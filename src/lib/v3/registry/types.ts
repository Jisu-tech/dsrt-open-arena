/**
 * DSRT Open Arena V3 — Registry Adapter Interface (CORRECTED)
 * 
 * Adapter interface contract. Each provider adapter MUST:
 *   - Discover ALL models the provider returns (no name-pattern filtering)
 *   - Report completeness explicitly (pagination, partial responses)
 *   - Handle its own pagination; return only fully-paginated results
 *   - Never fabricate pricing — pricing is supplied=false unless the API returns it
 *   - Return the raw response hash for audit
 * 
 * @module v3/registry/types
 */

import type { V3Provider } from '../contracts/enums';
import type {
  CatalogueSyncResult,
  ProviderCatalogueConfig,
  RawCatalogueEntry,
} from '../contracts/registry';

/**
 * Credential resolver function. The sync engine passes this to adapters.
 * Adapters NEVER fetch credentials directly.
 */
export type CatalogueKeyResolver = (provider: V3Provider) => Promise<string | null>;

/**
 * Fetch options passed to adapters.
 */
export interface AdapterFetchContext {
  readonly apiKey: string | null;
  readonly config: ProviderCatalogueConfig;
  readonly signal?: AbortSignal;  // For cancellation
  readonly heartbeat?: () => Promise<void>;  // Long syncs call this periodically
}

/**
 * The adapter contract. Every provider catalogue adapter implements this.
 */
export interface CatalogueAdapter {
  readonly provider: V3Provider;
  readonly displayName: string;

  /**
   * Whether this adapter fetches from a remote catalogue API.
   * false = adapter uses a curated manifest (e.g., Anthropic).
   */
  readonly supportsRemoteFetch: boolean;

  /**
   * Declared capability: does this adapter support pagination?
   * Adapters MUST paginate fully before returning. This flag is informational.
   */
  readonly supportsPagination: boolean;

  /**
   * Fetch the complete, paginated catalogue from the provider.
   * MUST paginate fully OR report completeness as FAILED_PAGINATION_INCOMPLETE.
   * MUST compute the raw response hash.
   * MUST classify completeness explicitly.
   */
  fetchCatalogue(context: AdapterFetchContext): Promise<CatalogueSyncResult>;

  /**
   * Infer the canonical model family from a provider model ID.
   * Used to group "same model, different provider" entries.
   * Returns null if no family mapping is defined.
   */
  inferModelFamily(providerModelId: string): string | null;

  /**
   * Compute the content hash of a catalogue entry (SHA-256, excluding pricing).
   * Used to detect metadata changes between syncs.
   */
  computeEntryHash(entry: RawCatalogueEntry): Promise<string>;
}

/**
 * Registry of all available catalogue adapters, keyed by provider.
 */
export type AdapterRegistry = ReadonlyMap<V3Provider, CatalogueAdapter>;