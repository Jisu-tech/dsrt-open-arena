/**
 * War Mode Comparator — DSRT Open Arena Phase 8
 *
 * Parallel raw + amplified paired execution.
 *
 * CRITICAL FAIR-PLAY RULES:
 * - Same provider, same model, same user prompt on both sides
 * - RAW path: separate code path via streamGatewayCall ONLY
 *   → ZERO engines, ZERO amplification, ZERO DSRT overhead hooks
 * - AMPLIFIED path: full runAmplification (12 engines)
 * - Not a boolean flag on one pipeline — two distinct paths
 * - One-side failure does not abort the other
 * - Events interleaved as each side produces them (true parallel)
 */

import {
  streamGatewayCall,
  type GatewayMessage,
} from '@/lib/providers/gateway';
import { calculateProviderCost, type ProviderType } from '@/lib/providers/registry';
import {
  runAmplification,
  type OrchestratorEvent,
} from '@/lib/amplification/orchestrator';
import type { AmplificationArtifacts } from '@/lib/amplification/types';
import type { Message } from '@/types';
import {
  evaluatePair,
  attachRunMetrics,
  buildEvaluationRubricPayload,
  type RubricEvaluation,
} from './evaluator';
import type { ComparisonMetricsResult, SideUsage } from './metrics';

export type WarComparatorEvent =
  | { type: 'state'; state: string }
  | { type: 'fair_play'; provider: string; model: string; message: string }
  | { type: 'raw_content'; content: string }
  | { type: 'amplified_content'; content: string }
  | { type: 'amplified_content_replace'; content: string }
  | {
      type: 'engine_start';
      engineId: string;
      name: string;
    }
  | {
      type: 'engine_done';
      engineId: string;
      success: boolean;
      durationMs: number;
    }
  | { type: 'tool_call'; name: string; args: unknown }
  | { type: 'tool_result'; name: string; success: boolean; output: string }
  | { type: 'artifacts'; artifacts: Partial<AmplificationArtifacts> }
  | {
      type: 'raw_done';
      content: string;
      usage: SideUsage;
      error?: string;
    }
  | {
      type: 'amplified_done';
      content: string;
      usage: SideUsage;
      chosenProvider: string;
      chosenModel: string;
      fallbackUsed: boolean;
      qualityOverall: number | null;
      verificationPassed: boolean | null;
      error?: string;
    }
  | { type: 'evaluation_start'; evaluatorModel: string }
  | {
      type: 'evaluation_done';
      evaluation: RubricEvaluation;
      metrics: ComparisonMetricsResult;
      rubricPayload: ReturnType<typeof buildEvaluationRubricPayload>;
    }
  | {
      type: 'done';
      rawContent: string;
      amplifiedContent: string;
      rawUsage: SideUsage;
      amplifiedUsage: SideUsage;
      metrics: ComparisonMetricsResult | null;
      evaluation: RubricEvaluation | null;
      rawFailed: boolean;
      amplifiedFailed: boolean;
      evaluationFailed: boolean;
      totalLatencyMs: number;
    }
  | { type: 'error'; error: string; side?: 'raw' | 'amplified' | 'evaluation' | 'system' };

export type RunWarComparisonInput = {
  workspaceId: string;
  conversationId: string;
  userId: string;
  userMessage: string;
  history: Message[];
  provider: ProviderType;
  model: string;
  apiKey: string;
  executionId?: string;
  /** Judge — defaults openai/gpt-4o; may use same apiKey if provider matches */
  evaluatorProvider?: ProviderType;
  evaluatorModel?: string;
  evaluatorApiKey?: string;
  /** Skip judge (pair-only). Default false. */
  skipEvaluation?: boolean;
};

type AsyncQueue<T> = {
  push: (item: T | null) => void;
  end: (err?: Error) => void;
  [Symbol.asyncIterator]: () => AsyncIterator<T>;
};

function createAsyncQueue<T>(): AsyncQueue<T> {
  const items: Array<T | null> = [];
  let done = false;
  let error: Error | null = null;
  let wake: (() => void) | null = null;

  const signal = () => {
    if (wake) {
      const w = wake;
      wake = null;
      w();
    }
  };

  return {
    push(item: T | null) {
      if (done) return;
      items.push(item);
      signal();
    },
    end(err?: Error) {
      if (done) return;
      if (err) error = err;
      done = true;
      signal();
    },
    async *[Symbol.asyncIterator](): AsyncIterator<T> {
      while (true) {
        if (items.length > 0) {
          const next = items.shift() as T | null;
          if (next === null && done && items.length === 0) return;
          if (next !== null) yield next;
          continue;
        }
        if (error) throw error;
        if (done) return;
        await new Promise<void>((resolve) => {
          wake = resolve;
        });
      }
    },
  };
}

function emptyUsage(): SideUsage {
  return {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    providerCostUsd: 0,
    dsrtCostUsd: 0,
    latencyMs: 0,
  };
}

/**
 * RAW PATH — intentionally minimal.
 * No orchestrator, no engines, no retrieval, no refinement.
 * Identical model + provider as amplified side for fair play.
 */
async function* runRawPath(input: {
  provider: ProviderType;
  model: string;
  apiKey: string;
  userMessage: string;
  history: Message[];
}): AsyncGenerator<WarComparatorEvent, { content: string; usage: SideUsage; failed: boolean }> {
  const start = Date.now();
  let content = '';
  let promptTokens = 0;
  let completionTokens = 0;
  let failed = false;
  let errorMsg: string | undefined;

  const historySlice = input.history
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(-12)
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

  const messages: GatewayMessage[] = [
    {
      role: 'system',
      content: 'You are a helpful assistant. Answer the user directly and clearly.',
    },
    ...historySlice,
    { role: 'user', content: input.userMessage },
  ];

  try {
    const stream = streamGatewayCall({
      provider: input.provider,
      model: input.model,
      apiKey: input.apiKey,
      messages,
      temperature: 0.7,
      maxTokens: 4096,
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content' && chunk.content) {
        content += chunk.content;
        yield { type: 'raw_content', content: chunk.content };
      } else if (chunk.type === 'done' && chunk.usage) {
        promptTokens = chunk.usage.promptTokens ?? 0;
        completionTokens = chunk.usage.completionTokens ?? 0;
      } else if (chunk.type === 'error') {
        failed = true;
        errorMsg = chunk.error || 'Raw provider stream error';
      }
    }
  } catch (err: unknown) {
    failed = true;
    errorMsg = err instanceof Error ? err.message : 'Raw path failed';
  }

  if (!content.trim() && !failed) {
    failed = true;
    errorMsg = errorMsg || 'Raw path returned empty response';
  }

  const latencyMs = Date.now() - start;
  let providerCostUsd = 0;
  try {
    providerCostUsd = calculateProviderCost(input.model, promptTokens, completionTokens);
  } catch {
    providerCostUsd = 0;
  }

  const usage: SideUsage = {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    providerCostUsd,
    dsrtCostUsd: 0,
    latencyMs,
  };

  yield {
    type: 'raw_done',
    content,
    usage,
    error: failed ? errorMsg : undefined,
  };

  return { content, usage, failed };
}

/**
 * AMPLIFIED PATH — full 12-engine pipeline via runAmplification.
 */
async function* runAmplifiedPath(input: {
  workspaceId: string;
  conversationId: string;
  userId: string;
  userMessage: string;
  history: Message[];
  provider: ProviderType;
  model: string;
  apiKey: string;
  executionId?: string;
}): AsyncGenerator<
  WarComparatorEvent,
  {
    content: string;
    usage: SideUsage;
    failed: boolean;
    chosenProvider: string;
    chosenModel: string;
    fallbackUsed: boolean;
    qualityOverall: number | null;
    verificationPassed: boolean | null;
  }
> {
  let content = '';
  let usage = emptyUsage();
  let failed = false;
  let chosenProvider = input.provider as string;
  let chosenModel = input.model as string;
  let fallbackUsed = false;
  let qualityOverall: number | null = null;
  let verificationPassed: boolean | null = null;
  let errorMsg: string | undefined;

  try {
    const gen = runAmplification({
      workspaceId: input.workspaceId,
      conversationId: input.conversationId,
      userId: input.userId,
      userMessage: input.userMessage,
      history: input.history,
      provider: input.provider,
      model: input.model,
      apiKey: input.apiKey,
      executionId: input.executionId,
      amplify: true,
    });

    for await (const event of gen) {
      const e = event as OrchestratorEvent;
      switch (e.type) {
        case 'state':
          yield { type: 'state', state: `AMP_${e.state}` };
          break;
        case 'engine_start':
          yield { type: 'engine_start', engineId: e.engineId, name: e.name };
          break;
        case 'engine_done':
          yield {
            type: 'engine_done',
            engineId: e.engineId,
            success: e.success,
            durationMs: e.durationMs,
          };
          break;
        case 'tool_call':
          yield { type: 'tool_call', name: e.name, args: e.args };
          break;
        case 'tool_result':
          yield {
            type: 'tool_result',
            name: e.name,
            success: e.success,
            output: e.output,
          };
          break;
        case 'content':
          content += e.content;
          yield { type: 'amplified_content', content: e.content };
          break;
        case 'content_replace':
          content = e.content;
          yield { type: 'amplified_content_replace', content: e.content };
          break;
        case 'artifacts':
          yield { type: 'artifacts', artifacts: e.artifacts };
          break;
        case 'done':
          usage = {
            promptTokens: e.usage.promptTokens,
            completionTokens: e.usage.completionTokens,
            totalTokens: e.usage.totalTokens,
            providerCostUsd: e.usage.providerCostUsd,
            dsrtCostUsd: e.dsrtCostUsd ?? e.usage.dsrtCostUsd ?? 0,
            latencyMs: e.latencyMs,
          };
          chosenProvider = e.chosenProvider || input.provider;
          chosenModel = e.chosenModel || input.model;
          fallbackUsed = Boolean(e.fallbackUsed);
          qualityOverall = e.qualityOverall;
          verificationPassed = e.verificationPassed;
          break;
        case 'error':
          failed = true;
          errorMsg = e.error;
          yield { type: 'error', error: e.error, side: 'amplified' };
          break;
        default:
          break;
      }
    }
  } catch (err: unknown) {
    failed = true;
    errorMsg = err instanceof Error ? err.message : 'Amplified path failed';
    yield { type: 'error', error: errorMsg, side: 'amplified' };
  }

  if (!content.trim() && !failed) {
    failed = true;
    errorMsg = errorMsg || 'Amplified path returned empty response';
  }

  yield {
    type: 'amplified_done',
    content,
    usage,
    chosenProvider,
    chosenModel,
    fallbackUsed,
    qualityOverall,
    verificationPassed,
    error: failed ? errorMsg : undefined,
  };

  return {
    content,
    usage,
    failed,
    chosenProvider,
    chosenModel,
    fallbackUsed,
    qualityOverall,
    verificationPassed,
  };
}

/**
 * Parallel paired runner.
 * Starts raw + amplified concurrently, merges events through a queue,
 * then optionally runs rubric evaluation.
 */
export async function* runWarComparison(
  input: RunWarComparisonInput
): AsyncGenerator<WarComparatorEvent> {
  const wallStart = Date.now();
  const executionId = input.executionId || `war_${Date.now()}`;

  yield {
    type: 'fair_play',
    provider: input.provider,
    model: input.model,
    message: `Fair play: both sides use ${input.provider}/${input.model}. Raw path has zero DSRT amplification.`,
  };
  yield { type: 'state', state: 'PAIRED_EXECUTION' };

  const queue = createAsyncQueue<WarComparatorEvent>();

  let rawResult = {
    content: '',
    usage: emptyUsage(),
    failed: true as boolean,
  };
  
  let ampResult: {
    content: string;
    usage: SideUsage;
    failed: boolean;
    chosenProvider: string;
    chosenModel: string;
    fallbackUsed: boolean;
    qualityOverall: number | null;
    verificationPassed: boolean | null;
  } = {
    content: '',
    usage: emptyUsage(),
    failed: true,
    chosenProvider: input.provider,
    chosenModel: input.model,
    fallbackUsed: false,
    qualityOverall: null,
    verificationPassed: null,
  };

  const rawPromise = (async () => {
    try {
      const gen = runRawPath({
        provider: input.provider,
        model: input.model,
        apiKey: input.apiKey,
        userMessage: input.userMessage,
        history: input.history,
      });
      let step = await gen.next();
      while (!step.done) {
        queue.push(step.value);
        step = await gen.next();
      }
      rawResult = step.value;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Raw path crashed';
      queue.push({ type: 'error', error: message, side: 'raw' });
      rawResult = { content: '', usage: emptyUsage(), failed: true };
    }
  })();

  const ampPromise = (async () => {
    try {
      const gen = runAmplifiedPath({
        workspaceId: input.workspaceId,
        conversationId: input.conversationId,
        userId: input.userId,
        userMessage: input.userMessage,
        history: input.history,
        provider: input.provider,
        model: input.model,
        apiKey: input.apiKey,
        executionId,
      });
      let step = await gen.next();
      while (!step.done) {
        queue.push(step.value);
        step = await gen.next();
      }
      ampResult = step.value;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Amplified path crashed';
      queue.push({ type: 'error', error: message, side: 'amplified' });
      ampResult = {
        content: '',
        usage: emptyUsage(),
        failed: true,
        chosenProvider: input.provider,
        chosenModel: input.model,
        fallbackUsed: false,
        qualityOverall: null,
        verificationPassed: null,
      };
    }
  })();

  const merger = Promise.all([rawPromise, ampPromise]).then(() => {
    queue.end();
  });

  for await (const event of queue) {
    yield event;
  }

  await merger;

  let evaluation: RubricEvaluation | null = null;
  let metrics: ComparisonMetricsResult | null = null;
  let evaluationFailed = false;

  const bothEmpty = !rawResult.content.trim() && !ampResult.content.trim();

  if (!input.skipEvaluation && !bothEmpty) {
    yield { type: 'state', state: 'EVALUATION' };
    const evaluatorModel = input.evaluatorModel ?? 'gpt-4o';
    const evaluatorProvider: ProviderType = input.evaluatorProvider ?? 'openai';
    yield { type: 'evaluation_start', evaluatorModel };

    const judgeKey = input.evaluatorApiKey || input.apiKey;

    const evalResult = await evaluatePair({
      userPrompt: input.userMessage,
      directResponse: rawResult.content,
      amplifiedResponse: ampResult.content,
      apiKey: judgeKey,
      evaluatorProvider,
      evaluatorModel,
    });

    if (evalResult.success && evalResult.evaluation) {
      evaluation = evalResult.evaluation;
      metrics = attachRunMetrics(evaluation, rawResult.usage, ampResult.usage);
      yield {
        type: 'evaluation_done',
        evaluation,
        metrics,
        rubricPayload: buildEvaluationRubricPayload(evaluation),
      };
    } else {
      evaluationFailed = true;
      // Still emit cost/latency metrics without quality scores
      metrics = attachRunMetrics(
        {
          dimensions: [],
          direct_overall: 0,
          amplified_overall: 0,
          reasoning: evalResult.error || 'Evaluation failed',
          preferred_side: 'tie',
          evaluator_model: evaluatorModel,
          evaluator_provider: evaluatorProvider,
          promptTokens: 0,
          completionTokens: 0,
          providerCostUsd: 0,
          latencyMs: 0,
        },
        rawResult.usage,
        ampResult.usage
      );
      // Null out scores so UI shows Unavailable rather than zeros pretending to be real
      metrics = {
        ...metrics,
        directScore: null,
        amplifiedScore: null,
        qualityDeltaPct: null,
        winningSide: 'unknown',
        dimensions: [],
        confidenceInterval: null,
      };
      yield {
        type: 'error',
        error: evalResult.error || 'Evaluation failed',
        side: 'evaluation',
      };
    }
  } else if (bothEmpty) {
    evaluationFailed = true;
    yield {
      type: 'error',
      error: 'Both sides failed — nothing to evaluate',
      side: 'system',
    };
  }

  yield { type: 'state', state: 'COMPLETED' };

  yield {
    type: 'done',
    rawContent: rawResult.content,
    amplifiedContent: ampResult.content,
    rawUsage: rawResult.usage,
    amplifiedUsage: ampResult.usage,
    metrics,
    evaluation,
    rawFailed: rawResult.failed,
    amplifiedFailed: ampResult.failed,
    evaluationFailed,
    totalLatencyMs: Date.now() - wallStart,
  };
}