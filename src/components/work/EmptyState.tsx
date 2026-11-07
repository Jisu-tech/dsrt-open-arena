'use client';

import React from 'react';
import { MessageSquarePlus, Swords, Sparkles } from 'lucide-react';

interface EmptyStateProps {
  onNewChat?: () => void;
  onOpenWar?: () => void;
}

export function EmptyState({ onNewChat, onOpenWar }: EmptyStateProps) {
  return (
    <div className="h-full w-full flex items-center justify-center p-6">
      <div className="max-w-lg w-full text-center space-y-6">
        <div className="mx-auto w-14 h-14 rounded-2xl border border-neutral-800 bg-neutral-900 flex items-center justify-center">
          <Sparkles className="w-6 h-6 text-neutral-200" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-neutral-50 tracking-tight">
            DSRT Open Arena
          </h1>
          <p className="text-sm text-neutral-400 leading-relaxed">
            Work Mode keeps endless context across chats. War Mode compares raw vs amplified
            output side-by-side on the same model and rubric.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onNewChat}
            className="flex items-center gap-3 p-4 rounded-xl border border-neutral-800 bg-neutral-950 hover:bg-neutral-900 transition-colors text-left"
          >
            <MessageSquarePlus className="w-5 h-5 text-neutral-200 shrink-0" />
            <div>
              <div className="text-sm font-medium text-neutral-100">New Work Chat</div>
              <div className="text-[11px] text-neutral-500">Continuous amplified workspace</div>
            </div>
          </button>
          <button
            type="button"
            onClick={onOpenWar}
            className="flex items-center gap-3 p-4 rounded-xl border border-neutral-800 bg-neutral-950 hover:bg-neutral-900 transition-colors text-left"
          >
            <Swords className="w-5 h-5 text-neutral-200 shrink-0" />
            <div>
              <div className="text-sm font-medium text-neutral-100">Open War Mode</div>
              <div className="text-[11px] text-neutral-500">Raw vs amplified comparison</div>
            </div>
          </button>
        </div>

        <div className="text-[11px] text-neutral-600 font-mono">
          Shortcuts: ⌘/Ctrl + Enter send · ⌘/Ctrl + K command · ⌘/Ctrl + J metrics
        </div>
      </div>
    </div>
  );
}