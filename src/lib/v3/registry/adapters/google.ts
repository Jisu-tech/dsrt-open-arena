import type { RawCatalogueEntry, V3Provider } from '../../contracts/registry';
import { PricingSource, SyncSource } from '../../contracts/registry';
import type { AdapterFetchContext } from '../types';
import { BaseCatalogueAdapter, pricingFromApiFields, type FetchPageResult } from './base';

export class GoogleCatalogueAdapter extends BaseCatalogueAdapter {
  readonly provider: V3Provider = 'google';
  readonly displayName = 'Google';
  readonly supportsRemoteFetch = true;
  readonly supportsPagination = true;

  protected async fetchPage(context: AdapterFetchContext, cursor: string | null): Promise<FetchPageResult> {
    const base = context.config.catalogueApiUrl ?? 'https://generativelanguage.googleapis.com/v1beta/models';
    if (!context.apiKey) throw new Error('Google catalogue requires an API key');
    const url = new URL(base);
    url.searchParams.set('key', context.apiKey);
    url.searchParams.set('pageSize', '100');
    if (cursor) url.searchParams.set('pageToken', cursor);

    const result = await this.httpGetJson(url.toString(), { Accept: 'application/json' }, context.signal, context.config.requestTimeoutMs ?? 30_000);
    return { ...result, nextCursor: (result.payload as any)?.nextPageToken ?? null, providerReportedTotal: null };
  }

  protected extractItems(payload: unknown): unknown[] {
    return Array.isArray((payload as any)?.models) ? (payload as any).models : [];
  }

  protected mapEntry(raw: unknown, fetchedAt: string): RawCatalogueEntry | null {
    if (!raw || typeof raw !== 'object') return null;
    const m = raw as any;
    if (!m.name || typeof m.name !== 'string') return null;

    const providerModelId = m.name.startsWith('models/') ? m.name.slice(7) : m.name;
    const methods = m.supportedGenerationMethods ?? [];
    
    const pricing = pricingFromApiFields({ source: PricingSource.PROVIDER_API_RESPONSE, sourceDetail: 'google (no pricing returned)' });

    return {
      provider: this.provider, providerModelId, displayName: m.displayName ?? providerModelId,
      syncSource: SyncSource.CATALOGUE_API,
      capabilities: { chat: methods.includes('generateContent') ? true : null, vision: null, tools: null, jsonMode: null, streaming: methods.includes('streamGenerateContent') ? true : null },
      contextWindow: m.inputTokenLimit ?? null, maxOutputTokens: m.outputTokenLimit ?? null, pricing,
      metadata: { description: m.description ?? null, version: m.version ?? null, supportedGenerationMethods: methods, fetchedAt },
      rawProviderPayload: m,
    };
  }
}