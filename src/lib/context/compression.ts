/**
 * Intelligent Conversation Context Compression & Persistent Memory Extraction (Phase 7: Endless Context)
 * Performs sliding window compression, structured fact extraction, and working memory synthesis.
 */

import { callLlmJson } from '@/lib/amplification/llmJson';
import type { ProviderType } from '@/lib/providers/registry';
import type { Message } from '@/types';
import type { ContextResult } from '@/lib/amplification/types';

type CompressionJson = {
  summary?: string;
  key_facts?: string[];
  open_questions?: string[];
  entities?: string[];
};

export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 3.8);
}

export async function compressConversationHistory(input: {
  history: Message[];
  userMessage: string;
  provider: ProviderType;
  model: string;
  apiKey: string;
}): Promise<ContextResult> {
  const history = input.history;

  if (history.length <= 4) {
    const summary = history
      .map((m) => `${m.role.toUpperCase()}: ${m.content.slice(0, 150)}`)
      .join(' | ');
    return {
      summary: summary || 'New conversation session.',
      key_facts: [],
      open_questions: [],
      token_estimate: estimateTokenCount(summary),
    };
  }

  const activeWindowSize = 6;
  const overflowMessages = history.slice(0, -activeWindowSize);
  const activeWindow = history.slice(-activeWindowSize);

  const overflowText = overflowMessages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n');

  const activeWindowText = activeWindow
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n');

  try {
    const result = await callLlmJson<CompressionJson>({
      provider: input.provider,
      model: input.model,
      apiKey: input.apiKey,
      system: `You are the Endless Context Compression Engine for DSRT Open Arena.
Compress older conversation history into a dense, high-fidelity working memory.
Preserve non-negotiable facts, user preferences, technical constraints, and unresolved questions.
Return ONLY valid JSON with this schema:
{
  "summary": "Dense narrative summary of conversation history to date",
  "key_facts": ["Immutable user decisions, preferences, and technical facts"],
  "open_questions": ["Pending user requests or active goals"],
  "entities": ["Core code symbols, framework names, or domain concepts"]
}`,
      user: `[Older Conversation History to Compress]\n${overflowText}\n\n[Recent Active Window Context]\n${activeWindowText}\n\n[Latest User Message]\n${input.userMessage}`,
    });

    const summary = result.data.summary || 'Prior context compressed.';
    const keyFacts = Array.isArray(result.data.key_facts)
      ? result.data.key_facts.map(String)
      : [];
    const openQuestions = Array.isArray(result.data.open_questions)
      ? result.data.open_questions.map(String)
      : [];

    return {
      summary,
      key_facts: keyFacts,
      open_questions: openQuestions,
      token_estimate: estimateTokenCount(summary + keyFacts.join(' ')),
    };
  } catch {
    // Fallback heuristic compression if LLM compression encounters rate limits
    const textSnippet = overflowMessages
      .slice(-6)
      .map((m) => `${m.role}: ${m.content.slice(0, 120)}`)
      .join(' | ');
    return {
      summary: `Compressed prior history (${overflowMessages.length} msgs): ${textSnippet}`,
      key_facts: [],
      open_questions: [],
      token_estimate: estimateTokenCount(textSnippet),
    };
  }
}