'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { EmptyState } from '@/components/work/EmptyState';
import { MessageActions } from '@/components/work/MessageActions';
import { ModelSelector } from '@/components/work/ModelSelector';
import { StreamingStatusBar, MetricsDrawer } from '@/components/metrics';
import { usePerformanceTracker } from '@/hooks/usePerformanceTracker';
import { useWorkspace } from '@/components/providers/WorkspaceProvider';
import { useConfiguredProviders } from '@/hooks/useConfiguredProviders';
import type { Message } from '@/types';
import type { ProviderType } from '@/lib/providers/registry';
import { Send, Swords, Archive, Trash2, Sparkles } from 'lucide-react';
import { WorkMark } from '@/components/ui/Marks';
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';

export function WorkWorkspace() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryConversationId = searchParams.get('c');
  const { activeWorkspaceId } = useWorkspace();
  const { configuredProviders } = useConfiguredProviders(activeWorkspaceId || undefined);

  const [conversationId, setConversationId] = useState<string | null>(queryConversationId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentState, setCurrentState] = useState('IDLE');
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [isMetricsOpen, setIsMetricsOpen] = useState(false);

  // Safe defaults matching registry
  const [provider, setProvider] = useState<ProviderType>('groq');
  const [model, setModel] = useState('llama-3.3-70b-versatile');

  const { snapshot, start: startMetrics, getTracker } = usePerformanceTracker();
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentState]);

  // URL is source of truth. Parent remounts on c change (key=), so no reset setState here.
  useEffect(() => {
    if (!queryConversationId) return;

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/v1/conversations/${queryConversationId}`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled) return;
        setMessages(data.messages || []);
        if (data.conversation) {
          setConversationId(data.conversation.id);
          if (data.conversation.default_provider) {
            setProvider(data.conversation.default_provider);
          }
          if (data.conversation.default_model) {
            setModel(data.conversation.default_model);
          }
        }
      } catch (err) {
        if (!cancelled) console.error('Failed to load conversation', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [queryConversationId]);

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
              if (!queryConversationId) {
                router.replace(`/work?c=${data.conversationId}`);
              }
            } else if (eventType === 'state') {
              setCurrentState(data.state);
              getTracker()?.setState(data.state);
            } else if (eventType === 'tool_call') {
              setActiveTool(data.name);
            } else if (eventType === 'content') {
              assistantMsg.content += data.content;
              setMessages((prev) => prev.map((m) => (m.id === assistantMsg.id ? { ...assistantMsg } : m)));
              getTracker()?.recordContent();
            } else if (eventType === 'content_replace') {
              assistantMsg.content = data.content;
              setMessages((prev) => prev.map((m) => (m.id === assistantMsg.id ? { ...assistantMsg } : m)));
            } else if (eventType === 'done') {
              assistantMsg.token_count_prompt = data.usage?.promptTokens || 0;
              assistantMsg.token_count_completion = data.usage?.completionTokens || 0;
              assistantMsg.provider_cost_usd = data.usage?.providerCostUsd || 0;
              assistantMsg.dsrt_cost_usd = data.dsrtCostUsd || 0;
              assistantMsg.latency_ms = data.latencyMs || 0;

              getTracker()?.complete({
                promptTokens: data.usage.promptTokens,
                completionTokens: data.usage.completionTokens,
                providerCostUsd: data.usage.providerCostUsd,
                dsrtCostUsd: data.usage.dsrtCostUsd,
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
      const msg = err instanceof Error ? err.message : String(err);
      getTracker()?.fail(msg);
      setCurrentState(`FAILED: ${msg}`);
    } finally {
      setIsStreaming(false);
    }
  };

  const forkToWarMode = (prompt: string) => {
    const params = new URLSearchParams({ prompt, provider, model });
    router.push(`/war?${params.toString()}`);
  };

  return (
    <div className="flex flex-col h-full bg-white relative">
      {/* Settings Bar synchronized visually with WarWorkspace */}
      <div className="border-b border-border bg-white px-4 md:px-6 py-3 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-4 min-w-0">
          <WorkMark className="h-6 text-foreground w-auto shrink-0" />
          <ModelSelector
            provider={provider}
            model={model}
            onProviderChange={(p) => setProvider(p as ProviderType)}
            onModelChange={setModel}
            configuredProviders={configuredProviders}
          />
        </div>

        {messages.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-secondary mr-2">
              <Sparkles className="w-3 h-3 inline mr-1" />
              {messages.length} messages
            </span>
            <button className="p-1.5 text-secondary hover:text-foreground hover:bg-workspace rounded-md transition" title="Archive Chat">
              <Archive size={16} />
            </button>
            <button className="p-1.5 text-secondary hover:text-error hover:bg-red-50 rounded-md transition" title="Delete Chat">
              <Trash2 size={16} />
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col relative overflow-hidden bg-workspace">
        {messages.length === 0 ? (
          <EmptyState
            onNewChat={() => {
              setConversationId(null);
              setMessages([]);
              router.push('/work');
            }}
            onOpenWar={() => router.push('/war')}
          />
        ) : (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-8 max-w-[1200px] mx-auto w-full">
            {messages.map((m) => {
              const isAssistant = m.role === 'assistant';
              return (
                <div key={m.id} className={`flex flex-col group ${isAssistant ? 'items-start' : 'items-end'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-5 py-4 shadow-sm border ${
                    isAssistant
                      ? 'bg-white border-border text-foreground'
                      : 'bg-foreground border-foreground text-white'
                  }`}>
                    {isAssistant ? (
                      <MarkdownRenderer
                        content={m.content}
                        isStreaming={isStreaming && m.id === messages[messages.length - 1]?.id}
                      />
                    ) : (
                      <div className="whitespace-pre-wrap text-sm">{m.content}</div>
                    )}
                  </div>

                  <div className={`flex items-center gap-2 mt-2 px-1 ${isAssistant ? 'self-start' : 'self-end flex-row-reverse'}`}>
                    <MessageActions
                      content={m.content}
                      isAssistant={isAssistant}
                      onShowMetrics={() => setIsMetricsOpen(true)}
                    />
                    {!isAssistant && (
                      <button
                        type="button"
                        onClick={() => forkToWarMode(m.content)}
                        className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-[11px] text-secondary hover:text-accent transition-opacity ml-2"
                        title="Fork prompt to War Mode"
                      >
                        <Swords className="w-3 h-3" /> Fork to War Mode
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={chatEndRef} className="h-4" />
          </div>
        )}
      </div>

      <div className="border-t border-border bg-white px-4 py-4 shrink-0 shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
        <div className="max-w-[1200px] mx-auto space-y-2 relative">
          <StreamingStatusBar
            state={currentState}
            isStreaming={isStreaming}
            toolName={activeTool}
            fallbackUsed={snapshot?.fallbackUsed}
            modelLabel={`${provider}/${model}`}
          />
          <form onSubmit={handleSend} className="relative flex items-center shadow-sm">
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend(e);
                }
              }}
              placeholder="Message DSRT Amplification... (⌘ + Enter to send)"
              rows={2}
              className="w-full pl-4 pr-16 py-3 bg-workspace border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent resize-none placeholder:text-secondary"
              disabled={isStreaming}
            />
            <div className="absolute right-3 bottom-3 flex items-center gap-1">
              <button
                type="submit"
                disabled={!inputMessage.trim() || isStreaming}
                className="p-2 bg-accent hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-accent text-white rounded-lg transition-colors shadow-sm"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
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