import type { RawCatalogueEntry, V3Provider } from '../../contracts/registry';
import { PricingSource, SyncSource } from '../../contracts/registry';
import type { AdapterFetchContext } from '../types';
import { BaseCatalogueAdapter, pricingFromApiFields, type FetchPageResult } from './base';

export class CohereCatalogueAdapter extends BaseCatalogueAdapter {
  readonly provider: V3Provider = 'cohere';
  readonly displayName = 'Cohere';
  readonly supportsRemoteFetch = true;
  readonly supportsPagination = true;

  protected async fetchPage(context: AdapterFetchContext, cursor: string | null): Promise<FetchPageResult> {
    const base = context.config.catalogueApiUrl ?? 'https://api.cohere.com/v2/models';
    const url = new URL(base);
    url.searchParams.set('page_size', '100');
    url.searchParams.set('endpoint', 'chat');
    if (cursor) url.searchParams.set('page_token', cursor);

    const result = await this.httpGetJson(url.toString(), { ...this.authHeaders(context), 'Content-Type': 'application/json' }, context.signal, 30000);
    return { ...result, nextCursor: (result.payload as any)?.next_page_token ?? null, providerReportedTotal: null };
  }

  protected extractItems(payload: unknown): unknown[] {
    return Array.isArray((payload as any)?.models) ? (payload as any).models : [];
  }

  protected mapEntry(raw: unknown, fetchedAt: string): RawCatalogueEntry | null {
    if (!raw || typeof raw !== 'object') return null;
    const m = raw as any;
    if (!m.name) return null;

    const endpoints = m.endpoints ?? m.default_endpoints ?? [];
    const features = m.features ?? [];
    const pricing = pricingFromApiFields({ source: PricingSource.PROVIDER_API_RESPONSE, sourceDetail: 'cohere (no pricing returned)' });

    return {
      provider: this.provider, providerModelId: m.name, displayName: m.name,
      syncSource: SyncSource.CATALOGUE_API,
      capabilities: { chat: endpoints.includes('chat') ? true : null, vision: null, tools: features.includes('tools') || endpoints.includes('chat') ? true : null, jsonMode: null, streaming: null },
      contextWindow: m.context_length ?? null, maxOutputTokens: null, pricing,
      metadata: { endpoints, features, finetuned: m.finetuned ?? null, fetchedAt },
      rawProviderPayload: m,
    };
  }
}