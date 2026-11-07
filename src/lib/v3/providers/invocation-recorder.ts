import type { InvocationRepository, RecordInvocationDto } from '../repositories/invocation.repository';
import type { BudgetRepository } from '../repositories/budget.repository';
import type { ErrorRepository } from '../repositories/error.repository';
import type { NormalizedUsage } from './usage-normalizer';
import type { CalculatedCost } from './cost-calculator';

export interface GatewayInvocationContext {
  taskId: string;
  workspaceId: string;
  provider: string;
  providerModelId: string;
  budgetId?: string | null;
}

export interface InvocationMetrics {
  durationMs: number | null;
  timeToFirstTokenMs: number | null;
}

export class InvocationRecorder {
  constructor(
    private readonly invocationRepo: InvocationRepository,
    private readonly budgetRepo: BudgetRepository,
    private readonly errorRepo: ErrorRepository
  ) {}

  /**
   * Intelligently records a gateway invocation. Dual-writes to budget if applicable.
   * Traps internal errors so telemetry logging never crashes the user's application, 
   * but writes them explicitly to the error repository.
   */
  async record(
    context: GatewayInvocationContext,
    status: RecordInvocationDto['status'],
    usage: NormalizedUsage,
    cost: CalculatedCost,
    metrics: InvocationMetrics,
    errorPayload?: { errorMessage: string; requestFingerprint?: string }
  ): Promise<void> {
    try {
      const dto: RecordInvocationDto = {
        taskId: context.taskId,
        workspaceId: context.workspaceId,
        provider: context.provider,
        providerModelId: context.providerModelId,
        status,
        
        tokensInput: usage.tokensInput,
        tokensOutput: usage.tokensOutput,
        tokensReasoning: usage.tokensReasoning,
        tokensCached: usage.tokensCached,
        
        costUsd: cost.costUsd,
        measurementSource: cost.measurementSource, // Takes priority from cost component
        
        durationMs: metrics.durationMs,
        timeToFirstTokenMs: metrics.timeToFirstTokenMs,
        
        errorMessage: errorPayload?.errorMessage ?? null,
        requestFingerprint: errorPayload?.requestFingerprint ?? null,
      };

      // 1. Record the invocation
      await this.invocationRepo.recordInvocation(dto);

      // 2. Increment active budget if there is a real cost
      if (context.budgetId && cost.costUsd && parseFloat(cost.costUsd) > 0) {
        await this.budgetRepo.incrementSpend(context.budgetId, cost.costUsd);
      }

    } catch (err) {
      // Telemetry MUST NOT crash generation, but MUST be declared explicitly
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('[V3/InvocationRecorder] Failed to record telemetry', errorMessage);
      
      // Attempt safe write to error repository
      this.errorRepo.logSystemError({
        workspaceId: context.workspaceId,
        taskId: context.taskId,
        errorCategory: 'gateway_internal',
        severity: 'high',
        errorMessage: `Telemetry recording failure: ${errorMessage}`,
        provider: context.provider,
        providerModelId: context.providerModelId,
        context: {
          originalStatus: status,
          usage,
          cost
        }
      }).catch(e => console.error('[V3/ErrorFallback] Fatal error logging failed', e));
    }
  }
}