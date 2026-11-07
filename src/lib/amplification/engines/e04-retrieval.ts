/**
 * Engine E04 — Production Semantic Vector Retrieval Engine (Phase 7 UPGRADE)
 * Hybrid RAG retrieval combining pgvector similarity search over workspace documents and conversation history.
 */

import type {
  AmplificationEngine,
  EngineContext,
  EngineResult,
  RetrievalResult,
} from '../types';
import { searchVectorStore } from '@/lib/context/vectorStore';

function lexicalScore(query: string, text: string): number {
  const qTerms = query.toLowerCase().split(/\W+/).filter((t) => t.length > 2);
  if (qTerms.length === 0) return 0;
  const hay = text.toLowerCase();
  let hits = 0;
  for (const term of qTerms) {
    if (hay.includes(term)) hits++;
  }
  return hits / qTerms.length;
}

export const e04RetrievalEngine: AmplificationEngine<RetrievalResult> = {
  id: 'E04',
  name: 'Retrieval',
  wave: 1,

  async execute(ctx: EngineContext): Promise<EngineResult<RetrievalResult>> {
    const started = Date.now();
    try {
      const intent = ctx.artifacts.intent;
      const shouldRetrieve =
        intent?.requires_retrieval ||
        intent?.complexity === 'high' ||
        ctx.history.length > 4;

      if (!shouldRetrieve) {
        const empty: RetrievalResult = {
          snippets: [],
          query_used: ctx.userMessage.slice(0, 200),
          hit_count: 0,
        };
        ctx.artifacts.retrieval = empty;
        return {
          success: true,
          data: empty,
          tokens_prompt: 0,
          tokens_completion: 0,
          latency_ms: Date.now() - started,
        };
      }

      const searchQuery = [
        ctx.userMessage,
        ...(intent?.entities || []),
        intent?.primary_intent || '',
      ].join(' ');

      // 1. Vector Store Document Search (pgvector)
      const docSnippets = await searchVectorStore({
        workspaceId: ctx.workspaceId,
        conversationId: ctx.conversationId,
        query: searchQuery,
        apiKey: ctx.apiKey,
        limit: 4,
        matchThreshold: 0.15,
      });

      // 2. Lexical Message Search Over Conversation Memory
      const messageSnippets = ctx.history
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          source: `Conversation Message (${m.role})`,
          content: m.content.slice(0, 1000),
          relevance: Number(lexicalScore(searchQuery, m.content).toFixed(4)),
        }))
        .filter((s) => s.relevance > 0.18);

      // 3. Hybrid Ranking & Deduplication
      const combined = [
        ...docSnippets.map((d) => ({
          source: d.source,
          content: d.content,
          relevance: d.relevance,
        })),
        ...messageSnippets,
      ]
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, 5);

      const result: RetrievalResult = {
        snippets: combined,
        query_used: searchQuery.slice(0, 250),
        hit_count: combined.length,
      };

      ctx.artifacts.retrieval = result;

      return {
        success: true,
        data: result,
        tokens_prompt: 0,
        tokens_completion: 0,
        latency_ms: Date.now() - started,
      };
    } catch (err: unknown) {
      const empty: RetrievalResult = {
        snippets: [],
        query_used: ctx.userMessage.slice(0, 200),
        hit_count: 0,
      };
      ctx.artifacts.retrieval = empty;

      return {
        success: false,
        data: empty,
        tokens_prompt: 0,
        tokens_completion: 0,
        latency_ms: Date.now() - started,
        error: err instanceof Error ? err.message : 'E04 Vector Retrieval failed',
      };
    }
  },
};

export const e04Retrieval = e04RetrievalEngine;
export default e04RetrievalEngine;