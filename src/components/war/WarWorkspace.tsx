'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Loader2,
  Swords,
  Shield,
  Sparkles,
  Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ModelSelector } from '@/components/work/ModelSelector';
import { useWorkspace } from '@/components/providers/WorkspaceProvider';
import { useConfiguredProviders } from '../../hooks/useConfiguredProviders';
import { ProviderType } from '@/lib/providers/registry';
import { ComparisonMetrics } from '@/components/war/ComparisonMetrics';
import { RubricDisplay } from '@/components/war/RubricDisplay';
import type { ComparisonMetricsResult, SideUsage } from '@/lib/warmode/metrics';
import type { RubricEvaluation } from '@/lib/warmode/evaluator';
import { WarMark } from '@/components/ui/Marks';
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';

type EngineTone = { engineId: string; name: string; status: 'running' | 'done' | 'failed' };

function SidePanel({
  title,
  badge,
  badgeClass,
  content,
  isStreaming,
  failed,
  usage,
  scrollRef,
  onScroll,
  emptyHint,
  footer,
}: {
  title: string;
  badge: string;
  badgeClass: string;
  content: string;
  isStreaming: boolean;
  failed?: boolean;
  usage?: SideUsage | null;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onScroll: () => void;
  emptyHint: string;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-0 min-w-0 border border-border rounded-card bg-white overflow-hidden">
      <div className="shrink-0 px-4 py-2.5 border-b border-border flex items-center justify-between gap-2 bg-workspace">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold text-foreground truncate">{title}</span>
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${badgeClass}`}>
            {badge}
          </span>
        </div>
        {isStreaming ? (
          <Loader2 className="animate-spin text-secondary shrink-0" size={14} />
        ) : failed ? (
          <span className="text-[10px] text-error font-medium">Failed</span>
        ) : null}
      </div>

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto px-4 py-4 min-h-70"
      >
        {!content && !isStreaming ? (
          <p className="text-xs text-secondary leading-relaxed">{emptyHint}</p>
        ) : (
          <MarkdownRenderer content={content} isStreaming={isStreaming} />
        )}
      </div>

      <div className="shrink-0 border-t border-border px-4 py-2 bg-workspace">
        {footer ? (
          footer
        ) : (
          <div className="flex flex-wrap gap-3 text-[10px] font-mono text-secondary">
            <span>
              Provider{' '}
              {usage ? `$${usage.providerCostUsd.toFixed(4)}` : '—'}
            </span>
            <span>
              DSRT{' '}
              {usage ? `$${usage.dsrtCostUsd.toFixed(4)}` : '—'}
            </span>
            <span>
              {usage
                ? `${usage.promptTokens + usage.completionTokens} tok · ${usage.latencyMs} ms`
                : '—'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export function WarWorkspace() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const conversationId = searchParams.get('c');
  const { activeWorkspaceId, isLoading: wsLoading } = useWorkspace();
  const { configuredProviders } = useConfiguredProviders(activeWorkspaceId || undefined);

  const [input, setInput] = useState('');
  const [provider, setProvider] = useState<ProviderType>('groq');
  const [model, setModel] = useState('llama-3.3-70b-versatile');
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [evalError, setEvalError] = useState<string | null>(null);

  const [rawContent, setRawContent] = useState('');
  const [ampContent, setAmpContent] = useState('');
  const [rawStreaming, setRawStreaming] = useState(false);
  const [ampStreaming, setAmpStreaming] = useState(false);
  const [rawFailed, setRawFailed] = useState(false);
  const [ampFailed, setAmpFailed] = useState(false);

  const [rawUsage, setRawUsage] = useState<SideUsage | null>(null);
  const [ampUsage, setAmpUsage] = useState<SideUsage | null>(null);
  const [metrics, setMetrics] = useState<ComparisonMetricsResult | null>(null);
  const [evaluation, setEvaluation] = useState<RubricEvaluation | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [fairPlayMsg, setFairPlayMsg] = useState<string | null>(null);
  const [engines, setEngines] = useState<EngineTone[]>([]);
  const [stateLabel, setStateLabel] = useState<string | null>(null);
  const [lastPrompt, setLastPrompt] = useState<string | null>(null);
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [comparisonId, setComparisonId] = useState<string | null>(null);

  const rawScrollRef = useRef<HTMLDivElement>(null);
  const ampScrollRef = useRef<HTMLDivElement>(null);
  const syncLock = useRef(false);

  const syncScroll = useCallback((source: 'raw' | 'amp') => {
    if (syncLock.current) return;
    const a = rawScrollRef.current;
    const b = ampScrollRef.current;
    if (!a || !b) return;
    syncLock.current = true;
    try {
      if (source === 'raw') {
        const max = a.scrollHeight - a.clientHeight;
        const ratio = max > 0 ? a.scrollTop / max : 0;
        const bMax = b.scrollHeight - b.clientHeight;
        b.scrollTop = ratio * bMax;
      } else {
        const max = b.scrollHeight - b.clientHeight;
        const ratio = max > 0 ? b.scrollTop / max : 0;
        const aMax = a.scrollHeight - a.clientHeight;
        a.scrollTop = ratio * aMax;
      }
    } finally {
      requestAnimationFrame(() => {
        syncLock.current = false;
      });
    }
  }, []);

  useEffect(() => {
    if (!rawStreaming) return;
    const el = rawScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [rawContent, rawStreaming]);

  useEffect(() => {
    if (!ampStreaming) return;
    const el = ampScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [ampContent, ampStreaming]);

  const createNewConversation = async (title: string): Promise<string | null> => {
    if (!activeWorkspaceId) return null;
    try {
      const res = await fetch('/api/v1/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: activeWorkspaceId,
          title: title.slice(0, 50) || 'War comparison',
          default_provider: provider,
          default_model: model,
        }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.conversation.id;
    } catch {
      return null;
    }
  };

  const resetRound = () => {
    setRawContent('');
    setAmpContent('');
    setRawUsage(null);
    setAmpUsage(null);
    setMetrics(null);
    setEvaluation(null);
    setEvalError(null);
    setError(null);
    setRawFailed(false);
    setAmpFailed(false);
    setEngines([]);
    setStateLabel(null);
    setFairPlayMsg(null);
    setExecutionId(null);
    setComparisonId(null);
    setIsEvaluating(false);
  };

  const handleRun = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isRunning) return;

    if (!activeWorkspaceId) {
      setError('No workspace selected.');
      return;
    }

    const userMsg = input.trim();
    setInput('');
    resetRound();
    setIsRunning(true);
    setRawStreaming(true);
    setAmpStreaming(true);
    setLastPrompt(userMsg);

    let activeConvId = conversationId;
    if (!activeConvId) {
      activeConvId = await createNewConversation(userMsg);
      if (!activeConvId) {
        setError('Failed to create conversation.');
        setIsRunning(false);
        setRawStreaming(false);
        setAmpStreaming(false);
        return;
      }
      router.push(`/war?c=${activeConvId}`);
    }

    try {
      const res = await fetch('/api/v1/war/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: activeConvId,
          workspace_id: activeWorkspaceId,
          user_message: userMsg,
          provider,
          model,
          evaluator_provider: provider,
          evaluator_model: model,
        }),
      });

      if (!res.ok || !res.body) {
        const errData = await res.json().catch(() => ({ error: 'War stream request failed' }));
        throw new Error(errData.error || 'War stream request failed');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const part of parts) {
          if (!part.startsWith('data: ')) continue;
          const payload = part.slice(6).trim();
          if (!payload) continue;

          let event: Record<string, unknown>;
          try {
            event = JSON.parse(payload);
          } catch {
            continue;
          }

          const type = event.type as string;

          switch (type) {
            case 'fair_play':
              setFairPlayMsg(String(event.message || ''));
              break;
            case 'state':
              setStateLabel(String(event.state || ''));
              if (event.state === 'EVALUATION') setIsEvaluating(true);
              break;
            case 'raw_content':
              setRawContent((prev) => prev + String(event.content || ''));
              break;
            case 'amplified_content':
              setAmpContent((prev) => prev + String(event.content || ''));
              break;
            case 'amplified_content_replace':
              setAmpContent(String(event.content || ''));
              break;
            case 'engine_start':
              setEngines((prev) => [
                ...prev.filter((x) => x.engineId !== event.engineId),
                {
                  engineId: String(event.engineId),
                  name: String(event.name || event.engineId),
                  status: 'running',
                },
              ]);
              break;
            case 'engine_done':
              setEngines((prev) =>
                prev.map((x) =>
                  x.engineId === event.engineId
                    ? {
                        ...x,
                        status: event.success === false ? 'failed' : 'done',
                      }
                    : x
                )
              );
              break;
            case 'raw_done': {
              setRawStreaming(false);
              setRawContent(String(event.content || ''));
              setRawUsage(event.usage as SideUsage);
              if (event.error) setRawFailed(true);
              break;
            }
            case 'amplified_done': {
              setAmpStreaming(false);
              setAmpContent(String(event.content || ''));
              setAmpUsage(event.usage as SideUsage);
              if (event.error) setAmpFailed(true);
              break;
            }
            case 'evaluation_start':
              setIsEvaluating(true);
              break;
            case 'evaluation_done':
              setIsEvaluating(false);
              setEvaluation(event.evaluation as RubricEvaluation);
              setMetrics(event.metrics as ComparisonMetricsResult);
              break;
            case 'persisted':
              if (event.executionId) setExecutionId(String(event.executionId));
              if (event.comparisonId) setComparisonId(String(event.comparisonId));
              break;
            case 'done':
              setRawStreaming(false);
              setAmpStreaming(false);
              setIsEvaluating(false);
              if (event.metrics) setMetrics(event.metrics as ComparisonMetricsResult);
              if (event.evaluation) setEvaluation(event.evaluation as RubricEvaluation);
              break;
            case 'error': {
              const side = event.side as string | undefined;
              const msg = String(event.error || 'Unknown error');
              if (side === 'evaluation') {
                setEvalError(msg);
                setIsEvaluating(false);
              } else if (side === 'raw') {
                setRawFailed(true);
                setRawStreaming(false);
              } else if (side === 'amplified') {
                setAmpFailed(true);
                setAmpStreaming(false);
              } else {
                setError(msg);
              }
              break;
            }
            default:
              break;
          }
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'War comparison failed');
    } finally {
      setIsRunning(false);
      setRawStreaming(false);
      setAmpStreaming(false);
    }
  };

  if (wsLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-secondary">
        <Loader2 className="animate-spin mr-2" size={16} />
        Loading workspace…
      </div>
    );
  }

  if (!activeWorkspaceId) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-secondary p-8 text-center">
        No workspace found for your account.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Top bar */}
      <div className="border-b border-border bg-white px-4 md:px-6 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-4 min-w-0">
          <WarMark className="h-6 text-foreground w-auto shrink-0" />
          <ModelSelector
            provider={provider}
            model={model}
            onProviderChange={(p) => setProvider(p as ProviderType)}
            onModelChange={setModel}
            configuredProviders={configuredProviders}
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          {fairPlayMsg ? (
            <div className="flex items-center gap-1.5 text-[11px] text-secondary max-w-md">
              <Lock size={12} className="shrink-0" />
              <span className="truncate">{fairPlayMsg}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[11px] text-secondary">
              <Lock size={12} />
              <span>Same model both sides · raw path = zero amplification</span>
            </div>
          )}
          {stateLabel ? (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-workspace border border-border text-secondary">
              {stateLabel}
            </span>
          ) : null}
        </div>
      </div>

      {/* Main body */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-4 md:p-6 space-y-4 max-w-[1600px] mx-auto">
          {lastPrompt ? (
            <div className="border border-border rounded-card bg-workspace px-4 py-3">
              <div className="text-[10px] uppercase tracking-wide text-secondary font-medium mb-1">
                Prompt under test
              </div>
              <p className="text-sm text-foreground whitespace-pre-wrap">{lastPrompt}</p>
              {(executionId || comparisonId) && (
                <div className="mt-2 flex flex-wrap gap-3 text-[10px] font-mono text-secondary">
                  {executionId ? <span>execution {executionId}</span> : null}
                  {comparisonId ? <span>comparison {comparisonId}</span> : null}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-10 border border-dashed border-border rounded-card bg-white">
              <Swords className="mx-auto text-secondary mb-3" size={28} />
              <h3 className="text-base font-semibold text-foreground">Raw vs Amplified</h3>
              <p className="text-xs text-secondary mt-1 max-w-md mx-auto leading-relaxed">
                Both sides run the same provider and model in parallel. Left is direct gateway
                output. Right is the full DSRT 12-engine amplification path.
              </p>
            </div>
          )}

          {/* Side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-90">
            <SidePanel
              title="Direct"
              badge="RAW"
              badgeClass="bg-white text-secondary border border-border"
              content={rawContent}
              isStreaming={rawStreaming}
              failed={rawFailed}
              usage={rawUsage}
              scrollRef={rawScrollRef}
              onScroll={() => syncScroll('raw')}
              emptyHint="Raw model output streams here. Zero DSRT engines touch this path."
              footer={
                <div className="flex items-center gap-2 text-[10px] text-secondary">
                  <Shield size={12} />
                  <span>Isolated gateway path · dsrt_cost always $0.00</span>
                </div>
              }
            />
            <SidePanel
              title="Amplified"
              badge="DSRT"
              badgeClass="bg-accent/10 text-accent border border-accent/20"
              content={ampContent}
              isStreaming={ampStreaming}
              failed={ampFailed}
              usage={ampUsage}
              scrollRef={ampScrollRef}
              onScroll={() => syncScroll('amp')}
              emptyHint="Full amplification pipeline output streams here."
              footer={
                <div className="flex items-center gap-2 text-[10px] text-secondary min-w-0">
                  <Sparkles size={12} className="shrink-0 text-accent" />
                  <span className="truncate">
                    {engines.length > 0
                      ? engines
                          .map((en) => {
                            const mark =
                              en.status === 'running' ? '…' : en.status === 'failed' ? '✗' : '✓';
                            return `${mark}${en.engineId}`;
                          })
                          .join('  ')
                      : '12-engine path'}
                  </span>
                </div>
              }
            />
          </div>

          <ComparisonMetrics
            metrics={metrics}
            rawUsage={rawUsage}
            amplifiedUsage={ampUsage}
            isRunning={isRunning}
            rawFailed={rawFailed}
            amplifiedFailed={ampFailed}
          />

          <RubricDisplay
            evaluation={evaluation}
            isEvaluating={isEvaluating}
            error={evalError}
          />

          {error ? (
            <div className="p-3 bg-red-50 border border-red-200 text-error rounded-input text-xs">
              {error}
            </div>
          ) : null}
        </div>
      </div>

      {/* Composer */}
      <div className="border-t border-border bg-white p-4 shrink-0">
        <form onSubmit={handleRun} className="max-w-[1600px] mx-auto flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleRun(e);
              }
            }}
            placeholder="Enter a prompt to compare raw vs amplified…"
            rows={2}
            className="flex-1 px-4 py-2 rounded-input border border-border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent"
            disabled={isRunning}
          />
          <Button
            type="submit"
            disabled={!input.trim() || isRunning}
            className="shrink-0 self-end"
          >
            {isRunning ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <>
                <Swords size={16} className="mr-1.5" />
                Run comparison
              </>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}