import { V3Provider, ModelLifecycleState } from './enums';

export { V3Provider, ModelLifecycleState };

export const LIFECYCLE_TRANSITIONS: Record<
  ModelLifecycleState,
  ModelLifecycleState[]
> = {
  preview: ['active', 'beta', 'deprecated', 'discontinued'],
  beta: ['active', 'deprecated', 'discontinued'],
  active: ['deprecated', 'discontinued'],
  deprecated: ['discontinued', 'active'],
  discontinued: [],
  unknown: ['active', 'beta', 'preview', 'deprecated', 'discontinued'],
};

export const CATALOGUE_ACTIVE_STATES: ModelLifecycleState[] = [
  'active',
  'beta',
  'preview',
];

export const PricingSource = {
  API: 'api',
  MANUAL: 'manual',
  OVERRIDE: 'override',
  DEFAULT: 'default',
} as const;

export type PricingSource =
  | 'api'
  | 'manual'
  | 'override'
  | 'default';

export const SyncSource = {
  CRON: 'cron',
  MANUAL: 'manual',
  STARTUP: 'startup',
  WEBHOOK: 'webhook',
} as const;

export type SyncSource =
  | 'cron'
  | 'manual'
  | 'startup'
  | 'webhook';

export const CatalogueCompletenessResult = {
  COMPLETE: 'COMPLETE',
  PARTIAL: 'PARTIAL',
  EMPTY: 'EMPTY',
  FAILED: 'FAILED',
} as const;

export type CatalogueCompletenessResult =
  | 'COMPLETE'
  | 'PARTIAL'
  | 'EMPTY'
  | 'FAILED';

export interface SuppliedPricing {
  promptUsdPerM?: number;
  completionUsdPerM?: number;
  requestUsd?: number;
}

export interface RawCatalogueEntry {
  id: string;
  name?: string;
  provider: V3Provider;
  created?: number;
  contextWindow?: number;
  maxOutputTokens?: number;
  pricing?: SuppliedPricing;
  pricingSource?: PricingSource;
  rawPayload?: Record<string, unknown>;
}

export interface ModelPricingSnapshot {
  promptUsdPerM: number;
  completionUsdPerM: number;
  effectiveAt: string;
  source: PricingSource;
}

export type SyncErrorCategory =
  | 'auth'
  | 'rate_limit'
  | 'network'
  | 'parse'
  | 'db';

export interface OperationError {
  category: SyncErrorCategory;
  message: string;
  code?: string;
  timestamp: string;
}

export interface ProviderCatalogueConfig {
  provider: V3Provider;
  enabled: boolean;
  syncIntervalMinutes?: number;
  endpoint?: string;
}

export interface CatalogueSyncResult {
  provider: V3Provider;
  success: boolean;
  totalFetched: number;
  totalUpserted: number;
  completeness: CatalogueCompletenessResult;
  errors?: OperationError[];
  syncedAt: string;
}
