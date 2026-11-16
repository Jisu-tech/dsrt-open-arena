'use client';

import React, { useState } from 'react';
import { Copy, Check, RotateCcw, BarChart3, Trash2 } from 'lucide-react';

interface MessageActionsProps {
  content: string;
  onRegenerate?: () => void;
  onShowMetrics?: () => void;
  onDeleteMessage?: () => void;
  isAssistant?: boolean;
}

export function MessageActions({
  content,
  onRegenerate,
  onShowMetrics,
  onDeleteMessage,
  isAssistant = false,
}: MessageActionsProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  };

  const btn =
    'p-1.5 rounded-md text-text-faint hover:text-text hover:bg-panel-hover transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100';

  return (
    <div className="flex items-center gap-0.5 -ml-1.5">
      <button type="button" onClick={handleCopy} className={btn} title="Copy">
        {copied ? <Check size={13} strokeWidth={2} className="text-success" /> : <Copy size={13} strokeWidth={1.8} />}
      </button>

      {isAssistant && onRegenerate && (
        <button type="button" onClick={onRegenerate} className={btn} title="Regenerate">
          <RotateCcw size={13} strokeWidth={1.8} />
        </button>
      )}

      {isAssistant && onShowMetrics && (
        <button type="button" onClick={onShowMetrics} className={btn} title="Metrics">
          <BarChart3 size={13} strokeWidth={1.8} />
        </button>
      )}

      {onDeleteMessage && (
        <button
          type="button"
          onClick={onDeleteMessage}
          className={`${btn} hover:text-error hover:bg-error-bg`}
          title="Delete"
        >
          <Trash2 size={13} strokeWidth={1.8} />
        </button>
      )}
    </div>
  );
}