import type { SupabaseClient } from '@supabase/supabase-js';
import { BaseRepository } from './base.repository';

export interface LogDecisionDto {
  taskId: string;
  workspaceId: string;
  decisionType: 'model_selection' | 'fallback_trigger' | 'cache_hit' | 'rejection';
  selectedProvider: string | null;
  selectedModel: string | null;
  
  // The math behind the decision
  predictedCostUsd: string | null;
  predictedLatencyMs: number | null;
  
  // Why this decision was made
  reasoning: string;
  alternativesConsidered: Array<{
    provider: string;
    model: string;
    predictedCostUsd: string | null;
    reason: string; // e.g., "Too expensive", "Rate limited"
  }>;
}

export class PtisDecisionRepository extends BaseRepository {
  constructor(supabase: SupabaseClient) {
    super(supabase);
  }

  async logDecision(dto: LogDecisionDto): Promise<void> {
    const { error } = await this.supabase
      .from('v3_ptis_decisions')
      .insert({
        task_id: dto.taskId,
        workspace_id: dto.workspaceId,
        decision_type: dto.decisionType,
        selected_provider: dto.selectedProvider,
        selected_model: dto.selectedModel,
        predicted_cost_usd: dto.predictedCostUsd,
        predicted_latency_ms: dto.predictedLatencyMs,
        reasoning: dto.reasoning,
        alternatives_considered: dto.alternativesConsidered,
      });

    if (error) {
      this.handleError(error, 'PtisDecisionRepository.logDecision');
    }
  }
}