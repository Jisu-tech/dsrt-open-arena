/**
 * BudgetController — pre-flight budget gate.
 *
 * If a budget is enforced and remaining capacity cannot cover the predicted cost,
 * routing is blocked with an explicit reason. Never silently continues.
 */

import type { BudgetRepository, WorkspaceBudgetDto } from '../repositories/budget.repository';
import type { CostPrediction } from './cost-predictor';

export type BudgetDecision =
  | { readonly allowed: true; readonly budget: WorkspaceBudgetDto | null; readonly remainingUsd: string | null }
  | {
      readonly allowed: false;
      readonly budget: WorkspaceBudgetDto;
      readonly remainingUsd: string;
      readonly reason: string;
    };

function remainingOf(b: WorkspaceBudgetDto): number | null {
  if (b.amountLimit == null) return null; // unlimited
  const limit = parseFloat(b.amountLimit);
  const spent = parseFloat(b.amountSpent);
  if (!Number.isFinite(limit) || !Number.isFinite(spent)) return null;
  return limit - spent;
}

export class BudgetController {
  constructor(private readonly budgetRepo: BudgetRepository) {}

  /**
   * Evaluate whether a predicted spend is permissible under workspace budgets.
   * Picks the most restrictive enforced budget that applies.
   */
  async evaluate(
    workspaceId: string,
    prediction: CostPrediction,
  ): Promise<BudgetDecision> {
    const budgets = await this.budgetRepo.getWorkspaceBudgets(workspaceId);
    const enforced = budgets.filter((b) => b.isEnforced);

    if (enforced.length === 0) {
      return { allowed: true, budget: null, remainingUsd: null };
    }

    // Predicted cost unknown → allow but surface that we cannot pre-check
    // (actual spend is still recorded post-invocation and can trip later gates)
    const predicted =
      prediction.predictedCostUsd != null ? parseFloat(prediction.predictedCostUsd) : null;

    let mostRestrictive: { budget: WorkspaceBudgetDto; remaining: number } | null = null;

    for (const b of enforced) {
      const remaining = remainingOf(b);
      if (remaining == null) continue; // unlimited or corrupt → skip
      if (!mostRestrictive || remaining < mostRestrictive.remaining) {
        mostRestrictive = { budget: b, remaining };
      }
    }

    if (!mostRestrictive) {
      return { allowed: true, budget: enforced[0] ?? null, remainingUsd: null };
    }

    const { budget, remaining } = mostRestrictive;
    const remainingUsd = remaining.toFixed(8);

    if (remaining <= 0) {
      return {
        allowed: false,
        budget,
        remainingUsd,
        reason: `Budget exhausted for period=${budget.period} (spent=${budget.amountSpent}, limit=${budget.amountLimit})`,
      };
    }

    if (predicted != null && predicted > remaining) {
      return {
        allowed: false,
        budget,
        remainingUsd,
        reason: `Predicted cost ${prediction.predictedCostUsd} ${prediction.currency} exceeds remaining ${remainingUsd} for period=${budget.period}`,
      };
    }

    return { allowed: true, budget, remainingUsd };
  }
}