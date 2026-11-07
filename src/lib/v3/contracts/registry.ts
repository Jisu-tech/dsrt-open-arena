/**
 * DSRT Open Arena V3 — Dynamic Registry Contracts (CORRECTED)
 * 
 * Key architectural corrections from the prior version:
 * 
 * 1. LIFECYCLE vs ACCESSIBILITY ARE SEPARATED
 *    - lifecycle_state is global (did provider list this model? is DSRT supported?)
 *    - accessibility is per-workspace (do THIS workspace's credentials work?)
 *    - These are computed/queried independently, never stored on the same column
 * 
 * 2. PRICING IS NEVER OVERWRITTEN
 *    - Every pricing change creates a new immutable snapshot
 *    - The model row holds a pointer to the current snapshot
 *    - Missing pricing from a new source does NOT erase prior pricing
 * 
 * 3. FIELD PRESENCE IS TRACKED EXPLICITLY
 *    - Every pricing field has a "supplied" flag
 *    - Distinguishes "source said null" from "source didn't mention this field"
 * 
 * 4. RETIREMENT REQUIRES EVIDENCE
 *    - A single sync absence does NOT retire a model
 *    - Requires N consecutive absences from VALIDATED-COMPLETE catalogue responses
 * 
 * @module v3/contracts/registry
 */

import type { ProviderRegistryEntryId, WorkspaceId, UserId } from './identifiers';
import type { ISOTimestamp, MonetaryValue } from './metadata';
import type { V3Provider, ModelCapability, ModelTier } from './enums';

// ─────────────────────────────────────────────
// Lifecycle (global, catalogue-level ONLY)
// ─────────────────────────────────────────────

/**
 * Catalogue lifecycle state. Describes the model's status in the GLOBAL registry.
 * Does NOT indicate whether any specific user or workspace can access it.
 * For per-workspace accessibility, see WorkspaceModelAccessibility.
 */
export enum ModelLifecycleState {
  /** Found in provider catalogue. Not yet confirmed as DSRT-supported. */
  DISCOVERED = 'discovered',

  /** DSRT has a working adapter for this provider and this model. */
  SUPPORTED = 'supported',

  /** Observed absent from recent syncs but not yet confirmed retired. */
  RETIREMENT_PENDING = 'retirement_pending',

  /** Confirmed removed from provider catalogue. */
  RETIRED = 'retired',

  /** Provider API is failing; previous catalogue data preserved. */
  STALE = 'stale',

  /** Administratively disabled (e.g., known broken, policy violation). */
  QUARANTINED = 'quarantined',
}

/**
 * Lifecycle states indicating the model exists in the catalogue and could be used.
 * NOT a proof of accessibility — only a proof that the model is not retired or quarantined.
 */
export const CATALOGUE_ACTIVE_STATES: ReadonlySet<ModelLifecycleState> = new Set([
  ModelLifecycleState.DISCOVERED,
  ModelLifecycleState.SUPPORTED,
  ModelLifecycleState.RETIREMENT_PENDING, // Still works, just under watch
  ModelLifecycleState.STALE, // Preserved data; may still work
]);

/**
 * Valid lifecycle transitions. Enforced at the service layer.
 */
export const LIFECYCLE_TRANSITIONS: Readonly<Record<ModelLifecycleState, readonly ModelLifecycleState[]>> = {
  [ModelLifecycleState.DISCOVERED]: [
    ModelLifecycleState.SUPPORTED,
    ModelLifecycleState.RETIREMENT_PENDING,
    ModelLifecycleState.STALE,
    ModelLifecycleState.QUARANTINED,
  ],
  [ModelLifecycleState.SUPPORTED]: [
    ModelLifecycleState.RETIREMENT_PENDING,
    ModelLifecycleState.STALE,
    ModelLifecycleState.QUARANTINED,
    ModelLifecycleState.DISCOVERED, // Adapter removed
  ],
  [ModelLifecycleState.RETIREMENT_PENDING]: [
    ModelLifecycleState.SUPPORTED, // Found again — reset
    ModelLifecycleState.DISCOVERED,
    ModelLifecycleState.RETIRED,
    ModelLifecycleState.STALE,
    ModelLifecycleState.QUARANTINED,
  ],
  [ModelLifecycleState.RETIRED]: [
    ModelLifecycleState.DISCOVERED, // Re-listed by provider
  ],
  [ModelLifecycleState.STALE]: [
    ModelLifecycleState.DISCOVERED,
    ModelLifecycleState.SUPPORTED,
    ModelLifecycleState.RETIREMENT_PENDING,
    ModelLifecycleState.RETIRED,
    ModelLifecycleState.QUARANTINED,
  ],
  [ModelLifecycleState.QUARANTINED]: [
    ModelLifecycleState.DISCOVERED,
    ModelLifecycleState.SUPPORTED,
  ],
};

// ─────────────────────────────────────────────
// Workspace-Level Accessibility (DERIVED, NOT STORED on model row)
// ─────────────────────────────────────────────

/**
 * Per-workspace accessibility status. COMPUTED from:
 *   - Global lifecycle state of the model
 *   - Whether workspace has credentials for the provider
 *   - Most recent verification record for this workspace + model
 * 
 * Not stored on v3_provider_models. Queried per-workspace via accessibility functions.
 */
export enum WorkspaceAccessibility {
  /** Workspace can and has successfully invoked this model. */
  VERIFIED = 'verified',

  /** Workspace has credentials and model is supported; not yet verified. */
  PRESUMED_ACCESSIBLE = 'presumed_accessible',

  /** Model is supported but workspace has no credentials for this provider. */
  NO_CREDENTIALS = 'no_credentials',

  /** Model exists in catalogue but DSRT does not have an adapter. */
  NOT_SUPPORTED = 'not_supported',

  /** Last verification attempt failed with authentication/authorization error. */
  CREDENTIALS_INVALID = 'credentials_invalid',

  /** Last verification attempt failed with quota/rate limit error. */
  QUOTA_EXCEEDED = 'quota_exceeded',

  /** Model is retired or quarantined globally. */
  CATALOGUE_UNAVAILABLE = 'catalogue_unavailable',

  /** Recent verification attempts failed with provider/network errors. */
  PROVIDER_FAILING = 'provider_failing',
}

/**
 * Computed accessibility result for a specific workspace + model.
 */
export interface WorkspaceModelAccessibility {
  readonly modelEntryId: ProviderRegistryEntryId;
  readonly workspaceId: WorkspaceId;
  readonly provider: V3Provider;
  readonly providerModelId: string;

  readonly accessibility: WorkspaceAccessibility;

  /** The global catalogue lifecycle state. */
  readonly lifecycleState: ModelLifecycleState;

  /** Does the workspace have a credential for this provider? */
  readonly hasCredentials: boolean;

  /** Does DSRT have a working adapter for this provider? */
  readonly adapterAvailable: boolean;

  /** The most recent verification outcome for this workspace + model (if any). */
  readonly lastVerification: {
    readonly verifiedAt: ISOTimestamp;
    readonly success: boolean;
    readonly errorCategory: VerificationErrorCategory | null;
  } | null;

  readonly computedAt: ISOTimestamp;
}

// ─────────────────────────────────────────────
// Sync Source Provenance
// ─────────────────────────────────────────────

export enum SyncSource {
  CATALOGUE_API = 'catalogue_api',           // Fetched from provider's model listing API
  CURATED_MANIFEST = 'curated_manifest',     // DSRT-maintained list (used for providers without public API)
  MANUAL_ADMIN = 'manual_admin',             // Entered by an administrator
  STATIC_SEED = 'static_seed',               // From migration seed data (deprecated for new entries)
  OPENROUTER_INDEX = 'openrouter_index',     // Discovered via OpenRouter aggregator
}

export enum PricingSource {
  PROVIDER_API_RESPONSE = 'provider_api_response',
  PROVIDER_DOCS = 'provider_docs',
  MANUAL_ADMIN = 'manual_admin',
  AGGREGATOR_OPENROUTER = 'aggregator_openrouter',
  INHERITED = 'inherited', // Carried forward because the new source did not supply pricing
}

// ─────────────────────────────────────────────
// Pricing Snapshot (immutable)
// ─────────────────────────────────────────────

/**
 * A single immutable pricing record. Every pricing change creates a new snapshot.
 * The model row's current_pricing_snapshot_id points to the active snapshot.
 * 
 * Critical: each price field has a "supplied" boolean. This distinguishes:
 *   - supplied=true, value=null:   source confirmed "we don't know / not applicable"
 *   - supplied=false:              source did not address this field at all
 *   - supplied=true, value=0:      source confirmed "free"
 *   - supplied=true, value=X:      source confirmed "X per million tokens"
 */
export interface ModelPricingSnapshot {
  readonly id: string;
  readonly modelEntryId: ProviderRegistryEntryId;

  readonly inputPricePerMillion: MonetaryValue | null;
  readonly outputPricePerMillion: MonetaryValue | null;
  readonly reasoningPricePerMillion: MonetaryValue | null;
  readonly cachedInputPricePerMillion: MonetaryValue | null;

  readonly inputPriceSupplied: boolean;
  readonly outputPriceSupplied: boolean;
  readonly reasoningPriceSupplied: boolean;
  readonly cachedInputPriceSupplied: boolean;

  readonly currency: string;

  readonly pricingSource: PricingSource;
  readonly pricingSourceDetail: string | null;

  readonly contentHash: string;
  readonly previousSnapshotId: string | null;
  readonly changeSummary: string | null;

  readonly effectiveFrom: ISOTimestamp;
  readonly recordedAt: ISOTimestamp;
  readonly recordedBy: string | null;
}

/**
 * Field-level pricing supplied from a source. Used by normalizers and sync engines.
 */
export interface SuppliedPrice {
  readonly supplied: boolean;
  readonly value: MonetaryValue | null;
}

/**
 * Complete pricing block from a source, with explicit field presence.
 */
export interface SuppliedPricing {
  readonly input: SuppliedPrice;
  readonly output: SuppliedPrice;
  readonly reasoning: SuppliedPrice;
  readonly cachedInput: SuppliedPrice;
  readonly currency: string;
  readonly source: PricingSource;
  readonly sourceDetail: string | null;
}

// ─────────────────────────────────────────────
// Registry Entry (Global)
// ─────────────────────────────────────────────

export interface DynamicRegistryEntry {
  readonly id: ProviderRegistryEntryId;
  readonly provider: V3Provider;
  readonly providerModelId: string;
  readonly displayName: string;
  readonly tier: ModelTier;
  readonly capabilities: readonly ModelCapability[];
  readonly contextWindow: number | null;
  readonly maxOutputTokens: number | null;
  readonly supportsStreaming: boolean;
  readonly supportsStructuredOutput: boolean;
  readonly supportsVision: boolean;
  readonly supportsToolUse: boolean;

  // Lifecycle (global)
  readonly lifecycleState: ModelLifecycleState;
  readonly catalogueLastSeenAt: ISOTimestamp | null;
  readonly absenceCount: number;
  readonly lastAbsenceAt: ISOTimestamp | null;
  readonly retirementConfirmedReason: string | null;

  // Pricing pointer
  readonly currentPricingSnapshotId: string | null;

  // Identity
  readonly canonicalModelFamily: string | null;
  readonly metadataContentHash: string | null;

  // Provenance
  readonly syncSource: SyncSource;
  readonly discoveredAt: ISOTimestamp;
  readonly lastSyncedAt: ISOTimestamp;

  readonly notes: string | null;
  readonly createdAt: ISOTimestamp;
  readonly updatedAt: ISOTimestamp;
}

// ─────────────────────────────────────────────
// Catalogue Response + Completeness
// ─────────────────────────────────────────────

/**
 * Catalogue completeness check result.
 * A sync will NOT contribute to absence tracking unless completeness passed.
 */
export enum CatalogueCompletenessResult {
  PASSED = 'passed',
  FAILED_TOO_FEW = 'failed_too_few',
  FAILED_PAGINATION_INCOMPLETE = 'failed_pagination_incomplete',
  FAILED_PROVIDER_SIGNALED_PARTIAL = 'failed_provider_signaled_partial',
  NOT_CHECKED = 'not_checked',
}

/**
 * Raw catalogue entry as returned by a provider adapter.
 * Normalizer transforms this into the registry format.
 */
export interface RawCatalogueEntry {
  readonly providerModelId: string;
  readonly displayName: string | null;
  readonly ownedBy: string | null;
  readonly contextWindow: number | null;
  readonly maxOutputTokens: number | null;
  readonly capabilities: readonly string[];
  readonly pricing: SuppliedPricing | null;
  readonly supportsStreaming: boolean | null;
  readonly supportsStructuredOutput: boolean | null;
  readonly supportsVision: boolean | null;
  readonly supportsToolUse: boolean | null;
  readonly rawData: Record<string, unknown>;
}

/**
 * Complete result from a catalogue adapter.
 */
export interface CatalogueSyncResult {
  readonly provider: V3Provider;
  readonly entries: readonly RawCatalogueEntry[];
  readonly fetchedAt: ISOTimestamp;
  readonly completeness: CatalogueCompletenessResult;
  readonly completenessDetail: string | null;
  readonly rawResponseHash: string;  // SHA-256 of the raw response
  readonly responseMetadata: Record<string, unknown> | null;
}

// ─────────────────────────────────────────────
// Sync Operation
// ─────────────────────────────────────────────

export type SyncStatus = 'success' | 'partial_success' | 'failed' | 'skipped' | 'locked' | 'in_progress';

export type SyncErrorCategory =
  | 'authentication' | 'authorization' | 'rate_limit' | 'quota_exceeded'
  | 'network_error' | 'timeout' | 'parse_error' | 'validation_error'
  | 'database_error' | 'lock_error' | 'unknown';

export type VerificationType =
  | 'initial_discovery' | 'periodic' | 'user_triggered'
  | 'credential_change' | 'failure_retest' | 'manual';

export type VerificationErrorCategory =
  | 'authentication' | 'authorization' | 'rate_limit' | 'quota_exceeded'
  | 'model_not_found' | 'invalid_request' | 'provider_error'
  | 'network_error' | 'timeout' | 'unknown';

export interface ProviderCatalogueConfig {
  readonly provider: V3Provider;
  readonly syncEnabled: boolean;
  readonly syncIntervalSeconds: number;
  readonly lastSyncStartedAt: ISOTimestamp | null;
  readonly lastSyncCompletedAt: ISOTimestamp | null;
  readonly lastSyncStatus: SyncStatus | null;
  readonly lastSyncError: string | null;
  readonly lastSyncDurationMs: number | null;
  readonly consecutiveFailureCount: number;
  readonly backoffUntil: ISOTimestamp | null;
  readonly catalogueApiUrl: string | null;
  readonly requiresAuth: boolean;
  readonly authHeaderName: string;
  readonly authPrefix: string;
  readonly maxRequestsPerMinute: number | null;
  readonly requestTimeoutMs: number;
  readonly absenceThresholdForRetirementPending: number;
  readonly absenceThresholdForRetirement: number;
  readonly minExpectedCatalogueSize: number;
  readonly modelsDiscovered: number;
  readonly modelsAdded: number;
  readonly modelsUpdated: number;
  readonly modelsMarkedAbsent: number;
  readonly pricingSnapshotsCreated: number;
  readonly adapterConfig: Record<string, unknown>;
}

export interface SyncOperationResult {
  readonly provider: V3Provider;
  readonly status: SyncStatus;
  readonly errorMessage: string | null;
  readonly errorCategory: SyncErrorCategory | null;

  readonly catalogueResponseReceived: boolean;
  readonly catalogueEntryCount: number | null;
  readonly catalogueCompletenessCheck: CatalogueCompletenessResult;

  readonly modelsDiscovered: number;
  readonly modelsAdded: number;
  readonly modelsUpdated: number;
  readonly modelsMarkedAbsent: number;
  readonly modelsLifecycleTransitioned: number;
  readonly pricingSnapshotsCreated: number;
  readonly databaseErrors: number;

  readonly operationErrors: readonly OperationError[];
  readonly startedAt: ISOTimestamp;
  readonly completedAt: ISOTimestamp;
  readonly durationMs: number;
}

export interface OperationError {
  readonly operation: string;
  readonly modelId: string | null;
  readonly error: string;
  readonly category: SyncErrorCategory;
}

// ─────────────────────────────────────────────
// Verification Records
// ─────────────────────────────────────────────

export interface ModelVerificationRecord {
  readonly id: string;
  readonly modelEntryId: ProviderRegistryEntryId;
  readonly workspaceId: WorkspaceId | null;
  readonly userId: UserId | null;
  readonly provider: V3Provider;
  readonly providerModelId: string;
  readonly success: boolean;
  readonly httpStatus: number | null;
  readonly errorCode: string | null;
  readonly errorMessage: string | null;
  readonly errorCategory: VerificationErrorCategory | null;
  readonly responseTimeMs: number | null;
  readonly testInputTokens: number | null;
  readonly testOutputTokens: number | null;
  readonly testCost: MonetaryValue | null;
  readonly verificationType: VerificationType;
  readonly verifiedAt: ISOTimestamp;
}

// ─────────────────────────────────────────────
// Coverage Metrics
// ─────────────────────────────────────────────

export interface RegistryCoverageMetrics {
  readonly providerCoverage: ProviderCoverageMetric;
  readonly catalogueCoverage: CatalogueCoverageMetric;
  readonly verifiedAvailability: VerifiedAvailabilityMetric;
  readonly computedAt: ISOTimestamp;
}

export interface ProviderCoverageMetric {
  readonly totalConfiguredProviders: number;
  readonly syncEnabledProviders: number;
  readonly providersWithSuccessfulSync: number;
  readonly providersWithFailingSync: number;
  readonly providers: readonly {
    readonly provider: V3Provider;
    readonly syncEnabled: boolean;
    readonly lastSyncStatus: SyncStatus | null;
    readonly lastSyncAt: ISOTimestamp | null;
    readonly modelCount: number;
    readonly consecutiveFailureCount: number;
  }[];
}

export interface CatalogueCoverageMetric {
  readonly totalRegistryEntries: number;
  readonly byProvider: readonly { readonly provider: V3Provider; readonly count: number }[];
  readonly byLifecycleState: readonly { readonly state: ModelLifecycleState; readonly count: number }[];
  readonly byTier: readonly { readonly tier: ModelTier; readonly count: number }[];
  readonly withKnownPricing: number;
  readonly withoutKnownPricing: number;
}

export interface VerifiedAvailabilityMetric {
  readonly workspaceId: WorkspaceId | null; // null = system-wide
  readonly totalModelsInRegistry: number;
  readonly totalVerifiedByThisWorkspace: number;
  readonly totalVerifiedBySomeWorkspace: number;
  readonly verificationRate: number | null;
  readonly lastVerificationAt: ISOTimestamp | null;
  readonly byProvider: readonly {
    readonly provider: V3Provider;
    readonly totalInRegistry: number;
    readonly verifiedByThisWorkspace: number;
    readonly verifiedBySomeWorkspace: number;
  }[];
}