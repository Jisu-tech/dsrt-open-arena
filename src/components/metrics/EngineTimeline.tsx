'use client';

import React from 'react';
import type { EngineTiming, ToolTiming } from '@/lib/metrics/performance';
import { formatMs } from '@/lib/metrics/performance';
import { Check, X, Settings } from 'lucide-react';

interface EngineTimelineProps {
  engines: EngineTiming[];
  tools?: ToolTiming[];
  currentState?: string;
}

export function EngineTimeline({ engines, tools = [], currentState }: EngineTimelineProps) {
  if (engines.length === 0 && tools.length === 0) {
    return (
      <div className="text-xs text-text-muted border border-border rounded-lg p-3 bg-panel">
        Waiting for engine activity…
        {currentState ? ` (${currentState})` : ''}
      </div>
    );
  }

  const maxDuration = Math.max(
    1,
    ...engines.map((e) => e.durationMs),
    ...tools.map((t) => t.durationMs)
  );

  return (
    <div className="border border-border rounded-lg bg-panel overflow-hidden">
      <div className="px-3 py-2 border-b border-border">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text">
          Execution Timeline
        </h3>
      </div>
      <div className="p-3 space-y-2">
        {engines.map((engine) => (
          <div key={`${engine.engineId}-${engine.name}`} className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <div className="flex items-center gap-1.5 min-w-0">
                {engine.success ? (
                  <Check className="w-3 h-3 text-text shrink-0" />
                ) : (
                  <X className="w-3 h-3 text-text-muted shrink-0" />
                )}
                <span className="font-mono text-text-muted shrink-0">{engine.engineId}</span>
                <span className="text-text truncate">{engine.name}</span>
              </div>
              <span className="font-mono text-text-dim shrink-0">
                {formatMs(engine.durationMs)}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-input overflow-hidden border border-border">
              <div
                className={`h-full rounded-full ${
                  engine.success ? 'bg-text-muted' : 'bg-text-dim'
                }`}
                style={{ width: `${Math.max(4, (engine.durationMs / maxDuration) * 100)}%` }}
              />
            </div>
          </div>
        ))}

        {tools.map((tool, idx) => (
          <div key={`${tool.name}-${idx}`} className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <div className="flex items-center gap-1.5 min-w-0">
                <Settings className="w-3 h-3 text-text-muted shrink-0" />
                <span className="text-text truncate">Tool: {tool.name}</span>
              </div>
              <span className="font-mono text-text-dim shrink-0">
                {formatMs(tool.durationMs)}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-input overflow-hidden border border-border">
              <div
                className={`h-full rounded-full ${
                  tool.success ? 'bg-text-muted' : 'bg-text-dim'
                }`}
                style={{ width: `${Math.max(4, (tool.durationMs / maxDuration) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}