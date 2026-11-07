import type { SupabaseClient } from '@supabase/supabase-js';
import { BaseRepository } from './base.repository';

export interface TelemetryEventDto {
  workspaceId: string;
  taskId?: string | null;
  eventType: 'ptis_optimization' | 'cache_hit' | 'rate_limit_hit' | 'failover_triggered' | 'budget_exhausted';
  metricValue?: number | null; // E.g., milliseconds saved, or tokens saved
  metadata: Record<string, unknown>;
}

export class MetricsRepository extends BaseRepository {
  constructor(supabase: SupabaseClient) {
    super(supabase);
  }

  async recordEvent(dto: TelemetryEventDto): Promise<void> {
    const { error } = await this.supabase
      .from('v3_telemetry_events')
      .insert({
        workspace_id: dto.workspaceId,
        task_id: dto.taskId ?? null,
        event_type: dto.eventType,
        metric_value: dto.metricValue ?? null,
        metadata: dto.metadata,
      });

    if (error) {
      this.handleError(error, 'MetricsRepository.recordEvent');
    }
  }
}