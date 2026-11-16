import { createClient } from '@/lib/supabase/server';

export function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

interface InitParams {
  conversationId: string;
  workspaceId: string;
  userId: string;
  mode: 'work' | 'war';
  provider: string;
  model: string;
  userPrompt: string;
  status: string;
}

interface PersistMessageParams {
  conversationId: string;
  workspaceId: string;
  userId: string | null;
  role: 'user' | 'assistant' | 'system';
  content: string;
  isAmplified: boolean;
  provider: string;
  model: string;
  executionId: string;
  tokenCountPrompt?: number;
  tokenCountCompletion?: number;
  providerCostUsd?: number;
  dsrtCostUsd?: number;
  latencyMs?: number;
}

export class AmplificationRuntime {
  private supabase: Awaited<ReturnType<typeof createClient>> | null = null;

  private async getSupabase() {
    if (!this.supabase) {
      this.supabase = await createClient();
    }
    return this.supabase;
  }

  async initialize(params: InitParams): Promise<string> {
    const sb = await this.getSupabase();

    const { data, error } = await sb
      .from('executions')
      .insert({
        conversation_id: params.conversationId,
        workspace_id: params.workspaceId,
        user_id: params.userId,
        mode: params.mode,
        provider: params.provider,
        model: params.model,
        user_prompt: params.userPrompt,
        status: params.status,
      })
      .select('id')
      .single();

    if (error || !data?.id) {
      // If the executions table doesn't exist, generate a client-side ID
      if (error?.code === '42P01' || error?.message?.includes('does not exist')) {
        console.warn('[runtime] executions table missing, using generated ID');
        return crypto.randomUUID();
      }
      throw new Error(`Failed to create execution: ${error?.message || 'Unknown error'}`);
    }

    return String(data.id);
  }

  async updateState(executionId: string, state: string): Promise<void> {
    try {
      const sb = await this.getSupabase();
      await sb
        .from('executions')
        .update({ status: state, updated_at: new Date().toISOString() })
        .eq('id', executionId);
    } catch {
      // Non-fatal
    }
  }

  async persistMessage(params: PersistMessageParams): Promise<string | null> {
    try {
      const sb = await this.getSupabase();

      const { data, error } = await sb
        .from('messages')
        .insert({
          conversation_id: params.conversationId,
          user_id: params.userId,
          role: params.role,
          content: params.content,
          is_amplified: params.isAmplified,
          provider: params.provider,
          model: params.model,
          execution_id: params.executionId,
          token_count_prompt: params.tokenCountPrompt || 0,
          token_count_completion: params.tokenCountCompletion || 0,
          provider_cost_usd: params.providerCostUsd || 0,
          dsrt_cost_usd: params.dsrtCostUsd || 0,
          latency_ms: params.latencyMs || 0,
        })
        .select('id')
        .single();

      if (error) {
        console.warn('[runtime] persistMessage error:', error.message);
        return null;
      }

      return data?.id ? String(data.id) : null;
    } catch (err) {
      console.warn('[runtime] persistMessage exception:', err);
      return null;
    }
  }

  async finalize(executionId: string, data: Record<string, unknown>): Promise<void> {
    try {
      const sb = await this.getSupabase();

      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      // Map camelCase to snake_case for known columns
      const mapping: Record<string, string> = {
        status: 'status',
        amplifiedResponse: 'amplified_response',
        rawResponse: 'raw_response',
        errorMessage: 'error_message',
        promptTokens: 'prompt_tokens',
        completionTokens: 'completion_tokens',
        totalTokens: 'total_tokens',
        providerCostUsd: 'provider_cost_usd',
        dsrtCostUsd: 'dsrt_cost_usd',
        latencyMs: 'latency_ms',
        provider: 'provider',
        model: 'model',
        amplifiedScore: 'amplified_score',
        directScore: 'direct_score',
        qualityDeltaPct: 'quality_delta_pct',
        winningSide: 'winning_side',
        rawLatencyMs: 'raw_latency_ms',
        amplifiedLatencyMs: 'amplified_latency_ms',
      };

      for (const [key, value] of Object.entries(data)) {
        if (value === undefined) continue;
        const col = mapping[key] || key;
        updates[col] = value;
      }

      // JSON fields
      if (data.evaluationJson !== undefined) updates.evaluation_json = JSON.stringify(data.evaluationJson);
      if (data.metricsJson !== undefined) updates.metrics_json = JSON.stringify(data.metricsJson);
      if (data.artifactsJson !== undefined) updates.artifacts_json = JSON.stringify(data.artifactsJson);

      await sb.from('executions').update(updates).eq('id', executionId);
    } catch (err) {
      console.warn('[runtime] finalize error:', err);
    }
  }

  async createComparison(data: Record<string, unknown>): Promise<string | null> {
    try {
      const sb = await this.getSupabase();

      const { data: row, error } = await sb
        .from('comparisons')
        .insert({
          execution_id: data.executionId,
          workspace_id: data.workspaceId,
          conversation_id: data.conversationId,
          user_id: data.userId,
          provider: data.provider,
          model: data.model,
          user_prompt: data.userPrompt,
          direct_message_id: data.directMessageId,
          amplified_message_id: data.amplifiedMessageId,
          direct_score: data.directScore,
          amplified_score: data.amplifiedScore,
          quality_delta_pct: data.qualityDeltaPct,
          winning_side: data.winningSide,
          metrics_json: data.metricsJson ? JSON.stringify(data.metricsJson) : null,
          evaluation_json: data.evaluationJson ? JSON.stringify(data.evaluationJson) : null,
          raw_usage_json: data.rawUsageJson ? JSON.stringify(data.rawUsageJson) : null,
          amplified_usage_json: data.amplifiedUsageJson ? JSON.stringify(data.amplifiedUsageJson) : null,
          status: data.status || 'completed',
          error_message: data.errorMessage || null,
        })
        .select('id')
        .single();

      if (error) {
        // If comparisons table doesn't exist, not fatal
        if (error.code === '42P01') {
          console.warn('[runtime] comparisons table missing');
          return null;
        }
        console.warn('[runtime] createComparison error:', error.message);
        return null;
      }

      return row?.id ? String(row.id) : null;
    } catch (err) {
      console.warn('[runtime] createComparison exception:', err);
      return null;
    }
  }
}
