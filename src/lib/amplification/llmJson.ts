import { executeGatewayCall } from '@/lib/providers/gateway';
import type { ProviderType } from '@/lib/providers/registry';

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : text.trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('No JSON object in model response');
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

export async function callLlmJson<T>(input: {
  provider: ProviderType;
  model: string;
  apiKey: string;
  system: string;
  user: string;
  schemaHint?: string;
}): Promise<{ data: T; promptTokens: number; completionTokens: number; raw: string }> {
  const systemPrompt = input.schemaHint
    ? `${input.system}\n\nSchema hint:\n${input.schemaHint}`
    : input.system;

  const result = await executeGatewayCall({
    provider: input.provider,
    model: input.model,
    apiKey: input.apiKey,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: input.user },
    ],
    temperature: 0.2,
  });

  const raw = result.content || '';
  const data = extractJson(raw) as T;

  return {
    data,
    promptTokens: result.promptTokens ?? 0,
    completionTokens: result.completionTokens ?? 0,
    raw,
  };
}