import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { calculateProviderCost, type ProviderType } from '@/lib/providers/registry';
import { runAmplification } from '@/lib/amplification/orchestrator';
import { AmplificationRuntime } from '@/lib/amplification/runtime';
import { getDecryptedKey } from '@/lib/auth/keyManager';
import '@/lib/amplification/tools';

function sanitizeModelId(model: string): string {
  if (!model) return 'gpt-4o-mini';
  const trimmed = model.trim();
  const slash = trimmed.indexOf('/');
  return slash >= 0 ? trimmed.slice(slash + 1) : trimmed;
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: {
    conversation_id?: string;
    workspace_id?: string;
    user_message?: string;
    provider?: ProviderType;
    model?: string;
    amplify?: boolean;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const conversation_id = body.conversation_id;
  const workspace_id = body.workspace_id;
  const user_message = body.user_message;
  const provider = (body.provider || 'openai') as ProviderType;
  const model = sanitizeModelId(body.model || 'gpt-4o-mini');
  const amplify = body.amplify !== false;

  if (!conversation_id || !workspace_id || !user_message || !provider || !model) {
    return NextResponse.json(
      {
        error:
          'conversation_id, workspace_id, user_message, provider, model required',
      },
      { status: 400 }
    );
  }

  const apiKey =
    (await getDecryptedKey(
      supabase,
      user.id,
      provider as 'openai' | 'anthropic' | 'google' | 'groq' | 'mistral' | 'deepseek'
    )) || '';

  if (!apiKey) {
    return NextResponse.json(
      { error: `No valid API key for provider "${provider}"` },
      { status: 400 }
    );
  }

  const runtime = new AmplificationRuntime();

  let executionId: string;
  try {
    executionId = await runtime.initialize({
      conversationId: conversation_id,
      workspaceId: workspace_id,
      userId: user.id,
      mode: 'chat',
      provider,
      model,
      userPrompt: user_message,
      status: 'CREATED',
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create execution' },
      { status: 500 }
    );
  }

  await runtime.persistMessage({
    conversationId: conversation_id,
    workspaceId: workspace_id,
    userId: user.id,
    role: 'user',
    content: user_message,
    isAmplified: false,
    provider,
    model,
    executionId,
  });

  const { data: history } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversation_id)
    .order('created_at', { ascending: true })
    .limit(100);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      let fullContent = '';
      let finalUsage = {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        providerCostUsd: 0,
        dsrtCostUsd: 0,
      };
      let finalLatency = 0;
      let amplifiedFlag = amplify;
      let chosenProvider: string = provider;
      let chosenModel = model;
      let artifacts: unknown = null;

      send({ type: 'persisted', executionId });

      try {
        for await (const event of runAmplification({
          conversationId: conversation_id,
          workspaceId: workspace_id,
          userId: user.id,
          userMessage: user_message,
          history: history || [],
          provider,
          model,
          apiKey,
          amplify,
          executionId,
          externalLifecycle: true,
        })) {
          if (event.type === 'content') {
            fullContent += event.content;
            send({ type: 'content', content: event.content });
          } else if (event.type === 'content_replace') {
            fullContent = event.content;
            send({ type: 'content_replace', content: event.content });
          } else if (event.type === 'state') {
            send({ type: 'state', state: event.state });
          } else if (event.type === 'engine_start' || event.type === 'engine_done') {
            send(event);
          } else if (event.type === 'artifacts') {
            artifacts = event.artifacts;
            send({ type: 'artifacts', artifacts: event.artifacts });
          } else if (event.type === 'done') {
            if (event.finalContent?.trim()) fullContent = event.finalContent;
            finalUsage = event.usage;
            finalLatency = event.latencyMs;
            amplifiedFlag = event.amplified;
            chosenProvider = event.chosenProvider;
            chosenModel = event.chosenModel;
          } else if (event.type === 'error') {
            throw new Error(event.error);
          }
        }

        const providerCostUsd =
          finalUsage.providerCostUsd ||
          calculateProviderCost(chosenModel, finalUsage.promptTokens, finalUsage.completionTokens);
        const dsrtCostUsd = finalUsage.dsrtCostUsd || 0;

        await runtime.persistMessage({
          conversationId: conversation_id,
          workspaceId: workspace_id,
          userId: null,
          role: 'assistant',
          content: fullContent,
          isAmplified: amplifiedFlag,
          provider: chosenProvider,
          model: chosenModel,
          executionId,
          tokenCountPrompt: finalUsage.promptTokens,
          tokenCountCompletion: finalUsage.completionTokens,
          providerCostUsd,
          dsrtCostUsd,
          latencyMs: finalLatency,
        });

        await runtime.finalize(executionId, {
          status: 'COMPLETED',
          amplifiedResponse: fullContent,
          promptTokens: finalUsage.promptTokens,
          completionTokens: finalUsage.completionTokens,
          totalTokens: finalUsage.promptTokens + finalUsage.completionTokens,
          providerCostUsd,
          dsrtCostUsd,
          latencyMs: finalLatency,
          provider: chosenProvider,
          model: chosenModel,
          artifactsJson: artifacts,
        });

        await supabase
          .from('conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', conversation_id);

        try {
          await supabase.rpc('increment_credential_cost', {
            cred_workspace_id: workspace_id,
            cred_provider: provider,
            cost_delta: providerCostUsd + dsrtCostUsd,
          });
        } catch {
          // non-fatal
        }

        send({
          type: 'done',
          executionId,
          usage: {
            promptTokens: finalUsage.promptTokens,
            completionTokens: finalUsage.completionTokens,
            totalTokens: finalUsage.promptTokens + finalUsage.completionTokens,
            providerCostUsd,
            dsrtCostUsd,
          },
          latencyMs: finalLatency,
          amplified: amplifiedFlag,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Stream failed';
        await runtime.finalize(executionId, {
          status: 'FAILED',
          errorMessage: message,
          amplifiedResponse: fullContent || null,
          latencyMs: finalLatency,
        });
        send({ type: 'error', error: message, executionId });
      } finally {
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}