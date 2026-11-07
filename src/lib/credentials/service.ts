import { SupabaseClient } from '@supabase/supabase-js';
import type { ProviderType } from '@/lib/providers/registry';
import { encryptCredential, createKeyMask, hashCredential } from './crypto';
import { resolveCredential } from './resolver';
import { validateProviderKey } from './validator';
import { CredentialError } from './errors';
import type { CredentialMetadata, SaveCredentialParams, ResolvedCredential } from './types';

export class CredentialService {
  constructor(private supabase: SupabaseClient) {}

  async resolve(
    userId: string,
    workspaceId: string,
    provider: ProviderType
  ): Promise<ResolvedCredential> {
    return resolveCredential(this.supabase, { userId, workspaceId, provider });
  }

  async saveCredential(params: SaveCredentialParams): Promise<CredentialMetadata> {
    const { workspaceId, userId, provider, rawApiKey, alias, targetScope = 'workspace' } = params;

    const validation = await validateProviderKey(provider, rawApiKey);
    if (!validation.valid) {
      throw new CredentialError(
        'INVALID_API_KEY',
        validation.message || 'Key validation failed',
        provider
      );
    }

    const encryptedKey = encryptCredential(rawApiKey);
    const keyMask = createKeyMask(rawApiKey);
    const keyHash = hashCredential(rawApiKey);
    const keyAlias = alias?.trim() || `${provider.toUpperCase()} Key (${keyHash.substring(0, 6)})`;
    const now = new Date().toISOString();

    // Clear existing credential for clean replacement.
    // Match by (workspace_id, user_id, provider) when workspace scope,
    // or (user_id, provider) with null workspace when user scope.
    const matchFilter: Record<string, unknown> =
      targetScope === 'user'
        ? { user_id: userId, provider }
        : { workspace_id: workspaceId, user_id: userId, provider };

    try {
      await this.supabase.from('provider_credentials').delete().match(matchFilter);
    } catch {
      /* non-fatal */
    }

    // Try status candidates to guarantee enum compatibility ('ACTIVE' vs 'active')
    const statusCandidates = ['ACTIVE', 'active'];
    let lastError: { message?: string } | null = null;

    for (const statusVal of statusCandidates) {
      const payload: Record<string, unknown> = {
        provider,
        encrypted_api_key: encryptedKey,
        key_mask: keyMask,
        key_alias: keyAlias,
        key_hash: keyHash,
        status: statusVal,
        is_active: true,
        last_validated_at: now,
        updated_at: now,
        created_at: now,
        user_id: userId,
      };

      if (targetScope === 'workspace' && workspaceId) {
        payload.workspace_id = workspaceId;
      }

      // First attempt full payload
      let { data, error } = await this.supabase
        .from('provider_credentials')
        .insert(payload)
        .select('*')
        .maybeSingle();

      // Retry without extended metadata if table uses a minimal schema
      if (error) {
        delete payload.is_active;
        delete payload.key_alias;
        delete payload.key_hash;

        const retry = await this.supabase
          .from('provider_credentials')
          .insert(payload)
          .select('*')
          .maybeSingle();

        data = retry.data;
        error = retry.error;
      }

      if (!error && data) {
        return {
          id: String(data.id),
          scope: targetScope,
          workspaceId: data.workspace_id ? String(data.workspace_id) : undefined,
          userId: data.user_id ? String(data.user_id) : undefined,
          provider: data.provider as ProviderType,
          keyMask: data.key_mask || keyMask,
          keyAlias: data.key_alias || keyAlias,
          status: data.status,
          isActive: true,
          lastValidatedAt: data.last_validated_at,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        };
      }

      lastError = error;
    }

    throw new Error(
      `Failed to save credential: ${lastError?.message || 'Database insert rejected status enum'}`
    );
  }

  async listCredentials(workspaceId: string, userId: string): Promise<CredentialMetadata[]> {
    const { data } = await this.supabase
      .from('provider_credentials')
      .select('*')
      .or(`workspace_id.eq.${workspaceId},user_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    return (data || []).map((row) => {
      const scope: 'workspace' | 'user' = row.workspace_id ? 'workspace' : 'user';
      return {
        id: String(row.id),
        scope,
        workspaceId: row.workspace_id ? String(row.workspace_id) : undefined,
        userId: row.user_id ? String(row.user_id) : undefined,
        provider: row.provider as ProviderType,
        keyMask: row.key_mask || '••••',
        keyAlias: row.key_alias,
        status: row.status,
        isActive:
          String(row.status).toLowerCase() === 'active' || Boolean(row.is_active),
        lastValidatedAt: row.last_validated_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });
  }

  async deleteCredential(id: string): Promise<void> {
    const { error } = await this.supabase.from('provider_credentials').delete().eq('id', id);
    if (error) {
      throw new Error(`Failed to delete credential: ${error.message}`);
    }
  }
}