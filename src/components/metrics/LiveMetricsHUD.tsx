'use client';

import React, { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { PerformanceSnapshot } from '@/lib/metrics/performance';
import { formatMs, formatUsd, formatTokens } from '@/lib/metrics/performance';

interface LiveMetricsHUDProps {
  snapshot: PerformanceSnapshot | null;
  collapsed?: boolean;
  onToggle?: () => void;
}

export function LiveMetricsHUD({
  snapshot,
  collapsed = false,
  onToggle,
}: LiveMetricsHUDProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!snapshot || snapshot.completedAt) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [snapshot]);

  if (!snapshot) return null;

  const liveLatency = snapshot.completedAt
    ? snapshot.totalLatencyMs
    : now - snapshot.startedAt;

  const isRunning = !snapshot.completedAt && !snapshot.currentState.startsWith('FAILED');

  return (
    <div className="w-full border border-border bg-panel rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-input transition-colors text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`w-2 h-2 rounded-full shrink-0 ${
              isRunning ? 'bg-text animate-pulse' : 'bg-text-dim'
            }`}
          />
          <span className="text-xs font-semibold tracking-wide text-text uppercase shrink-0">
            Live Metrics
          </span>
          <span className="text-[10px] text-text-muted font-mono truncate">
            {snapshot.currentState}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs font-mono text-text-muted">{formatMs(liveLatency)}</span>
          <ChevronDown className={`w-4 h-4 text-text-muted transition-transform ${collapsed ? '' : 'rotate-180'}`} />
        </div>
      </button>

      {!collapsed && (
        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-border">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <MetricTile
              label="Latency"
              value={formatMs(liveLatency)}
            />
            <MetricTile
              label="TTFT"
              value={formatMs(snapshot.timeToFirstTokenMs)}
            />
            <MetricTile
              label="Tokens"
              value={formatTokens(snapshot.totalTokens)}
            />
            <MetricTile
              label="Total Cost"
              value={formatUsd(snapshot.providerCostUsd + snapshot.dsrtCostUsd)}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-border bg-input p-2.5">
              <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1">
                Provider Cost
              </div>
              <div className="text-sm font-mono text-text">
                {formatUsd(snapshot.providerCostUsd)}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-input p-2.5">
              <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1">
                DSRT Platform
              </div>
              <div className="text-sm font-mono text-text">
                {formatUsd(snapshot.dsrtCostUsd)}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
            {snapshot.chosenProvider && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-border bg-input">
                {snapshot.chosenProvider}
                {snapshot.chosenModel ? ` / ${snapshot.chosenModel}` : ''}
              </span>
            )}
            {snapshot.fallbackUsed && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-border bg-input text-text">
                Failover
              </span>
            )}
            {snapshot.qualityOverall != null && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-border bg-input">
                Quality {snapshot.qualityOverall.toFixed(1)}
              </span>
            )}
            {snapshot.verificationPassed != null && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-border bg-input">
                {snapshot.verificationPassed ? 'Verified' : 'Needs review'}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricTile({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-input p-2.5">
      <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">
        {label}
      </div>
      <div className="text-sm font-mono text-text">{value}</div>
    </div>
  );
}