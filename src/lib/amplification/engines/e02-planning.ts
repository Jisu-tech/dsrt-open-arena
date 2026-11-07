import type { AmplificationEngine, EngineContext, EngineResult, PlanResult } from '../types';
import { callLlmJson } from '../llmJson';

const SYSTEM = `You are Engine E02 Planning for DSRT Open Arena.
Given intent analysis and the user message, produce an actionable plan.
Return ONLY valid JSON:
{
  "objective": "string",
  "steps": [
    { "id": "S1", "title": "string", "detail": "string", "depends_on": [] }
  ],
  "risks": ["string"],
  "recommended_strategy": "direct|stepwise|verify-first|creative-explore"
}
3-7 steps. No markdown.`;

export const e02PlanningEngine: AmplificationEngine<PlanResult> = {
  id: 'E02',
  name: 'Task Planning',
  wave: 1,

  async execute(ctx: EngineContext): Promise<EngineResult<PlanResult>> {
    const started = Date.now();
    try {
      const intent = ctx.artifacts.intent;
      const { data, promptTokens, completionTokens, raw } = await callLlmJson<PlanResult>({
        provider: ctx.provider,
        model: ctx.model,
        apiKey: ctx.apiKey,
        system: SYSTEM,
        user: JSON.stringify({ user_message: ctx.userMessage, intent }, null, 2),
      });

      const normalized: PlanResult = {
        objective: data.objective || ctx.userMessage.slice(0, 120),
        steps: Array.isArray(data.steps) ? data.steps : [],
        risks: data.risks || [],
        recommended_strategy: data.recommended_strategy || 'direct',
      };

      ctx.artifacts.plan = normalized;

      return {
        success: true,
        data: normalized,
        raw_output: raw,
        tokens_prompt: promptTokens,
        tokens_completion: completionTokens,
        latency_ms: Date.now() - started,
      };
    } catch (err: unknown) {
      return {
        success: false,
        tokens_prompt: 0,
        tokens_completion: 0,
        latency_ms: Date.now() - started,
        error: err instanceof Error ? err.message : 'E02 failed',
      };
    }
  },
};

export const e02Planning = e02PlanningEngine;
export default e02PlanningEngine;