'use client';

import React from 'react';
import { DsrtLogo } from '@/components/ui/DsrtMarks';

interface EmptyStateProps {
  onPromptClick?: (prompt: string) => void;
}

const SUGGESTIONS = [
  'Explain how async iterators work in JavaScript with a practical example.',
  'Draft a one-page technical spec for a rate-limiting middleware.',
  'Give me five non-obvious ways to reduce cloud spending for a Next.js app.',
  'Rewrite this prompt into a precise, verifiable instruction.',
];

export function EmptyState({ onPromptClick }: EmptyStateProps) {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center p-6">
      <div className="max-w-[720px] w-full flex flex-col items-center">
        <div className="mb-6 opacity-90">
          <DsrtLogo size={36} />
        </div>

        <h1 className="text-[28px] md:text-[32px] font-normal text-text tracking-tight text-center mb-10">
          What&apos;s on your mind today?
        </h1>

        <div className="w-full max-w-[640px] flex flex-wrap justify-center gap-2">
          {SUGGESTIONS.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onPromptClick?.(s)}
              className="text-left px-3.5 py-2 rounded-full border border-border bg-panel hover:bg-panel-hover text-[12px] text-text-muted hover:text-text transition-colors max-w-[360px] truncate"
              title={s}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}