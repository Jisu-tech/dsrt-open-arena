/**
 * DSRT Open Arena V3 — Workspace Accessibility Computation (NEW)
 * 
 * Computes per-workspace model accessibility from:
 *   1. Global lifecycle state (from v3_provider_models)
 *   2. Workspace credential availability (from existing credentials system)
 *   3. Most recent verification record for this workspace + model
 * 
 * This is COMPUTED, not stored on the model row — accessibility is per-workspace
 * and changes with credentials, verifications, and lifecycle state.
 * 
 * @module v3/registry/accessibility
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { WorkspaceId, ProviderRegistryEntryId } from '../contracts/identifiers';
import { V3Provider } from '../contracts/enums';
import {
  ModelLifecycleState,
  WorkspaceAccessibility,
  type WorkspaceModelAccessibility,
  type VerificationErrorCategory,
} from '../contracts/registry';

// ─────────────────────────────────────────────
// Pure accessibility computation
// ─────────────────────────────────────────────

export interface AccessibilityInputs {
  readonly lifecycleState: ModelLifecycleState;
  readonly adapterAvailable: boolean;
  readonly hasWorkspaceCredentials: boolean;
  readonly mostRecentVerification: {
    readonly success: boolean;
    readonly errorCategory: VerificationErrorCategory | null;
    readonly verifiedAt: string;
  } | null;
  /** Maximum age for a verification to be considered valid. */
  readonly verificationValidityMs?: number;
}

const DEFAULT_VERIFICATION_VALIDITY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Pure function: compute accessibility from inputs.
 */
export function computeAccessibility(inputs: AccessibilityInputs): WorkspaceAccessibility {
  const validityMs = inputs.verificationValidityMs ?? DEFAULT_VERIFICATION_VALIDITY_MS;

  // Catalogue-terminated states short-circuit
  if (inputs.lifecycleState === ModelLifecycleState.RETIRED ||
      inputs.lifecycleState === ModelLifecycleState.QUARANTINED) {
    return WorkspaceAccessibility.CATALOGUE_UNAVAILABLE;
  }

  // No adapter = cannot be used regardless of credentials
  if (!inputs.adapterAvailable) {
    return WorkspaceAccessibility.NOT_SUPPORTED;
  }

  // Check recent verification first (most authoritative signal)
  if (inputs.mostRecentVerification !== null) {
    const verifiedAt = new Date(inputs.mostRecentVerification.verifiedAt).getTime();
    const age = Date.now() - verifiedAt;

    if (age < validityMs) {
      // Recent verification — use its outcome
      if (inputs.mostRecentVerification.success) {
        return WorkspaceAccessibility.VERIFIED;
      }

      // Recent failure — classify by error category
      const cat = inputs.mostRecentVerification.errorCategory;
      switch (cat) {
        case 'authentication':
        case 'authorization':
          return WorkspaceAccessibility.CREDENTIALS_INVALID;
        case 'rate_limit':
        case 'quota_exceeded':
          return WorkspaceAccessibility.QUOTA_EXCEEDED;
        case 'provider_error':
        case 'network_error':
        case 'timeout':
          return WorkspaceAccessibility.PROVIDER_FAILING;
        case 'model_not_found':
          return WorkspaceAccessibility.CATALOGUE_UNAVAILABLE;
        default:
          // Fall through to credential check
          break;
      }
    }
  }

  // No recent verification — use credential signal
  if (!inputs.hasWorkspaceCredentials) {
    return WorkspaceAccessibility.NO_CREDENTIALS;
  }

  return WorkspaceAccessibility.PRESUMED_ACCESSIBLE;
}

// ─────────────────────────────────────────────
// Database-backed computation for a single model + workspace
// ─────────────────────────────────────────────

export interface AccessibilityComputationOptions {
  readonly verificationValidityMs?: number;
}

/**
 * Compute accessibility for a single workspace + model pair using the database.
 */
export async function getWorkspaceModelAccessibility(
  supabase: SupabaseClient,
  workspaceId: WorkspaceId,
  modelEntryId: ProviderRegistryEntryId,
  hasWorkspaceCredentials: boolean,
  adapterAvailable: boolean,
  options: AccessibilityComputationOptions = {},
): Promise<WorkspaceModelAccessibility | null> {
  // Load the model entry
  const { data: modelRow, error: modelError } = await supabase
    .from('v3_provider_models')
    .select('id, provider, provider_model_id, lifecycle_state')
    .eq('id', modelEntryId)
    .single();

  if (modelError || !modelRow) {
    return null;
  }

  // Load most recent verification record for this workspace + model
  const { data: verifRow, error: verifError } = await supabase
    .from('v3_model_verification_records')
    .select('success, error_category, verified_at')
    .eq('model_entry_id', modelEntryId)
    .eq('workspace_id', workspaceId)
    .order('verified_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // verifError is acceptable if no rows — maybeSingle returns null
  if (verifError && verifError.code !== 'PGRST116') {
    throw new Error(`Failed to load verification records: ${verifError.message}`);
  }

  const lifecycleState = modelRow.lifecycle_state as ModelLifecycleState;

  const accessibility = computeAccessibility({
    lifecycleState,
    adapterAvailable,
    hasWorkspaceCredentials,
    mostRecentVerification: verifRow ? {
      success: verifRow.success,
      errorCategory: verifRow.error_category as VerificationErrorCategory | null,
      verifiedAt: verifRow.verified_at,
    } : null,
    verificationValidityMs: options.verificationValidityMs,
  });

  return {
    modelEntryId,
    workspaceId,
    provider: modelRow.provider as V3Provider,
    providerModelId: modelRow.provider_model_id,
    accessibility,
    lifecycleState,
    hasCredentials: hasWorkspaceCredentials,
    adapterAvailable,
    lastVerification: verifRow ? {
      verifiedAt: verifRow.verified_at,
      success: verifRow.success,
      errorCategory: verifRow.error_category as VerificationErrorCategory | null,
    } : null,
    computedAt: new Date().toISOString(),
  };
}

/**
 * Describes a workspace accessibility state.
 */
export function accessibilityDescription(state: WorkspaceAccessibility): string {
  switch (state) {
    case WorkspaceAccessibility.VERIFIED:
      return 'Workspace has successfully invoked this model (verified by a recent API call)';
    case WorkspaceAccessibility.PRESUMED_ACCESSIBLE:
      return 'Workspace has credentials and DSRT supports the model (not yet verified)';
    case WorkspaceAccessibility.NO_CREDENTIALS:
      return 'Model is supported but workspace has no credentials for the provider';
    case WorkspaceAccessibility.NOT_SUPPORTED:
      return 'Model exists in catalogue but DSRT does not have an adapter';
    case WorkspaceAccessibility.CREDENTIALS_INVALID:
      return 'Last API call failed with authentication/authorization error';
    case WorkspaceAccessibility.QUOTA_EXCEEDED:
      return 'Last API call failed with rate limit or quota error';
    case WorkspaceAccessibility.CATALOGUE_UNAVAILABLE:
      return 'Model is retired, quarantined, or not found';
    case WorkspaceAccessibility.PROVIDER_FAILING:
      return 'Recent API calls failed with provider or network errors';
  }
}