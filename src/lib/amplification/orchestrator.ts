import type {
  AmplificationArtifacts,
  AmplificationEngine,
  CostOptimizationResult,
  EngineContext,
  EngineResult,
  InstructionResult,
  IntentResult,
  OrchestrationResult,
  PlanResult,
  QualityResult,
  RefinementResult,
  StrategyResult,
  ToolCallResult,
  ToolSpec,
  VerificationResult,
  ContextResult,
  RetrievalResult,
  ExecutionState,
} from './types';
import { AmplificationRuntime, isUuid } from './runtime';
import { e01IntentEngine } from './engines/e01-intent';
import { e02PlanningEngine } from './engines/e02-planning';
import { e03ContextEngine } from './engines/e03-context';
import { e04RetrievalEngine } from './engines/e04-retrieval';
import { e05StrategyEngine } from './engines/e05-strategy';
import { e06InstructionEngine } from './engines/e06-instruction';
import { e07OrchestrationEngine } from './engines/e07-orchestration';
import { e08ToolsEngine } from './engines/e08-tools';
import { e09RefinementEngine } from './engines/e09-refinement';
import { e10VerificationEngine } from './engines/e10-verification';
import { e11QualityEngine } from './engines/e11-quality';
import { e12CostEngine } from './engines/e12-cost';
import { streamGatewayCall, GatewayMessage } from '@/lib/providers/gateway';
import type { ProviderType } from '@/lib/providers/registry';
import { calculateProviderCost } from '@/lib/providers/registry';
import { executeToolCall, parseToolDirectives } from './tools/executor';
import type { Message } from '@/types';

export type OrchestratorEvent =
  | { type: 'state'; state: string }
  | { type: 'engine_start'; engineId: string; name: string }
  | { type: 'engine_done'; engineId: string; success: boolean; durationMs: number }
  | { type: 'tool_call'; name: string; args: unknown }
  | { type: 'tool_result'; name: string; success: boolean; output: string }
  | { type: 'content'; content: string }
  | { type: 'content_replace'; content: string }
  | { type: 'artifacts'; artifacts: Partial<AmplificationArtifacts> }
  | { type: 'execution_ready'; executionId: string }
  | {
      type: 'done';
      executionId: string;
      usage: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
        providerCostUsd: number;
        dsrtCostUsd: number;
      };
      latencyMs: number;
      dsrtCostUsd: number;
      amplified: boolean;
      chosenProvider: string;
      chosenModel: string;
      fallbackUsed: boolean;
      qualityOverall: number | null;
      verificationPassed: boolean | null;
      finalContent: string;
    }
  | { type: 'error'; error: string };

export type RunAmplificationInput = {
  workspaceId: string;
  conversationId: string;
  userId: string;
  userMessage: string;
  history: Message[];
  provider: ProviderType;
  model: string;
  apiKey: string;
  executionId?: string;
  amplify?: boolean;
  externalLifecycle?: boolean;
};

function buildHistoryMessages(history: Message[]): GatewayMessage[] {
  return history
    .slice(-12)
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));
}

function addOverhead(overhead: { tokens: number }, result: EngineResult): void {
  overhead.tokens += (result.tokens_prompt || 0) + (result.tokens_completion || 0);
}

export async function* runAmplification(
  input: RunAmplificationInput
): AsyncGenerator<OrchestratorEvent> {
  const wallStart = Date.now();
  const overhead = { tokens: 0 };
  const runtime = new AmplificationRuntime();
  const externalLifecycle = Boolean(input.externalLifecycle);
  const amplify = input.amplify !== false;

  let executionId = input.executionId && isUuid(input.executionId) ? input.executionId : '';

  if (!executionId && !externalLifecycle) {
    try {
      executionId = await runtime.initialize({
        conversationId: input.conversationId,
        workspaceId: input.workspaceId,
        userId: input.userId,
        mode: 'work',
        provider: input.provider,
        model: input.model,
        userPrompt: input.userMessage,
        status: 'CREATED',
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create execution';
      console.error('[orchestrator] initialize failed:', message);
      yield { type: 'error', error: message };
      return;
    }
  } else if (!executionId && externalLifecycle) {
    yield {
      type: 'error',
      error: 'externalLifecycle requires a real UUID executionId from AmplificationRuntime.initialize',
    };
    return;
  }

  yield { type: 'execution_ready', executionId };

  const artifacts: AmplificationArtifacts = {};

  const baseCtx = (provider?: ProviderType, model?: string): EngineContext => ({
    executionId,
    conversationId: input.conversationId,
    workspaceId: input.workspaceId,
    userId: input.userId,
    history: input.history,
    provider: provider ?? input.provider,
    model: model ?? input.model,
    apiKey: input.apiKey,
    userMessage: input.userMessage,
    artifacts,
  });

  async function setState(state: ExecutionState): Promise<OrchestratorEvent> {
    if (!externalLifecycle) {
      try {
        await runtime.updateState(executionId, state);
      } catch (err) {
        console.error('[orchestrator] updateState failed', err);
      }
    }
    return { type: 'state', state };
  }

  async function* runEng<T>(
    engine: AmplificationEngine<T>,
    ctx: EngineContext
  ): AsyncGenerator<OrchestratorEvent, EngineResult<T>> {
    yield { type: 'engine_start', engineId: engine.id, name: engine.name };
    const result = await engine.execute(ctx);
    addOverhead(overhead, result);
    yield {
      type: 'engine_done',
      engineId: engine.id,
      success: result.success,
      durationMs: result.latency_ms,
    };
    try {
      await runtime.logEngineRun({
        executionId,
        engineId: engine.id,
        engineName: engine.name,
        durationMs: result.latency_ms,
        promptTokens: result.tokens_prompt,
        completionTokens: result.tokens_completion,
        status: result.success ? 'SUCCESS' : 'FAILED',
        outputSummary: result.success
          ? (typeof result.raw_output === 'string' ? result.raw_output.slice(0, 500) : undefined)
          : undefined,
        errorMessage: result.error,
      });
    } catch (err) {
      console.error('[orchestrator] logEngineRun failed', err);
    }
    return result;
  }

  try {
    if (!amplify) {
      yield await setState('MODEL_EXECUTION');
      let promptTokens = 0;
      let completionTokens = 0;
      let accumulated = '';
      let streamError: string | null = null;

      try {
        const stream = streamGatewayCall({
          provider: input.provider,
          model: input.model,
          apiKey: input.apiKey,
          messages: [
            ...buildHistoryMessages(input.history),
            { role: 'user', content: input.userMessage },
          ],
          temperature: 0.7,
          maxTokens: 4096,
        });

        for await (const chunk of stream) {
          if (chunk.type === 'content' && chunk.content) {
            accumulated += chunk.content;
            yield { type: 'content', content: chunk.content };
          } else if (chunk.type === 'done' && chunk.usage) {
            promptTokens = chunk.usage.promptTokens ?? 0;
            completionTokens = chunk.usage.completionTokens ?? 0;
          } else if (chunk.type === 'error') {
            streamError = chunk.error || 'Provider stream error';
          }
        }
      } catch (err: unknown) {
        streamError = err instanceof Error ? err.message : 'Provider call failed';
      }

      if (streamError || !accumulated.trim()) {
        yield { type: 'error', error: streamError || 'Empty direct response' };
        if (!externalLifecycle) {
          await runtime.finalize(executionId, {
            status: 'FAILED',
            errorMessage: streamError || 'Empty direct response',
            latencyMs: Date.now() - wallStart,
          });
        }
        return;
      }

      const providerCostUsd = calculateProviderCost(input.model, promptTokens, completionTokens);
      const latencyMs = Date.now() - wallStart;

      if (!externalLifecycle) {
        await runtime.finalize(executionId, {
          status: 'COMPLETED',
          amplifiedResponse: accumulated,
          promptTokens,
          completionTokens,
          providerCostUsd,
          dsrtCostUsd: 0,
          latencyMs,
          provider: input.provider,
          model: input.model,
        });
      }

      yield await setState('COMPLETED');
      yield {
        type: 'done',
        executionId,
        usage: {
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
          providerCostUsd,
          dsrtCostUsd: 0,
        },
        latencyMs,
        dsrtCostUsd: 0,
        amplified: false,
        chosenProvider: input.provider,
        chosenModel: input.model,
        fallbackUsed: false,
        qualityOverall: null,
        verificationPassed: null,
        finalContent: accumulated,
      };
      return;
    }

    // ── E01 Intent ──
    yield await setState('UNDERSTANDING');
    {
      const gen = runEng(e01IntentEngine, baseCtx());
      let step = await gen.next();
      while (!step.done) {
        yield step.value;
        step = await gen.next();
      }
      const r = step.value;
      if (r.success && r.data) artifacts.intent = r.data as IntentResult;
    }

    // ── E02 Planning ──
    yield await setState('PLANNING');
    {
      const gen = runEng(e02PlanningEngine, baseCtx());
      let step = await gen.next();
      while (!step.done) {
        yield step.value;
        step = await gen.next();
      }
      const r = step.value;
      if (r.success && r.data) artifacts.plan = r.data as PlanResult;
    }

    // ── E03 Context ──
    yield await setState('PREPARING_CONTEXT');
    {
      const gen = runEng(e03ContextEngine, baseCtx());
      let step = await gen.next();
      while (!step.done) {
        yield step.value;
        step = await gen.next();
      }
      const r = step.value;
      if (r.success && r.data) artifacts.context = r.data as ContextResult;
    }

    // ── E04 Retrieval ──
    yield await setState('RETRIEVING');
    {
      const gen = runEng(e04RetrievalEngine, baseCtx());
      let step = await gen.next();
      while (!step.done) {
        yield step.value;
        step = await gen.next();
      }
      const r = step.value;
      if (r.success && r.data) artifacts.retrieval = r.data as RetrievalResult;
    }

    // ── E05 Strategy ──
    yield await setState('STRATEGY_SELECTION');
    {
      const gen = runEng(e05StrategyEngine, baseCtx());
      let step = await gen.next();
      while (!step.done) {
        yield step.value;
        step = await gen.next();
      }
      const r = step.value;
      if (r.success && r.data) artifacts.strategy = r.data as StrategyResult;
    }

    // ── E06 Instruction ──
    yield await setState('INSTRUCTION_SYNTHESIS');
    {
      const gen = runEng(e06InstructionEngine, baseCtx());
      let step = await gen.next();
      while (!step.done) {
        yield step.value;
        step = await gen.next();
      }
      const r = step.value;
      if (r.success && r.data) artifacts.instruction = r.data as InstructionResult;
    }

    // ── E07 Orchestration ──
    {
      const gen = runEng(e07OrchestrationEngine, baseCtx());
      let step = await gen.next();
      while (!step.done) {
        yield step.value;
        step = await gen.next();
      }
      const r = step.value;
      if (r.success && r.data) artifacts.orchestration = r.data as OrchestrationResult;
    }

    // ── E08 Tools ──
    let toolSpecs: ToolSpec[] = [];
    {
      const gen = runEng(e08ToolsEngine, baseCtx());
      let step = await gen.next();
      while (!step.done) {
        yield step.value;
        step = await gen.next();
      }
      const r = step.value;
      if (r.success && r.data) {
        toolSpecs = Array.isArray(r.data)
          ? (r.data as ToolSpec[])
          : ((r.data as { tools?: ToolSpec[] }).tools ?? []);
      }
    }

    const strategy = artifacts.strategy;
    const instruction = artifacts.instruction;

    // STRICT BYOK LOCK: Provider & Model remain strictly locked to user input
    const activeProvider = input.provider;
    const activeModel = input.model;
    const fallbackUsed = false;
    const apiKey = input.apiKey;

    const systemPrompt =
      instruction?.system_prompt ||
      'You are a helpful assistant inside DSRT Open Arena.';

    const contextBlock = artifacts.context
      ? `\n\n[Conversation context]\n${artifacts.context.summary}${
          artifacts.context.key_facts?.length
            ? `\nKey facts:\n- ${artifacts.context.key_facts.join('\n- ')}`
            : ''
        }`
      : '';

    const retrievalBlock =
      artifacts.retrieval?.snippets?.length
        ? `\n\n[Retrieved context]\n${artifacts.retrieval.snippets
            .map((s) => `(${s.source}, rel=${s.relevance}): ${s.content}`)
            .join('\n---\n')}`
        : '';

    const toolHint =
      toolSpecs.length > 0
        ? `\n\nYou may invoke available tools by emitting a fenced code block:
\`\`\`tool
{"name":"tool_name","args":{...}}
\`\`\`
Available tools:\n${toolSpecs.map((t) => `- ${t.name}: ${t.description}`).join('\n')}`
        : '';

    const addon = artifacts.system_prompt_addon ? `\n${artifacts.system_prompt_addon}` : '';

    const messages: GatewayMessage[] = [
      { role: 'system', content: systemPrompt + addon + toolHint },
      ...buildHistoryMessages(input.history),
      {
        role: 'user',
        content: `${instruction?.user_instruction || input.userMessage}${contextBlock}${retrievalBlock}`,
      },
    ];

    // ── Primary model execution loop ──
    yield await setState('MODEL_EXECUTION');

    let promptTokens = 0;
    let completionTokens = 0;
    let accumulated = '';
    let streamError: string | null = null;
    const allToolResults: ToolCallResult[] = [];

    const MAX_TOOL_STEPS = 5;
    let currentStep = 0;

    while (currentStep < MAX_TOOL_STEPS) {
      currentStep++;
      accumulated = '';

      async function* attemptStream(
        provider: ProviderType,
        model: string
      ): AsyncGenerator<OrchestratorEvent, boolean> {
        try {
          const stream = streamGatewayCall({
            provider,
            model,
            apiKey,
            messages,
            temperature: strategy?.temperature,
            maxTokens: strategy?.max_tokens,
          });

          for await (const chunk of stream) {
            const c = chunk as {
              type?: string;
              content?: string;
              error?: string;
              usage?: { promptTokens?: number; completionTokens?: number };
            };
            if (c.type === 'content' && c.content) {
              accumulated += c.content;
              yield { type: 'content', content: c.content };
            } else if (c.type === 'done' && c.usage) {
              promptTokens += c.usage.promptTokens ?? 0;
              completionTokens += c.usage.completionTokens ?? 0;
            } else if (c.type === 'error') {
              streamError = c.error || 'Provider stream error';
              return false;
            }
          }
          return true;
        } catch (err: unknown) {
          streamError = err instanceof Error ? err.message : 'Provider call failed';
          return false;
        }
      }

      let ok = false;
      {
        const gen = attemptStream(activeProvider, activeModel);
        let step = await gen.next();
        while (!step.done) {
          yield step.value;
          step = await gen.next();
        }
        ok = Boolean(step.value);
      }

      if (!ok) {
        // 🚨 FIX: Removed FALLBACK_CHAIN logic.
        // We must NEVER silently switch the user's model in War Mode or anywhere else.
        // Fail honestly with the real provider error.
        const errMsg = streamError || 'Model execution failed with empty response';
        console.error(`[orchestrator] Model execution failed using ${activeProvider}/${activeModel}: ${errMsg}`);
        yield { type: 'error', error: errMsg };
        if (!externalLifecycle) {
          await runtime.finalize(executionId, {
            status: 'FAILED',
            errorMessage: errMsg,
            latencyMs: Date.now() - wallStart,
            artifactsJson: artifacts,
          });
        }
        return;
      }

      if (!accumulated) {
        const errMsg = streamError || 'Model execution returned empty content';
        yield { type: 'error', error: errMsg };
        if (!externalLifecycle) {
          await runtime.finalize(executionId, {
            status: 'FAILED',
            errorMessage: errMsg,
            latencyMs: Date.now() - wallStart,
            artifactsJson: artifacts,
          });
        }
        return;
      }

      const toolCalls = parseToolDirectives(accumulated);

      if (toolCalls.length === 0 || toolSpecs.length === 0) {
        break;
      }

      yield await setState('TOOL_EXECUTION');
      const toolContext = {
        workspaceId: input.workspaceId,
        userId: input.userId,
        conversationId: input.conversationId,
        apiKey: input.apiKey,
        provider: activeProvider,
        model: activeModel,
      };

      for (const call of toolCalls) {
        yield { type: 'tool_call', name: call.name, args: call.args };
        const result = await executeToolCall(call, toolContext);
        allToolResults.push(result);

        yield {
          type: 'tool_result',
          name: result.name,
          success: result.success,
          output: result.success ? result.output : result.error || 'Tool failed',
        };
      }

      artifacts.tool_calls = allToolResults;

      const toolPayload = allToolResults
        .slice(-toolCalls.length)
        .map(
          (t) =>
            `Tool "${t.name}" (${t.success ? 'Success' : 'Error'}):\n${
              t.success ? t.output : t.error
            }`
        )
        .join('\n\n');

      messages.push({ role: 'assistant', content: accumulated });
      messages.push({
        role: 'user',
        content: `Tool Execution Results:\n\n${toolPayload}\n\nIncorporate these tool results to provide the user's final answer. Do not emit tool directives unless further action is strictly required.`,
      });
    }

    artifacts.draft_content = accumulated;

    // ── E09 Refinement ──
    yield await setState('REFINEMENT');
    {
      const gen = runEng(e09RefinementEngine, baseCtx(activeProvider, activeModel));
      let step = await gen.next();
      while (!step.done) {
        yield step.value;
        step = await gen.next();
      }
      const r = step.value;
      const refinement = r.data as RefinementResult | undefined;
      if (refinement) {
        artifacts.refinement = refinement;
        if (refinement.refinement_applied && refinement.refined_content?.trim()) {
          accumulated = refinement.refined_content;
          yield { type: 'content_replace', content: accumulated };
        }
      }
    }

    artifacts.final_content = accumulated;

    // ── E10 Verification ──
    yield await setState('VERIFICATION');
    {
      const gen = runEng(e10VerificationEngine, baseCtx(activeProvider, activeModel));
      let step = await gen.next();
      while (!step.done) {
        yield step.value;
        step = await gen.next();
      }
      const r = step.value;
      if (r.data) artifacts.verification = r.data as VerificationResult;
    }

    // Repair pass if verification fails
    if (
      artifacts.verification &&
      !artifacts.verification.passed &&
      artifacts.verification.issues.length > 0 &&
      accumulated.length > 80
    ) {
      try {
        const repairMessages: GatewayMessage[] = [
          {
            role: 'system',
            content:
              systemPrompt +
              '\nYou must revise the answer to satisfy failed verification checks. Return the full improved answer only.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              original_request: input.userMessage,
              previous_answer: accumulated,
              failed_checks: artifacts.verification.checks.filter((c) => !c.met),
              issues: artifacts.verification.issues,
            }),
          },
        ];
        let repaired = '';
        const repairStream = streamGatewayCall({
          provider: activeProvider,
          model: activeModel,
          apiKey,
          messages: repairMessages,
          temperature: 0.3,
          maxTokens: strategy?.max_tokens,
        });
        for await (const chunk of repairStream) {
          const c = chunk as {
            type?: string;
            content?: string;
            usage?: { promptTokens?: number; completionTokens?: number };
          };
          if (c.type === 'content' && c.content) repaired += c.content;
          else if (c.type === 'done' && c.usage) {
            promptTokens += c.usage.promptTokens ?? 0;
            completionTokens += c.usage.completionTokens ?? 0;
          }
        }
        if (repaired.trim().length > 40) {
          accumulated = repaired.trim();
          artifacts.final_content = accumulated;
          yield { type: 'content_replace', content: accumulated };
        }
      } catch {
        /* soft-fail repair */
      }
    }

    // ── E11 Quality ──
    yield await setState('EVALUATION');
    {
      const gen = runEng(e11QualityEngine, baseCtx(activeProvider, activeModel));
      let step = await gen.next();
      while (!step.done) {
        yield step.value;
        step = await gen.next();
      }
      const r = step.value;
      if (r.data) artifacts.quality = r.data as QualityResult;
    }

    // ── E12 Cost ──
    yield await setState('OPTIMIZATION');
    const latencyMs = Date.now() - wallStart;
    {
      const costCtx: EngineContext = {
        ...baseCtx(activeProvider, activeModel),
        metrics: {
          promptTokens,
          completionTokens,
          engineOverheadTokens: overhead.tokens,
          latencyMs,
        },
      };
      const gen = runEng(e12CostEngine, costCtx);
      let step = await gen.next();
      while (!step.done) {
        yield step.value;
        step = await gen.next();
      }
      const r = step.value;
      if (r.data) artifacts.cost = r.data as CostOptimizationResult;
    }

    let providerCostUsd = 0;
    try {
      providerCostUsd = calculateProviderCost(activeModel, promptTokens, completionTokens);
    } catch {
      providerCostUsd = artifacts.cost?.provider_cost_usd ?? 0;
    }
    const dsrtCostUsd =
      artifacts.cost?.amplification_overhead_usd ??
      Number((0.005 + overhead.tokens * 0.000001).toFixed(6));

    if (artifacts.orchestration) {
      artifacts.orchestration = {
        ...artifacts.orchestration,
        chosen_provider: activeProvider,
        chosen_model: activeModel,
        fallback_used: fallbackUsed,
      };
    }

    yield { type: 'artifacts', artifacts };
    yield await setState('COMPLETED');

    if (!externalLifecycle) {
      await runtime.finalize(executionId, {
        status: 'COMPLETED',
        amplifiedResponse: accumulated,
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        providerCostUsd,
        dsrtCostUsd,
        latencyMs,
        amplifiedScore: artifacts.quality?.overall ?? null,
        provider: activeProvider,
        model: activeModel,
        artifactsJson: artifacts,
      });
    }

    yield {
      type: 'done',
      executionId,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        providerCostUsd,
        dsrtCostUsd,
      },
      latencyMs,
      dsrtCostUsd,
      amplified: true,
      chosenProvider: activeProvider,
      chosenModel: activeModel,
      fallbackUsed,
      qualityOverall: artifacts.quality?.overall ?? null,
      verificationPassed: artifacts.verification?.passed ?? null,
      finalContent: accumulated,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Amplification failed';
    yield { type: 'error', error: message };
    try {
      if (!externalLifecycle && isUuid(executionId)) {
        await runtime.finalize(executionId, {
          status: 'FAILED',
          errorMessage: message,
          latencyMs: Date.now() - wallStart,
        });
      } else if (isUuid(executionId)) {
        await runtime.updateState(executionId, 'FAILED');
      }
    } catch (e) {
      console.error('[orchestrator] failure finalize error', e);
    }
  }
}