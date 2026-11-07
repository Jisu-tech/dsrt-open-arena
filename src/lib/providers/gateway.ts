import { ProviderType, PROVIDER_METADATA, calculateProviderCost } from './registry';
import { parseProviderError } from './errors';
import { cleanApiKey } from '@/lib/credentials/crypto';

// ─── V3 Invocation Hook Types ─────────────────────────────────────────────
export type V3OnInvocationPayload = {
  provider: string;
  model: string;
  status: 'success' | 'failed' | 'timeout' | 'aborted';
  rawProviderPayload: Record<string, unknown> | null;
  durationMs: number | null;
  errorMessage?: string | null;
  /** Optional correlation — set by work/stream when a V3 task exists */
  v3TaskId?: string | null;
  workspaceId?: string | null;
};

export type V3OnInvocation = (payload: V3OnInvocationPayload) => void | Promise<void>;

export interface GatewayMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
}

export interface GatewayRequest {
  provider: ProviderType;
  model: string;
  apiKey: string;
  messages: GatewayMessage[];
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  onInvocation?: V3OnInvocation;
  v3TaskId?: string | null;
  workspaceId?: string | null;
}

export interface GatewayResponse {
  content: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  providerCostUsd: number;
  latencyMs: number;
  model: string;
  provider: ProviderType;
}

export interface StreamChunk {
  type: 'content' | 'done' | 'error';
  content?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    providerCostUsd: number;
  };
  error?: string;
}

export function sanitizeModelId(model: string, provider?: ProviderType): string {
  if (!model) return '';
  let trimmed = model.trim();

  // OpenRouter requires organization/model format
  if (provider === 'openrouter') {
    if (trimmed.toLowerCase().startsWith('openrouter/')) {
      return trimmed.slice(11);
    }
    return trimmed;
  }

  // ONLY strip the provider prefix if present (e.g. "groq/openai/gpt-oss-120b" -> "openai/gpt-oss-120b")
  // Do NOT strip sub-namespaces like "openai/" or "qwen/" or "meta-llama/"
  if (provider) {
    const providerPrefix = `${provider.toLowerCase()}/`;
    if (trimmed.toLowerCase().startsWith(providerPrefix)) {
      trimmed = trimmed.slice(providerPrefix.length);
    }
  }

  return trimmed;
}

function normalizeMessages(messages: GatewayMessage[]): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
  return messages.map((m) => {
    if (m.role === 'tool') {
      return { role: 'user' as const, content: `[Tool Output]\n${m.content}` };
    }
    return { role: m.role, content: m.content };
  });
}

function getBaseUrl(provider: ProviderType): string {
  return PROVIDER_METADATA[provider]?.baseUrl || PROVIDER_METADATA.openai.baseUrl;
}

async function fireInvocationHook(
  req: GatewayRequest,
  provider: string,
  model: string,
  status: 'success' | 'failed' | 'timeout' | 'aborted',
  startTime: number,
  errorMessage: string | null,
  durationMs?: number,
): Promise<void> {
  if (!req.onInvocation) return;
  try {
    await req.onInvocation({
      provider,
      model,
      status,
      rawProviderPayload: null,
      durationMs: durationMs ?? Date.now() - startTime,
      errorMessage,
      v3TaskId: req.v3TaskId ?? null,
      workspaceId: req.workspaceId ?? null,
    });
  } catch (hookErr) {
    console.error('[gateway] onInvocation hook failed', hookErr);
  }
}

export async function executeGatewayCall(req: GatewayRequest): Promise<GatewayResponse> {
  const startTime = Date.now();
  const cleanKey = cleanApiKey(req.apiKey);
  if (!cleanKey) {
    const errMsg = `AUTH_FAILED: No valid API key provided for provider "${req.provider}". Please check API Keys settings.`;
    await fireInvocationHook(req, req.provider, req.model, 'failed', startTime, errMsg);
    throw new Error(errMsg);
  }

  const cleanReq = { ...req, apiKey: cleanKey };
  const temperature = req.temperature ?? 0.7;
  const maxTokens = req.maxTokens ?? 2048;

  try {
    let response: GatewayResponse;
    switch (cleanReq.provider) {
      case 'openai':
      case 'groq':
      case 'deepseek':
      case 'mistral':
      case 'xai':
      case 'openrouter':
      case 'cohere':
        response = await callOpenAICompatible(cleanReq, startTime, temperature, maxTokens);
        break;
      case 'anthropic':
        response = await callAnthropic(cleanReq, startTime, temperature, maxTokens);
        break;
      case 'google':
        response = await callGoogle(cleanReq, startTime, temperature, maxTokens);
        break;
      default:
        throw new Error(`Unsupported provider: ${cleanReq.provider}`);
    }
    await fireInvocationHook(cleanReq, cleanReq.provider, response.model, 'success', startTime, null, response.latencyMs);
    return response;
  } catch (err) {
    await fireInvocationHook(cleanReq, cleanReq.provider, cleanReq.model, 'failed', startTime, (err as Error).message);
    throw err;
  }
}

export async function* streamGatewayCall(req: GatewayRequest): AsyncGenerator<StreamChunk> {
  const startTime = Date.now();
  const cleanKey = cleanApiKey(req.apiKey);
  if (!cleanKey) {
    const errMsg = `AUTH_FAILED: No valid API key provided for provider "${req.provider}". Please check API Keys settings.`;
    yield { type: 'error', error: errMsg };
    await fireInvocationHook(req, req.provider, req.model, 'failed', startTime, errMsg);
    return;
  }

  const cleanReq = { ...req, apiKey: cleanKey };
  const temperature = req.temperature ?? 0.7;
  const maxTokens = req.maxTokens ?? 2048;

  let status: 'success' | 'failed' = 'failed';
  let errorMessage: string | null = null;

  try {
    let innerGen: AsyncGenerator<StreamChunk>;
    switch (cleanReq.provider) {
      case 'openai':
      case 'groq':
      case 'deepseek':
      case 'mistral':
      case 'xai':
      case 'openrouter':
      case 'cohere':
        innerGen = streamOpenAICompatible(cleanReq, temperature, maxTokens);
        break;
      case 'anthropic':
        innerGen = streamAnthropic(cleanReq, temperature, maxTokens);
        break;
      case 'google':
        innerGen = streamGoogle(cleanReq, temperature, maxTokens);
        break;
      default:
        yield { type: 'error', error: `Streaming not supported for ${cleanReq.provider}` };
        await fireInvocationHook(cleanReq, cleanReq.provider, cleanReq.model, 'failed', startTime, `Streaming not supported for ${cleanReq.provider}`);
        return;
    }

    for await (const chunk of innerGen) {
      yield chunk;
      if (chunk.type === 'done') status = 'success';
      if (chunk.type === 'error') {
        status = 'failed';
        errorMessage = chunk.error || null;
      }
    }
  } catch (err) {
    const msg = (err as Error).message;
    yield { type: 'error', error: msg };
    status = 'failed';
    errorMessage = msg;
  }

  await fireInvocationHook(cleanReq, cleanReq.provider, cleanReq.model, status, startTime, errorMessage);
}

async function callOpenAICompatible(
  req: GatewayRequest,
  startTime: number,
  temperature: number,
  maxTokens: number
): Promise<GatewayResponse> {
  const safeModel = sanitizeModelId(req.model, req.provider);
  const formattedMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
  if (req.systemPrompt) formattedMessages.push({ role: 'system', content: req.systemPrompt });
  formattedMessages.push(...normalizeMessages(req.messages));

  const res = await fetch(`${getBaseUrl(req.provider)}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${req.apiKey}`,
    },
    body: JSON.stringify({
      model: safeModel,
      messages: formattedMessages,
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    const parsed = parseProviderError(req.provider, res.status, errorBody);
    throw parsed;
  }

  const data = await res.json();
  const latencyMs = Date.now() - startTime;
  const content = data.choices?.[0]?.message?.content || '';
  const promptTokens = data.usage?.prompt_tokens || 0;
  const completionTokens = data.usage?.completion_tokens || 0;
  const providerCostUsd = calculateProviderCost(safeModel, promptTokens, completionTokens);

  return {
    content,
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    providerCostUsd,
    latencyMs,
    model: safeModel,
    provider: req.provider,
  };
}

async function* streamOpenAICompatible(
  req: GatewayRequest,
  temperature: number,
  maxTokens: number
): AsyncGenerator<StreamChunk> {
  const safeModel = sanitizeModelId(req.model, req.provider);
  const formattedMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
  if (req.systemPrompt) formattedMessages.push({ role: 'system', content: req.systemPrompt });
  formattedMessages.push(...normalizeMessages(req.messages));

  const bodyPayload: Record<string, unknown> = {
    model: safeModel,
    messages: formattedMessages,
    temperature,
    max_tokens: maxTokens,
    stream: true,
  };

  if (req.provider === 'openai') {
    bodyPayload.stream_options = { include_usage: true };
  }

  const res = await fetch(`${getBaseUrl(req.provider)}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${req.apiKey}`,
    },
    body: JSON.stringify(bodyPayload),
  });

  if (!res.ok || !res.body) {
    const errorBody = await res.text();
    const parsed = parseProviderError(req.provider, res.status, errorBody);
    yield { type: 'error', error: parsed.message };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let promptTokens = 0;
  let completionTokens = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (payload === '[DONE]') continue;

        try {
          const chunk = JSON.parse(payload);
          const delta = chunk.choices?.[0]?.delta?.content;
          if (delta) yield { type: 'content', content: delta };
          if (chunk.usage) {
            promptTokens = chunk.usage.prompt_tokens || 0;
            completionTokens = chunk.usage.completion_tokens || 0;
          }
        } catch {
          /* skip parse errors */
        }
      }
    }

    const providerCostUsd = calculateProviderCost(safeModel, promptTokens, completionTokens);
    yield {
      type: 'done',
      usage: { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens, providerCostUsd },
    };
  } finally {
    reader.releaseLock();
  }
}

async function callAnthropic(
  req: GatewayRequest,
  startTime: number,
  temperature: number,
  maxTokens: number
): Promise<GatewayResponse> {
  const safeModel = sanitizeModelId(req.model, req.provider);
  const norm = normalizeMessages(req.messages);
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': req.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: safeModel,
      system: req.systemPrompt || undefined,
      messages: norm.filter((m) => m.role !== 'system'),
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw parseProviderError('anthropic', res.status, errorBody);
  }

  const data = await res.json();
  const latencyMs = Date.now() - startTime;
  const content = data.content?.[0]?.text || '';
  const promptTokens = data.usage?.input_tokens || 0;
  const completionTokens = data.usage?.output_tokens || 0;
  const providerCostUsd = calculateProviderCost(safeModel, promptTokens, completionTokens);

  return {
    content,
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    providerCostUsd,
    latencyMs,
    model: safeModel,
    provider: 'anthropic',
  };
}

async function* streamAnthropic(
  req: GatewayRequest,
  temperature: number,
  maxTokens: number
): AsyncGenerator<StreamChunk> {
  const safeModel = sanitizeModelId(req.model, req.provider);
  const norm = normalizeMessages(req.messages);
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': req.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: safeModel,
      system: req.systemPrompt || undefined,
      messages: norm.filter((m) => m.role !== 'system'),
      temperature,
      max_tokens: maxTokens,
      stream: true,
    }),
  });

  if (!res.ok || !res.body) {
    const errorBody = await res.text();
    yield { type: 'error', error: parseProviderError('anthropic', res.status, errorBody).message };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let promptTokens = 0;
  let completionTokens = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (!payload) continue;

        try {
          const event = JSON.parse(payload);
          if (event.type === 'content_block_delta' && event.delta?.text) {
            yield { type: 'content', content: event.delta.text };
          }
          if (event.type === 'message_start' && event.message?.usage) {
            promptTokens = event.message.usage.input_tokens || 0;
          }
          if (event.type === 'message_delta' && event.usage) {
            completionTokens = event.usage.output_tokens || 0;
          }
        } catch {
          /* skip */
        }
      }
    }

    const providerCostUsd = calculateProviderCost(safeModel, promptTokens, completionTokens);
    yield {
      type: 'done',
      usage: { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens, providerCostUsd },
    };
  } finally {
    reader.releaseLock();
  }
}

async function callGoogle(
  req: GatewayRequest,
  startTime: number,
  temperature: number,
  maxTokens: number
): Promise<GatewayResponse> {
  const safeModel = sanitizeModelId(req.model, req.provider);
  const norm = normalizeMessages(req.messages);
  const contents = norm.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${safeModel}:generateContent?key=${req.apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      systemInstruction: req.systemPrompt ? { parts: [{ text: req.systemPrompt }] } : undefined,
      generationConfig: { temperature, maxOutputTokens: maxTokens },
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw parseProviderError('google', res.status, errorBody);
  }

  const data = await res.json();
  const latencyMs = Date.now() - startTime;
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const promptTokens = data.usageMetadata?.promptTokenCount || 0;
  const completionTokens = data.usageMetadata?.candidatesTokenCount || 0;
  const providerCostUsd = calculateProviderCost(safeModel, promptTokens, completionTokens);

  return {
    content,
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    providerCostUsd,
    latencyMs,
    model: safeModel,
    provider: 'google',
  };
}

async function* streamGoogle(
  req: GatewayRequest,
  temperature: number,
  maxTokens: number
): AsyncGenerator<StreamChunk> {
  const safeModel = sanitizeModelId(req.model, req.provider);
  const norm = normalizeMessages(req.messages);
  const contents = norm.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${safeModel}:streamGenerateContent?alt=sse&key=${req.apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      systemInstruction: req.systemPrompt ? { parts: [{ text: req.systemPrompt }] } : undefined,
      generationConfig: { temperature, maxOutputTokens: maxTokens },
    }),
  });

  if (!res.ok || !res.body) {
    const errorBody = await res.text();
    yield { type: 'error', error: parseProviderError('google', res.status, errorBody).message };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let promptTokens = 0;
  let completionTokens = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (!payload) continue;

        try {
          const event = JSON.parse(payload);
          const text = event.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) yield { type: 'content', content: text };

          if (event.usageMetadata) {
            promptTokens = event.usageMetadata.promptTokenCount || promptTokens;
            completionTokens = event.usageMetadata.candidatesTokenCount || completionTokens;
          }
        } catch {
          /* skip */
        }
      }
    }

    const providerCostUsd = calculateProviderCost(safeModel, promptTokens, completionTokens);
    yield {
      type: 'done',
      usage: { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens, providerCostUsd },
    };
  } finally {
    reader.releaseLock();
  }
}