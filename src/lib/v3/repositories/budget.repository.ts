import type { SupabaseClient } from '@supabase/supabase-js';
import { BaseRepository } from './base.repository';

export interface WorkspaceBudgetDto {
  id: string;
  workspaceId: string;
  period: 'daily' | 'weekly' | 'monthly' | 'all_time';
  amountLimit: string | null;
  amountSpent: string;
  currency: string;
  isEnforced: boolean;
}

export class BudgetRepository extends BaseRepository {
  constructor(supabase: SupabaseClient) {
    super(supabase);
  }

  /**
   * Retrieves active budgets for a workspace.
   */
  async getWorkspaceBudgets(workspaceId: string): Promise<WorkspaceBudgetDto[]> {
    const { data, error } = await this.supabase
      .from('v3_workspace_budgets')
      .select('*')
      .eq('workspace_id', workspaceId);

    if (error) {
      this.handleError(error, 'BudgetRepository.getWorkspaceBudgets');
    }
    
    return (data || []).map(row => ({
      id: row.id,
      workspaceId: row.workspace_id,
      period: row.period,
      amountLimit: row.amount_limit !== null ? String(row.amount_limit) : null,
      amountSpent: String(row.amount_spent),
      currency: row.currency || 'USD',
      isEnforced: row.is_enforced
    }));
  }

  /**
   * Records additional spend against a specific budget.
   * NOTE: For extreme high-concurrency environments, this read-modify-write 
   * should be replaced by a PostgreSQL RPC `v3_increment_budget(id, amount)`.
   * The Economics Engine mitigates current race conditions via memory caching.
   */
  async incrementSpend(budgetId: string, additionalSpend: string): Promise<void> {
    const { data: budget, error: fetchErr } = await this.supabase
      .from('v3_workspace_budgets')
      .select('amount_spent')
      .eq('id', budgetId)
      .single();
      
    if (fetchErr) {
      this.handleError(fetchErr, 'BudgetRepository.incrementSpend(fetch)');
    }
    
    const currentSpent = parseFloat(budget.amount_spent);
    const added = parseFloat(additionalSpend);
    const newSpent = (currentSpent + added).toFixed(8); // Decimal safety enforcement

    const { error: updateErr } = await this.supabase
      .from('v3_workspace_budgets')
      .update({ amount_spent: newSpent })
      .eq('id', budgetId);

    if (updateErr) {
      this.handleError(updateErr, 'BudgetRepository.incrementSpend(update)');
    }
  }
}