import type { RawCatalogueEntry, V3Provider } from '../../contracts/registry';
import { PricingSource, SyncSource } from '../../contracts/registry';
import type { AdapterFetchContext } from '../types';
import { BaseCatalogueAdapter, pricingFromApiFields, type FetchPageResult } from './base';

const DOCS_PRICING_URL = 'https://docs.anthropic.com/en/docs/about-claude/pricing';

export class AnthropicCatalogueAdapter extends BaseCatalogueAdapter {
  readonly provider: V3Provider = 'anthropic';
  readonly displayName = 'Anthropic';
  readonly supportsRemoteFetch = false;
  readonly supportsPagination = false;

  protected async fetchPage(): Promise<FetchPageResult> {
    throw new Error('Anthropic adapter uses curated manifest only');
  }

  protected mapEntry(): RawCatalogueEntry | null { return null; }

  protected getCuratedManifest(fetchedAt: string): RawCatalogueEntry[] {
    const CURATED = [
      { id: 'claude-opus-4-1-20250805', name: 'Claude Opus 4.1', input: 15, output: 75, cached: 1.5, cw: 200000, mo: 32000 },
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', input: 3, output: 15, cached: 0.3, cw: 200000, mo: 8192 },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', input: 0.8, output: 4, cached: 0.08, cw: 200000, mo: 8192 },
    ];

    return CURATED.map((m) => {
      const pricing = pricingFromApiFields({
        input: m.input, output: m.output, cachedInput: m.cached,
        source: PricingSource.PROVIDER_DOCS, sourceDetail: DOCS_PRICING_URL,
      });

      return {
        provider: this.provider, providerModelId: m.id, displayName: m.name,
        syncSource: SyncSource.CURATED_MANIFEST,
        capabilities: { chat: true, vision: null, tools: true, jsonMode: null, streaming: true },
        contextWindow: m.cw, maxOutputTokens: m.mo, pricing,
        metadata: { curated: true, pricingDocsUrl: DOCS_PRICING_URL, fetchedAt },
        rawProviderPayload: { id: m.id, curated: true },
      };
    });
  }
}