export interface SideUsage {
  ttftMs: number | null;
  totalDurationMs: number;
  tokensPerSec: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
  score?: number;
}

export const emptySideUsage = (): SideUsage => ({
  ttftMs: null,
  totalDurationMs: 0,
  tokensPerSec: 0,
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
  costUsd: 0,
  score: 0,
});

export interface ComparisonMetricsResult {
  raw: SideUsage;
  amplified: SideUsage;
  speedupFactor: number;
  costRatio: number;
  qualityDeltaPct: number;
}

export type ComparisonMetrics = ComparisonMetricsResult;

export function buildComparisonMetrics(
  raw: SideUsage,
  amplified: SideUsage
): ComparisonMetricsResult {
  const rawDuration = raw.totalDurationMs || 1;
  const ampDuration = amplified.totalDurationMs || 1;
  const speedupFactor = Math.round((rawDuration / ampDuration) * 100) / 100;

  const rawCost = raw.costUsd || 0.00001;
  const ampCost = amplified.costUsd || 0.00001;
  const costRatio = Math.round((ampCost / rawCost) * 100) / 100;

  const rawScore = raw.score ?? 50;
  const ampScore = amplified.score ?? 50;
  const qualityDeltaPct = Math.round(
    ((ampScore - rawScore) / Math.max(1, rawScore)) * 100
  );

  return {
    raw,
    amplified,
    speedupFactor,
    costRatio,
    qualityDeltaPct,
  };
}

export function formatMs(ms: number | null | undefined): string {
  if (ms == null || isNaN(ms)) return '0ms';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function formatPct(val: number | null | undefined): string {
  if (val == null || isNaN(val)) return '0%';
  const prefix = val > 0 ? '+' : '';
  return `${prefix}${Math.round(val)}%`;
}

export function formatUsd(val: number | null | undefined): string {
  if (val == null || isNaN(val)) return '$0.0000';
  if (val === 0) return '$0.0000';
  if (val < 0.0001) return '<$0.0001';
  return `$${val.toFixed(4)}`;
}

export function formatScore(score: number | null | undefined): string {
  if (score == null || isNaN(score)) return '0';
  return score.toFixed(1);
}
