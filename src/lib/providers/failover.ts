export type ProviderType =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'groq'
  | 'mistral'
  | 'deepseek';

export interface FailoverTarget {
  provider: ProviderType;
  model: string;
}

export interface FailoverEvent {
  timestamp: string;
  originalProvider: ProviderType;
  originalModel: string;
  fallbackProvider: ProviderType;
  fallbackModel: string;
  attempt: number;
  reason: string;
  errorDetails?: string;
}

export interface FailoverExecutionResult {
  text: string;
  finalProvider: ProviderType;
  finalModel: string;
  wasFailover: boolean;
  failoverEvents: FailoverEvent[];
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Smart Fallback Cascade Mapping
 * When a primary model fails due to 429 rate limits, 5xx server errors, or quota exhaustion,
 * execution cascades down this ordered fallback chain.
 */
const DEFAULT_FAILOVER_CASCADE: Record<string, FailoverTarget[]> = {
  'openai:gpt-4o': [
    { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022' },
    { provider: 'google', model: 'gemini-1.5-pro' },
    { provider: 'groq', model: 'llama-3.3-70b-versatile' },
    { provider: 'openai', model: 'gpt-4o-mini' },
  ],
  'openai:gpt-4o-mini': [
    { provider: 'groq', model: 'llama-3.3-70b-versatile' },
    { provider: 'google', model: 'gemini-1.5-flash' },
  ],
  'anthropic:claude-3-5-sonnet-20241022': [
    { provider: 'openai', model: 'gpt-4o' },
    { provider: 'google', model: 'gemini-1.5-pro' },
    { provider: 'mistral', model: 'mistral-large-latest' },
  ],
  'google:gemini-1.5-pro': [
    { provider: 'openai', model: 'gpt-4o' },
    { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022' },
  ],
  'groq:llama-3.3-70b-versatile': [
    { provider: 'openai', model: 'gpt-4o-mini' },
    { provider: 'google', model: 'gemini-1.5-flash' },
  ],
};

/**
 * Determines whether an error qualifies for automated provider failover.
 */
export function isFailoverEligibleError(error: unknown): boolean {
  if (!error) return false;

  const msg =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  const is429 =
    msg.includes('429') ||
    msg.includes('rate limit') ||
    msg.includes('too many requests');
  const is5xx =
    msg.includes('500') ||
    msg.includes('502') ||
    msg.includes('503') ||
    msg.includes('504') ||
    msg.includes('overloaded');
  const isQuota =
    msg.includes('quota') || msg.includes('exceeded') || msg.includes('credit');
  const isTimeout =
    msg.includes('timeout') ||
    msg.includes('econnaborted') ||
    msg.includes('network error');

  return is429 || is5xx || isQuota || isTimeout;
}

/**
 * Resolves the ordered cascade chain for a given provider and model pair.
 */
export function getFailoverCascade(
  provider: ProviderType,
  model: string
): FailoverTarget[] {
  const key = `${provider}:${model}`;
  if (DEFAULT_FAILOVER_CASCADE[key]) {
    return DEFAULT_FAILOVER_CASCADE[key];
  }

  const genericCascade: FailoverTarget[] = [];
  if (provider !== 'openai') genericCascade.push({ provider: 'openai', model: 'gpt-4o' });
  if (provider !== 'anthropic')
    genericCascade.push({ provider: 'anthropic', model: 'claude-3-5-sonnet-20241022' });
  if (provider !== 'google')
    genericCascade.push({ provider: 'google', model: 'gemini-1.5-pro' });
  if (provider !== 'groq')
    genericCascade.push({ provider: 'groq', model: 'llama-3.3-70b-versatile' });

  return genericCascade;
}