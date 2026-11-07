import type { AmplificationEngine, CostOptimizationResult, EngineContext, EngineResult } from '../types';
import { calculateProviderCost, getModelsForProvider, type ProviderType } from '@/lib/providers/registry';

const ECONOMY_HINTS: Record<string, string> = {
  'gpt-4o': 'gpt-4o-mini',
  'gpt-4-turbo': 'gpt-4o-mini',
  'claude-3-5-sonnet-20241022': 'claude-3-5-haiku-20241022',
  'claude-3-opus-20240229': 'claude-3-5-haiku-20241022',
  'gemini-1.5-pro': 'gemini-1.5-flash',
  'mistral-large-latest': 'mistral-small-latest',
  'llama-3.3-70b-versatile': 'llama-3.1-8b-instant',
  'deepseek-reasoner': 'deepseek-chat',
};

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

export const e12CostEngine: AmplificationEngine<CostOptimizationResult> = {
  id: 'E12',
  name: 'Cost & Optimization',
  wave: 3,

  async execute(ctx: EngineContext): Promise<EngineResult<CostOptimizationResult>> {
    const start = Date.now();

    const promptTokens = Number(ctx.metrics?.promptTokens ?? 0);
    const completionTokens = Number(ctx.metrics?.completionTokens ?? 0);
    const engineOverheadTokens = Number(ctx.metrics?.engineOverheadTokens ?? 0);
    const latencyMs = Number(ctx.metrics?.latencyMs ?? Date.now() - start);

    const provider = (ctx.provider || 'openai') as ProviderType;
    const model = ctx.model || 'gpt-4o-mini';
    const quality = ctx.artifacts.quality;
    const strategy = ctx.artifacts.strategy;
    const intent = ctx.artifacts.intent;

    let providerCost = 0;
    let overheadCost = 0;

    try {
      providerCost = calculateProviderCost(model, promptTokens, completionTokens);
    } catch {
      providerCost = 0;
    }

    try {
      overheadCost = calculateProviderCost(
        model,
        engineOverheadTokens,
        Math.round(engineOverheadTokens * 0.25)
      );
    } catch {
      overheadCost = 0;
    }

    const total = providerCost + overheadCost;
    const qualityOverall = quality?.overall ?? null;
    const qualityPerDollar =
      qualityOverall != null ? qualityOverall / Math.max(total, 0.0001) : null;

    let suggestion: string | null = null;
    let suggested_provider: string | null = null;
    let suggested_model: string | null = null;

    const economy = ECONOMY_HINTS[model];
    const highQuality = qualityOverall != null && qualityOverall >= 7.5;
    const lowComplexity =
      intent?.complexity === 'low' || strategy?.strategy === 'direct';

    if (economy && highQuality && lowComplexity) {
      suggested_model = economy;
      suggested_provider = provider;
      suggestion = `Quality scored ${qualityOverall}/10 on a low-complexity task. Consider ${economy} next time to reduce provider cost while holding quality.`;
    } else if (economy && highQuality && total > 0.02) {
      suggested_model = economy;
      suggested_provider = provider;
      suggestion = `Strong quality (${qualityOverall}/10) at $${total.toFixed(4)}. A cheaper model (${economy}) may be sufficient for similar asks.`;
    } else if (qualityOverall != null && qualityOverall < 5.5) {
      try {
        const peers = getModelsForProvider(provider);
        const richer = peers.find((m) => {
          const id = typeof m === 'string' ? m : m.id;
          return id !== model && /pro|sonnet|large|opus|gpt-4o$|reasoner/i.test(id);
        });
        if (richer) {
          const id = typeof richer === 'string' ? richer : richer.id;
          suggested_model = id;
          suggested_provider = provider;
          suggestion = `Quality scored ${qualityOverall}/10. Consider ${id} for harder prompts.`;
        } else {
          suggestion = `Quality scored ${qualityOverall}/10. Review verification issues and success criteria coverage.`;
        }
      } catch {
        suggestion = `Quality scored ${qualityOverall}/10. Review verification issues and success criteria coverage.`;
      }
    } else if (strategy?.use_tools && engineOverheadTokens > promptTokens) {
      suggestion =
        'Amplification overhead exceeded primary completion tokens — expected for multi-engine + tool runs.';
    }

    const data: CostOptimizationResult = {
      provider_cost_usd: round4(providerCost),
      amplification_overhead_usd: round4(overheadCost),
      total_cost_usd: round4(total),
      token_breakdown: {
        prompt: promptTokens,
        completion: completionTokens,
        engine_overhead: engineOverheadTokens,
      },
      latency_ms: latencyMs,
      quality_overall: qualityOverall,
      quality_per_dollar: qualityPerDollar != null ? round4(qualityPerDollar) : null,
      suggestion,
      suggested_provider,
      suggested_model,
    };

    return {
      success: true,
      data,
      tokens_prompt: 0,
      tokens_completion: 0,
      latency_ms: Date.now() - start,
    };
  },
};

export const e12Cost = e12CostEngine;
export default e12CostEngine;