'use client';

import React from 'react';
import type { EngineTiming, ToolTiming } from '@/lib/metrics/performance';
import { formatMs } from '@/lib/metrics/performance';
import { Check, X, Wrench } from 'lucide-react';

interface EngineTimelineProps {
  engines: EngineTiming[];
  tools?: ToolTiming[];
  currentState?: string;
}

export function EngineTimeline({ engines, tools = [], currentState }: EngineTimelineProps) {
  if (engines.length === 0 && tools.length === 0) {
    return (
      <div className="text-xs text-neutral-500 border border-neutral-800 rounded-lg p-3 bg-neutral-950">
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
    <div className="border border-neutral-800 rounded-xl bg-neutral-950 overflow-hidden">
      <div className="px-3 py-2 border-b border-neutral-900">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
          Execution Timeline
        </h3>
      </div>
      <div className="p-3 space-y-2">
        {engines.map((engine) => (
          <div key={`${engine.engineId}-${engine.name}`} className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <div className="flex items-center gap-1.5 min-w-0">
                {engine.success ? (
                  <Check className="w-3 h-3 text-neutral-300 shrink-0" />
                ) : (
                  <X className="w-3 h-3 text-neutral-500 shrink-0" />
                )}
                <span className="font-mono text-neutral-400 shrink-0">{engine.engineId}</span>
                <span className="text-neutral-200 truncate">{engine.name}</span>
              </div>
              <span className="font-mono text-neutral-500 shrink-0">
                {formatMs(engine.durationMs)}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-neutral-900 overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  engine.success ? 'bg-neutral-200' : 'bg-neutral-600'
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
                <Wrench className="w-3 h-3 text-neutral-400 shrink-0" />
                <span className="text-neutral-200 truncate">Tool: {tool.name}</span>
              </div>
              <span className="font-mono text-neutral-500 shrink-0">
                {formatMs(tool.durationMs)}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-neutral-900 overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  tool.success ? 'bg-neutral-400' : 'bg-neutral-700'
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