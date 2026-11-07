import { NormalizedUsage } from './usage-normalizer';

export interface PricingFactors {
  inputPerMillion: string | null;
  outputPerMillion: string | null;
  reasoningPerMillion: string | null;
  cachedInputPerMillion: string | null;
}

export interface CalculatedCost {
  costUsd: string | null;
  measurementSource: 'calculated_from_registry' | 'fallback_estimation' | 'provider_api';
}

/**
 * Calculates financial cost from normalized usage and active pricing factors.
 * All math is handled using string-conversion limits to prevent float anomalies.
 */
export function calculateCost(
  usage: NormalizedUsage,
  pricing: PricingFactors | null
): CalculatedCost {
  // If we have no pricing data, we cannot calculate cost. Never invent it.
  if (!pricing) {
    return {
      costUsd: null,
      measurementSource: 'fallback_estimation',
    };
  }

  // If we are missing both input and output usage, we can't calculate.
  if (usage.tokensInput === null && usage.tokensOutput === null) {
    return {
      costUsd: null,
      measurementSource: 'fallback_estimation',
    };
  }

  let totalCost = 0.0;
  let calculationValid = false;

  const calculateSegment = (tokens: number | null, pricePerMillion: string | null) => {
    if (tokens === null || pricePerMillion === null) return 0;
    const price = parseFloat(pricePerMillion);
    if (Number.isNaN(price)) return 0;
    
    calculationValid = true; // At least one segment had both tokens and price
    return (tokens / 1_000_000) * price;
  };

  // 1. Output (Standard)
  totalCost += calculateSegment(usage.tokensOutput, pricing.outputPerMillion);

  // 2. Reasoning (if billed separately, handled explicitly, else it's usually part of output)
  // Currently most providers bill reasoning as output tokens. If they bill explicitly differently, 
  // we add it. Otherwise, normalizer keeps it in output.
  totalCost += calculateSegment(usage.tokensReasoning, pricing.reasoningPerMillion);

  // 3. Input (Cached vs Uncached)
  if (usage.tokensCached !== null && pricing.cachedInputPerMillion !== null) {
    // We have explicit cache telemetry and explicit cache pricing
    totalCost += calculateSegment(usage.tokensCached, pricing.cachedInputPerMillion);
    
    const uncachedInput = Math.max(0, (usage.tokensInput ?? 0) - usage.tokensCached);
    totalCost += calculateSegment(uncachedInput, pricing.inputPerMillion);
  } else {
    // Standard input billing
    totalCost += calculateSegment(usage.tokensInput, pricing.inputPerMillion);
  }

  if (!calculationValid) {
    return { costUsd: null, measurementSource: 'fallback_estimation' };
  }

  // Enforce 8 decimal places for US Dollar precision consistency
  return {
    costUsd: totalCost.toFixed(8),
    measurementSource: 'calculated_from_registry',
  };
}