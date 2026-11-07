import type { V3Provider } from '../contracts/registry';

export interface NormalizedUsage {
  tokensInput: number | null;
  tokensOutput: number | null;
  tokensReasoning: number | null;
  tokensCached: number | null;
  measurementSource: 'provider_api' | 'fallback_estimation';
}

/**
 * Extracts explicit token telemetry from raw provider responses.
 * Never guesses. If a provider doesn't report it, it remains null.
 */
export function normalizeProviderUsage(
  provider: V3Provider,
  rawPayload: Record<string, any> | null | undefined
): NormalizedUsage {
  // If we got no payload or it's malformed, we have no measurements.
  if (!rawPayload) {
    return {
      tokensInput: null,
      tokensOutput: null,
      tokensReasoning: null,
      tokensCached: null,
      measurementSource: 'fallback_estimation', // Signals no API data was present
    };
  }

  let input: number | null = null;
  let output: number | null = null;
  let reasoning: number | null = null;
  let cached: number | null = null;

  switch (provider) {
    case 'openai':
    case 'openrouter':
    case 'deepseek':
    case 'groq':
    case 'mistral':
    case 'xai':
      // Standard OpenAI-compatible format
      if (rawPayload.usage) {
        input = typeof rawPayload.usage.prompt_tokens === 'number' ? rawPayload.usage.prompt_tokens : null;
        output = typeof rawPayload.usage.completion_tokens === 'number' ? rawPayload.usage.completion_tokens : null;
        
        // Extended OpenAI/DeepSeek fields
        if (rawPayload.usage.completion_tokens_details) {
          reasoning = typeof rawPayload.usage.completion_tokens_details.reasoning_tokens === 'number' 
            ? rawPayload.usage.completion_tokens_details.reasoning_tokens 
            : null;
        }
        if (rawPayload.usage.prompt_tokens_details) {
          cached = typeof rawPayload.usage.prompt_tokens_details.cached_tokens === 'number'
            ? rawPayload.usage.prompt_tokens_details.cached_tokens
            : null;
        }
      }
      break;

    case 'anthropic':
      // Anthropic format (Messages API)
      if (rawPayload.usage) {
        input = typeof rawPayload.usage.input_tokens === 'number' ? rawPayload.usage.input_tokens : null;
        output = typeof rawPayload.usage.output_tokens === 'number' ? rawPayload.usage.output_tokens : null;
        
        // Cache read tokens
        if (typeof rawPayload.usage.cache_read_input_tokens === 'number') {
          cached = rawPayload.usage.cache_read_input_tokens;
        }
      }
      break;

    case 'google':
      // Gemini format
      if (rawPayload.usageMetadata) {
        input = typeof rawPayload.usageMetadata.promptTokenCount === 'number' ? rawPayload.usageMetadata.promptTokenCount : null;
        output = typeof rawPayload.usageMetadata.candidatesTokenCount === 'number' ? rawPayload.usageMetadata.candidatesTokenCount : null;
      }
      // Gemini does not currently expose reasoning isolated from output in standard telemetry
      break;

    case 'cohere':
      // Cohere V2 format
      if (rawPayload.meta?.billed_units) {
        input = typeof rawPayload.meta.billed_units.input_tokens === 'number' ? rawPayload.meta.billed_units.input_tokens : null;
        output = typeof rawPayload.meta.billed_units.output_tokens === 'number' ? rawPayload.meta.billed_units.output_tokens : null;
      }
      break;
  }

  // Double check that we actually got numbers, else revert to null
  const ensureNumberOrNull = (val: any) => (typeof val === 'number' && !Number.isNaN(val) ? val : null);

  return {
    tokensInput: ensureNumberOrNull(input),
    tokensOutput: ensureNumberOrNull(output),
    tokensReasoning: ensureNumberOrNull(reasoning),
    tokensCached: ensureNumberOrNull(cached),
    measurementSource: 'provider_api',
  };
}