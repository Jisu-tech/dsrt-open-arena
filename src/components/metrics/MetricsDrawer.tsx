'use client';

import React, { useState } from 'react';
import type { PerformanceSnapshot } from '@/lib/metrics/performance';
import { LiveMetricsHUD } from './LiveMetricsHUD';
import { EngineTimeline } from './EngineTimeline';
import { CostBreakdownPanel } from './CostBreakdownPanel';
import { X } from 'lucide-react';

interface MetricsDrawerProps {
  open: boolean;
  onClose: () => void;
  snapshot: PerformanceSnapshot | null;
}

export function MetricsDrawer({ open, onClose, snapshot }: MetricsDrawerProps) {
  const [hudCollapsed, setHudCollapsed] = useState(false);

  if (!open) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full max-w-md border-l border-neutral-800 bg-neutral-950 shadow-2xl flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-900">
        <div>
          <h2 className="text-sm font-semibold text-neutral-100">Performance</h2>
          <p className="text-[11px] text-neutral-500">
            Real-time latency, cost, and engine traces
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-900 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <LiveMetricsHUD
          snapshot={snapshot}
          collapsed={hudCollapsed}
          onToggle={() => setHudCollapsed((v) => !v)}
        />
        <EngineTimeline
          engines={snapshot?.engineTimings ?? []}
          tools={snapshot?.toolTimings ?? []}
          currentState={snapshot?.currentState}
        />
        <CostBreakdownPanel snapshot={snapshot} />
      </div>
    </div>
  );
}