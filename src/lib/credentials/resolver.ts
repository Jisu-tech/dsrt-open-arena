import { SupabaseClient } from '@supabase/supabase-js';
import type { ProviderType } from '@/lib/providers/registry';
import { CredentialError } from './errors';
import { decryptCredential } from './crypto';
import type { ResolvedCredential } from './types';

export async function resolveCredential(
  supabase: SupabaseClient,
  params: {
    userId: string;
    workspaceId: string;
    provider: ProviderType;
  }
): Promise<ResolvedCredential> {
  const { userId, workspaceId, provider } = params;

  // 1. User-level credential (highest priority)
  if (userId) {
    const { data: userCred } = await supabase
      .from('provider_credentials')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', provider)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (userCred && userCred.encrypted_api_key) {
      try {
        const apiKey = decryptCredential(userCred.encrypted_api_key);
        if (apiKey) {
          return {
            apiKey,
            provider,
            scope: 'user',
            credentialId: userCred.id,
            mask: userCred.key_mask || '••••',
          };
        }
      } catch (err) {
        console.warn(`[resolver] Decryption failed for user credential ID ${userCred.id}:`, err);
      }
    }
  }

  // 2. Workspace-level credential (secondary priority)
  if (workspaceId) {
    const { data: wsCred } = await supabase
      .from('provider_credentials')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('provider', provider)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (wsCred && wsCred.encrypted_api_key) {
      try {
        const apiKey = decryptCredential(wsCred.encrypted_api_key);
        if (apiKey) {
          return {
            apiKey,
            provider,
            scope: 'workspace',
            credentialId: wsCred.id,
            mask: wsCred.key_mask || '••••',
          };
        }
      } catch (err) {
        console.warn(`[resolver] Decryption failed for workspace credential ID ${wsCred.id}:`, err);
      }
    }
  }

  // Explicit BYOK requirement — throw error instead of silent process.env fallback
  throw new CredentialError(
    'CREDENTIAL_NOT_FOUND',
    `No API key configured for provider "${provider}". Please add an API key in API Keys settings.`,
    provider
  );
}