import type { SupabaseClient } from '@supabase/supabase-js';
import { BaseRepository } from './base.repository';

export interface LogErrorDto {
  workspaceId?: string | null;
  taskId?: string | null;
  invocationId?: string | null;
  errorCategory: 'provider_api' | 'gateway_internal' | 'ptis_decision' | 'timeout' | 'validation' | 'unknown';
  severity: 'low' | 'medium' | 'high' | 'critical';
  errorMessage: string;
  provider?: string | null;
  providerModelId?: string | null;
  context: Record<string, unknown>;
}

export class ErrorRepository extends BaseRepository {
  constructor(supabase: SupabaseClient) {
    super(supabase);
  }

  async logSystemError(dto: LogErrorDto): Promise<string> {
    const { data, error } = await this.supabase
      .from('v3_error_logs')
      .insert({
        workspace_id: dto.workspaceId ?? null,
        task_id: dto.taskId ?? null,
        invocation_id: dto.invocationId ?? null,
        error_category: dto.errorCategory,
        severity: dto.severity,
        error_message: dto.errorMessage,
        provider: dto.provider ?? null,
        provider_model_id: dto.providerModelId ?? null,
        context: dto.context,
      })
      .select('id')
      .single();

    const result = this.ensureData(data, error, 'ErrorRepository.logSystemError');
    return result.id;
  }
}