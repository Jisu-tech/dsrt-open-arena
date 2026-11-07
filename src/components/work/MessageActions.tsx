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
      // clipboard blocked
    }
  };

  return (
    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
      <button
        type="button"
        onClick={handleCopy}
        className="p-1.5 rounded-md text-secondary hover:text-foreground hover:bg-workspace transition-colors"
        title="Copy"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
      
      {isAssistant && onRegenerate && (
        <button
          type="button"
          onClick={onRegenerate}
          className="p-1.5 rounded-md text-secondary hover:text-foreground hover:bg-workspace transition-colors"
          title="Regenerate"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      )}

      {isAssistant && onShowMetrics && (
        <button
          type="button"
          onClick={onShowMetrics}
          className="p-1.5 rounded-md text-secondary hover:text-accent hover:bg-blue-50 transition-colors"
          title="Metrics"
        >
          <BarChart3 className="w-3.5 h-3.5" />
        </button>
      )}

      {onDeleteMessage && (
        <button
          type="button"
          onClick={onDeleteMessage}
          className="p-1.5 rounded-md text-secondary hover:text-error hover:bg-red-50 transition-colors"
          title="Delete message"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}