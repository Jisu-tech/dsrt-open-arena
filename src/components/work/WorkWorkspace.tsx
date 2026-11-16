'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Plus, ArrowUp, Square, Mic } from 'lucide-react';
import { EmptyState } from '@/components/work/EmptyState';
import { MessageActions } from '@/components/work/MessageActions';
import { ModelSelector } from '@/components/work/ModelSelector';
import { StreamingStatusBar, MetricsDrawer } from '@/components/metrics';
import { usePerformanceTracker } from '@/hooks/usePerformanceTracker';
import { useWorkspace } from '@/components/providers/WorkspaceProvider';
import { useConfiguredProviders } from '@/hooks/useConfiguredProviders';
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';
import { DsrtLogo } from '@/components/ui/DsrtMarks';
import type { Message } from '@/types';
import type { ProviderType } from '@/lib/providers/registry';

export function WorkWorkspace() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryConversationId = searchParams.get('c');
  const { activeWorkspaceId } = useWorkspace();
  const { configuredProviders } = useConfiguredProviders(
    activeWorkspaceId || undefined
  );

  const [conversationId, setConversationId] = useState<string | null>(
    queryConversationId
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentState, setCurrentState] = useState('IDLE');
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [isMetricsOpen, setIsMetricsOpen] = useState(false);

  const [provider, setProvider] = useState<ProviderType>('groq');
  const [model, setModel] = useState('llama-3.3-70b-versatile');

  const { snapshot, start: startMetrics, getTracker } = usePerformanceTracker();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, currentState]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  }, [inputMessage]);

  useEffect(() => {
    if (!queryConversationId) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(
          `/api/v1/conversations/${queryConversationId}`
        );
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled) return;
        setMessages(data.messages || []);
        if (data.conversation) {
          setConversationId(data.conversation.id);
          if (data.conversation.default_provider)
            setProvider(data.conversation.default_provider);
          if (data.conversation.default_model)
            setModel(data.conversation.default_model);
        }
      } catch (err) {
        if (!cancelled) console.error('Failed to load conversation', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [queryConversationId]);

  const stopStreaming = () => {
    abortRef.current?.abort();
    setIsStreaming(false);
    setCurrentState('CANCELLED');
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputMessage.trim() || isStreaming) return;

    const userText = inputMessage.trim();
    setInputMessage('');

    const userMsg: Message = {
      id: `msg_${Date.now()}`,
      conversation_id: conversationId || '',
      user_id: null,
      role: 'user',
      content: userText,
      is_amplified: false,
      token_count_prompt: 0,
      token_count_completion: 0,
      provider_cost_usd: 0,
      dsrt_cost_usd: 0,
      latency_ms: 0,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsStreaming(true);
    setCurrentState('INITIALIZING');
    setActiveTool(null);

    const execId = `exec_${Date.now()}`;
    startMetrics(execId, true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch('/api/v1/work/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          workspaceId: activeWorkspaceId || 'ws_default',
          userId: 'usr_default',
          userMessage: userText,
          history: messages,
          provider,
          model,
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Stream request failed.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const assistantMsg: Message = {
        id: `msg_asst_${Date.now()}`,
        conversation_id: conversationId || '',
        user_id: null,
        role: 'assistant',
        content: '',
        is_amplified: true,
        token_count_prompt: 0,
        token_count_completion: 0,
        provider_cost_usd: 0,
        dsrt_cost_usd: 0,
        latency_ms: 0,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMsg]);

      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const block of lines) {
          const eventLine = block.match(/^event:\s*(.+)$/m);
          const dataLine = block.match(/^data:\s*(.+)$/m);

          if (eventLine && dataLine) {
            const eventType = eventLine[1].trim();
            const data = JSON.parse(dataLine[1]);

            if (eventType === 'meta' && data.conversationId) {
              setConversationId(data.conversationId);
              if (!queryConversationId)
                router.replace(`/work?c=${data.conversationId}`);
            } else if (eventType === 'state') {
              setCurrentState(data.state);
              getTracker()?.setState(data.state);
            } else if (eventType === 'tool_call') {
              setActiveTool(data.name);
            } else if (eventType === 'content') {
              assistantMsg.content += data.content;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsg.id ? { ...assistantMsg } : m
                )
              );
              getTracker()?.recordContent();
            } else if (eventType === 'content_replace') {
              assistantMsg.content = data.content;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsg.id ? { ...assistantMsg } : m
                )
              );
            } else if (eventType === 'done') {
              assistantMsg.token_count_prompt =
                data.usage?.promptTokens || 0;
              assistantMsg.token_count_completion =
                data.usage?.completionTokens || 0;
              assistantMsg.provider_cost_usd =
                data.usage?.providerCostUsd || 0;
              assistantMsg.dsrt_cost_usd = data.dsrtCostUsd || 0;
              assistantMsg.latency_ms = data.latencyMs || 0;

              getTracker()?.complete({
                promptTokens: data.usage.promptTokens,
                completionTokens: data.usage.completionTokens,
                providerCostUsd: data.usage.providerCostUsd,
                dsrtCostUsd: data.dsrtCostUsd,
                qualityOverall: data.qualityOverall,
                verificationPassed: data.verificationPassed,
                fallbackUsed: data.fallbackUsed,
                chosenProvider: data.chosenProvider,
                chosenModel: data.chosenModel,
              });
            }
          }
        }
      }
    } catch (err: unknown) {
      if ((err as Error).name === 'AbortError') {
        setCurrentState('CANCELLED');
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        getTracker()?.fail(msg);
        setCurrentState(`FAILED: ${msg}`);
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col h-full bg-bg">
      {/* Model bar */}
      <div className="shrink-0 border-b border-border px-4 md:px-6 py-2.5 flex items-center justify-between gap-3">
        <ModelSelector
          provider={provider}
          model={model}
          onProviderChange={(p) => setProvider(p as ProviderType)}
          onModelChange={setModel}
          configuredProviders={configuredProviders}
        />
        {hasMessages && (
          <div className="text-[10px] font-mono text-text-faint">
            {messages.length} messages
          </div>
        )}
      </div>

      {/* Conversation */}
      <div className="flex-1 overflow-y-auto">
        {!hasMessages ? (
          <EmptyState onPromptClick={(prompt) => setInputMessage(prompt)} />
        ) : (
          <div className="max-w-[760px] mx-auto w-full px-4 md:px-6 py-8 space-y-7">
            {messages.map((m, idx) => {
              const isAssistant = m.role === 'assistant';
              const isLast = idx === messages.length - 1;
              return (
                <div key={m.id} className="group flex gap-3 md:gap-4 dsrt-fade">
                  <div className="shrink-0 pt-0.5">
                    {isAssistant ? (
                      <div className="h-7 w-7 rounded-md bg-panel border border-border flex items-center justify-center">
                        <DsrtLogo size={16} />
                      </div>
                    ) : (
                      <div className="h-7 w-7 rounded-md bg-panel border border-border-strong flex items-center justify-center text-[11px] font-semibold text-text">
                        Y
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[12px] font-semibold text-text">
                        {isAssistant ? 'Dsrt AI' : 'You'}
                      </span>
                      {isAssistant && m.is_amplified && (
                        <span className="text-[9px] font-mono uppercase tracking-wider text-text-faint border border-border rounded px-1.5 py-[1px]">
                          Amplified
                        </span>
                      )}
                    </div>

                    {isAssistant ? (
                      <MarkdownRenderer
                        content={m.content}
                        isStreaming={isStreaming && isLast}
                      />
                    ) : (
                      <div className="text-[14px] text-text whitespace-pre-wrap leading-relaxed break-words">
                        {m.content}
                      </div>
                    )}

                    {isAssistant && !isStreaming && m.latency_ms > 0 && (
                      <div className="flex items-center gap-2 mt-2 text-[10px] font-mono text-text-faint">
                        <span>
                          {m.token_count_prompt + m.token_count_completion} tok
                        </span>
                        <span>·</span>
                        <span>${m.provider_cost_usd.toFixed(6)}</span>
                        <span>·</span>
                        <span>{m.latency_ms}ms</span>
                      </div>
                    )}

                    <div className="mt-2">
                      <MessageActions
                        content={m.content}
                        isAssistant={isAssistant}
                        onShowMetrics={() => setIsMetricsOpen(true)}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={chatEndRef} className="h-8" />
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="shrink-0 px-4 md:px-6 pb-5 pt-2">
        <div className="max-w-[760px] mx-auto w-full space-y-2">
          <StreamingStatusBar
            state={currentState}
            isStreaming={isStreaming}
            toolName={activeTool}
            fallbackUsed={snapshot?.fallbackUsed}
            modelLabel={`${provider}/${model}`}
          />

          <form
            onSubmit={handleSend}
            className="relative flex items-end bg-input border border-border rounded-2xl shadow-[0_0_0_1px_rgba(255,255,255,0.02)] focus-within:border-border-hover transition-colors"
          >
            <button
              type="button"
              className="shrink-0 h-10 w-10 flex items-center justify-center text-text-muted hover:text-text transition-colors"
              title="Attach"
            >
              <Plus size={16} strokeWidth={1.8} />
            </button>

            <textarea
              ref={textareaRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend(e);
                }
              }}
              placeholder="Ask Dsrt AI"
              rows={1}
              disabled={isStreaming}
              className="flex-1 bg-transparent px-1 py-3 pr-2 text-[14px] text-text placeholder:text-text-dim focus:outline-none resize-none max-h-[200px] leading-relaxed"
            />

            <div className="shrink-0 flex items-center gap-1 pr-2 pb-2">
              <button
                type="button"
                className="h-8 w-8 flex items-center justify-center text-text-muted hover:text-text rounded-md transition-colors"
                title="Voice"
              >
                <Mic size={14} strokeWidth={1.8} />
              </button>
              {isStreaming ? (
                <button
                  type="button"
                  onClick={stopStreaming}
                  className="h-8 w-8 flex items-center justify-center rounded-full bg-text text-bg hover:bg-accent-hover transition-colors"
                  title="Stop"
                >
                  <Square size={12} strokeWidth={2.5} fill="currentColor" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!inputMessage.trim()}
                  className="h-8 w-8 flex items-center justify-center rounded-full bg-text text-bg disabled:bg-panel disabled:text-text-faint disabled:cursor-not-allowed hover:bg-accent-hover transition-colors"
                  title="Send"
                >
                  <ArrowUp size={14} strokeWidth={2.2} />
                </button>
              )}
            </div>
          </form>

          <div className="text-[10px] text-text-faint text-center">
            Dsrt AI can make mistakes. Verify important outputs.
          </div>
        </div>
      </div>

      <MetricsDrawer
        open={isMetricsOpen}
        onClose={() => setIsMetricsOpen(false)}
        snapshot={snapshot}
      />
    </div>
  );
}