import type { AmplificationEngine, EngineContext, EngineResult, IntentResult } from '../types';
import { callLlmJson } from '../llmJson';

const SYSTEM = `You are Engine E01 Intent Analyzer for DSRT Open Arena.
Analyze the latest user message in context of the conversation.
Return ONLY valid JSON with this exact shape:
{
  "primary_intent": "string",
  "intent_category": "question|code|analysis|creative|planning|debugging|other",
  "entities": ["string"],
  "constraints": ["string"],
  "success_criteria": ["string"],
  "complexity": "low|medium|high",
  "requires_tools": false,
  "requires_retrieval": false
}
No markdown, no commentary.`;

export const e01IntentEngine: AmplificationEngine<IntentResult> = {
  id: 'E01',
  name: 'Intent Understanding',
  wave: 1,

  async execute(ctx: EngineContext): Promise<EngineResult<IntentResult>> {
    const started = Date.now();
    try {
      const historyTail = ctx.history
        .slice(-8)
        .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
        .join('\n');

      const { data, promptTokens, completionTokens, raw } = await callLlmJson<IntentResult>({
        provider: ctx.provider,
        model: ctx.model,
        apiKey: ctx.apiKey,
        system: SYSTEM,
        user: `Conversation tail:\n${historyTail}\n\nLatest user message:\n${ctx.userMessage}`,
      });

      const normalized: IntentResult = {
        primary_intent: data.primary_intent || 'general_assist',
        intent_category: data.intent_category || 'other',
        entities: data.entities || [],
        constraints: data.constraints || [],
        success_criteria: data.success_criteria || [],
        complexity: data.complexity || 'medium',
        requires_tools: Boolean(data.requires_tools),
        requires_retrieval: Boolean(data.requires_retrieval),
      };

      ctx.artifacts.intent = normalized;

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
        error: err instanceof Error ? err.message : 'E01 failed',
      };
    }
  },
};

export const e01Intent = e01IntentEngine;
export default e01IntentEngine;