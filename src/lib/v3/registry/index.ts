// 1. Types & Interfaces
export type { CatalogueAdapter, AdapterFetchContext } from './types';

// 2. Pure state management
export { determineNewLifecycleState, QUARANTINED } from './availability';
export { computeWorkspaceAccessibility } from './accessibility';

// 3. Pricing & Hashing
export { mergePricingSnapshots } from './pricing-merge';
export { sha256Hex } from './content-hash';

// 4. Core Registry Sync Engine
export { syncProvider, syncAllDueProviders, type SyncEngineConfig } from './sync-engine';
export { getDueProviders, type DueProvider } from './sync-scheduler';
export { normalizeCatalogueEntry, buildSuppliedPricing, convertUnit } from './normalizer';
export { reconcileProviderCatalogue } from './reconciler';
export { runVerificationProbe } from './verification-runner';

// 5. Adapters
export {
  createAdapter,
  createAdapterRegistry,
  listRegisteredProviders,
  BaseCatalogueAdapter,
  pricingFromApiFields,
  toPerMillion,
  OpenAICatalogueAdapter,
  AnthropicCatalogueAdapter,
  GoogleCatalogueAdapter,
  DeepSeekCatalogueAdapter,
  GroqCatalogueAdapter,
  MistralCatalogueAdapter,
  OpenRouterCatalogueAdapter,
  XaiCatalogueAdapter,
  CohereCatalogueAdapter,
} from './adapters';