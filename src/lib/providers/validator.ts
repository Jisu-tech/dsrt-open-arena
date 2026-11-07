import { ProviderType } from './registry';
import { executeGatewayCall } from './gateway';

interface ValidationResult {
  valid: boolean;
  message?: string;
}

const VALIDATION_MODELS: Record<ProviderType, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-haiku-20241022',
  google: 'gemini-1.5-flash',
  deepseek: 'deepseek-chat',
  openrouter: 'openai/gpt-4o-mini',
  groq: 'llama-3.1-8b-instant',
  mistral: 'mistral-small-latest',
  xai: 'grok-2-latest',
  cohere: 'command-r',
};

export async function validateProviderKey(
  provider: ProviderType,
  apiKey: string
): Promise<ValidationResult> {
  try {
    const model = VALIDATION_MODELS[provider];
    if (!model) {
      return { valid: false, message: `No validation model configured for ${provider}` };
    }

    await executeGatewayCall({
      provider,
      model,
      apiKey,
      messages: [{ role: 'user', content: 'Hi' }],
      maxTokens: 5,
    });

    return { valid: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to validate API key with provider.';
    return { valid: false, message };
  }
}