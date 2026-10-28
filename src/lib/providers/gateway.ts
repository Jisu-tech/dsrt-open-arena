import { MODEL_REGISTRY, ProviderType, calculateProviderCost } from './registry';

export interface GatewayMessage {
  role: 'system' | 'user' | 'assistant';
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

export async function executeGatewayCall(req: GatewayRequest): Promise<GatewayResponse> {
  const startTime = Date.now();
  const temperature = req.temperature ?? 0.7;
  const maxTokens = req.maxTokens ?? 2048;

  if (req.provider === 'openai') {
    return await callOpenAI(req, startTime, temperature, maxTokens);
  } else if (req.provider === 'anthropic') {
    return await callAnthropic(req, startTime, temperature, maxTokens);
  } else if (req.provider === 'google') {
    return await callGoogle(req, startTime, temperature, maxTokens);
  } else {
    throw new Error(`Unsupported provider: ${req.provider}`);
  }
}

// ----------------------------------------------------------------------------
// OPENAI IMPLEMENTATION
// ----------------------------------------------------------------------------
async function callOpenAI(
  req: GatewayRequest,
  startTime: number,
  temperature: number,
  maxTokens: number
): Promise<GatewayResponse> {
  const formattedMessages = [];
  if (req.systemPrompt) {
    formattedMessages.push({ role: 'system', content: req.systemPrompt });
  }
  formattedMessages.push(...req.messages);

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${req.apiKey}`,
    },
    body: JSON.stringify({
      model: req.model,
      messages: formattedMessages,
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`OpenAI API Error (${res.status}): ${errorBody}`);
  }

  const data = await res.json();
  const latencyMs = Date.now() - startTime;

  const content = data.choices[0]?.message?.content || '';
  const promptTokens = data.usage?.prompt_tokens || 0;
  const completionTokens = data.usage?.completion_tokens || 0;
  const providerCostUsd = calculateProviderCost(req.model, promptTokens, completionTokens);

  return {
    content,
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    providerCostUsd,
    latencyMs,
    model: req.model,
    provider: 'openai',
  };
}

// ----------------------------------------------------------------------------
// ANTHROPIC IMPLEMENTATION
// ----------------------------------------------------------------------------
async function callAnthropic(
  req: GatewayRequest,
  startTime: number,
  temperature: number,
  maxTokens: number
): Promise<GatewayResponse> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': req.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: req.model,
      system: req.systemPrompt || undefined,
      messages: req.messages.filter(m => m.role !== 'system'),
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Anthropic API Error (${res.status}): ${errorBody}`);
  }

  const data = await res.json();
  const latencyMs = Date.now() - startTime;

  const content = data.content?.[0]?.text || '';
  const promptTokens = data.usage?.input_tokens || 0;
  const completionTokens = data.usage?.output_tokens || 0;
  const providerCostUsd = calculateProviderCost(req.model, promptTokens, completionTokens);

  return {
    content,
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    providerCostUsd,
    latencyMs,
    model: req.model,
    provider: 'anthropic',
  };
}

// ----------------------------------------------------------------------------
// GOOGLE GEMINI IMPLEMENTATION
// ----------------------------------------------------------------------------
async function callGoogle(
  req: GatewayRequest,
  startTime: number,
  temperature: number,
  maxTokens: number
): Promise<GatewayResponse> {
  const contents = req.messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${req.model}:generateContent?key=${req.apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      systemInstruction: req.systemPrompt ? { parts: [{ text: req.systemPrompt }] } : undefined,
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
      },
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Google Gemini API Error (${res.status}): ${errorBody}`);
  }

  const data = await res.json();
  const latencyMs = Date.now() - startTime;

  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const promptTokens = data.usageMetadata?.promptTokenCount || 0;
  const completionTokens = data.usageMetadata?.candidatesTokenCount || 0;
  const providerCostUsd = calculateProviderCost(req.model, promptTokens, completionTokens);

  return {
    content,
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    providerCostUsd,
    latencyMs,
    model: req.model,
    provider: 'google',
  };
}