/**
 * Engine E03 — Production Endless Context Compression Engine (Phase 7 UPGRADE)
 * Integrates intelligent sliding-window context compression & working memory persistence.
 */

import type {
  AmplificationEngine,
  EngineContext,
  EngineResult,
  ContextResult,
} from '../types';
import { compressConversationHistory } from '@/lib/context/compression';

export const e03ContextEngine: AmplificationEngine<ContextResult> = {
  id: 'E03',
  name: 'Context Preparation',
  wave: 1,

  async execute(ctx: EngineContext): Promise<EngineResult<ContextResult>> {
    const started = Date.now();
    try {
      const result = await compressConversationHistory({
        history: ctx.history,
        userMessage: ctx.userMessage,
        provider: ctx.provider,
        model: ctx.model,
        apiKey: ctx.apiKey,
      });

      ctx.artifacts.context = result;

      return {
        success: true,
        data: result,
        tokens_prompt: result.token_estimate,
        tokens_completion: 0,
        latency_ms: Date.now() - started,
      };
    } catch (err: unknown) {
      const fallback: ContextResult = {
        summary: ctx.history.slice(-4).map((m) => `${m.role}: ${m.content.slice(0, 100)}`).join(' | '),
        key_facts: [],
        open_questions: [],
        token_estimate: 50,
      };
      ctx.artifacts.context = fallback;

      return {
        success: false,
        data: fallback,
        tokens_prompt: 0,
        tokens_completion: 0,
        latency_ms: Date.now() - started,
        error: err instanceof Error ? err.message : 'E03 Endless Context Engine soft-failed',
      };
    }
  },
};

export const e03Context = e03ContextEngine;
export default e03ContextEngine;