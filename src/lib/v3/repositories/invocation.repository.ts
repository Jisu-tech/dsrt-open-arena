import type { SupabaseClient } from '@supabase/supabase-js';
import { BaseRepository } from './base.repository';

export interface RecordInvocationDto {
  taskId: string;
  workspaceId: string;
  provider: string;
  providerModelId: string;
  status: 'success' | 'failed' | 'timeout' | 'aborted';
  
  // Measurement Foundation
  tokensInput: number | null;
  tokensOutput: number | null;
  tokensReasoning: number | null;
  tokensCached: number | null;
  
  // Cost: Must be decimal-safe string
  costUsd: string | null;
  measurementSource: 'provider_api' | 'calculated_from_registry' | 'fallback_estimation';
  
  // Metrics
  durationMs: number | null;
  timeToFirstTokenMs: number | null;
  
  // Auditing
  requestFingerprint: string | null;
  errorMessage: string | null;
}

export class InvocationRepository extends BaseRepository {
  constructor(supabase: SupabaseClient) {
    super(supabase);
  }

  /**
   * Records a single model invocation for exact financial and performance accounting.
   */
  async recordInvocation(dto: RecordInvocationDto): Promise<string> {
    const payload = {
      task_id: dto.taskId,
      workspace_id: dto.workspaceId,
      provider: dto.provider,
      provider_model_id: dto.providerModelId,
      status: dto.status,
      
      tokens_input: dto.tokensInput,
      tokens_output: dto.tokensOutput,
      tokens_reasoning: dto.tokensReasoning,
      tokens_cached: dto.tokensCached,
      
      cost_usd: dto.costUsd,
      measurement_source: dto.measurementSource,
      
      duration_ms: dto.durationMs,
      time_to_first_token_ms: dto.timeToFirstTokenMs,
      
      request_fingerprint: dto.requestFingerprint,
      error_message: dto.errorMessage,
    };

    const { data, error } = await this.supabase
      .from('v3_invocations')
      .insert(payload)
      .select('id')
      .single();

    const result = this.ensureData(data, error, 'InvocationRepository.recordInvocation');
    return result.id;
  }
}