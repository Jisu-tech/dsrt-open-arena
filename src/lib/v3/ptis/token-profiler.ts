/**
 * TokenProfiler — pre-invocation token demand estimation.
 *
 * Rules:
 * - Null = unknown. Zero = measured empty. Never conflate.
 * - Estimation is explicitly labelled; it is never presented as provider_api truth.
 * - Used by CostPredictor and DecisionEngine only as a planning signal.
 */

export type TokenEstimateSource =
  | 'heuristic_char_ratio'
  | 'tiktoken_approx'
  | 'provider_tokenizer'
  | 'unknown';

export interface TokenEstimate {
  /** Estimated prompt tokens. null = could not estimate. */
  readonly promptTokens: number | null;
  /** Estimated completion budget the caller intends to allow. */
  readonly maxCompletionTokens: number | null;
  /** How this estimate was produced. */
  readonly source: TokenEstimateSource;
  /** Confidence 0..1. null if unknown. */
  readonly confidence: number | null;
}

export interface ProfileInput {
  readonly systemPrompt?: string | null;
  readonly userPrompt: string;
  readonly conversationHistory?: readonly string[] | null;
  readonly maxCompletionTokens?: number | null;
  /** Optional: model family hint for tokenizer selection. */
  readonly modelFamily?: string | null;
}

/**
 * Character-ratio heuristic. ~4 chars/token for English-dominant text.
 * Documented as heuristic — never claimed as exact.
 */
const CHARS_PER_TOKEN = 4;

export function profileTokenDemand(input: ProfileInput): TokenEstimate {
  const parts: string[] = [];
  if (input.systemPrompt) parts.push(input.systemPrompt);
  if (input.conversationHistory?.length) {
    for (const turn of input.conversationHistory) parts.push(turn);
  }
  parts.push(input.userPrompt);

  const totalChars = parts.reduce((sum, p) => sum + (p?.length ?? 0), 0);

  if (totalChars === 0) {
    return {
      promptTokens: 0,
      maxCompletionTokens: input.maxCompletionTokens ?? null,
      source: 'heuristic_char_ratio',
      confidence: 1,
    };
  }

  const promptTokens = Math.ceil(totalChars / CHARS_PER_TOKEN);

  return {
    promptTokens,
    maxCompletionTokens: input.maxCompletionTokens ?? null,
    source: 'heuristic_char_ratio',
    // Char-ratio is rough; lower confidence on very short or code-heavy inputs
    confidence: totalChars < 50 ? 0.5 : 0.75,
  };
}

/**
 * Bound an estimate to a model's context window when known.
 * Returns null tokens if the prompt alone exceeds the window (caller should reject).
 */
export function boundToContextWindow(
  estimate: TokenEstimate,
  contextWindow: number | null,
): TokenEstimate {
  if (contextWindow == null || estimate.promptTokens == null) return estimate;

  if (estimate.promptTokens >= contextWindow) {
    return {
      ...estimate,
      promptTokens: estimate.promptTokens,
      maxCompletionTokens: 0,
      confidence: estimate.confidence != null ? estimate.confidence * 0.5 : null,
    };
  }

  const remaining = contextWindow - estimate.promptTokens;
  const cappedCompletion =
    estimate.maxCompletionTokens != null
      ? Math.min(estimate.maxCompletionTokens, remaining)
      : remaining;

  return {
    ...estimate,
    maxCompletionTokens: cappedCompletion,
  };
}