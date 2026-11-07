'use client';

import React from 'react';
import { User, Sparkles } from 'lucide-react';
import { Message } from '@/types';

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
}

export function MessageBubble({ message, isStreaming }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
          isUser ? 'bg-foreground text-white' : 'bg-accent text-white'
        }`}
      >
        {isUser ? <User size={14} /> : <Sparkles size={14} />}
      </div>
      <div className={`flex-1 max-w-[85%] ${isUser ? 'text-right' : ''}`}>
        <div
          className={`inline-block px-4 py-2.5 rounded-card text-sm leading-relaxed whitespace-pre-wrap text-left ${
            isUser
              ? 'bg-foreground text-white'
              : 'bg-white border border-border text-foreground'
          }`}
        >
          {message.content}
          {isStreaming && <span className="inline-block w-1.5 h-4 bg-accent ml-1 animate-pulse" />}
        </div>
        {!isUser && !isStreaming && message.latency_ms > 0 && (
          <div className="flex gap-3 mt-1.5 text-[10px] font-mono text-secondary">
            <span>{message.token_count_prompt + message.token_count_completion} tokens</span>
            <span>·</span>
            <span>${message.provider_cost_usd.toFixed(6)} provider</span>
            <span>·</span>
            <span>{message.latency_ms}ms</span>
          </div>
        )}
      </div>
    </div>
  );
}