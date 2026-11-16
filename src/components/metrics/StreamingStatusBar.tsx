'use client';

import React from 'react';
import { Loader2, Settings, Check, X } from 'lucide-react';

interface StreamingStatusBarProps {
  state: string;
  isStreaming: boolean;
  toolName?: string | null;
  fallbackUsed?: boolean;
  error?: string | null;
  modelLabel?: string | null;
}

export function StreamingStatusBar({
  state,
  isStreaming,
  toolName,
  fallbackUsed,
  error,
  modelLabel,
}: StreamingStatusBarProps) {
  if (error) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-panel text-xs text-text-muted">
        <X className="w-3.5 h-3.5 text-error shrink-0" />
        <span className="truncate text-error">{error}</span>
      </div>
    );
  }

  if (!isStreaming && state === 'COMPLETED') {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-panel text-xs text-text-muted">
        <Check className="w-3.5 h-3.5 text-text shrink-0" />
        <span>Completed</span>
        {modelLabel && <span className="font-mono text-text-dim">· {modelLabel}</span>}
        {fallbackUsed && (
          <span className="inline-flex items-center gap-1 text-text">
            Failover used
          </span>
        )}
      </div>
    );
  }

  if (!isStreaming) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-panel text-xs text-text-muted">
      <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 text-text" />
      <span className="font-medium tracking-wide text-text">{humanizeState(state)}</span>
      {toolName && (
        <span className="inline-flex items-center gap-1 text-text-muted">
          <Settings className="w-3 h-3" />
          {toolName}
        </span>
      )}
      {fallbackUsed && (
        <span className="inline-flex items-center gap-1 text-text-muted">
          Failover
        </span>
      )}
      {modelLabel && <span className="ml-auto font-mono text-text-dim">{modelLabel}</span>}
    </div>
  );
}

function humanizeState(state: string): string {
  const map: Record<string, string> = {
    INITIALIZING: 'Initializing',
    UNDERSTANDING: 'Understanding intent',
    PLANNING: 'Planning',
    PREPARING_CONTEXT: 'Preparing context',
    RETRIEVING: 'Retrieving knowledge',
    STRATEGY_SELECTION: 'Selecting strategy',
    INSTRUCTION_SYNTHESIS: 'Synthesizing instructions',
    MODEL_EXECUTION: 'Generating response',
    TOOL_EXECUTION: 'Running tools',
    REFINEMENT: 'Refining output',
    VERIFICATION: 'Verifying',
    EVALUATION: 'Evaluating quality',
    OPTIMIZATION: 'Optimizing cost',
    COMPLETED: 'Completed',
  };
  if (map[state]) return map[state];
  if (state.startsWith('ENGINE:')) return `Running ${state.replace('ENGINE:', '')}`;
  return state.replace(/_/g, ' ').toLowerCase();
}