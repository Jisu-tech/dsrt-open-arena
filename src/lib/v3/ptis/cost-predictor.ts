/**
 * CostPredictor — pre-invocation cost simulation.
 *
 * Uses TokenEstimate + registry PricingFactors.
 * Returns null cost when pricing or tokens are unknown.
 * measurementSource is always explicit.
 */

import type { TokenEstimate } from './token-profiler';
import type { PricingFactors } from '../providers/cost-calculator';

export type CostPredictionSource =
  | 'registry_pricing'
  | 'partial_pricing'
  | 'unpriced'
  | 'unknown_tokens';

export interface CostPrediction {
  /** Predicted total USD as decimal string. null = cannot predict. */
  readonly predictedCostUsd: string | null;
  readonly inputCostUsd: string | null;
  readonly outputCostUsd: string | null;
  readonly source: CostPredictionSource;
  readonly currency: string;
}

function segmentCost(tokens: number | null, pricePerMillion: string | null): number | null {
  if (tokens == null || pricePerMillion == null) return null;
  const price = parseFloat(pricePerMillion);
  if (!Number.isFinite(price)) return null;
  return (tokens / 1_000_000) * price;
}

export function predictCost(
  estimate: TokenEstimate,
  pricing: PricingFactors | null,
  currency = 'USD',
): CostPrediction {
  if (estimate.promptTokens == null && estimate.maxCompletionTokens == null) {
    return {
      predictedCostUsd: null,
      inputCostUsd: null,
      outputCostUsd: null,
      source: 'unknown_tokens',
      currency,
    };
  }

  if (!pricing) {
    return {
      predictedCostUsd: null,
      inputCostUsd: null,
      outputCostUsd: null,
      source: 'unpriced',
      currency,
    };
  }

  const input = segmentCost(estimate.promptTokens, pricing.inputPerMillion);
  // For prediction we treat maxCompletion as the planned output budget
  const output = segmentCost(estimate.maxCompletionTokens, pricing.outputPerMillion);

  const hasInputPrice = pricing.inputPerMillion != null;
  const hasOutputPrice = pricing.outputPerMillion != null;

  if (input == null && output == null) {
    return {
      predictedCostUsd: null,
      inputCostUsd: null,
      outputCostUsd: null,
      source: 'unpriced',
      currency,
    };
  }

  const total = (input ?? 0) + (output ?? 0);
  const source: CostPredictionSource =
    hasInputPrice && hasOutputPrice ? 'registry_pricing' : 'partial_pricing';

  return {
    predictedCostUsd: total.toFixed(8),
    inputCostUsd: input != null ? input.toFixed(8) : null,
    outputCostUsd: output != null ? output.toFixed(8) : null,
    source,
    currency,
  };
}

/**
 * Compare two predictions for ranking. Lower cost ranks first.
 * Unpredictable (null) sorts after any known cost.
 */
export function compareCostPredictions(a: CostPrediction, b: CostPrediction): number {
  if (a.predictedCostUsd == null && b.predictedCostUsd == null) return 0;
  if (a.predictedCostUsd == null) return 1;
  if (b.predictedCostUsd == null) return -1;
  return parseFloat(a.predictedCostUsd) - parseFloat(b.predictedCostUsd);
}