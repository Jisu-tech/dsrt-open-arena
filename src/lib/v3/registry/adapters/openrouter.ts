import type { RawCatalogueEntry, V3Provider } from '../../contracts/registry';
import { PricingSource, SyncSource } from '../../contracts/registry';
import type { AdapterFetchContext } from '../types';
import { BaseCatalogueAdapter, pricingFromApiFields, toPerMillion, type FetchPageResult } from './base';

export class OpenRouterCatalogueAdapter extends BaseCatalogueAdapter {
  readonly provider: V3Provider = 'openrouter';
  readonly displayName = 'OpenRouter';
  readonly supportsRemoteFetch = true;
  readonly supportsPagination = false; // OpenRouter returns a massive 1-page payload currently

  protected async fetchPage(context: AdapterFetchContext): Promise<FetchPageResult> {
    const url = context.config.catalogueApiUrl ?? 'https://openrouter.ai/api/v1/models';
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (context.apiKey) headers.Authorization = `Bearer ${context.apiKey}`; // public fallback permitted

    const result = await this.httpGetJson(url, headers, context.signal, context.config.requestTimeoutMs ?? 60_000);
    const payload = result.payload as { data?: unknown[] } | null;
    const total = Array.isArray(payload?.data) ? payload!.data!.length : null;

    return { ...result, nextCursor: null, providerReportedTotal: total }; // Total derived directly ensures no silent truncation
  }

  protected mapEntry(raw: unknown, fetchedAt: string): RawCatalogueEntry | null {
    if (!raw || typeof raw !== 'object') return null;
    const m = raw as any;
    if (!m.id) return null;

    const parsePerToken = (s: string | undefined): number | null => {
      if (!s) return null;
      const n = Number(s);
      return Number.isFinite(n) ? toPerMillion(n, 'per_token') : null;
    };

    const pricing = pricingFromApiFields({
      input: parsePerToken(m.pricing?.prompt), output: parsePerToken(m.pricing?.completion),
      cachedInput: parsePerToken(m.pricing?.input_cache_read), reasoning: parsePerToken(m.pricing?.internal_reasoning),
      source: PricingSource.AGGREGATOR_OPENROUTER, sourceDetail: `openrouter:${m.id}`,
    });

    const params = m.supported_parameters ?? [];

    return {
      provider: this.provider, providerModelId: m.id, displayName: m.name ?? m.id,
      syncSource: SyncSource.OPENROUTER_INDEX,
      capabilities: {
        chat: true, vision: m.architecture?.modality?.includes('image') ? true : null,
        tools: params.includes('tools') || params.includes('tool_choice') ? true : null,
        jsonMode: params.includes('response_format') || params.includes('structured_outputs') ? true : null,
        streaming: true,
      },
      contextWindow: m.context_length ?? null, maxOutputTokens: m.top_provider?.max_completion_tokens ?? null,
      pricing,
      metadata: { description: m.description ?? null, modality: m.architecture?.modality ?? null, fetchedAt },
      rawProviderPayload: m,
    };
  }
}