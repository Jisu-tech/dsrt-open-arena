import type { RawCatalogueEntry, V3Provider } from '../../contracts/registry';
import { PricingSource, SyncSource } from '../../contracts/registry';
import type { AdapterFetchContext } from '../types';
import { BaseCatalogueAdapter, pricingFromApiFields, type FetchPageResult } from './base';

export class MistralCatalogueAdapter extends BaseCatalogueAdapter {
  readonly provider: V3Provider = 'mistral';
  readonly displayName = 'Mistral';
  readonly supportsRemoteFetch = true;
  readonly supportsPagination = false;

  protected async fetchPage(context: AdapterFetchContext): Promise<FetchPageResult> {
    const url = context.config.catalogueApiUrl ?? 'https://api.mistral.ai/v1/models';
    const result = await this.httpGetJson(url, this.authHeaders(context), context.signal, 30000);
    return { ...result, nextCursor: null, providerReportedTotal: null };
  }

  protected mapEntry(raw: unknown, fetchedAt: string): RawCatalogueEntry | null {
    if (!raw || typeof raw !== 'object') return null;
    const m = raw as any;
    if (!m.id) return null;
    
    const caps = m.capabilities || {};
    const pricing = pricingFromApiFields({ source: PricingSource.PROVIDER_API_RESPONSE, sourceDetail: 'mistral (no pricing returned)' });

    return {
      provider: this.provider, providerModelId: m.id, displayName: m.id,
      syncSource: SyncSource.CATALOGUE_API,
      capabilities: { chat: caps.completion_chat ?? null, vision: caps.vision ?? null, tools: caps.function_calling ?? null, jsonMode: null, streaming: null },
      contextWindow: m.max_context_length ?? null, maxOutputTokens: m.max_tokens ?? null, pricing,
      metadata: { ownedBy: m.owned_by ?? null, fetchedAt },
      rawProviderPayload: m,
    };
  }
}