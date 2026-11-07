/**
 * TaskController — Phase-1 orchestration:
 *   create task → PTIS decide → budget gate → V3 gateway invoke → finalize
 *
 * Dual-write friendly: does not disable legacy executions.
 * Every path leaves an auditable decision + invocation record.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { V3Provider } from '../contracts/registry';
import { TaskRepository } from '../repositories/task.repository';
import { InvocationRepository } from '../repositories/invocation.repository';
import { PtisDecisionRepository } from '../repositories/ptis-decision.repository';
import { BudgetRepository } from '../repositories/budget.repository';
import { ErrorRepository } from '../repositories/error.repository';
import { ProviderRegistryRepository } from '../repositories/provider-registry.repository';
import { MetricsRepository } from '../repositories/metrics.repository';
import {
  DecisionEngine,
  type CandidateModel,
  type DecisionRequest,
  type ProfileInput,
  type ResponsibilityId,
} from '../ptis';
import { BudgetController } from '../ptis/budget-controller';
import { EconomicsEngine } from '../ptis/economics-engine';
import {
  executeWithV3Telemetry,
  type V3GatewayContext,
} from '../providers/gateway-wrapper';
import { InvocationRecorder } from '../providers/invocation-recorder';
import { RawExecutor, type ExecutionRequest, type LegacyGatewayCall } from './raw-executor';
import { assertTransition, type TaskStatus } from './state-machine';

export interface RunTaskInput {
  readonly workspaceId: string;
  readonly responsibility: ResponsibilityId;
  readonly profile: ProfileInput;
  readonly messages: ExecutionRequest['messages'];
  readonly apiKeyFor: (provider: V3Provider) => Promise<string | null>;
  readonly candidates: readonly CandidateModel[];
  readonly temperature?: number;
  readonly priority?: 'low' | 'normal' | 'high' | 'critical';
  readonly latencyWeight?: number;
  readonly metadata?: Record<string, unknown>;
  readonly signal?: AbortSignal;
}

export type RunTaskResult =
  | {
      readonly status: 'completed';
      readonly taskId: string;
      readonly provider: V3Provider;
      readonly providerModelId: string;
      readonly result: unknown;
      readonly predictedCostUsd: string | null;
      readonly reasoning: string;
    }
  | {
      readonly status: 'rejected' | 'failed';
      readonly taskId: string;
      readonly reason: string;
    };

export class TaskController {
  private readonly tasks: TaskRepository;
  private readonly decisions: PtisDecisionRepository;
  private readonly budgets: BudgetRepository;
  private readonly errors: ErrorRepository;
  private readonly registry: ProviderRegistryRepository;
  private readonly metrics: MetricsRepository;
  private readonly decisionEngine: DecisionEngine;
  private readonly recorder: InvocationRecorder;
  private readonly raw: RawExecutor;
  private status: TaskStatus = 'pending';

  constructor(
    private readonly supabase: SupabaseClient,
    legacyGatewayCall: LegacyGatewayCall,
  ) {
    this.tasks = new TaskRepository(supabase);
    this.decisions = new PtisDecisionRepository(supabase);
    this.budgets = new BudgetRepository(supabase);
    this.errors = new ErrorRepository(supabase);
    this.registry = new ProviderRegistryRepository(supabase);
    this.metrics = new MetricsRepository(supabase);

    const economics = new EconomicsEngine(supabase);
    const budgetController = new BudgetController(this.budgets);
    this.decisionEngine = new DecisionEngine(
      this.registry,
      this.decisions,
      budgetController,
      economics,
    );
    this.recorder = new InvocationRecorder(
      new InvocationRepository(supabase),
      this.budgets,
      this.errors,
    );
    this.raw = new RawExecutor(legacyGatewayCall);
  }

  async run(input: RunTaskInput): Promise<RunTaskResult> {
    const taskId = await this.tasks.createTask({
      workspaceId: input.workspaceId,
      responsibility: String(input.responsibility),
      priority: input.priority ?? 'normal',
      complexityScore: null,
      metadata: input.metadata ?? {},
    });

    try {
      // ── PENDING → DECIDING ──────────────────────────────────────────
      this.transition('deciding');
      await this.tasks.updateTaskStatus(taskId, 'in_progress');

      const decisionReq: DecisionRequest = {
        taskId,
        workspaceId: input.workspaceId,
        responsibility: input.responsibility,
        profile: input.profile,
        candidates: input.candidates,
        latencyWeight: input.latencyWeight,
      };
      const decision = await this.decisionEngine.decide(decisionReq);

      if (decision.status === 'rejected') {
        this.transition('rejected');
        await this.tasks.updateTaskStatus(taskId, 'failed', decision.reason);
        await this.metrics.recordEvent({
          workspaceId: input.workspaceId,
          taskId,
          eventType: 'budget_exhausted',
          metadata: { reason: decision.reason },
        });
        return { status: 'rejected', taskId, reason: decision.reason };
      }

      // ── DECIDING → INVOKING ─────────────────────────────────────────
      this.transition('invoking');

      const apiKey = await input.apiKeyFor(decision.provider);
      if (!apiKey) {
        const reason = `No BYOK credential for provider ${decision.provider}`;
        this.transition('failed');
        await this.tasks.updateTaskStatus(taskId, 'failed', reason);
        return { status: 'failed', taskId, reason };
      }

      const v3ctx: V3GatewayContext = {
        taskId,
        workspaceId: input.workspaceId,
        provider: decision.provider,
        providerModelId: decision.providerModelId,
        budgetId: decision.budgetId,
      };

      const execReq: ExecutionRequest = {
        provider: decision.provider,
        providerModelId: decision.providerModelId,
        messages: input.messages,
        temperature: input.temperature,
        maxTokens: input.profile.maxCompletionTokens ?? null,
        apiKey,
        signal: input.signal,
      };

      const rawResponse = await executeWithV3Telemetry(
        v3ctx,
        { registryRepo: this.registry, invocationRecorder: this.recorder },
        () => this.raw.execute(execReq),
      );

      // ── INVOKING → COMPLETED ────────────────────────────────────────
      this.transition('completed');
      await this.tasks.updateTaskStatus(taskId, 'completed');
      await this.metrics.recordEvent({
        workspaceId: input.workspaceId,
        taskId,
        eventType: 'ptis_optimization',
        metadata: {
          provider: decision.provider,
          model: decision.providerModelId,
          predictedCostUsd: decision.predictedCostUsd,
          reasoning: decision.reasoning,
        },
      });

      return {
        status: 'completed',
        taskId,
        provider: decision.provider,
        providerModelId: decision.providerModelId,
        result: rawResponse.result,
        predictedCostUsd: decision.predictedCostUsd,
        reasoning: decision.reasoning,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      try {
        if (this.status !== 'failed') this.transition('failed');
      } catch {
        /* already terminal */
      }
      await this.tasks.updateTaskStatus(taskId, 'failed', message);
      await this.errors.logSystemError({
        workspaceId: input.workspaceId,
        taskId,
        errorCategory: 'gateway_internal',
        severity: 'high',
        errorMessage: message,
        context: { responsibility: input.responsibility },
      });
      return { status: 'failed', taskId, reason: message };
    }
  }

  private transition(to: TaskStatus): void {
    assertTransition(this.status, to);
    this.status = to;
  }
}