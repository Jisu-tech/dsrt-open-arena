import type { SupabaseClient } from '@supabase/supabase-js';
import { BaseRepository } from './base.repository';

export interface CreateTaskDto {
  workspaceId: string;
  responsibility: string; // I01 - I12
  priority: 'low' | 'normal' | 'high' | 'critical';
  complexityScore: number | null;
  metadata: Record<string, unknown>;
}

export class TaskRepository extends BaseRepository {
  constructor(supabase: SupabaseClient) {
    super(supabase);
  }

  async createTask(dto: CreateTaskDto): Promise<string> {
    const { data, error } = await this.supabase
      .from('v3_tasks')
      .insert({
        workspace_id: dto.workspaceId,
        responsibility: dto.responsibility,
        status: 'pending',
        priority: dto.priority,
        complexity_score: dto.complexityScore,
        metadata: dto.metadata,
      })
      .select('id')
      .single();

    const result = this.ensureData(data, error, 'TaskRepository.createTask');
    return result.id;
  }

  async updateTaskStatus(taskId: string, status: 'in_progress' | 'completed' | 'failed', errorMessage?: string): Promise<void> {
    const updatePayload: Record<string, unknown> = { status };
    
    if (status === 'completed') updatePayload.completed_at = new Date().toISOString();
    if (errorMessage) updatePayload.error_message = errorMessage;

    const { error } = await this.supabase
      .from('v3_tasks')
      .update(updatePayload)
      .eq('id', taskId);

    if (error) {
      this.handleError(error, 'TaskRepository.updateTaskStatus');
    }
  }
}