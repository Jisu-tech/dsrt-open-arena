'use client';

import React from 'react';
import {
  formatPct,
  formatUsd,
  formatMs,
  formatScore,
  type ComparisonMetricsResult,
} from '@/lib/warmode/metrics';
import type { SideUsage } from '@/lib/warmode/metrics';

type Props = {
  metrics: ComparisonMetricsResult | null;
  rawUsage?: SideUsage | null;
  amplifiedUsage?: SideUsage | null;
  isRunning?: boolean;
  rawFailed?: boolean;
  amplifiedFailed?: boolean;
};

function WinnerPill({ side }: { side: ComparisonMetricsResult['winningSide'] }) {
  if (side === 'amplified') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-success border border-emerald-100">
        Amplified wins
      </span>
    );
  }
  if (side === 'direct') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-workspace text-foreground border border-border">
        Direct wins
      </span>
    );
  }
  if (side === 'tie') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-workspace text-secondary border border-border">
        Tie
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-workspace text-secondary border border-border">
      Unscored
    </span>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wide text-secondary font-medium">{label}</div>
      <div className="text-sm font-semibold font-mono text-foreground mt-0.5 truncate">{value}</div>
      {sub ? <div className="text-[10px] text-secondary mt-0.5 truncate">{sub}</div> : null}
    </div>
  );
}

export function ComparisonMetrics({
  metrics,
  rawUsage,
  amplifiedUsage,
  isRunning,
  rawFailed,
  amplifiedFailed,
}: Props) {
  const dUsage = metrics?.cost.direct ?? rawUsage ?? null;
  const aUsage = metrics?.cost.amplified ?? amplifiedUsage ?? null;

  const qualityText = metrics ? formatPct(metrics.qualityDeltaPct) : isRunning ? '…' : 'Unavailable';
  const qualityPositive =
    metrics?.qualityDeltaPct !== null &&
    metrics?.qualityDeltaPct !== undefined &&
    metrics.qualityDeltaPct > 0;
  const qualityNegative =
    metrics?.qualityDeltaPct !== null &&
    metrics?.qualityDeltaPct !== undefined &&
    metrics.qualityDeltaPct < 0;

  return (
    <div className="border border-border rounded-card bg-white p-4 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-sm font-semibold text-foreground">Comparison metrics</div>
          <p className="text-[11px] text-secondary mt-0.5">
            Quality formula: ((Amplified − Direct) / Direct) × 100 · costs separated
          </p>
        </div>
        {metrics ? <WinnerPill side={metrics.winningSide} /> : null}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat
          label="Quality Δ"
          value={qualityText}
          sub={
            metrics?.confidenceInterval
              ? `CI ${formatPct(metrics.confidenceInterval.low)} … ${formatPct(metrics.confidenceInterval.high)} · agree ${(metrics.confidenceInterval.level * 100).toFixed(0)}%`
              : rawFailed || amplifiedFailed
                ? 'One or both sides failed'
                : undefined
          }
        />
        <Stat
          label="Direct score"
          value={metrics ? formatScore(metrics.directScore) : 'Unavailable'}
        />
        <Stat
          label="Amplified score"
          value={metrics ? formatScore(metrics.amplifiedScore) : 'Unavailable'}
        />
        <Stat
          label="Latency Δ"
          value={metrics ? formatMs(metrics.latency.deltaMs) : dUsage && aUsage ? formatMs(aUsage.latencyMs - dUsage.latencyMs) : 'Unavailable'}
          sub={
            metrics?.latency.deltaPct !== null && metrics?.latency.deltaPct !== undefined
              ? formatPct(metrics.latency.deltaPct)
              : undefined
          }
        />
      </div>

      {/* Quality bar — only when real scores exist */}
      {metrics?.directScore !== null &&
      metrics?.directScore !== undefined &&
      metrics?.amplifiedScore !== null &&
      metrics?.amplifiedScore !== undefined ? (
        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px] text-secondary">
            <span>Direct {formatScore(metrics.directScore)} / 10</span>
            <span
              className={
                qualityPositive ? 'text-success' : qualityNegative ? 'text-error' : 'text-secondary'
              }
            >
              {qualityText}
            </span>
            <span>Amplified {formatScore(metrics.amplifiedScore)} / 10</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="h-2 rounded-full bg-workspace overflow-hidden border border-border">
              <div
                className="h-full bg-secondary/40 rounded-full transition-all duration-500"
                style={{ width: `${Math.max(0, Math.min(100, (metrics.directScore / 10) * 100))}%` }}
              />
            </div>
            <div className="h-2 rounded-full bg-workspace overflow-hidden border border-border">
              <div
                className="h-full bg-accent rounded-full transition-all duration-500"
                style={{
                  width: `${Math.max(0, Math.min(100, (metrics.amplifiedScore / 10) * 100))}%`,
                }}
              />
            </div>
          </div>
        </div>
      ) : null}

      {/* Cost separation — always show measured usage when present */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 border-t border-border">
        <div className="rounded-input border border-border bg-workspace p-3 space-y-2">
          <div className="text-[10px] uppercase tracking-wide text-secondary font-medium">
            Direct (raw) cost
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Provider" value={dUsage ? formatUsd(dUsage.providerCostUsd) : 'Unavailable'} />
            <Stat label="DSRT" value="$0.00" sub="Raw path · zero amplification" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Stat
              label="Tokens"
              value={
                dUsage
                  ? `${dUsage.promptTokens + dUsage.completionTokens}`
                  : 'Unavailable'
              }
              sub={
                dUsage
                  ? `${dUsage.promptTokens} prompt · ${dUsage.completionTokens} completion`
                  : undefined
              }
            />
            <Stat label="Latency" value={dUsage ? formatMs(dUsage.latencyMs) : 'Unavailable'} />
          </div>
        </div>

        <div className="rounded-input border border-border bg-workspace p-3 space-y-2">
          <div className="text-[10px] uppercase tracking-wide text-secondary font-medium">
            Amplified cost
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Stat
              label="Provider"
              value={aUsage ? formatUsd(aUsage.providerCostUsd) : 'Unavailable'}
            />
            <Stat
              label="DSRT platform"
              value={aUsage ? formatUsd(aUsage.dsrtCostUsd) : 'Unavailable'}
              sub="Engines + overhead"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Stat
              label="Tokens"
              value={
                aUsage
                  ? `${aUsage.promptTokens + aUsage.completionTokens}`
                  : 'Unavailable'
              }
              sub={
                aUsage
                  ? `${aUsage.promptTokens} prompt · ${aUsage.completionTokens} completion`
                  : undefined
              }
            />
            <Stat label="Latency" value={aUsage ? formatMs(aUsage.latencyMs) : 'Unavailable'} />
          </div>
        </div>
      </div>

      {metrics ? (
        <div className="flex flex-wrap gap-4 text-[11px] text-secondary font-mono pt-1">
          <span>Provider Δ {formatUsd(metrics.cost.providerCostDeltaUsd)}</span>
          <span>DSRT Δ {formatUsd(metrics.cost.dsrtCostDeltaUsd)}</span>
          <span>Total Δ {formatUsd(metrics.cost.totalCostDeltaUsd)}</span>
        </div>
      ) : null}

      {isRunning ? (
        <p className="text-[11px] text-secondary">Live — metrics finalize when both sides and judge complete.</p>
      ) : null}
    </div>
  );
}