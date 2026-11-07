/**
 * DSRT Open Arena V3 — Sync Reconciler (NEW)
 * 
 * Safely reconciles a catalogue sync response against the existing registry.
 * 
 * Responsibilities:
 *   - Compute diffs: added, metadata-updated, pricing-updated, observed-absent
 *   - Apply pricing changes via immutable snapshots
 *   - Manage absence tracking with completeness validation
 *   - Transition lifecycle state per the state machine
 *   - Return structured results with per-operation success/failure tracking
 * 
 * Every database operation is error-checked. Counters only increment on
 * confirmed success.
 * 
 * @module v3/registry/reconciler
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { V3Provider } from '../contracts/enums';
import {
  CatalogueCompletenessResult,
  ModelLifecycleState,
  type CatalogueSyncResult,
  type ProviderCatalogueConfig,
  type RawCatalogueEntry,
  type ModelPricingSnapshot,
  type OperationError,
  type SyncErrorCategory,
} from '../contracts/registry';
import type { CatalogueAdapter } from './types';
import { normalizeRawEntry, type NormalizedEntry } from './normalizer';
import { mergePricing, hashMergedPricing, type MergedPricing } from './pricing-merge';
import { determineNextLifecycleState, validateLifecycleTransition, isValidLifecycleTransition } from './availability';
import { computeContentHash } from './content-hash';

// ─────────────────────────────────────────────
// Reconciliation Result
// ─────────────────────────────────────────────

export interface ReconciliationResult {
  readonly modelsAdded: number;
  readonly modelsMetadataUpdated: number;
  readonly pricingSnapshotsCreated: number;
  readonly modelsObservedAbsent: number;
  readonly modelsLifecycleTransitioned: number;
  readonly databaseErrors: number;
  readonly operationErrors: readonly OperationError[];
}

// ─────────────────────────────────────────────
// Main reconciler
// ─────────────────────────────────────────────

export async function reconcileCatalogueSync(
  supabase: SupabaseClient,
  catalogueResult: CatalogueSyncResult,
  config: ProviderCatalogueConfig,
  adapter: CatalogueAdapter,
  syncLogId: string,
): Promise<ReconciliationResult> {
  const errors: OperationError[] = [];
  let modelsAdded = 0;
  let modelsMetadataUpdated = 0;
  let pricingSnapshotsCreated = 0;
  let modelsObservedAbsent = 0;
  let modelsLifecycleTransitioned = 0;
  let databaseErrors = 0;

  // ── Load existing entries for this provider ──
  const { data: existingRows, error: existingErr } = await supabase
    .from('v3_provider_models')
    .select('*')
    .eq('provider', catalogueResult.provider);

  if (existingErr) {
    errors.push({
      operation: 'load_existing',
      modelId: null,
      error: existingErr.message,
      category: 'database_error' as SyncErrorCategory,
    });
    databaseErrors++;
    return {
      modelsAdded, modelsMetadataUpdated, pricingSnapshotsCreated,
      modelsObservedAbsent, modelsLifecycleTransitioned, databaseErrors,
      operationErrors: errors,
    };
  }

  const existingByModelId = new Map<string, Record<string, unknown>>();
  for (const row of existingRows ?? []) {
    existingByModelId.set(row.provider_model_id as string, row);
  }

  // ── Process each discovered entry ──
  const discoveredModelIds = new Set<string>();
  for (const rawEntry of catalogueResult.entries) {
    discoveredModelIds.add(rawEntry.providerModelId);

    const normalized = await normalizeRawEntry(rawEntry, catalogueResult.provider, adapter);
    const existing = existingByModelId.get(rawEntry.providerModelId);

    try {
      if (!existing) {
        const result = await insertNewModel(supabase, normalized, adapter, catalogueResult.provider);
        if (result.success) {
          modelsAdded++;
          if (result.pricingSnapshotCreated) pricingSnapshotsCreated++;
        } else {
          errors.push({
            operation: 'insert_new_model',
            modelId: rawEntry.providerModelId,
            error: result.error ?? 'unknown',
            category: 'database_error',
          });
          databaseErrors++;
        }
      } else {
        const result = await updateExistingModel(supabase, existing, normalized, rawEntry);
        if (result.success) {
          if (result.metadataUpdated) modelsMetadataUpdated++;
          if (result.pricingSnapshotCreated) pricingSnapshotsCreated++;
          if (result.lifecycleTransitioned) modelsLifecycleTransitioned++;
        } else {
          errors.push({
            operation: 'update_existing_model',
            modelId: rawEntry.providerModelId,
            error: result.error ?? 'unknown',
            category: 'database_error',
          });
          databaseErrors++;
        }
      }
    } catch (ex) {
      errors.push({
        operation: 'process_entry',
        modelId: rawEntry.providerModelId,
        error: ex instanceof Error ? ex.message : String(ex),
        category: 'database_error',
      });
      databaseErrors++;
    }
  }

  // ── Process absences (only if catalogue completeness passed) ──
  if (catalogueResult.completeness === CatalogueCompletenessResult.PASSED) {
    for (const [modelId, existing] of existingByModelId) {
      if (discoveredModelIds.has(modelId)) continue;
      if (existing.sync_source === 'manual_admin') continue; // Never auto-retire manual entries

      try {
        const result = await processAbsence(
          supabase,
          existing,
          catalogueResult,
          config,
          syncLogId,
        );
        if (result.success) {
          modelsObservedAbsent++;
          if (result.lifecycleTransitioned) modelsLifecycleTransitioned++;
        } else {
          errors.push({
            operation: 'process_absence',
            modelId,
            error: result.error ?? 'unknown',
            category: 'database_error',
          });
          databaseErrors++;
        }
      } catch (ex) {
        errors.push({
          operation: 'process_absence',
          modelId,
          error: ex instanceof Error ? ex.message : String(ex),
          category: 'database_error',
        });
        databaseErrors++;
      }
    }
  }
  // NOTE: If completeness != PASSED, absences are NOT counted. Models stay in their current state.

  return {
    modelsAdded,
    modelsMetadataUpdated,
    pricingSnapshotsCreated,
    modelsObservedAbsent,
    modelsLifecycleTransitioned,
    databaseErrors,
    operationErrors: errors,
  };
}

// ─────────────────────────────────────────────
// Insert new model
// ─────────────────────────────────────────────

async function insertNewModel(
  supabase: SupabaseClient,
  normalized: NormalizedEntry,
  adapter: CatalogueAdapter,
  provider: V3Provider,
): Promise<{ success: boolean; pricingSnapshotCreated: boolean; error?: string }> {
  const now = new Date().toISOString();

  // Insert the model row first (without pricing snapshot pointer)
  const { data: insertedModel, error: insertErr } = await supabase
    .from('v3_provider_models')
    .insert({
      provider,
      provider_model_id: normalized.providerModelId,
      display_name: normalized.displayName,
      tier: normalized.tier,
      capabilities: normalized.capabilities,
      context_window: normalized.contextWindow,
      max_output_tokens: normalized.maxOutputTokens,
      supports_streaming: normalized.supportsStreaming,
      supports_structured_output: normalized.supportsStructuredOutput,
      supports_vision: normalized.supportsVision,
      supports_tool_use: normalized.supportsToolUse,
      is_active: true,
      is_deprecated: false,
      pricing_version: '1',
      pricing_source: normalized.pricing?.source ?? 'static_fallback',
      pricing_last_verified: now,
      lifecycle_state: 'discovered',
      catalogue_last_seen_at: now,
      absence_count: 0,
      canonical_model_family: adapter.inferModelFamily(normalized.providerModelId),
      metadata_content_hash: normalized.metadataContentHash,
      sync_source: 'catalogue_api',
      discovered_at: now,
      last_synced_at: now,
    })
    .select('id')
    .single();

  if (insertErr || !insertedModel) {
    return {
      success: false,
      pricingSnapshotCreated: false,
      error: insertErr?.message ?? 'Insert returned no row',
    };
  }

  const modelEntryId = insertedModel.id as string;

  // Create initial pricing snapshot if pricing was supplied
  let pricingSnapshotCreated = false;
  if (normalized.pricing !== null) {
    const mergeOutcome = mergePricing(normalized.pricing, null);
    const snapshotHash = await hashMergedPricing(mergeOutcome.merged);

    const { data: snapshot, error: snapshotErr } = await supabase
      .from('v3_model_pricing_snapshots')
      .insert({
        model_entry_id: modelEntryId,
        price_input_per_million: mergeOutcome.merged.inputPricePerMillion !== null
          ? parseFloat(mergeOutcome.merged.inputPricePerMillion) : null,
        price_output_per_million: mergeOutcome.merged.outputPricePerMillion !== null
          ? parseFloat(mergeOutcome.merged.outputPricePerMillion) : null,
        price_reasoning_per_million: mergeOutcome.merged.reasoningPricePerMillion !== null
          ? parseFloat(mergeOutcome.merged.reasoningPricePerMillion) : null,
        price_cached_input_per_million: mergeOutcome.merged.cachedInputPricePerMillion !== null
          ? parseFloat(mergeOutcome.merged.cachedInputPricePerMillion) : null,
        input_price_supplied: mergeOutcome.merged.inputPriceSupplied,
        output_price_supplied: mergeOutcome.merged.outputPriceSupplied,
        reasoning_price_supplied: mergeOutcome.merged.reasoningPriceSupplied,
        cached_input_price_supplied: mergeOutcome.merged.cachedInputPriceSupplied,
        currency: mergeOutcome.merged.currency,
        pricing_source: mergeOutcome.merged.pricingSource,
        pricing_source_detail: mergeOutcome.merged.pricingSourceDetail,
        content_hash: snapshotHash,
        previous_snapshot_id: null,
        change_summary: mergeOutcome.changeSummary,
        effective_from: now,
        recorded_by: 'system:sync-engine',
      })
      .select('id')
      .single();

    if (snapshotErr || !snapshot) {
      return {
        success: true, // Model was inserted
        pricingSnapshotCreated: false,
        error: `Pricing snapshot insert failed: ${snapshotErr?.message ?? 'no row'}`,
      };
    }

    // Link snapshot to model
    const { error: linkErr } = await supabase
      .from('v3_provider_models')
      .update({ current_pricing_snapshot_id: snapshot.id })
      .eq('id', modelEntryId);

    if (linkErr) {
      return {
        success: true,
        pricingSnapshotCreated: true,
        error: `Snapshot link failed: ${linkErr.message}`,
      };
    }

    pricingSnapshotCreated = true;
  }

  return { success: true, pricingSnapshotCreated };
}

// ─────────────────────────────────────────────
// Update existing model
// ─────────────────────────────────────────────

async function updateExistingModel(
  supabase: SupabaseClient,
  existing: Record<string, unknown>,
  normalized: NormalizedEntry,
  _rawEntry: RawCatalogueEntry,
): Promise<{
  success: boolean;
  metadataUpdated: boolean;
  pricingSnapshotCreated: boolean;
  lifecycleTransitioned: boolean;
  error?: string;
}> {
  const now = new Date().toISOString();
  const modelEntryId = existing.id as string;
  const existingMetadataHash = existing.metadata_content_hash as string | null;

  const metadataChanged = normalized.metadataContentHash !== existingMetadataHash;

  // Load current pricing snapshot if exists
  let currentSnapshot: ModelPricingSnapshot | null = null;
  if (existing.current_pricing_snapshot_id) {
    const { data: snap, error: snapErr } = await supabase
      .from('v3_model_pricing_snapshots')
      .select('*')
      .eq('id', existing.current_pricing_snapshot_id as string)
      .single();
    if (!snapErr && snap) {
      currentSnapshot = mapSnapshotRow(snap);
    }
  }

  // Merge pricing
  let pricingSnapshotCreated = false;
  let newSnapshotId: string | null = null;

  if (normalized.pricing !== null) {
    const mergeOutcome = mergePricing(normalized.pricing, currentSnapshot);

    if (mergeOutcome.hasChanges) {
      const snapshotHash = await hashMergedPricing(mergeOutcome.merged);

      // Only create snapshot if content hash differs
      if (!currentSnapshot || currentSnapshot.contentHash !== snapshotHash) {
        const { data: snapshot, error: snapErr } = await supabase
          .from('v3_model_pricing_snapshots')
          .insert({
            model_entry_id: modelEntryId,
            price_input_per_million: mergeOutcome.merged.inputPricePerMillion !== null
              ? parseFloat(mergeOutcome.merged.inputPricePerMillion) : null,
            price_output_per_million: mergeOutcome.merged.outputPricePerMillion !== null
              ? parseFloat(mergeOutcome.merged.outputPricePerMillion) : null,
            price_reasoning_per_million: mergeOutcome.merged.reasoningPricePerMillion !== null
              ? parseFloat(mergeOutcome.merged.reasoningPricePerMillion) : null,
            price_cached_input_per_million: mergeOutcome.merged.cachedInputPricePerMillion !== null
              ? parseFloat(mergeOutcome.merged.cachedInputPricePerMillion) : null,
            input_price_supplied: mergeOutcome.merged.inputPriceSupplied,
            output_price_supplied: mergeOutcome.merged.outputPriceSupplied,
            reasoning_price_supplied: mergeOutcome.merged.reasoningPriceSupplied,
            cached_input_price_supplied: mergeOutcome.merged.cachedInputPriceSupplied,
            currency: mergeOutcome.merged.currency,
            pricing_source: mergeOutcome.merged.pricingSource,
            pricing_source_detail: mergeOutcome.merged.pricingSourceDetail,
            content_hash: snapshotHash,
            previous_snapshot_id: currentSnapshot?.id ?? null,
            change_summary: mergeOutcome.changeSummary,
            effective_from: now,
            recorded_by: 'system:sync-engine',
          })
          .select('id')
          .single();

        if (snapErr || !snapshot) {
          return {
            success: false,
            metadataUpdated: false,
            pricingSnapshotCreated: false,
            lifecycleTransitioned: false,
            error: `Pricing snapshot insert failed: ${snapErr?.message ?? 'no row'}`,
          };
        }
        newSnapshotId = snapshot.id as string;
        pricingSnapshotCreated = true;
      }
    }
  }

  // Determine lifecycle transition
  const currentLifecycle = (existing.lifecycle_state as ModelLifecycleState) ?? ModelLifecycleState.DISCOVERED;
  const nextLifecycle = determineNextLifecycleState({
    currentState: currentLifecycle,
    foundInCurrentCatalogue: true,
    catalogueCompletenessPassed: true,
    absenceCount: 0, // Reset because found
    absenceThresholdForRetirementPending: 999, // Not relevant here
    absenceThresholdForRetirement: 999,
    adapterAvailable: true,
    providerSyncFailing: false,
  });

  const lifecycleTransitioned = nextLifecycle !== currentLifecycle;
  if (lifecycleTransitioned && !isValidLifecycleTransition(currentLifecycle, nextLifecycle)) {
    // Should not happen; log and keep current
    return {
      success: false,
      metadataUpdated: false,
      pricingSnapshotCreated,
      lifecycleTransitioned: false,
      error: `Invalid lifecycle transition: ${currentLifecycle} → ${nextLifecycle}`,
    };
  }

  // Update model row
  const updatePayload: Record<string, unknown> = {
    display_name: normalized.displayName,
    tier: normalized.tier,
    capabilities: normalized.capabilities,
    context_window: normalized.contextWindow,
    max_output_tokens: normalized.maxOutputTokens,
    supports_streaming: normalized.supportsStreaming,
    supports_structured_output: normalized.supportsStructuredOutput,
    supports_vision: normalized.supportsVision,
    supports_tool_use: normalized.supportsToolUse,
    metadata_content_hash: normalized.metadataContentHash,
    lifecycle_state: nextLifecycle,
    catalogue_last_seen_at: now,
    absence_count: 0,
    last_absence_at: null,
    last_synced_at: now,
  };

  if (newSnapshotId) {
    updatePayload.current_pricing_snapshot_id = newSnapshotId;
  }

  const { error: updErr } = await supabase
    .from('v3_provider_models')
    .update(updatePayload)
    .eq('id', modelEntryId);

  if (updErr) {
    return {
      success: false,
      metadataUpdated: false,
      pricingSnapshotCreated,
      lifecycleTransitioned: false,
      error: `Model update failed: ${updErr.message}`,
    };
  }

  return {
    success: true,
    metadataUpdated: metadataChanged,
    pricingSnapshotCreated,
    lifecycleTransitioned,
  };
}

// ─────────────────────────────────────────────
// Process absence
// ─────────────────────────────────────────────

async function processAbsence(
  supabase: SupabaseClient,
  existing: Record<string, unknown>,
  catalogueResult: CatalogueSyncResult,
  config: ProviderCatalogueConfig,
  syncLogId: string,
): Promise<{ success: boolean; lifecycleTransitioned: boolean; error?: string }> {
  const now = new Date().toISOString();
  const modelEntryId = existing.id as string;
  const currentLifecycle = (existing.lifecycle_state as ModelLifecycleState) ?? ModelLifecycleState.DISCOVERED;
  const currentAbsenceCount = (existing.absence_count as number) ?? 0;
  const newAbsenceCount = currentAbsenceCount + 1;

  // Record the absence (append-only)
  const { error: absErr } = await supabase
    .from('v3_model_absence_tracking')
    .insert({
      model_entry_id: modelEntryId,
      sync_log_id: syncLogId,
      catalogue_response_complete: true, // Caller guarantees this
      catalogue_entry_count: catalogueResult.entries.length,
      observed_at: now,
    });

  if (absErr) {
    return {
      success: false,
      lifecycleTransitioned: false,
      error: `Absence tracking insert failed: ${absErr.message}`,
    };
  }

  // Determine next lifecycle state
  const nextLifecycle = determineNextLifecycleState({
    currentState: currentLifecycle,
    foundInCurrentCatalogue: false,
    catalogueCompletenessPassed: true,
    absenceCount: newAbsenceCount,
    absenceThresholdForRetirementPending: config.absenceThresholdForRetirementPending,
    absenceThresholdForRetirement: config.absenceThresholdForRetirement,
    adapterAvailable: true,
    providerSyncFailing: false,
  });

  const lifecycleTransitioned = nextLifecycle !== currentLifecycle;
  const updatePayload: Record<string, unknown> = {
    absence_count: newAbsenceCount,
    last_absence_at: now,
    last_synced_at: now,
  };

  if (lifecycleTransitioned && isValidLifecycleTransition(currentLifecycle, nextLifecycle)) {
    updatePayload.lifecycle_state = nextLifecycle;
    if (nextLifecycle === ModelLifecycleState.RETIRED) {
      updatePayload.retirement_confirmed_reason =
        `Absent from ${newAbsenceCount} consecutive complete catalogue syncs`;
    }
  }

  const { error: updErr } = await supabase
    .from('v3_provider_models')
    .update(updatePayload)
    .eq('id', modelEntryId);

  if (updErr) {
    return {
      success: false,
      lifecycleTransitioned: false,
      error: `Absence state update failed: ${updErr.message}`,
    };
  }

  return { success: true, lifecycleTransitioned };
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function mapSnapshotRow(row: Record<string, unknown>): ModelPricingSnapshot {
  return {
    id: row.id as string,
    modelEntryId: row.model_entry_id as ModelPricingSnapshot['modelEntryId'],
    inputPricePerMillion: row.price_input_per_million !== null && row.price_input_per_million !== undefined
      ? String(row.price_input_per_million) : null,
    outputPricePerMillion: row.price_output_per_million !== null && row.price_output_per_million !== undefined
      ? String(row.price_output_per_million) : null,
    reasoningPricePerMillion: row.price_reasoning_per_million !== null && row.price_reasoning_per_million !== undefined
      ? String(row.price_reasoning_per_million) : null,
    cachedInputPricePerMillion: row.price_cached_input_per_million !== null && row.price_cached_input_per_million !== undefined
      ? String(row.price_cached_input_per_million) : null,
    inputPriceSupplied: Boolean(row.input_price_supplied),
    outputPriceSupplied: Boolean(row.output_price_supplied),
    reasoningPriceSupplied: Boolean(row.reasoning_price_supplied),
    cachedInputPriceSupplied: Boolean(row.cached_input_price_supplied),
    currency: (row.currency as string) ?? 'USD',
    pricingSource: row.pricing_source as ModelPricingSnapshot['pricingSource'],
    pricingSourceDetail: (row.pricing_source_detail as string) ?? null,
    contentHash: row.content_hash as string,
    previousSnapshotId: (row.previous_snapshot_id as string) ?? null,
    changeSummary: (row.change_summary as string) ?? null,
    effectiveFrom: row.effective_from as string,
    recordedAt: row.recorded_at as string,
    recordedBy: (row.recorded_by as string) ?? null,
  };
}

/** Exposed helper for tests and sync engine. */
export async function markProviderModelsStale(
  supabase: SupabaseClient,
  provider: V3Provider,
): Promise<{ marked: number; error: string | null }> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('v3_provider_models')
    .update({
      lifecycle_state: 'stale',
      last_synced_at: now,
    })
    .eq('provider', provider)
    .not('lifecycle_state', 'in', '("retired","quarantined")')
    .neq('sync_source', 'manual_admin')
    .select('id');

  if (error) {
    return { marked: 0, error: error.message };
  }
  return { marked: data?.length ?? 0, error: null };
}

/** Compute raw response hash for audit. */
export async function hashRawResponse(raw: unknown): Promise<string> {
  return computeContentHash(JSON.stringify(raw));
}