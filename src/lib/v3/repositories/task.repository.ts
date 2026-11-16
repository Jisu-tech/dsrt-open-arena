import type { SupabaseClient } from '@supabase/supabase-js';

export class TaskRepository {
  constructor(private supabase: SupabaseClient) {}

  async createTask(params: {
    workspaceId: string;
    responsibility: string;
    priority: string;
    complexityScore: number | null;
    metadata: Record<string, unknown>;
  }): Promise<string> {
    const { data, error } = await this.supabase
      .from('v3_tasks')
      .insert({
        workspace_id: params.workspaceId,
        responsibility: params.responsibility,
        priority: params.priority,
        complexity_score: params.complexityScore,
        metadata: params.metadata,
        status: 'pending',
      })
      .select('id')
      .single();

    if (error) {
      // Table might not exist yet — non-fatal
      if (error.code === '42P01') {
        console.warn('[TaskRepository] v3_tasks table does not exist');
        return crypto.randomUUID();
      }
      throw error;
    }

    return String(data.id);
  }

  async updateTaskStatus(
    taskId: string,
    status: string,
    errorMessage?: string
  ): Promise<void> {
    try {
      const updates: Record<string, unknown> = {
        status,
        updated_at: new Date().toISOString(),
      };
      if (errorMessage) updates.error_message = errorMessage;
      if (status === 'completed' || status === 'failed') {
        updates.completed_at = new Date().toISOString();
      }

      await this.supabase
        .from('v3_tasks')
        .update(updates)
        .eq('id', taskId);
    } catch {
      // Non-fatal
    }
  }
}
