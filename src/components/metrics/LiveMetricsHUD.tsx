'use client';

import React, { useEffect, useState } from 'react';
import {
  Activity,
  Clock,
  Coins,
  Cpu,
  Gauge,
  ShieldCheck,
  Zap,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
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
    <div className="w-full border border-neutral-800 bg-neutral-950 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-neutral-900/60 transition-colors text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`w-2 h-2 rounded-full shrink-0 ${
              isRunning ? 'bg-white animate-pulse' : 'bg-neutral-500'
            }`}
          />
          <span className="text-xs font-semibold tracking-wide text-neutral-200 uppercase shrink-0">
            Live Metrics
          </span>
          <span className="text-[10px] text-neutral-500 font-mono truncate">
            {snapshot.currentState}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs font-mono text-neutral-400">{formatMs(liveLatency)}</span>
          {collapsed ? (
            <ChevronDown className="w-4 h-4 text-neutral-500" />
          ) : (
            <ChevronUp className="w-4 h-4 text-neutral-500" />
          )}
        </div>
      </button>

      {!collapsed && (
        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-neutral-900">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <MetricTile
              icon={<Clock className="w-3.5 h-3.5" />}
              label="Latency"
              value={formatMs(liveLatency)}
            />
            <MetricTile
              icon={<Zap className="w-3.5 h-3.5" />}
              label="TTFT"
              value={formatMs(snapshot.timeToFirstTokenMs)}
            />
            <MetricTile
              icon={<Cpu className="w-3.5 h-3.5" />}
              label="Tokens"
              value={formatTokens(snapshot.totalTokens)}
            />
            <MetricTile
              icon={<Coins className="w-3.5 h-3.5" />}
              label="Total Cost"
              value={formatUsd(snapshot.providerCostUsd + snapshot.dsrtCostUsd)}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-2.5">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">
                Provider Cost
              </div>
              <div className="text-sm font-mono text-neutral-100">
                {formatUsd(snapshot.providerCostUsd)}
              </div>
            </div>
            <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-2.5">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">
                DSRT Platform
              </div>
              <div className="text-sm font-mono text-neutral-100">
                {formatUsd(snapshot.dsrtCostUsd)}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] text-neutral-400">
            {snapshot.chosenProvider && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-neutral-800 bg-neutral-900">
                <Gauge className="w-3 h-3" />
                {snapshot.chosenProvider}
                {snapshot.chosenModel ? ` / ${snapshot.chosenModel}` : ''}
              </span>
            )}
            {snapshot.fallbackUsed && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-neutral-700 bg-neutral-900 text-neutral-200">
                <Activity className="w-3 h-3" />
                Failover
              </span>
            )}
            {snapshot.qualityOverall != null && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-neutral-800 bg-neutral-900">
                Quality {snapshot.qualityOverall.toFixed(1)}
              </span>
            )}
            {snapshot.verificationPassed != null && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-neutral-800 bg-neutral-900">
                <ShieldCheck className="w-3 h-3" />
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
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-2.5">
      <div className="flex items-center gap-1.5 text-neutral-500 mb-1">
        {icon}
        <span className="text-[10px] uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-sm font-mono text-neutral-100">{value}</div>
    </div>
  );
}