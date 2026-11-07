/**
 * BaseCatalogueAdapter — shared fetch, retry, hash, pagination, completeness.
 *
 * Every provider adapter extends this. No pricing invention. No model allowlists.
 * Filtering is only by provider-declared capabilities when the API exposes them.
 */

import type {
  CatalogueCompletenessResult,
  CatalogueSyncResult,
  ProviderCatalogueConfig,
  RawCatalogueEntry,
  SuppliedPricing,
  V3Provider,
} from '../../contracts/registry';
import { CatalogueCompletenessResult as Completeness } from '../../contracts/registry';
import type { AdapterFetchContext, CatalogueAdapter } from '../types';
import { sha256Hex } from '../content-hash';

export interface FetchPageResult {
  readonly rawText: string;
  readonly payload: unknown;
  readonly httpStatus: number;
  readonly nextCursor: string | null;
  readonly providerReportedTotal: number | null;
}

export interface RetryConfig {
  readonly maxAttempts: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
}

const DEFAULT_RETRY: RetryConfig = {
  maxAttempts: 4,
  baseDelayMs: 500,
  maxDelayMs: 8_000,
};

export abstract class BaseCatalogueAdapter implements CatalogueAdapter {
  abstract readonly provider: V3Provider;
  abstract readonly displayName: string;
  abstract readonly supportsRemoteFetch: boolean;
  abstract readonly supportsPagination: boolean;

  protected abstract fetchPage(
    context: AdapterFetchContext,
    cursor: string | null,
  ): Promise<FetchPageResult>;

  protected abstract mapEntry(
    raw: unknown,
    fetchedAt: string,
  ): RawCatalogueEntry | null;

  inferModelFamily(_providerModelId: string): string | null {
    return null;
  }

  async computeEntryHash(entry: RawCatalogueEntry): Promise<string> {
    const canonical = JSON.stringify({
      provider: entry.provider,
      providerModelId: entry.providerModelId,
      displayName: entry.displayName,
      capabilities: entry.capabilities,
      contextWindow: entry.contextWindow,
      maxOutputTokens: entry.maxOutputTokens,
      pricing: entry.pricing,
      metadata: entry.metadata ?? null,
    });
    return sha256Hex(canonical);
  }

  async fetchCatalogue(context: AdapterFetchContext): Promise<CatalogueSyncResult> {
    const fetchedAt = new Date().toISOString();

    if (!this.supportsRemoteFetch) {
      return this.fetchCurated(context, fetchedAt);
    }

    const rawChunks: string[] = [];
    const entries: RawCatalogueEntry[] = [];
    let cursor: string | null = null;
    let pageCount = 0;
    let providerReportedTotal: number | null = null;
    let paginationIncomplete = false;
    const maxPages = 100;

    try {
      do {
        if (context.signal?.aborted) {
          throw new DOMException('Catalogue fetch aborted', 'AbortError');
        }

        if (context.heartbeat) await context.heartbeat();

        const page = await this.fetchPageWithRetry(context, cursor);
        rawChunks.push(page.rawText);
        pageCount += 1;

        if (page.providerReportedTotal != null) {
          providerReportedTotal = page.providerReportedTotal;
        }

        const items = this.extractItems(page.payload);
        for (const item of items) {
          const mapped = this.mapEntry(item, fetchedAt);
          if (mapped) entries.push(mapped);
        }

        cursor = this.supportsPagination ? page.nextCursor : null;

        if (pageCount >= maxPages && cursor != null) {
          paginationIncomplete = true;
          break;
        }
      } while (cursor != null);
    } catch (err) {
      if (entries.length === 0 && rawChunks.length === 0) throw err;
      paginationIncomplete = true;
    }

    const rawResponseHash = await sha256Hex(rawChunks.join('\n'));
    const completeness = this.classifyCompleteness(
      entries.length,
      context.config,
      paginationIncomplete,
      providerReportedTotal,
    );

    return {
      provider: this.provider,
      entries,
      fetchedAt,
      completeness,
      completenessDetail: this.completenessDetail(
        completeness,
        entries.length,
        context.config,
        pageCount,
        providerReportedTotal,
      ),
      rawResponseHash,
      responseMetadata: {
        pageCount,
        providerReportedTotal,
        supportsPagination: this.supportsPagination,
      },
    };
  }

  protected async fetchCurated(
    _context: AdapterFetchContext,
    fetchedAt: string,
  ): Promise<CatalogueSyncResult> {
    const entries = this.getCuratedManifest(fetchedAt);
    const rawResponseHash = await sha256Hex(
      JSON.stringify(entries.map((e) => e.providerModelId).sort()),
    );
    const completeness = entries.length >= 1 ? Completeness.PASSED : Completeness.FAILED_TOO_FEW;

    return {
      provider: this.provider,
      entries,
      fetchedAt,
      completeness,
      completenessDetail: completeness === Completeness.PASSED
          ? `Curated manifest with ${entries.length} entries`
          : 'Curated manifest empty',
      rawResponseHash,
      responseMetadata: { source: 'curated_manifest' },
    };
  }

  protected getCuratedManifest(_fetchedAt: string): RawCatalogueEntry[] {
    return [];
  }

  protected extractItems(payload: unknown): unknown[] {
    if (Array.isArray(payload)) return payload;
    if (payload && typeof payload === 'object') {
      const obj = payload as Record<string, unknown>;
      if (Array.isArray(obj.data)) return obj.data;
      if (Array.isArray(obj.models)) return obj.models;
      if (Array.isArray(obj.items)) return obj.items;
    }
    return [];
  }

  /**
   * Completeness verification checks.
   * NOTE: Validating minimum count or internal response lengths is a partial safeguard. 
   * It prevents catastrophic erasure on malformed responses, but cannot cryptographically 
   * prove the provider didn't silently truncate their own catalogue API response.
   */
  protected classifyCompleteness(
    entryCount: number,
    config: ProviderCatalogueConfig,
    paginationIncomplete: boolean,
    providerReportedTotal: number | null,
  ): CatalogueCompletenessResult {
    if (paginationIncomplete) return Completeness.FAILED_PAGINATION_INCOMPLETE;
    if (providerReportedTotal != null && entryCount < providerReportedTotal) {
      return Completeness.FAILED_PROVIDER_SIGNALED_PARTIAL;
    }
    const minExpected = config.minExpectedCatalogueSize ?? 0;
    if (entryCount < minExpected) return Completeness.FAILED_TOO_FEW;
    
    return Completeness.PASSED;
  }

  protected completenessDetail(
    result: CatalogueCompletenessResult,
    entryCount: number,
    config: ProviderCatalogueConfig,
    pageCount: number,
    providerReportedTotal: number | null,
  ): string {
    switch (result) {
      case Completeness.PASSED:
        return `OK: ${entryCount} entries across ${pageCount} page(s)`;
      case Completeness.FAILED_TOO_FEW:
        return `Too few: got ${entryCount}, minExpected=${config.minExpectedCatalogueSize ?? 0}`;
      case Completeness.FAILED_PAGINATION_INCOMPLETE:
        return `Pagination incomplete after ${pageCount} page(s); got ${entryCount} entries`;
      case Completeness.FAILED_PROVIDER_SIGNALED_PARTIAL:
        return `Provider reported total=${providerReportedTotal}, got ${entryCount}`;
      default:
        return `Not checked (${entryCount} entries)`;
    }
  }

  protected async fetchPageWithRetry(
    context: AdapterFetchContext,
    cursor: string | null,
    retry: RetryConfig = DEFAULT_RETRY,
  ): Promise<FetchPageResult> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= retry.maxAttempts; attempt++) {
      try {
        return await this.fetchPage(context, cursor);
      } catch (err) {
        lastError = err;
        if (context.signal?.aborted) throw err;
        if (attempt >= retry.maxAttempts) break;
        if (!isRetryable(err)) throw err;
        const delay = Math.min(retry.maxDelayMs, retry.baseDelayMs * 2 ** (attempt - 1));
        const jitter = Math.floor(Math.random() * delay * 0.2);
        await sleep(delay + jitter, context.signal);
      }
    }
    throw lastError;
  }

  protected async httpGetJson(
    url: string,
    headers: Record<string, string>,
    signal: AbortSignal | undefined,
    timeoutMs: number,
  ): Promise<FetchPageResult> {
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    signal?.addEventListener('abort', onAbort);
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json', ...headers },
        signal: controller.signal,
      });
      const rawText = await res.text();
      let payload: unknown = null;
      try {
        payload = rawText ? JSON.parse(rawText) : null;
      } catch {
        const err = new Error(`JSON parse failed (${res.status}) from ${url}`);
        (err as Error & { httpStatus: number }).httpStatus = res.status;
        throw err;
      }
      if (!res.ok) {
        const err = new Error(`HTTP ${res.status} from ${url}: ${rawText.slice(0, 200)}`);
        (err as Error & { httpStatus: number }).httpStatus = res.status;
        throw err;
      }
      return { rawText, payload, httpStatus: res.status, nextCursor: null, providerReportedTotal: null };
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', onAbort);
    }
  }

  protected authHeaders(context: AdapterFetchContext): Record<string, string> {
    const cfg = context.config;
    if (!cfg.requiresAuth) return {};
    if (!context.apiKey) {
      throw new Error(`Provider ${this.provider} requires auth but no system apiKey supplied`);
    }
    const headerName = cfg.authHeaderName || 'Authorization';
    const prefix = cfg.authPrefix ?? 'Bearer ';
    return { [headerName]: `${prefix}${context.apiKey}` };
  }
}

function isRetryable(err: unknown): boolean {
  if (!err || typeof err !== 'object') return true;
  const httpStatus = (err as { httpStatus?: number }).httpStatus;
  if (httpStatus == null) return true;
  if (httpStatus === 408 || httpStatus === 429) return true;
  if (httpStatus >= 500) return true;
  return false;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('aborted', 'AbortError'));
      return;
    }
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new DOMException('aborted', 'AbortError'));
    }, { once: true });
  });
}

export function pricingFromApiFields(args: {
  input?: number | null;
  output?: number | null;
  reasoning?: number | null;
  cachedInput?: number | null;
  currency?: string;
  source: SuppliedPricing['source'];
  sourceDetail?: string | null;
}): SuppliedPricing {
  const toSupplied = (v: number | null | undefined) => {
    if (v === undefined || v === null || Number.isNaN(v)) {
      return { supplied: false as const, value: null };
    }
    return { supplied: true as const, value: String(v) };
  };
  return {
    input: toSupplied(args.input),
    output: toSupplied(args.output),
    reasoning: toSupplied(args.reasoning),
    cachedInput: toSupplied(args.cachedInput),
    currency: args.currency ?? 'USD',
    source: args.source,
    sourceDetail: args.sourceDetail ?? null,
  };
}

export function toPerMillion(value: number, unit: 'per_token' | 'per_thousand' | 'per_million'): number {
  switch (unit) {
    case 'per_token': return value * 1_000_000;
    case 'per_thousand': return value * 1_000;
    case 'per_million': return value;
  }
}