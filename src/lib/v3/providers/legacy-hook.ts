import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Creates a V3 invocation hook that logs provider calls
 * for dual-write tracking during the V1→V3 migration.
 */
export function createV3InvocationHook(
  supabase: SupabaseClient
): (data: Record<string, unknown>) => Promise<void> {
  return async (data: Record<string, unknown>) => {
    try {
      await supabase.from('v3_invocations').insert({
        task_id: data.taskId || null,
        provider: data.provider,
        model: data.model,
        input_tokens: data.inputTokens || 0,
        output_tokens: data.outputTokens || 0,
        latency_ms: data.latencyMs || 0,
        cost_usd: data.costUsd || 0,
        status: data.status || 'completed',
        metadata: data.metadata || null,
      });
    } catch {
      // V3 table may not exist — non-fatal
    }
  };
}
