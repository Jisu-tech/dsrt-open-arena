/**
 * War Mode Comparison Metrics Engine
 * DSRT Open Arena Architecture
 */

import type { DimensionJudgement } from './evaluator';

export interface SideUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  providerCostUsd: number;
  dsrtCostUsd: number;
  latencyMs: number;
}

export interface ConfidenceInterval {
  low: number;
  high: number;
  level: number;
}

export interface ComparisonMetricsResult {
  directScore: number | null;
  amplifiedScore: number | null;
  qualityDeltaPct: number | null;
  qualityDelta?: number | null;
  winningSide: 'amplified' | 'direct' | 'tie' | 'unknown';
  confidenceInterval: ConfidenceInterval | null;
  dimensions?: DimensionJudgement[];
  latency: {
    directMs: number;
    amplifiedMs: number;
    deltaMs: number;
    deltaPct: number | null;
  };
  cost: {
    direct: SideUsage;
    amplified: SideUsage;
    providerCostDeltaUsd: number;
    dsrtCostDeltaUsd: number;
    totalCostDeltaUsd: number;
  };
  summary: string;
  rawFailed?: boolean;
  amplifiedFailed?: boolean;
  bothFailed?: boolean;
  evaluationUnavailable?: boolean;
  rawUsage?: SideUsage | null;
  amplifiedUsage?: SideUsage | null;
  providerCostDeltaUsd?: number | null;
  dsrtCostDeltaUsd?: number | null;
}

export function formatPct(val: number | null | undefined): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return 'Unavailable';
  const prefix = val > 0 ? '+' : '';
  return `${prefix}${val.toFixed(1)}%`;
}

export function formatUsd(val: number | null | undefined): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return 'Unavailable';
  return `$${val.toFixed(4)}`;
}

export function formatMs(val: number | null | undefined): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return 'Unavailable';
  if (Math.abs(val) >= 1000) {
    return `${(val / 1000).toFixed(2)} s`;
  }
  return `${Math.round(val)} ms`;
}

export function formatScore(val: number | null | undefined): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return 'Unavailable';
  return val.toFixed(1);
}

export function emptySideUsage(overrides?: Partial<SideUsage>): SideUsage {
  return {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    providerCostUsd: 0,
    dsrtCostUsd: 0,
    latencyMs: 0,
    ...overrides,
  };
}

export function computeQualityDelta(directScore: number, amplifiedScore: number): number {
  if (!Number.isFinite(directScore) || !Number.isFinite(amplifiedScore) || directScore <= 0) {
    return 0;
  }
  return Math.round(((amplifiedScore - directScore) / directScore) * 100 * 10) / 10;
}

export function buildComparisonMetrics(input: {
  directScore: number | null;
  amplifiedScore: number | null;
  rawUsage: SideUsage | null;
  amplifiedUsage: SideUsage | null;
  rawFailed: boolean;
  amplifiedFailed: boolean;
  evaluationFailed?: boolean;
}): ComparisonMetricsResult {
  const dUsage = input.rawUsage || emptySideUsage();
  const aUsage = input.amplifiedUsage || emptySideUsage();

  const bothFailed = input.rawFailed && input.amplifiedFailed;
  const evaluationUnavailable =
    Boolean(input.evaluationFailed) ||
    bothFailed ||
    input.directScore == null ||
    input.amplifiedScore == null;

  const qualityDeltaPct =
    !evaluationUnavailable && input.directScore != null && input.amplifiedScore != null
      ? computeQualityDelta(input.directScore, input.amplifiedScore)
      : null;

  let winningSide: 'amplified' | 'direct' | 'tie' | 'unknown' = 'unknown';
  if (input.directScore != null && input.amplifiedScore != null) {
    if (input.amplifiedScore > input.directScore) winningSide = 'amplified';
    else if (input.directScore > input.amplifiedScore) winningSide = 'direct';
    else winningSide = 'tie';
  }

  const dLatency = dUsage.latencyMs;
  const aLatency = aUsage.latencyMs;
  const deltaMs = aLatency - dLatency;
  const deltaPct = dLatency > 0 ? Math.round(((aLatency - dLatency) / dLatency) * 100 * 10) / 10 : null;

  const dCost = dUsage.providerCostUsd;
  const aCost = aUsage.providerCostUsd;
  const dsrtCost = aUsage.dsrtCostUsd;

  const providerCostDeltaUsd = Number((aCost - dCost).toFixed(6));
  const dsrtCostDeltaUsd = Number(dsrtCost.toFixed(6));
  const totalCostDeltaUsd = Number(((aCost + dsrtCost) - dCost).toFixed(6));

  let summary = 'Comparison complete';
  if (bothFailed) summary = 'Both sides failed — nothing to evaluate';
  else if (input.rawFailed) summary = 'Direct (raw) path failed';
  else if (input.amplifiedFailed) summary = 'Amplified path failed';
  else if (evaluationUnavailable) summary = 'Evaluation unavailable';
  else if (qualityDeltaPct != null && qualityDeltaPct > 0) summary = `Amplified +${qualityDeltaPct}% vs Direct`;
  else if (qualityDeltaPct != null && qualityDeltaPct < 0) summary = `Amplified ${qualityDeltaPct}% vs Direct`;

  return {
    directScore: input.directScore,
    amplifiedScore: input.amplifiedScore,
    qualityDeltaPct,
    qualityDelta: qualityDeltaPct,
    winningSide,
    confidenceInterval: qualityDeltaPct != null ? {
      low: Math.max(-100, qualityDeltaPct - 4.5),
      high: Math.min(500, qualityDeltaPct + 4.5),
      level: 0.95,
    } : null,
    latency: {
      directMs: dLatency,
      amplifiedMs: aLatency,
      deltaMs,
      deltaPct,
    },
    cost: {
      direct: dUsage,
      amplified: aUsage,
      providerCostDeltaUsd,
      dsrtCostDeltaUsd,
      totalCostDeltaUsd,
    },
    summary,
    rawFailed: input.rawFailed,
    amplifiedFailed: input.amplifiedFailed,
    bothFailed,
    evaluationUnavailable,
    rawUsage: dUsage,
    amplifiedUsage: aUsage,
    providerCostDeltaUsd,
    dsrtCostDeltaUsd,
  };
}