import type { ProviderType } from './registry';

export class ProviderError extends Error {
  constructor(
    public provider: ProviderType,
    public statusCode: number,
    message: string,
    public rawError?: unknown
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export function parseProviderError(
  provider: ProviderType,
  statusCode: number,
  responseBody: string
): ProviderError {
  let message = responseBody;

  try {
    const json = JSON.parse(responseBody);
    if (json.error) {
      if (typeof json.error === 'string') {
        message = json.error;
      } else if (typeof json.error === 'object' && json.error !== null) {
        message = json.error.message || json.error.description || JSON.stringify(json.error);
      }
    } else if (json.message) {
      message = json.message;
    }
  } catch {
    /* Keep raw text if not valid JSON */
  }

  if (statusCode === 401 || statusCode === 403) {
    message = `AUTH_FAILED: Invalid or unauthorized API key for provider "${provider}". (${message})`;
  } else if (statusCode === 404 && provider === 'groq') {
    message = `GROQ_AUTH_OR_MODEL_ERROR: Groq rejected the API key or model access. Please re-save key in API Keys. (${message})`;
  } else if (statusCode === 429) {
    message = `RATE_LIMIT_EXCEEDED: Rate limit or quota exceeded for provider "${provider}". (${message})`;
  }

  return new ProviderError(provider, statusCode, message, responseBody);
}