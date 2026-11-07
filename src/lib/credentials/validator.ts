import type { ProviderType } from '@/lib/providers/registry';
import { cleanApiKey } from './crypto';

export interface ValidationResult {
  valid: boolean;
  message?: string;
  accountStatus?: 'HEALTHY' | 'INSUFFICIENT_QUOTA' | 'RATE_LIMITED' | 'UNKNOWN';
}

export async function validateProviderKey(
  provider: ProviderType,
  apiKey: string
): Promise<ValidationResult> {
  const trimmed = cleanApiKey(apiKey);
  if (!trimmed) {
    return { valid: false, message: 'API key cannot be empty' };
  }

  try {
    switch (provider) {
      case 'openai': {
        const res = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${trimmed}` },
        });
        if (res.ok) return { valid: true, accountStatus: 'HEALTHY' };
        const data = await res.json().catch(() => ({}));
        const msg = data.error?.message || `OpenAI status ${res.status}`;
        if (res.status === 429 && msg.includes('quota')) {
          return { valid: false, message: 'API key is valid, but account quota is exhausted.', accountStatus: 'INSUFFICIENT_QUOTA' };
        }
        return { valid: false, message: msg };
      }
      case 'anthropic': {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': trimmed,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'ping' }],
          }),
        });
        if (res.ok || res.status === 400) return { valid: true, accountStatus: 'HEALTHY' };
        const data = await res.json().catch(() => ({}));
        return { valid: false, message: data.error?.message || `Anthropic status ${res.status}` };
      }
      case 'google': {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${trimmed}`);
        if (res.ok) return { valid: true, accountStatus: 'HEALTHY' };
        const data = await res.json().catch(() => ({}));
        return { valid: false, message: data.error?.message || `Google Gemini status ${res.status}` };
      }
      case 'groq': {
        const res = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { Authorization: `Bearer ${trimmed}` },
        });
        if (res.ok) return { valid: true, accountStatus: 'HEALTHY' };
        const data = await res.json().catch(() => ({}));
        return { valid: false, message: data.error?.message || `Groq status ${res.status}` };
      }
      case 'mistral': {
        const res = await fetch('https://api.mistral.ai/v1/models', {
          headers: { Authorization: `Bearer ${trimmed}` },
        });
        if (res.ok) return { valid: true, accountStatus: 'HEALTHY' };
        const data = await res.json().catch(() => ({}));
        return { valid: false, message: data.error?.message || `Mistral status ${res.status}` };
      }
      case 'deepseek': {
        const res = await fetch('https://api.deepseek.com/models', {
          headers: { Authorization: `Bearer ${trimmed}` },
        });
        if (res.ok) return { valid: true, accountStatus: 'HEALTHY' };
        const data = await res.json().catch(() => ({}));
        return { valid: false, message: data.error?.message || `DeepSeek status ${res.status}` };
      }
      case 'xai': {
        const res = await fetch('https://api.x.ai/v1/models', {
          headers: { Authorization: `Bearer ${trimmed}` },
        });
        if (res.ok) return { valid: true, accountStatus: 'HEALTHY' };
        const data = await res.json().catch(() => ({}));
        return { valid: false, message: data.error?.message || `xAI status ${res.status}` };
      }
      case 'openrouter': {
        const res = await fetch('https://openrouter.ai/api/v1/models', {
          headers: { Authorization: `Bearer ${trimmed}` },
        });
        if (res.ok) return { valid: true, accountStatus: 'HEALTHY' };
        const data = await res.json().catch(() => ({}));
        return { valid: false, message: data.error?.message || `OpenRouter status ${res.status}` };
      }
      case 'cohere': {
        const res = await fetch('https://api.cohere.com/v1/models', {
          headers: { Authorization: `Bearer ${trimmed}` },
        });
        if (res.ok) return { valid: true, accountStatus: 'HEALTHY' };
        const data = await res.json().catch(() => ({}));
        return { valid: false, message: data.error?.message || `Cohere status ${res.status}` };
      }
      default:
        if (trimmed.length > 8) return { valid: true, accountStatus: 'HEALTHY' };
        return { valid: false, message: 'Invalid API key format' };
    }
  } catch (err: unknown) {
    return { valid: false, message: err instanceof Error ? err.message : 'Network error testing key' };
  }
}