import { NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { streamGatewayCall, sanitizeModelId } from '@/lib/providers/gateway';
import { CredentialService } from '@/lib/credentials/service';
import { runAmplification } from '@/lib/amplification/orchestrator';
import { AmplificationRuntime } from '@/lib/amplification/runtime';
import type { ProviderType } from '@/lib/providers/registry';
import { calculateProviderCost } from '@/lib/providers/registry';
import {
  buildComparisonMetrics,
  emptySideUsage,
  type SideUsage,
} from '@/lib/warmode/metrics';
import { evaluatePair, type RubricEvaluation } from '@/lib/warmode/evaluator';
import type { Message } from '@/types';

function normalizeProvider(raw: string): ProviderType {
  const p = (raw || 'openai').toLowerCase().trim();
  if (p === 'gemini') return 'google';
  if (p === 'grok') return 'xai';
  return p as ProviderType;
}

function sseEncode(data: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const conversationId = String(body.conversation_id || '');
  const workspaceId = String(body.workspace_id || '');
  const userMessage = String(body.user_message || body.prompt || body.message || '').trim();
  const rawProvider = String(body.provider || '').trim();
  const provider = normalizeProvider(rawProvider || 'openai');
  const model = sanitizeModelId(String(body.model || ''), provider);

  // 🚨 FIX: Default evaluator to the chosen provider/model, NEVER hardcode openai/gpt-4o
  const rawEvalProvider = String(body.evaluator_provider || body.evaluatorProvider || '').trim();
  const evaluatorProvider = rawEvalProvider ? normalizeProvider(rawEvalProvider) : provider;

  const rawEvalModel = String(body.evaluator_model || body.evaluatorModel || '').trim();
  const evaluatorModel = rawEvalModel ? sanitizeModelId(rawEvalModel, evaluatorProvider) : model;

  if (!userMessage || !conversationId || !workspaceId) {
    return new Response(
      JSON.stringify({ error: 'user_message, conversation_id, and workspace_id are required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const credentialService = new CredentialService(supabase);
  let apiKey: string;
  try {
    const resolved = await credentialService.resolve(user.id, workspaceId, provider);
    apiKey = resolved.apiKey;
  } catch (err: unknown) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!apiKey || !apiKey.trim()) {
    return new Response(
      JSON.stringify({ error: `AUTH_FAILED: No valid API key configured for ${provider}. Please add it under API Keys.` }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const runtime = new AmplificationRuntime();
  let executionId: string;
  try {
    executionId = await runtime.initialize({
      conversationId,
      workspaceId,
      userId: user.id,
      mode: 'war',
      provider,
      model,
      userPrompt: userMessage,
      status: 'CREATED',
    });
  } catch (err: unknown) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let history: Message[] = [];
  try {
    const { data: rows } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(20);
    history = (rows || []) as Message[];
  } catch {
    history = [];
  }

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        try {
          controller.enqueue(sseEncode(data));
        } catch {
          /* client disconnected */
        }
      };

      let rawContent = '';
      let ampContent = '';
      let rawFailed = false;
      let amplifiedFailed = false;
      let rawError: string | null = null;
      let ampError: string | null = null;
      let rawUsage: SideUsage = emptySideUsage({ dsrtCostUsd: 0 });
      let ampUsage: SideUsage = emptySideUsage();
      let evaluation: RubricEvaluation | null = null;
      let evaluationFailed = false;
      let evalError: string | null = null;
      let ampArtifacts: Record<string, unknown> | null = null;
      let directMessageId: string | null = null;
      let amplifiedMessageId: string | null = null;

      send({
        type: 'fair_play',
        message: `Fair play: both sides use ${provider}/${model}. Raw path has zero DSRT overhead.`,
        provider,
        model,
        zeroOverheadDirect: true,
      });
      send({ type: 'state', state: 'STARTING' });
      send({ type: 'persisted', executionId, comparisonId: null });

      try {
        await runtime.persistMessage({
          conversationId,
          workspaceId,
          userId: user.id,
          role: 'user',
          content: userMessage,
          isAmplified: false,
          provider,
          model,
          executionId,
        });
      } catch (e) {
        console.warn('[war/stream] User message persist warning:', e);
      }

      await runtime.updateState(executionId, 'STREAMING');

      // ── Direct (RAW) ──
      const rawPromise = (async () => {
        const t0 = Date.now();
        try {
          send({ type: 'state', state: 'RAW_RUNNING' });
          let promptTokens = 0;
          let completionTokens = 0;
          let providerCostUsd = 0;

          const gen = streamGatewayCall({
            provider,
            model,
            apiKey,
            messages: [{ role: 'user', content: userMessage }],
            temperature: 0.7,
            maxTokens: 4096,
          });

          for await (const chunk of gen) {
            if (chunk.type === 'content' && chunk.content) {
              rawContent += chunk.content;
              send({ type: 'raw_content', content: chunk.content });
            } else if (chunk.type === 'done' && chunk.usage) {
              promptTokens = chunk.usage.promptTokens || 0;
              completionTokens = chunk.usage.completionTokens || 0;
              providerCostUsd = chunk.usage.providerCostUsd || 0;
            } else if (chunk.type === 'error') {
              throw new Error(chunk.error || 'Raw gateway error');
            }
          }

          if (!rawContent.trim()) throw new Error('Raw path returned empty content');

          if (!providerCostUsd) {
            providerCostUsd = calculateProviderCost(model, promptTokens, completionTokens);
          }

          rawUsage = {
            promptTokens,
            completionTokens,
            totalTokens: promptTokens + completionTokens,
            providerCostUsd,
            dsrtCostUsd: 0,
            latencyMs: Date.now() - t0,
          };

          directMessageId = await runtime.persistMessage({
            conversationId,
            workspaceId,
            userId: null,
            role: 'assistant',
            content: rawContent,
            isAmplified: false,
            provider,
            model,
            executionId,
            tokenCountPrompt: promptTokens,
            tokenCountCompletion: completionTokens,
            providerCostUsd,
            dsrtCostUsd: 0,
            latencyMs: rawUsage.latencyMs,
          });

          send({ type: 'raw_done', content: rawContent, usage: rawUsage, status: 'completed', messageId: directMessageId });
        } catch (err: unknown) {
          rawFailed = true;
          rawError = err instanceof Error ? err.message : String(err);
          rawUsage = emptySideUsage({ dsrtCostUsd: 0, latencyMs: Date.now() - t0 });
          send({ type: 'error', side: 'raw', error: rawError });
          send({ type: 'raw_done', content: rawContent, usage: rawUsage, status: 'failed', error: rawError });
        }
      })();

      // ── Amplified (12 engines) ──
      const ampPromise = (async () => {
        const t0 = Date.now();
        try {
          send({ type: 'state', state: 'AMPLIFIED_RUNNING' });

          const gen = runAmplification({
            workspaceId,
            conversationId,
            userId: user.id,
            userMessage,
            history,
            provider,
            model,
            apiKey,
            executionId,
            amplify: true,
            externalLifecycle: true,
          });

          let promptTokens = 0;
          let completionTokens = 0;
          let providerCostUsd = 0;
          let dsrtCostUsd = 0.005;

          for await (const ev of gen) {
            switch (ev.type) {
              case 'state':
                send({ type: 'state', state: ev.state });
                break;
              case 'engine_start':
                send({ type: 'engine_start', engineId: ev.engineId, name: ev.name });
                break;
              case 'engine_done':
                send({ type: 'engine_done', engineId: ev.engineId, success: ev.success, durationMs: ev.durationMs });
                break;
              case 'content':
                ampContent += ev.content;
                send({ type: 'amplified_content', content: ev.content });
                break;
              case 'content_replace':
                ampContent = ev.content;
                send({ type: 'amplified_content_replace', content: ev.content });
                break;
              case 'artifacts':
                ampArtifacts = ev.artifacts as Record<string, unknown>;
                send({ type: 'artifacts', artifacts: ev.artifacts });
                break;
              case 'done':
                if (ev.finalContent?.trim()) ampContent = ev.finalContent;
                promptTokens = ev.usage?.promptTokens || 0;
                completionTokens = ev.usage?.completionTokens || 0;
                providerCostUsd = ev.usage?.providerCostUsd || 0;
                dsrtCostUsd = ev.dsrtCostUsd ?? ev.usage?.dsrtCostUsd ?? dsrtCostUsd;
                break;
              case 'error':
                throw new Error(ev.error || 'Amplification error');
              default:
                break;
            }
          }

          if (!ampContent.trim()) throw new Error('Amplified path returned empty content');

          if (!providerCostUsd) {
            providerCostUsd = calculateProviderCost(model, promptTokens, completionTokens);
          }

          ampUsage = {
            promptTokens,
            completionTokens,
            totalTokens: promptTokens + completionTokens,
            providerCostUsd,
            dsrtCostUsd,
            latencyMs: Date.now() - t0,
          };

          amplifiedMessageId = await runtime.persistMessage({
            conversationId,
            workspaceId,
            userId: null,
            role: 'assistant',
            content: ampContent,
            isAmplified: true,
            provider,
            model,
            executionId,
            tokenCountPrompt: promptTokens,
            tokenCountCompletion: completionTokens,
            providerCostUsd,
            dsrtCostUsd,
            latencyMs: ampUsage.latencyMs,
          });

          send({ type: 'amplified_done', content: ampContent, usage: ampUsage, status: 'completed', messageId: amplifiedMessageId });
        } catch (err: unknown) {
          amplifiedFailed = true;
          ampError = err instanceof Error ? err.message : String(err);
          ampUsage = emptySideUsage({ latencyMs: Date.now() - t0, dsrtCostUsd: 0.005 });
          send({ type: 'error', side: 'amplified', error: ampError });
          send({ type: 'amplified_done', content: ampContent, usage: ampUsage, status: 'failed', error: ampError });
        }
      })();

      await Promise.all([rawPromise, ampPromise]);

      // ── Rubric Evaluation ──
      send({ type: 'evaluation_start' });
      send({ type: 'state', state: 'EVALUATION' });

      if (!rawFailed && !amplifiedFailed && rawContent.trim() && ampContent.trim()) {
        try {
          let judgeKey = apiKey;
          let activeEvalProvider = evaluatorProvider;
          let activeEvalModel = evaluatorModel;

          if (evaluatorProvider !== provider) {
            try {
              const judgeRes = await credentialService.resolve(user.id, workspaceId, evaluatorProvider);
              judgeKey = judgeRes.apiKey;
            } catch {
              activeEvalProvider = provider;
              activeEvalModel = model;
              judgeKey = apiKey;
            }
          }

          const evalResult = await evaluatePair({
            userPrompt: userMessage,
            directResponse: rawContent,
            amplifiedResponse: ampContent,
            apiKey: judgeKey,
            evaluatorProvider: activeEvalProvider,
            evaluatorModel: activeEvalModel,
          });

          if (evalResult.success && evalResult.evaluation) {
            evaluation = evalResult.evaluation;
            const metrics = buildComparisonMetrics({
              directScore: evaluation.direct_overall,
              amplifiedScore: evaluation.amplified_overall,
              rawUsage,
              amplifiedUsage: ampUsage,
              rawFailed,
              amplifiedFailed,
              evaluationFailed: false,
            });
            send({ type: 'evaluation_done', evaluation, metrics, status: 'success' });
          } else {
            throw new Error(evalResult.error || 'Evaluation scoring failed');
          }
        } catch (err: unknown) {
          evaluationFailed = true;
          evalError = err instanceof Error ? err.message : String(err);
          const metrics = buildComparisonMetrics({
            directScore: null,
            amplifiedScore: null,
            rawUsage,
            amplifiedUsage: ampUsage,
            rawFailed,
            amplifiedFailed,
            evaluationFailed: true,
          });
          send({ type: 'evaluation_done', evaluation: null, metrics, status: 'failed', error: evalError });
        }
      } else {
        evaluationFailed = true;
        evalError = rawFailed && amplifiedFailed 
          ? 'Both sides failed' 
          : rawFailed ? `Direct failed: ${rawError}` : `Amplified failed: ${ampError}`;

        const metrics = buildComparisonMetrics({
          directScore: null,
          amplifiedScore: null,
          rawUsage,
          amplifiedUsage: ampUsage,
          rawFailed,
          amplifiedFailed,
          evaluationFailed: true,
        });
        send({ type: 'evaluation_done', evaluation: null, metrics, status: 'failed', error: evalError });
      }

      const finalMetrics = buildComparisonMetrics({
        directScore: evaluation?.direct_overall ?? null,
        amplifiedScore: evaluation?.amplified_overall ?? null,
        rawUsage,
        amplifiedUsage: ampUsage,
        rawFailed,
        amplifiedFailed,
        evaluationFailed,
      });

      const terminalStatus = rawFailed && amplifiedFailed ? 'FAILED' : 'COMPLETED';
      const errorParts = [rawError, ampError, evalError].filter(Boolean);

      await runtime.finalize(executionId, {
        status: terminalStatus,
        rawResponse: rawContent || null,
        amplifiedResponse: ampContent || null,
        directScore: evaluation?.direct_overall ?? null,
        amplifiedScore: evaluation?.amplified_overall ?? null,
        qualityDeltaPct: finalMetrics.qualityDeltaPct,
        winningSide: finalMetrics.winningSide,
        promptTokens: (rawUsage.promptTokens || 0) + (ampUsage.promptTokens || 0),
        completionTokens: (rawUsage.completionTokens || 0) + (ampUsage.completionTokens || 0),
        totalTokens: (rawUsage.totalTokens || 0) + (ampUsage.totalTokens || 0),
        providerCostUsd: (rawUsage.providerCostUsd || 0) + (ampUsage.providerCostUsd || 0),
        dsrtCostUsd: ampUsage.dsrtCostUsd || 0,
        latencyMs: Math.max(rawUsage.latencyMs || 0, ampUsage.latencyMs || 0),
        rawLatencyMs: rawUsage.latencyMs,
        amplifiedLatencyMs: ampUsage.latencyMs,
        errorMessage: errorParts.length ? errorParts.join(' | ') : null,
        evaluationJson: evaluation,
        metricsJson: finalMetrics,
        artifactsJson: ampArtifacts,
        provider,
        model,
      });

      const comparisonId = await runtime.createComparison({
        executionId,
        workspaceId,
        conversationId,
        userId: user.id,
        provider,
        model,
        userPrompt: userMessage,
        directMessageId,
        amplifiedMessageId,
        directScore: evaluation?.direct_overall ?? null,
        amplifiedScore: evaluation?.amplified_overall ?? null,
        qualityDeltaPct: finalMetrics.qualityDeltaPct,
        winningSide: finalMetrics.winningSide,
        metricsJson: finalMetrics,
        evaluationJson: evaluation,
        rawUsageJson: rawUsage,
        amplifiedUsageJson: ampUsage,
        status: evaluationFailed && rawFailed && amplifiedFailed ? 'failed' : 'completed',
        errorMessage: errorParts.length ? errorParts.join(' | ') : null,
      });

      send({
        type: 'done',
        executionId,
        comparisonId,
        metrics: finalMetrics,
        evaluation,
      });

      send({ type: 'state', state: 'COMPLETED' });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}