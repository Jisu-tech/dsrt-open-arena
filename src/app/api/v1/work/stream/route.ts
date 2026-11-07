import { NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { runAmplification } from '@/lib/amplification/orchestrator';
import { AmplificationRuntime, isUuid } from '@/lib/amplification/runtime';
import { CredentialService } from '@/lib/credentials/service';
import { CredentialError } from '@/lib/credentials/errors';
import { sanitizeUserInput } from '@/lib/security/sanitizer';
import { sanitizeModelId } from '@/lib/providers/gateway';
import type { ProviderType } from '@/lib/providers/registry';
import { calculateProviderCost } from '@/lib/providers/registry';
import type { Message } from '@/types';
import { TaskRepository } from '@/lib/v3/repositories/task.repository';
import { createV3InvocationHook } from '@/lib/v3/providers/legacy-hook';

function normalizeProvider(raw: string): ProviderType {
  const p = (raw || '').toLowerCase().trim();
  if (p === 'gemini') return 'google';
  if (p === 'grok') return 'xai' as ProviderType;
  return (p || 'openai') as ProviderType;
}

function sseEncode(event: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();

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

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const workspaceId = String(body.workspaceId || body.workspace_id || '');
  let conversationId = String(body.conversationId || body.conversation_id || '');
  const rawMessage = String(body.userMessage || body.user_message || body.prompt || '').trim();
  const rawProvider = String(body.provider || '').trim();
  const provider = normalizeProvider(rawProvider || 'openai');
  const rawModel = String(body.model || '').trim();
  const model = sanitizeModelId(rawModel, provider);
  const amplify = body.amplify !== false;
  const userId = user.id;

  if (!rawMessage) {
    return new Response(JSON.stringify({ error: 'userMessage is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (!workspaceId || !isUuid(workspaceId)) {
    return new Response(JSON.stringify({ error: 'workspaceId must be a valid UUID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const sanitized = sanitizeUserInput(rawMessage);
  const userMessage = sanitized.cleanPrompt || rawMessage;

  if (!conversationId || !isUuid(conversationId)) {
    const { data: convData, error: convError } = await supabase
      .from('conversations')
      .insert({
        workspace_id: workspaceId,
        user_id: userId,
        title: userMessage.slice(0, 60) + (userMessage.length > 60 ? '…' : ''),
        default_provider: provider,
        default_model: model,
      } as Record<string, unknown>)
      .select('id')
      .single();

    if (convError || !convData?.id) {
      return new Response(
        JSON.stringify({ error: convError?.message || 'Failed to create conversation' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    conversationId = String(convData.id);
  }

  const credentialService = new CredentialService(supabase);
  let apiKey: string;
  try {
    const resolved = await credentialService.resolve(userId, workspaceId, provider);
    apiKey = resolved.apiKey;
  } catch (err: unknown) {
    const isCredErr = err instanceof CredentialError;
    const message = isCredErr
      ? (err as CredentialError).message
      : `No API key configured for provider "${provider}". Please add an API key in API Keys settings.`;
    return new Response(
      JSON.stringify({
        error: message,
        provider,
        code: isCredErr ? (err as CredentialError).code : 'CREDENTIAL_NOT_FOUND',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let history: Message[] = [];
  if (Array.isArray(body.history) && body.history.length) {
    history = body.history as Message[];
  } else {
    const { data: rows } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(40);
    history = (rows || []) as Message[];
  }

  const runtime = new AmplificationRuntime();
  let executionId: string;
  try {
    executionId = await runtime.initialize({
      conversationId,
      workspaceId,
      userId,
      mode: 'work',
      provider,
      model,
      userPrompt: userMessage,
      status: 'CREATED',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create execution';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ─── V3 dual-write: create task ──────────────────────────────────────────
  const v3tasks = new TaskRepository(supabase);
  let v3TaskId: string | null = null;
  try {
    v3TaskId = await v3tasks.createTask({
      workspaceId,
      responsibility: 'I01',
      priority: 'normal',
      complexityScore: null,
      metadata: { source: 'v1/work/stream', legacyExecutionId: executionId ?? null },
    });
  } catch (e) {
    console.error('[v1/work/stream] V3 task create failed — continuing legacy only', e);
  }

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(sseEncode(event, data));
        } catch {
          /* closed */
        }
      };

      send('meta', { conversationId, executionId, workspaceId });
      send('persisted', { executionId, conversationId });

      try {
        await runtime.persistMessage({
          conversationId,
          workspaceId,
          userId,
          role: 'user',
          content: userMessage,
          isAmplified: false,
          provider,
          model,
          executionId,
        });
      } catch (e) {
        console.warn('[work/stream] user message persist warning', e);
      }

      let finalAssistantContent = '';
      let finalUsage = {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        providerCostUsd: 0,
        dsrtCostUsd: 0,
      };
      let finalLatency = 0;
      let chosenProvider: ProviderType = provider;
      let chosenModel = model;
      let amplified = amplify;
      let failed = false;
      let failMessage: string | null = null;
      let artifacts: unknown = null;

      try {
        const generator = runAmplification({
          workspaceId,
          conversationId,
          userId,
          userMessage,
          history,
          provider,
          model,
          apiKey,
          executionId,
          amplify,
          externalLifecycle: true,
          v3TaskId,
          onInvocation: createV3InvocationHook(supabase),
        });

        for await (const event of generator) {
          send(event.type, event);

          if (event.type === 'content') {
            finalAssistantContent += event.content;
          } else if (event.type === 'content_replace') {
            finalAssistantContent = event.content;
          } else if (event.type === 'artifacts') {
            artifacts = event.artifacts;
          } else if (event.type === 'done') {
            if (event.finalContent?.trim()) {
              finalAssistantContent = event.finalContent;
            }
            finalUsage = event.usage;
            finalLatency = event.latencyMs;
            chosenProvider = event.chosenProvider as ProviderType;
            chosenModel = event.chosenModel;
            amplified = event.amplified;
          } else if (event.type === 'error') {
            failed = true;
            failMessage = event.error;
          }
        }

        if (!finalUsage.providerCostUsd && (finalUsage.promptTokens || finalUsage.completionTokens)) {
          finalUsage.providerCostUsd = calculateProviderCost(
            chosenModel,
            finalUsage.promptTokens,
            finalUsage.completionTokens
          );
        }

        if (!failed && finalAssistantContent.trim()) {
          await runtime.persistMessage({
            conversationId,
            workspaceId,
            userId: null,
            role: 'assistant',
            content: finalAssistantContent,
            isAmplified: amplified,
            provider: chosenProvider,
            model: chosenModel,
            executionId,
            tokenCountPrompt: finalUsage.promptTokens,
            tokenCountCompletion: finalUsage.completionTokens,
            providerCostUsd: finalUsage.providerCostUsd,
            dsrtCostUsd: finalUsage.dsrtCostUsd,
            latencyMs: finalLatency,
          });

          await runtime.finalize(executionId, {
            status: 'COMPLETED',
            amplifiedResponse: finalAssistantContent,
            promptTokens: finalUsage.promptTokens,
            completionTokens: finalUsage.completionTokens,
            totalTokens: finalUsage.totalTokens,
            providerCostUsd: finalUsage.providerCostUsd,
            dsrtCostUsd: finalUsage.dsrtCostUsd,
            latencyMs: finalLatency,
            provider: chosenProvider,
            model: chosenModel,
            artifactsJson: artifacts,
            amplifiedScore:
              artifacts &&
              typeof artifacts === 'object' &&
              artifacts !== null &&
              'quality' in (artifacts as Record<string, unknown>)
                ? ((artifacts as { quality?: { overall?: number } }).quality?.overall ?? null)
                : null,
          });

          await supabase
            .from('conversations')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', conversationId);

          // ─── V3 dual-write: finalize task (success) ────────────────────
          if (v3TaskId) {
            try {
              await v3tasks.updateTaskStatus(v3TaskId, 'completed');
            } catch (e) {
              console.error('[v1/work/stream] V3 task finalize failed', e);
            }
          }

          send('done', {
            executionId,
            conversationId,
            usage: finalUsage,
            latencyMs: finalLatency,
            amplified,
            chosenProvider,
            chosenModel,
            content: finalAssistantContent,
          });
        } else {
          const err = failMessage || 'Work amplification produced no content';
          await runtime.finalize(executionId, {
            status: 'FAILED',
            errorMessage: err,
            amplifiedResponse: finalAssistantContent || null,
            promptTokens: finalUsage.promptTokens,
            completionTokens: finalUsage.completionTokens,
            providerCostUsd: finalUsage.providerCostUsd,
            dsrtCostUsd: finalUsage.dsrtCostUsd,
            latencyMs: finalLatency,
            provider: chosenProvider,
            model: chosenModel,
          });

          // ─── V3 dual-write: finalize task (failure) ────────────────────
          if (v3TaskId) {
            try {
              await v3tasks.updateTaskStatus(v3TaskId, 'failed', err);
            } catch (e) {
              console.error('[v1/work/stream] V3 task finalize failed', e);
            }
          }

          send('error', { error: err, executionId });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[work/stream] fatal', msg);
        await runtime.finalize(executionId, {
          status: 'FAILED',
          errorMessage: msg,
          latencyMs: finalLatency,
        });

        // ─── V3 dual-write: finalize task (exception) ────────────────────
        if (v3TaskId) {
          try {
            await v3tasks.updateTaskStatus(v3TaskId, 'failed', msg);
          } catch (e) {
            console.error('[v1/work/stream] V3 task finalize failed', e);
          }
        }

        send('error', { error: msg, executionId });
      } finally {
        controller.close();
      }
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
