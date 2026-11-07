'use client';

import React from 'react';
import { formatUsd, formatTokens } from '@/lib/metrics/performance';
import type { PerformanceSnapshot } from '@/lib/metrics/performance';

interface CostBreakdownPanelProps {
  snapshot: PerformanceSnapshot | null;
}

export function CostBreakdownPanel({ snapshot }: CostBreakdownPanelProps) {
  if (!snapshot) {
    return (
      <div className="border border-neutral-800 rounded-xl bg-neutral-950 p-4 text-xs text-neutral-500">
        Cost metrics appear after the first completion.
      </div>
    );
  }

  const provider = snapshot.providerCostUsd || 0;
  const dsrt = snapshot.dsrtCostUsd || 0;
  const total = provider + dsrt;
  const providerPct = total > 0 ? (provider / total) * 100 : 50;
  const dsrtPct = total > 0 ? (dsrt / total) * 100 : 50;

  return (
    <div className="border border-neutral-800 rounded-xl bg-neutral-950 overflow-hidden">
      <div className="px-3 py-2 border-b border-neutral-900">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
          Cost Breakdown
        </h3>
      </div>

      <div className="p-3 space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-neutral-500">Total</div>
            <div className="text-lg font-mono text-white">{formatUsd(total)}</div>
          </div>
          <div className="text-right text-[11px] text-neutral-400 font-mono">
            <div>{formatTokens(snapshot.promptTokens)} in</div>
            <div>{formatTokens(snapshot.completionTokens)} out</div>
          </div>
        </div>

        <div className="h-2 rounded-full bg-neutral-900 overflow-hidden flex">
          <div className="h-full bg-neutral-200" style={{ width: `${providerPct}%` }} />
          <div className="h-full bg-neutral-600" style={{ width: `${dsrtPct}%` }} />
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg border border-neutral-800 p-2.5 bg-neutral-900/40">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-neutral-200" />
              <span className="text-neutral-400">Provider</span>
            </div>
            <div className="font-mono text-neutral-100">{formatUsd(provider)}</div>
            <div className="text-[10px] text-neutral-500 mt-0.5">{providerPct.toFixed(1)}%</div>
          </div>
          <div className="rounded-lg border border-neutral-800 p-2.5 bg-neutral-900/40">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-neutral-600" />
              <span className="text-neutral-400">DSRT Platform</span>
            </div>
            <div className="font-mono text-neutral-100">{formatUsd(dsrt)}</div>
            <div className="text-[10px] text-neutral-500 mt-0.5">{dsrtPct.toFixed(1)}%</div>
          </div>
        </div>

        <p className="text-[10px] text-neutral-500 leading-relaxed">
          Provider cost is billed by the model vendor. DSRT platform cost covers amplification
          engine overhead and is tracked separately across the database and UI.
        </p>
      </div>
    </div>
  );
}