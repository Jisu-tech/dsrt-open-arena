import { SupabaseClient } from '@supabase/supabase-js';
import { CredentialService } from '@/lib/credentials/service';
import { validateProviderKey } from '@/lib/credentials/validator';
import { createKeyMask } from '@/lib/credentials/crypto';
import type { ProviderType } from '@/lib/providers/registry';

export interface CredentialReplaceParams {
  userId: string;
  provider: ProviderType;
  rawApiKey: string;
  alias?: string;
  workspaceId?: string;
  supabase: SupabaseClient;
}

export interface CredentialReplaceResult {
  success: boolean;
  credentialId?: string;
  provider: ProviderType;
  alias?: string;
  error?: string;
}

export { createKeyMask };

/**
 * Tests an API key against provider endpoints using the unified CredentialValidator.
 */
export async function testProviderKey(
  provider: ProviderType,
  apiKey: string
): Promise<{ valid: boolean; message?: string }> {
  const result = await validateProviderKey(provider, apiKey);
  return {
    valid: result.valid,
    message: result.message,
  };
}

/**
 * Replaces or registers a provider API key using CredentialService.
 */
export async function replaceProviderCredential(
  params: CredentialReplaceParams
): Promise<CredentialReplaceResult> {
  const service = new CredentialService(params.supabase);
  try {
    const cred = await service.saveCredential({
      workspaceId: params.workspaceId || '',
      userId: params.userId,
      provider: params.provider,
      rawApiKey: params.rawApiKey,
      alias: params.alias,
      targetScope: params.workspaceId ? 'workspace' : 'user',
    });
    return {
      success: true,
      credentialId: cred.id,
      provider: cred.provider,
      alias: cred.keyAlias,
    };
  } catch (err: unknown) {
    return {
      success: false,
      provider: params.provider,
      error: err instanceof Error ? err.message : 'Save credential failed',
    };
  }
}

/**
 * Resolves a decrypted API key for a user/workspace using CredentialService.
 */
export async function getDecryptedKey(
  supabase: SupabaseClient,
  userId: string,
  provider: ProviderType,
  workspaceId?: string
): Promise<string | null> {
  const service = new CredentialService(supabase);
  try {
    const resolved = await service.resolve(userId, workspaceId || '', provider);
    return resolved.apiKey;
  } catch {
    return null;
  }
}

/**
 * Retrieves all decrypted keys configured for a user/workspace.
 */
export async function getDecryptedUserKeys(
  supabase: SupabaseClient,
  userId: string,
  workspaceId?: string
): Promise<Record<string, string | null>> {
  const service = new CredentialService(supabase);
  const providers: ProviderType[] = [
    'openai',
    'anthropic',
    'google',
    'groq',
    'mistral',
    'deepseek',
    'xai',
    'openrouter',
  ];
  const keys: Record<string, string | null> = {};

  for (const provider of providers) {
    try {
      const resolved = await service.resolve(userId, workspaceId || '', provider);
      keys[provider] = resolved.apiKey;
    } catch {
      keys[provider] = null;
    }
  }

  return keys;
}

/**
 * Returns configuration status metadata for user keys.
 */
export async function getUserKeyStatuses(
  supabase: SupabaseClient,
  userId: string,
  workspaceId?: string
): Promise<Record<string, { configured: boolean; alias?: string; updatedAt?: string }>> {
  const service = new CredentialService(supabase);
  const providers: ProviderType[] = [
    'openai',
    'anthropic',
    'google',
    'groq',
    'mistral',
    'deepseek',
    'xai',
    'openrouter',
  ];
  const statusMap: Record<string, { configured: boolean; alias?: string; updatedAt?: string }> = {};

  try {
    const list = await service.listCredentials(workspaceId || '', userId);
    for (const p of providers) {
      const found = list.find((c) => c.provider === p);
      statusMap[p] = {
        configured: Boolean(found?.isActive),
        alias: found?.keyAlias,
        updatedAt: found?.updatedAt,
      };
    }
  } catch {
    for (const p of providers) {
      statusMap[p] = { configured: false };
    }
  }

  return statusMap;
}