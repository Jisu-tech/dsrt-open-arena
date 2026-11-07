'use client';

import React from 'react';
import { Loader2, Wrench, ShieldAlert, CheckCircle2, AlertCircle } from 'lucide-react';

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
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-800 bg-neutral-950 text-xs text-neutral-300">
        <AlertCircle className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
        <span className="truncate">{error}</span>
      </div>
    );
  }

  if (!isStreaming && state === 'COMPLETED') {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-800 bg-neutral-950 text-xs text-neutral-400">
        <CheckCircle2 className="w-3.5 h-3.5 text-neutral-300 shrink-0" />
        <span>Completed</span>
        {modelLabel && <span className="font-mono text-neutral-500">· {modelLabel}</span>}
        {fallbackUsed && (
          <span className="inline-flex items-center gap-1 text-neutral-300">
            <ShieldAlert className="w-3 h-3" /> Failover used
          </span>
        )}
      </div>
    );
  }

  if (!isStreaming) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-800 bg-neutral-950 text-xs text-neutral-300">
      <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 text-neutral-200" />
      <span className="font-medium tracking-wide">{humanizeState(state)}</span>
      {toolName && (
        <span className="inline-flex items-center gap-1 text-neutral-400">
          <Wrench className="w-3 h-3" />
          {toolName}
        </span>
      )}
      {fallbackUsed && (
        <span className="inline-flex items-center gap-1 text-neutral-400">
          <ShieldAlert className="w-3 h-3" />
          Failover
        </span>
      )}
      {modelLabel && <span className="ml-auto font-mono text-neutral-500">{modelLabel}</span>}
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