/**
 * Bridges legacy gateway onInvocation events into V3 telemetry.
 * Safe no-op when workspace/task correlation is absent.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { V3Provider } from '../contracts/registry';
import { ProviderRegistryRepository } from '../repositories/provider-registry.repository';
import { InvocationRepository } from '../repositories/invocation.repository';
import { BudgetRepository } from '../repositories/budget.repository';
import { ErrorRepository } from '../repositories/error.repository';
import { normalizeProviderUsage } from './usage-normalizer';
import { calculateCost } from './cost-calculator';
import { InvocationRecorder } from './invocation-recorder';
import type { V3OnInvocation, V3OnInvocationPayload } from '../../providers/gateway';

export function createV3InvocationHook(supabase: SupabaseClient): V3OnInvocation {
  const registryRepo = new ProviderRegistryRepository(supabase);
  const recorder = new InvocationRecorder(
    new InvocationRepository(supabase),
    new BudgetRepository(supabase),
    new ErrorRepository(supabase),
  );

  return async (payload: V3OnInvocationPayload) => {
    // Without correlation ids we cannot legally write V3 rows — do not invent them
    if (!payload.v3TaskId || !payload.workspaceId) return;

    const provider = payload.provider as V3Provider;
    const usage = normalizeProviderUsage(provider, payload.rawProviderPayload);
    const pricing = await registryRepo.getModelPricing(provider, payload.model);
    const cost = calculateCost(usage, pricing);

    await recorder.record(
      {
        taskId: payload.v3TaskId,
        workspaceId: payload.workspaceId,
        provider,
        providerModelId: payload.model,
        budgetId: null,
      },
      payload.status,
      usage,
      cost,
      {
        durationMs: payload.durationMs,
        timeToFirstTokenMs: null,
      },
      payload.errorMessage
        ? { errorMessage: payload.errorMessage }
        : undefined,
    );
  };
}