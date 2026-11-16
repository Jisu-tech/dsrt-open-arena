export const V3Provider = {
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic',
  GOOGLE: 'google',
  GROQ: 'groq',
  DEEPSEEK: 'deepseek',
  MISTRAL: 'mistral',
  XAI: 'xai',
  OPENROUTER: 'openrouter',
  COHERE: 'cohere',
} as const;

export type V3Provider =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'groq'
  | 'deepseek'
  | 'mistral'
  | 'xai'
  | 'openrouter'
  | 'cohere';

export const ModelLifecycleState = {
  ACTIVE: 'active',
  DEPRECATED: 'deprecated',
  DISCONTINUED: 'discontinued',
  BETA: 'beta',
  PREVIEW: 'preview',
  UNKNOWN: 'unknown',
} as const;

export type ModelLifecycleState =
  | 'active'
  | 'deprecated'
  | 'discontinued'
  | 'beta'
  | 'preview'
  | 'unknown';

export const ErrorSeverity = {
  FATAL: 'fatal',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
} as const;

export type ErrorSeverity = 'fatal' | 'error' | 'warning' | 'info';

export const ErrorCategory = {
  AUTHENTICATION: 'authentication',
  RATE_LIMIT: 'rate_limit',
  PROVIDER_DOWN: 'provider_down',
  INVALID_REQUEST: 'invalid_request',
  INTERNAL: 'internal',
  TIMEOUT: 'timeout',
} as const;

export type ErrorCategory =
  | 'authentication'
  | 'rate_limit'
  | 'provider_down'
  | 'invalid_request'
  | 'internal'
  | 'timeout';

export const ErrorRecoverability = {
  RETRYABLE: 'retryable',
  NON_RETRYABLE: 'non_retryable',
  FALLBACK_AVAILABLE: 'fallback_available',
} as const;

export type ErrorRecoverability =
  | 'retryable'
  | 'non_retryable'
  | 'fallback_available';

export const ModelTier = {
  FLAGSHIP: 'flagship',
  MID: 'mid',
  FAST: 'fast',
  REASONING: 'reasoning',
  EMBEDDING: 'embedding',
} as const;

export type ModelTier =
  | 'flagship'
  | 'mid'
  | 'fast'
  | 'reasoning'
  | 'embedding';

export const ModelCapability = {
  CHAT: 'chat',
  CODE: 'code',
  VISION: 'vision',
  FUNCTION_CALLING: 'function_calling',
  JSON: 'json',
  WEB_SEARCH: 'web_search',
} as const;

export type ModelCapability =
  | 'chat'
  | 'code'
  | 'vision'
  | 'function_calling'
  | 'json'
  | 'web_search';

export const TaskState = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const;

export type TaskState =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export function isV3Provider(val: string): val is V3Provider {
  return [
    'openai',
    'anthropic',
    'google',
    'groq',
    'deepseek',
    'mistral',
    'xai',
    'openrouter',
    'cohere',
  ].includes(val);
}

export function isTaskState(val: string): val is TaskState {
  return ['pending', 'running', 'completed', 'failed', 'cancelled'].includes(val);
}
