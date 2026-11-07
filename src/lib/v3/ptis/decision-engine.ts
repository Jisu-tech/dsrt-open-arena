/**
 * DecisionEngine — PTIS model selection.
 *
 * Responsibilities:
 * - Rank candidate models by predicted cost, historical economics, lifecycle, accessibility
 * - Enforce budget gate
 * - Log every decision (and rejected alternatives) via PtisDecisionRepository
 *
 * Invariants:
 * - Only lifecycle-active catalogue entries are candidates
 * - Only verified/presumed accessibility may be routed (caller supplies accessibility)
 * - measurementSource / prediction source always explicit
 * - No silent fallback to a random model
 */

import type { V3Provider } from '../contracts/registry';
import type {
  ProviderRegistryRepository,
  RegistryModelDto,
} from '../repositories/provider-registry.repository';
import type {
  PtisDecisionRepository,
  LogDecisionDto,
} from '../repositories/ptis-decision.repository';
import { profileTokenDemand, boundToContextWindow, type ProfileInput } from './token-profiler';
import { predictCost, compareCostPredictions, type CostPrediction } from './cost-predictor';
import { BudgetController } from './budget-controller';
import type { EconomicsEngine, ModelEconomics } from './economics-engine';

export type ResponsibilityId =
  | 'I01' | 'I02' | 'I03' | 'I04' | 'I05' | 'I06'
  | 'I07' | 'I08' | 'I09' | 'I10' | 'I11' | 'I12'
  | string;

export interface CandidateModel {
  readonly provider: V3Provider;
  readonly providerModelId: string;
  readonly displayName: string;
  readonly contextWindow: number | null;
  readonly pricing: {
    inputPerMillion: string | null;
    outputPerMillion: string | null;
    currency: string;
  } | null;
  /** WorkspaceAccessibility-derived: only verified | presumed_accessible should be true */
  readonly isRoutable: boolean;
  readonly lifecycleState: string;
}

export interface DecisionRequest {
  readonly taskId: string;
  readonly workspaceId: string;
  readonly responsibility: ResponsibilityId;
  readonly profile: ProfileInput;
  readonly candidates: readonly CandidateModel[];
  /** Optional: prefer lower latency over lower cost (0 = cost only, 1 = latency only). */
  readonly latencyWeight?: number;
}

export type DecisionResult =
  | {
      readonly status: 'selected';
      readonly provider: V3Provider;
      readonly providerModelId: string;
      readonly predictedCostUsd: string | null;
      readonly predictedLatencyMs: number | null;
      readonly reasoning: string;
      readonly budgetId: string | null;
    }
  | {
      readonly status: 'rejected';
      readonly reason: string;
    };

interface ScoredCandidate {
  model: CandidateModel;
  prediction: CostPrediction;
  economics: ModelEconomics | null;
  score: number;
  rejectReason: string | null;
}

export class DecisionEngine {
  constructor(
    private readonly registryRepo: ProviderRegistryRepository,
    private readonly decisionRepo: PtisDecisionRepository,
    private readonly budgetController: BudgetController,
    private readonly economicsEngine: EconomicsEngine,
  ) {}

  async decide(req: DecisionRequest): Promise<DecisionResult> {
    const latencyWeight = clamp(req.latencyWeight ?? 0.15, 0, 1);
    const costWeight = 1 - latencyWeight;

    // 1. Token profile
    let estimate = profileTokenDemand(req.profile);

    // 2. Pull economics for workspace (measured only)
    const economics = await this.economicsEngine.getModelEconomics({
      workspaceId: req.workspaceId,
      lookbackHours: 168,
      minSamples: 3,
    });
    const econIndex = new Map(
      economics.map((e) => [`${e.provider}::${e.providerModelId}`, e]),
    );

    // 3. Score candidates
    const scored: ScoredCandidate[] = [];
    for (const model of req.candidates) {
      const bound = boundToContextWindow(estimate, model.contextWindow);
      const pricingFactors = model.pricing
        ? {
            inputPerMillion: model.pricing.inputPerMillion,
            outputPerMillion: model.pricing.outputPerMillion,
            reasoningPerMillion: null,
            cachedInputPerMillion: null,
          }
        : null;

      const prediction = predictCost(bound, pricingFactors, model.pricing?.currency ?? 'USD');
      const econ = econIndex.get(`${model.provider}::${model.providerModelId}`) ?? null;

      let rejectReason: string | null = null;
      if (!model.isRoutable) rejectReason = 'Not routable for this workspace (accessibility)';
      else if (model.lifecycleState === 'retired' || model.lifecycleState === 'quarantined') {
        rejectReason = `Lifecycle state=${model.lifecycleState}`;
      } else if (
        bound.promptTokens != null &&
        model.contextWindow != null &&
        bound.promptTokens >= model.contextWindow
      ) {
        rejectReason = 'Prompt exceeds context window';
      }

      // Score: lower is better. Unknown cost sorts last via large sentinel.
      const costVal =
        prediction.predictedCostUsd != null ? parseFloat(prediction.predictedCostUsd) : 1e9;
      const latencyVal = econ?.meanLatencyMs ?? 60_000;
      const successPenalty =
        econ?.successRate != null ? (1 - econ.successRate) * 10 : 2; // unknown → mild penalty

      const score =
        costWeight * costVal * 1000 + // scale $ to ms-comparable-ish units
        latencyWeight * latencyVal +
        successPenalty;

      scored.push({ model, prediction, economics: econ, score, rejectReason });
    }

    // 4. Partition viable vs rejected
    const viable = scored
      .filter((s) => s.rejectReason == null)
      .sort((a, b) => a.score - b.score || compareCostPredictions(a.prediction, b.prediction));
    const rejected = scored.filter((s) => s.rejectReason != null);

    if (viable.length === 0) {
      const reason =
        rejected.length > 0
          ? `No viable candidates. Examples: ${rejected
              .slice(0, 3)
              .map((r) => `${r.model.provider}/${r.model.providerModelId}:${r.rejectReason}`)
              .join('; ')}`
          : 'No candidates supplied';

      await this.log(req, {
        decisionType: 'rejection',
        selectedProvider: null,
        selectedModel: null,
        predictedCostUsd: null,
        predictedLatencyMs: null,
        reasoning: reason,
        alternativesConsidered: rejected.slice(0, 10).map((r) => ({
          provider: r.model.provider,
          model: r.model.providerModelId,
          predictedCostUsd: r.prediction.predictedCostUsd,
          reason: r.rejectReason ?? 'rejected',
        })),
      });

      return { status: 'rejected', reason };
    }

    const best = viable[0];

    // 5. Budget gate on the leading candidate
    const budgetDecision = await this.budgetController.evaluate(
      req.workspaceId,
      best.prediction,
    );

    if (!budgetDecision.allowed) {
      const reason = budgetDecision.reason;
      await this.log(req, {
        decisionType: 'rejection',
        selectedProvider: best.model.provider,
        selectedModel: best.model.providerModelId,
        predictedCostUsd: best.prediction.predictedCostUsd,
        predictedLatencyMs: best.economics?.meanLatencyMs ?? null,
        reasoning: reason,
        alternativesConsidered: viable.slice(0, 8).map((v) => ({
          provider: v.model.provider,
          model: v.model.providerModelId,
          predictedCostUsd: v.prediction.predictedCostUsd,
          reason: 'budget_blocked_primary',
        })),
      });
      return { status: 'rejected', reason };
    }

    // 6. Commit selection
    const reasoning = buildReasoning(best, viable.slice(1, 4), latencyWeight);

    await this.log(req, {
      decisionType: 'model_selection',
      selectedProvider: best.model.provider,
      selectedModel: best.model.providerModelId,
      predictedCostUsd: best.prediction.predictedCostUsd,
      predictedLatencyMs: best.economics?.meanLatencyMs ?? null,
      reasoning,
      alternativesConsidered: [
        ...viable.slice(1, 6).map((v) => ({
          provider: v.model.provider,
          model: v.model.providerModelId,
          predictedCostUsd: v.prediction.predictedCostUsd,
          reason: `score=${v.score.toFixed(2)}; costSource=${v.prediction.source}`,
        })),
        ...rejected.slice(0, 4).map((r) => ({
          provider: r.model.provider,
          model: r.model.providerModelId,
          predictedCostUsd: r.prediction.predictedCostUsd,
          reason: r.rejectReason ?? 'rejected',
        })),
      ],
    });

    return {
      status: 'selected',
      provider: best.model.provider,
      providerModelId: best.model.providerModelId,
      predictedCostUsd: best.prediction.predictedCostUsd,
      predictedLatencyMs: best.economics?.meanLatencyMs ?? null,
      reasoning,
      budgetId: budgetDecision.budget?.id ?? null,
    };
  }

  /**
   * Convenience: build candidates from the active registry list + accessibility map.
   */
  async candidatesFromRegistry(
    routableKeys: ReadonlySet<string>, // `${provider}::${providerModelId}`
  ): Promise<CandidateModel[]> {
    const active = await this.registryRepo.getActiveModels();
    return active.map((m: RegistryModelDto) => ({
      provider: m.provider,
      providerModelId: m.providerModelId,
      displayName: m.displayName,
      contextWindow: m.contextWindow,
      pricing: m.pricing,
      isRoutable: routableKeys.has(`${m.provider}::${m.providerModelId}`),
      lifecycleState: m.lifecycleState,
    }));
  }

  private async log(
    req: DecisionRequest,
    partial: Omit<LogDecisionDto, 'taskId' | 'workspaceId'>,
  ): Promise<void> {
    try {
      await this.decisionRepo.logDecision({
        taskId: req.taskId,
        workspaceId: req.workspaceId,
        ...partial,
      });
    } catch (err) {
      // Decision logging must not crash routing, but must be visible
      console.error('[DecisionEngine] failed to log decision', err);
    }
  }
}

function buildReasoning(
  best: ScoredCandidate,
  next: ScoredCandidate[],
  latencyWeight: number,
): string {
  const parts = [
    `Selected ${best.model.provider}/${best.model.providerModelId}`,
    `predictedCost=${best.prediction.predictedCostUsd ?? 'unknown'} (${best.prediction.source})`,
    `score=${best.score.toFixed(2)} (latencyWeight=${latencyWeight})`,
    `lifecycle=${best.model.lifecycleState}`,
  ];
  if (best.economics) {
    parts.push(
      `hist n=${best.economics.sampleSize} successRate=${best.economics.successRate ?? 'n/a'} meanLatencyMs=${best.economics.meanLatencyMs ?? 'n/a'}`,
    );
  } else {
    parts.push('hist=insufficient_samples');
  }
  if (next.length > 0) {
    parts.push(
      `next_best=${next
        .map(
          (n) =>
            `${n.model.provider}/${n.model.providerModelId}@${n.prediction.predictedCostUsd ?? '?'}`,
        )
        .join(', ')}`,
    );
  }
  return parts.join(' | ');
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}