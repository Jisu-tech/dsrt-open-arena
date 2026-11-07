import type { RawCatalogueEntry, V3Provider } from '../../contracts/registry';
import { PricingSource, SyncSource } from '../../contracts/registry';
import type { AdapterFetchContext } from '../types';
import { BaseCatalogueAdapter, pricingFromApiFields, type FetchPageResult } from './base';

export class DeepSeekCatalogueAdapter extends BaseCatalogueAdapter {
  readonly provider: V3Provider = 'deepseek';
  readonly displayName = 'DeepSeek';
  readonly supportsRemoteFetch = true;
  readonly supportsPagination = false;

  protected async fetchPage(context: AdapterFetchContext): Promise<FetchPageResult> {
    const url = context.config.catalogueApiUrl ?? 'https://api.deepseek.com/models';
    const result = await this.httpGetJson(url, this.authHeaders(context), context.signal, context.config.requestTimeoutMs ?? 30000);
    return { ...result, nextCursor: null, providerReportedTotal: null };
  }

  protected mapEntry(raw: unknown, fetchedAt: string): RawCatalogueEntry | null {
    if (!raw || typeof raw !== 'object') return null;
    const m = raw as any;
    if (!m.id || typeof m.id !== 'string') return null;
    
    const pricing = pricingFromApiFields({ source: PricingSource.PROVIDER_API_RESPONSE, sourceDetail: 'deepseek (no pricing returned)' });

    return {
      provider: this.provider, providerModelId: m.id, displayName: m.id,
      syncSource: SyncSource.CATALOGUE_API,
      capabilities: { chat: null, vision: null, tools: null, jsonMode: null, streaming: null },
      contextWindow: null, maxOutputTokens: null, pricing,
      metadata: { ownedBy: m.owned_by ?? null, fetchedAt },
      rawProviderPayload: m,
    };
  }
}