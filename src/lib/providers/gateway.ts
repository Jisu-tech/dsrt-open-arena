import type { ProviderType } from './registry';
import { PROVIDER_METADATA } from './registry';

export interface GatewayMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GatewayCallParams {
  provider: ProviderType;
  model: string;
  apiKey: string;
  messages: GatewayMessage[];
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export interface GatewayChunk {
  type: 'content' | 'done' | 'error';
  content?: string;
  error?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    providerCostUsd: number;
  };
}

export function sanitizeModelId(rawModel: string, provider: ProviderType): string {
  const trimmed = (rawModel || '').trim();
  if (trimmed) return trimmed;

  const defaults: Partial<Record<ProviderType, string>> = {
    openai: 'gpt-4o-mini',
    anthropic: 'claude-3-5-sonnet-20241022',
    google: 'gemini-2.5-flash',
    groq: 'llama-3.3-70b-versatile',
    deepseek: 'deepseek-chat',
    mistral: 'mistral-small-latest',
    xai: 'grok-2-latest',
    cohere: 'command-r-plus',
    openrouter: 'openai/gpt-4o-mini',
  };

  return defaults[provider] || 'gpt-4o-mini';
}

/**
 * Unified streaming gateway for all providers.
 * Yields normalized chunks: content | done | error.
 */
export async function* streamGatewayCall(
  params: GatewayCallParams
): AsyncGenerator<GatewayChunk> {
  const { provider, model, apiKey, messages, temperature = 0.7, maxTokens = 4096, systemPrompt } = params;

  const allMessages = systemPrompt
    ? [{ role: 'system' as const, content: systemPrompt }, ...messages]
    : messages;

  try {
    if (provider === 'anthropic') {
      yield* streamAnthropic(model, apiKey, allMessages, temperature, maxTokens);
    } else if (provider === 'google') {
      yield* streamGoogle(model, apiKey, allMessages, temperature, maxTokens);
    } else {
      // OpenAI-compatible: openai, groq, deepseek, mistral, xai, openrouter, cohere
      yield* streamOpenAICompatible(provider, model, apiKey, allMessages, temperature, maxTokens);
    }
  } catch (err: unknown) {
    yield { type: 'error', error: err instanceof Error ? err.message : String(err) };
  }
}

async function* streamOpenAICompatible(
  provider: ProviderType,
  model: string,
  apiKey: string,
  messages: GatewayMessage[],
  temperature: number,
  maxTokens: number
): AsyncGenerator<GatewayChunk> {
  const meta = PROVIDER_METADATA[provider];
  const url = `${meta.baseUrl}/chat/completions`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: true,
      stream_options: { include_usage: true },
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    let msg = `${provider} API error ${res.status}`;
    try {
      const parsed = JSON.parse(errBody);
      msg = parsed.error?.message || parsed.error || msg;
    } catch {}
    yield { type: 'error', error: msg };
    return;
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let promptTokens = 0;
  let completionTokens = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'data: [DONE]') continue;
      if (!trimmed.startsWith('data: ')) continue;

      try {
        const chunk = JSON.parse(trimmed.slice(6));

        if (chunk.usage) {
          promptTokens = chunk.usage.prompt_tokens || 0;
          completionTokens = chunk.usage.completion_tokens || 0;
        }

        const delta = chunk.choices?.[0]?.delta;
        if (delta?.content) {
          yield { type: 'content', content: delta.content };
        }
      } catch {}
    }
  }

  yield {
    type: 'done',
    usage: { promptTokens, completionTokens, providerCostUsd: 0 },
  };
}

async function* streamAnthropic(
  model: string,
  apiKey: string,
  messages: GatewayMessage[],
  temperature: number,
  maxTokens: number
): AsyncGenerator<GatewayChunk> {
  const systemMsg = messages.find((m) => m.role === 'system');
  const nonSystem = messages.filter((m) => m.role !== 'system');

  const body: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    temperature,
    messages: nonSystem.map((m) => ({ role: m.role, content: m.content })),
    stream: true,
  };
  if (systemMsg) body.system = systemMsg.content;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text();
    let msg = `Anthropic API error ${res.status}`;
    try {
      const parsed = JSON.parse(errBody);
      msg = parsed.error?.message || msg;
    } catch {}
    yield { type: 'error', error: msg };
    return;
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let promptTokens = 0;
  let completionTokens = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data: ')) continue;

      try {
        const event = JSON.parse(trimmed.slice(6));

        if (event.type === 'content_block_delta' && event.delta?.text) {
          yield { type: 'content', content: event.delta.text };
        } else if (event.type === 'message_start' && event.message?.usage) {
          promptTokens = event.message.usage.input_tokens || 0;
        } else if (event.type === 'message_delta' && event.usage) {
          completionTokens = event.usage.output_tokens || 0;
        }
      } catch {}
    }
  }

  yield {
    type: 'done',
    usage: { promptTokens, completionTokens, providerCostUsd: 0 },
  };
}

async function* streamGoogle(
  model: string,
  apiKey: string,
  messages: GatewayMessage[],
  temperature: number,
  maxTokens: number
): AsyncGenerator<GatewayChunk> {
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  const systemMsg = messages.find((m) => m.role === 'system');
  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
    },
  };
  if (systemMsg) {
    body.systemInstruction = { parts: [{ text: systemMsg.content }] };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text();
    let msg = `Google API error ${res.status}`;
    try {
      const parsed = JSON.parse(errBody);
      msg = parsed.error?.message || msg;
    } catch {}
    yield { type: 'error', error: msg };
    return;
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let promptTokens = 0;
  let completionTokens = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data: ')) continue;

      try {
        const chunk = JSON.parse(trimmed.slice(6));
        const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          yield { type: 'content', content: text };
        }

        const usage = chunk.usageMetadata;
        if (usage) {
          promptTokens = usage.promptTokenCount || 0;
          completionTokens = usage.candidatesTokenCount || 0;
        }
      } catch {}
    }
  }

  yield {
    type: 'done',
    usage: { promptTokens, completionTokens, providerCostUsd: 0 },
  };
}

/**
 * Non-streaming gateway call (for evaluator, tools, etc.)
 */
export async function callGateway(
  params: GatewayCallParams
): Promise<{ content: string; usage: { promptTokens: number; completionTokens: number } }> {
  let fullContent = '';
  let finalUsage = { promptTokens: 0, completionTokens: 0 };

  for await (const chunk of streamGatewayCall(params)) {
    if (chunk.type === 'content' && chunk.content) {
      fullContent += chunk.content;
    } else if (chunk.type === 'done' && chunk.usage) {
      finalUsage = chunk.usage;
    } else if (chunk.type === 'error') {
      throw new Error(chunk.error);
    }
  }

  return { content: fullContent, usage: finalUsage };
}
