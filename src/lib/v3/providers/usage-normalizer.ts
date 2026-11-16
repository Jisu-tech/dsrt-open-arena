export interface NormalizedUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  providerCostUsd: number;
  dsrtCostUsd: number;
}

export function normalizeUsage(raw: Record<string, unknown>): NormalizedUsage {
  return {
    promptTokens: Number(raw.prompt_tokens || raw.promptTokens || 0),
    completionTokens: Number(raw.completion_tokens || raw.completionTokens || 0),
    totalTokens: Number(raw.total_tokens || raw.totalTokens || 0),
    providerCostUsd: Number(raw.provider_cost_usd || raw.providerCostUsd || 0),
    dsrtCostUsd: Number(raw.dsrt_cost_usd || raw.dsrtCostUsd || 0),
  };
}
