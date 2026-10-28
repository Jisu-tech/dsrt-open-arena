import { ProviderType } from './registry';
import { executeGatewayCall } from './gateway';

export async function validateProviderKey(provider: ProviderType, apiKey: string): Promise<{ valid: boolean; message?: string }> {
  try {
    if (provider === 'openai') {
      await executeGatewayCall({
        provider: 'openai',
        model: 'gpt-4o-mini',
        apiKey,
        messages: [{ role: 'user', content: 'Ping' }],
        maxTokens: 1,
      });
    } else if (provider === 'anthropic') {
      await executeGatewayCall({
        provider: 'anthropic',
        model: 'claude-3-haiku-20240307',
        apiKey,
        messages: [{ role: 'user', content: 'Ping' }],
        maxTokens: 1,
      });
    } else if (provider === 'google') {
      await executeGatewayCall({
        provider: 'google',
        model: 'gemini-1.5-flash',
        apiKey,
        messages: [{ role: 'user', content: 'Ping' }],
        maxTokens: 1,
      });
    }
    return { valid: true };
  } catch (error: any) {
    return {
      valid: false,
      message: error?.message || 'Failed to validate API key with provider.',
    };
  }
}