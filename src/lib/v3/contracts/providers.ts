/**
 * DSRT Open Arena V3 — Provider Registry Contracts
 * 
 * Defines the provider and model registry contracts. All model information,
 * pricing, and capabilities come from the registry — never hardcoded.
 * 
 * The registry supports two tiers:
 * 1. Database-backed: For production pricing and capabilities, updated without deploys.
 * 2. Static fallback: The existing MODEL_REGISTRY, used only when DB is unavailable.
 * 
 * @module v3/contracts/providers
 */

import type { ProviderRegistryEntryId } from './identifiers';
import type {
  ISOTimestamp,
  AuditFields,
  MonetaryValue,
} from './metadata';
import { V3Provider, ModelCapability, ModelTier } from './enums';

// ─────────────────────────────────────────────
// Provider Registry Entry
// ─────────────────────────────────────────────

/**
 * A model entry in the provider registry.
 * This is the single source of truth for model capabilities and pricing.
 */
export interface ProviderRegistryEntry extends AuditFields {
  readonly id: ProviderRegistryEntryId;

  /** The provider that serves this model. */
  readonly provider: V3Provider;

  /** The model identifier as known to the provider's API. */
  readonly providerModelId: string;

  /** The canonical display name. */
  readonly displayName: string;

  /** Model tier classification. */
  readonly tier: ModelTier;

  /** Supported capabilities. */
  readonly capabilities: readonly ModelCapability[];

  /** Maximum context window in tokens. null if unknown. */
  readonly contextWindow: number | null;

  /** Maximum output tokens. null if unknown or no explicit limit. */
  readonly maxOutputTokens: number | null;

  /** Whether the model supports streaming. */
  readonly supportsStreaming: boolean;

  /** Whether the model supports structured output / JSON mode. */
  readonly supportsStructuredOutput: boolean;

  /** Whether the model supports vision/image inputs. */
  readonly supportsVision: boolean;

  /** Whether the model supports tool/function calling. */
  readonly supportsToolUse: boolean;

  /** Pricing information. */
  readonly pricing: ModelPricing;

  /** Whether this model is currently available for use. */
  readonly isActive: boolean;

  /** Whether this model is deprecated. */
  readonly isDeprecated: boolean;

  /** Deprecation date, if applicable. */
  readonly deprecatedAt: ISOTimestamp | null;

  /** Optional notes (e.g., "beta", "preview", known limitations). */
  readonly notes: string | null;
}

// ─────────────────────────────────────────────
// Model Pricing
// ─────────────────────────────────────────────

/**
 * Pricing for a model. All values are per-million-tokens in USD.
 * Stored as decimal-safe strings.
 * 
 * null means "pricing unknown" — not "free".
 * "0" means "actually free for this token type".
 */
export interface ModelPricing {
  /** Cost per million input tokens. */
  readonly inputPricePerMillion: MonetaryValue | null;

  /** Cost per million output tokens. */
  readonly outputPricePerMillion: MonetaryValue | null;

  /** Cost per million reasoning tokens (for reasoning models). */
  readonly reasoningPricePerMillion: MonetaryValue | null;

  /** Cost per million cached input tokens (for providers with prompt caching). */
  readonly cachedInputPricePerMillion: MonetaryValue | null;

  /** Version identifier for this pricing data. Used in cost calculation audit trail. */
  readonly pricingVersion: string;

  /** When this pricing was last verified/updated. */
  readonly lastVerifiedAt: ISOTimestamp;

  /** Source of this pricing data. */
  readonly source: 'provider_api' | 'provider_docs' | 'manual_entry' | 'static_fallback';
}

// ─────────────────────────────────────────────
// Registry Query Types
// ─────────────────────────────────────────────

/**
 * Filter for querying the provider registry.
 */
export interface RegistryFilter {
  readonly provider?: V3Provider;
  readonly tier?: ModelTier;
  readonly capabilities?: readonly ModelCapability[];
  readonly isActive?: boolean;
  readonly supportsStreaming?: boolean;
}

/**
 * Result of looking up a model in the registry.
 * Includes the source of the data for transparency.
 */
export interface RegistryLookupResult {
  readonly entry: ProviderRegistryEntry;
  /** Whether this came from the database or the static fallback. */
  readonly source: 'database' | 'static_fallback';
}

// ─────────────────────────────────────────────
// Provider Health
// ─────────────────────────────────────────────

/**
 * Real-time provider health status.
 * Used for routing decisions and failure detection.
 */
export interface ProviderHealthStatus {
  readonly provider: V3Provider;
  readonly isAvailable: boolean;
  readonly lastSuccessAt: ISOTimestamp | null;
  readonly lastFailureAt: ISOTimestamp | null;
  readonly recentErrorRate: number | null;
  readonly averageLatencyMs: number | null;
  readonly checkedAt: ISOTimestamp;
}

// ─────────────────────────────────────────────
// Credential Reference
// ─────────────────────────────────────────────

/**
 * A reference to a stored credential — never contains the actual secret.
 * The actual key is resolved only at the gateway boundary.
 */
export interface CredentialReference {
  /** The provider this credential is for. */
  readonly provider: V3Provider;

  /** Whether a credential is available for this provider in the user's workspace. */
  readonly isAvailable: boolean;

  /** When the credential was last validated. null if never validated. */
  readonly lastValidatedAt: ISOTimestamp | null;

  /** Whether the credential passed its last validation. null if never validated. */
  readonly isValid: boolean | null;
}