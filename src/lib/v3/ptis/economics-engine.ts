/**
 * EconomicsEngine — historical cost/latency/success rollups from v3_invocations.
 *
 * All figures come from recorded measurements.
 * Missing data = null. Never zero-filled to look healthy.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { V3Provider } from '../contracts/registry';

export interface ModelEconomics {
  readonly provider: V3Provider;
  readonly providerModelId: string;
  readonly sampleSize: number;
  /** Mean measured cost USD (string). null if no cost samples. */
  readonly meanCostUsd: string | null;
  /** Mean duration ms. null if no duration samples. */
  readonly meanLatencyMs: number | null;
  /** Success rate 0..1. null if no samples. */
  readonly successRate: number | null;
  /** Mean input tokens. null if unmeasured. */
  readonly meanInputTokens: number | null;
  /** Mean output tokens. null if unmeasured. */
  readonly meanOutputTokens: number | null;
  readonly windowStart: string;
  readonly windowEnd: string;
}

export interface EconomicsQuery {
  readonly workspaceId?: string | null;
  readonly provider?: V3Provider | null;
  readonly providerModelId?: string | null;
  /** Lookback window in hours. Default 168 (7d). */
  readonly lookbackHours?: number;
  readonly minSamples?: number;
}

export class EconomicsEngine {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Aggregate measured invocations into per-model economics.
   * Uses only rows with real measurements.
   */
  async getModelEconomics(query: EconomicsQuery = {}): Promise<ModelEconomics[]> {
    const lookbackHours = query.lookbackHours ?? 168;
    const minSamples = query.minSamples ?? 1;
    const windowEnd = new Date();
    const windowStart = new Date(windowEnd.getTime() - lookbackHours * 3600_000);

    let q = this.supabase
      .from('v3_invocations')
      .select(
        'provider, provider_model_id, status, cost_usd, duration_ms, tokens_input, tokens_output, created_at',
      )
      .gte('created_at', windowStart.toISOString())
      .lte('created_at', windowEnd.toISOString());

    if (query.workspaceId) q = q.eq('workspace_id', query.workspaceId);
    if (query.provider) q = q.eq('provider', query.provider);
    if (query.providerModelId) q = q.eq('provider_model_id', query.providerModelId);

    const { data, error } = await q;
    if (error) {
      console.error('[EconomicsEngine] query failed', error);
      throw new Error(`EconomicsEngine.getModelEconomics: ${error.message}`);
    }

    type Agg = {
      provider: V3Provider;
      providerModelId: string;
      n: number;
      successes: number;
      costSum: number;
      costN: number;
      latencySum: number;
      latencyN: number;
      inputSum: number;
      inputN: number;
      outputSum: number;
      outputN: number;
    };

    const map = new Map<string, Agg>();

    for (const row of data ?? []) {
      const key = `${row.provider}::${row.provider_model_id}`;
      let agg = map.get(key);
      if (!agg) {
        agg = {
          provider: row.provider as V3Provider,
          providerModelId: row.provider_model_id,
          n: 0,
          successes: 0,
          costSum: 0,
          costN: 0,
          latencySum: 0,
          latencyN: 0,
          inputSum: 0,
          inputN: 0,
          outputSum: 0,
          outputN: 0,
        };
        map.set(key, agg);
      }

      agg.n += 1;
      if (row.status === 'success') agg.successes += 1;

      if (row.cost_usd != null && row.cost_usd !== '') {
        const c = parseFloat(String(row.cost_usd));
        if (Number.isFinite(c)) {
          agg.costSum += c;
          agg.costN += 1;
        }
      }
      if (typeof row.duration_ms === 'number') {
        agg.latencySum += row.duration_ms;
        agg.latencyN += 1;
      }
      if (typeof row.tokens_input === 'number') {
        agg.inputSum += row.tokens_input;
        agg.inputN += 1;
      }
      if (typeof row.tokens_output === 'number') {
        agg.outputSum += row.tokens_output;
        agg.outputN += 1;
      }
    }

    const results: ModelEconomics[] = [];
    for (const agg of map.values()) {
      if (agg.n < minSamples) continue;
      results.push({
        provider: agg.provider,
        providerModelId: agg.providerModelId,
        sampleSize: agg.n,
        meanCostUsd: agg.costN > 0 ? (agg.costSum / agg.costN).toFixed(8) : null,
        meanLatencyMs: agg.latencyN > 0 ? Math.round(agg.latencySum / agg.latencyN) : null,
        successRate: agg.n > 0 ? agg.successes / agg.n : null,
        meanInputTokens: agg.inputN > 0 ? Math.round(agg.inputSum / agg.inputN) : null,
        meanOutputTokens: agg.outputN > 0 ? Math.round(agg.outputSum / agg.outputN) : null,
        windowStart: windowStart.toISOString(),
        windowEnd: windowEnd.toISOString(),
      });
    }

    return results;
  }
}