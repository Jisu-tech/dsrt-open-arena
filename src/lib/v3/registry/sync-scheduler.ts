/**
 * DSRT Open Arena V3 — Sync Scheduler (NEW)
 * 
 * Determines which providers are due for synchronization right now.
 * Called by:
 *   - Cron API endpoint (scheduled)
 *   - Admin trigger (manual)
 * 
 * Does NOT itself schedule; scheduling is external (Vercel Cron, etc.).
 * This module answers: "given current state, what should run?"
 * 
 * @module v3/registry/sync-scheduler
 */

import { createAdminClient } from '@/lib/supabase/admin';
import type { V3Provider } from '../contracts/enums';
import type { ProviderCatalogueConfig, SyncStatus } from '../contracts/registry';

// ─────────────────────────────────────────────
// Due provider selection
// ─────────────────────────────────────────────

export interface DueProvider {
  readonly provider: V3Provider;
  readonly reason: 'never_synced' | 'interval_elapsed' | 'retry_after_backoff';
  readonly lastSyncAt: string | null;
  readonly consecutiveFailures: number;
}

export interface DueProvidersResult {
  readonly due: readonly DueProvider[];
  readonly skipped: readonly {
    readonly provider: V3Provider;
    readonly reason: 'disabled' | 'in_backoff' | 'interval_not_elapsed';
    readonly detail: string;
  }[];
}

/**
 * Determine which providers are due for synchronization.
 */
export async function getDueProviders(): Promise<DueProvidersResult> {
  const supabase = createAdminClient();

  const { data: rows, error } = await supabase
    .from('v3_provider_catalogue_config')
    .select('*');

  if (error) {
    throw new Error(`Failed to load catalogue configs: ${error.message}`);
  }

  const due: DueProvider[] = [];
  const skipped: DueProvidersResult['skipped'] = [];

  const now = Date.now();

  for (const row of rows ?? []) {
    const config = {
      provider: row.provider as V3Provider,
      syncEnabled: Boolean(row.sync_enabled),
      syncIntervalSeconds: row.sync_interval_seconds as number,
      lastSyncCompletedAt: (row.last_sync_completed_at as string) ?? null,
      backoffUntil: (row.backoff_until as string) ?? null,
      consecutiveFailureCount: (row.consecutive_failure_count as number) ?? 0,
    };

    if (!config.syncEnabled) {
      skipped.push({
        provider: config.provider,
        reason: 'disabled',
        detail: 'sync_enabled = false',
      });
      continue;
    }

    if (config.backoffUntil) {
      const backoffUntil = new Date(config.backoffUntil).getTime();
      if (backoffUntil > now) {
        skipped.push({
          provider: config.provider,
          reason: 'in_backoff',
          detail: `In backoff until ${config.backoffUntil} (${config.consecutiveFailureCount} consecutive failures)`,
        });
        continue;
      }

      // Backoff expired — this is a retry attempt
      due.push({
        provider: config.provider,
        reason: 'retry_after_backoff',
        lastSyncAt: config.lastSyncCompletedAt,
        consecutiveFailures: config.consecutiveFailureCount,
      });
      continue;
    }

    if (!config.lastSyncCompletedAt) {
      due.push({
        provider: config.provider,
        reason: 'never_synced',
        lastSyncAt: null,
        consecutiveFailures: 0,
      });
      continue;
    }

    const lastSync = new Date(config.lastSyncCompletedAt).getTime();
    const elapsed = now - lastSync;
    const intervalMs = config.syncIntervalSeconds * 1000;

    if (elapsed >= intervalMs) {
      due.push({
        provider: config.provider,
        reason: 'interval_elapsed',
        lastSyncAt: config.lastSyncCompletedAt,
        consecutiveFailures: 0,
      });
    } else {
      const remaining = Math.ceil((intervalMs - elapsed) / 1000);
      skipped.push({
        provider: config.provider,
        reason: 'interval_not_elapsed',
        detail: `${remaining}s until next sync`,
      });
    }
  }

  return { due, skipped };
}

/**
 * Generate a unique lock holder identifier for this scheduler invocation.
 */
export function generateLockHolder(context: 'cron' | 'manual' | 'api', detail?: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  const parts = [context, timestamp, random];
  if (detail) parts.push(detail);
  return parts.join(':');
}