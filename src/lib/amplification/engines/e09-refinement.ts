import type { AmplificationEngine, EngineContext, EngineResult, RefinementResult } from '../types';
import { callLlmJson } from '../llmJson';

type RefineJson = {
  critique?: string;
  refined_content?: string;
  changes_made?: string[];
  refinement_applied?: boolean;
  improvement_confidence?: number;
};

function shouldRefine(ctx: EngineContext, draft: string): boolean {
  if (!draft || draft.trim().length < 40) return false;
  const strategy = ctx.artifacts.strategy;
  const intent = ctx.artifacts.intent;
  if (strategy?.verify_after) return true;
  if (strategy?.strategy === 'verify-first' || strategy?.strategy === 'stepwise') return true;
  if (intent?.complexity === 'high' || intent?.complexity === 'medium') return true;
  if (draft.length > 1200) return true;
  return false;
}

function okResult<T>(data: T, start: number, tokens = { p: 0, c: 0 }, error?: string): EngineResult<T> {
  return {
    success: true,
    data,
    tokens_prompt: tokens.p,
    tokens_completion: tokens.c,
    latency_ms: Date.now() - start,
    error,
  };
}

export const e09RefinementEngine: AmplificationEngine<RefinementResult> = {
  id: 'E09',
  name: 'Refinement',
  wave: 3,

  async execute(ctx: EngineContext): Promise<EngineResult<RefinementResult>> {
    const start = Date.now();
    const draft = (ctx.artifacts.draft_content ?? '').trim() ? String(ctx.artifacts.draft_content) : '';

    if (!draft.trim() || !shouldRefine(ctx, draft)) {
      return okResult(
        {
          refined_content: draft,
          critique: 'Refinement skipped or no content.',
          changes_made: [],
          refinement_applied: false,
          improvement_confidence: 0,
        },
        start
      );
    }

    const intent = ctx.artifacts.intent;
    const successCriteria = intent?.success_criteria?.length
      ? intent.success_criteria.map((c, i) => `${i + 1}. ${c}`).join('\n')
      : 'Response is correct, complete, clear, and directly useful.';

    try {
      const result = await callLlmJson<RefineJson>({
        provider: ctx.provider,
        model: ctx.model,
        apiKey: ctx.apiKey,
        system: `You are the Refinement engine of DSRT Open Arena.
Critique the draft against success criteria, then produce an improved final answer.
Rules: Preserve correctness, improve clarity.
Return ONLY valid JSON matching this schema:
{"critique":"string","refined_content":"string","changes_made":["string"],"refinement_applied":true,"improvement_confidence":0.0}`,
        user: JSON.stringify({
          user_message: ctx.userMessage,
          success_criteria: successCriteria,
          draft,
        }),
      });

      const refinedText =
        typeof result.data.refined_content === 'string' && result.data.refined_content.trim()
          ? result.data.refined_content
          : draft;
      const applied = Boolean(result.data.refinement_applied) && refinedText.trim() !== draft.trim();

      return okResult(
        {
          critique: String(result.data.critique ?? ''),
          refined_content: refinedText,
          changes_made: Array.isArray(result.data.changes_made)
            ? result.data.changes_made.map(String)
            : [],
          refinement_applied: applied,
          improvement_confidence: Math.max(0, Math.min(1, Number(result.data.improvement_confidence) || 0)),
        },
        start,
        { p: result.promptTokens, c: result.completionTokens }
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Refinement failed';
      return okResult(
        {
          refined_content: draft,
          critique: `Error: ${message}`,
          changes_made: [],
          refinement_applied: false,
          improvement_confidence: 0,
        },
        start,
        { p: 0, c: 0 },
        message
      );
    }
  },
};

export const e09Refinement = e09RefinementEngine;
export default e09RefinementEngine;