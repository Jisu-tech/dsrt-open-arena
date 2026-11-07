/**
 * DSRT Open Arena V3 — Lifecycle State Machine (CORRECTED)
 * 
 * Validates transitions of the GLOBAL catalogue lifecycle state.
 * Does NOT handle workspace-level accessibility — see accessibility.ts.
 * 
 * @module v3/registry/availability
 */

import { ModelLifecycleState, LIFECYCLE_TRANSITIONS, CATALOGUE_ACTIVE_STATES } from '../contracts/registry';
import { V3Error, ErrorCategory, ErrorSeverity, ErrorRecoverability } from '../contracts/errors';

/**
 * Check if a lifecycle transition is permitted.
 */
export function isValidLifecycleTransition(
  from: ModelLifecycleState,
  to: ModelLifecycleState,
): boolean {
  if (from === to) return true;
  return LIFECYCLE_TRANSITIONS[from].includes(to);
}

/**
 * Validate and throw on an invalid lifecycle transition.
 */
export function validateLifecycleTransition(
  from: ModelLifecycleState,
  to: ModelLifecycleState,
  context: { readonly provider: string; readonly modelId: string },
): void {
  if (from === to) return;
  if (!isValidLifecycleTransition(from, to)) {
    throw new V3Error({
      message: `Invalid lifecycle transition for ${context.provider}/${context.modelId}: ${from} → ${to}`,
      category: ErrorCategory.STATE,
      severity: ErrorSeverity.MEDIUM,
      recoverability: ErrorRecoverability.NON_RECOVERABLE,
      code: 'V3_ERR_STATE_INVALID_LIFECYCLE_TRANSITION',
      source: 'registry/availability',
      details: {
        from,
        to,
        provider: context.provider,
        modelId: context.modelId,
        validTransitions: LIFECYCLE_TRANSITIONS[from],
      },
    });
  }
}

/**
 * Inputs for determining the next lifecycle state based on sync observations.
 */
export interface LifecycleTransitionSignals {
  readonly currentState: ModelLifecycleState;
  readonly foundInCurrentCatalogue: boolean;
  readonly catalogueCompletenessPassed: boolean;
  readonly absenceCount: number;
  readonly absenceThresholdForRetirementPending: number;
  readonly absenceThresholdForRetirement: number;
  readonly adapterAvailable: boolean;
  readonly providerSyncFailing: boolean;
}

/**
 * Determine the next lifecycle state based on sync observation.
 * PURE FUNCTION — no side effects.
 * 
 * Key rules:
 *   - Catalogue absence is IGNORED if completeness check failed
 *   - Retirement requires reaching the configured absence threshold
 *   - Finding a model again always resets to supported/discovered
 */
export function determineNextLifecycleState(
  signals: LifecycleTransitionSignals,
): ModelLifecycleState {
  const {
    currentState,
    foundInCurrentCatalogue,
    catalogueCompletenessPassed,
    absenceCount,
    absenceThresholdForRetirementPending,
    absenceThresholdForRetirement,
    adapterAvailable,
    providerSyncFailing,
  } = signals;

  // Quarantined is sticky — only admin action moves it
  if (currentState === ModelLifecycleState.QUARANTINED) {
    return ModelLifecycleState.QUARANTINED;
  }

  // Provider sync is failing entirely — mark stale, preserve everything
  if (providerSyncFailing) {
    return ModelLifecycleState.STALE;
  }

  // Found in current catalogue — model is alive
  if (foundInCurrentCatalogue) {
    if (adapterAvailable) {
      return ModelLifecycleState.SUPPORTED;
    }
    return ModelLifecycleState.DISCOVERED;
  }

  // Not found, but completeness check failed — we cannot conclude absence
  // Keep current state. Absence count is NOT incremented by caller in this case.
  if (!catalogueCompletenessPassed) {
    return currentState;
  }

  // Not found, completeness passed — count this as a true absence
  if (absenceCount >= absenceThresholdForRetirement) {
    return ModelLifecycleState.RETIRED;
  }
  if (absenceCount >= absenceThresholdForRetirementPending) {
    return ModelLifecycleState.RETIREMENT_PENDING;
  }

  // Below retirement threshold — keep current state (or stale if preserving)
  return currentState;
}

/**
 * Whether a model in this state should appear in catalogue listings.
 * NOT a proof of accessibility — use workspace accessibility for that.
 */
export function isCatalogueActive(state: ModelLifecycleState): boolean {
  return CATALOGUE_ACTIVE_STATES.has(state);
}

/**
 * Whether a model is definitively unavailable (retired or quarantined).
 */
export function isCatalogueTerminated(state: ModelLifecycleState): boolean {
  return state === ModelLifecycleState.RETIRED || state === ModelLifecycleState.QUARANTINED;
}

/**
 * Human-readable description.
 */
export function lifecycleDescription(state: ModelLifecycleState): string {
  switch (state) {
    case ModelLifecycleState.DISCOVERED:
      return 'Model is listed in provider catalogue but DSRT support status is not confirmed';
    case ModelLifecycleState.SUPPORTED:
      return 'Model is in catalogue and DSRT has a working adapter';
    case ModelLifecycleState.RETIREMENT_PENDING:
      return 'Model has been absent from recent catalogue syncs and may be retired soon';
    case ModelLifecycleState.RETIRED:
      return 'Model has been confirmed absent from the provider catalogue';
    case ModelLifecycleState.STALE:
      return 'Provider catalogue API has been failing; last known data is preserved';
    case ModelLifecycleState.QUARANTINED:
      return 'Model has been administratively disabled';
  }
}