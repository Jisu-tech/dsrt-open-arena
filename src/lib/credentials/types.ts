import type { ProviderType } from '@/lib/providers/registry';

export type CredentialScope = 'user' | 'workspace';

export interface CredentialMetadata {
  id: string;
  scope: CredentialScope;
  workspaceId?: string;
  userId?: string;
  provider: ProviderType;
  keyMask: string;
  keyAlias?: string;
  status: 'active' | 'inactive' | 'invalid' | 'ACTIVE' | 'INACTIVE';
  isActive: boolean;
  lastValidatedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ResolvedCredential {
  apiKey: string;
  provider: ProviderType;
  scope: CredentialScope;
  credentialId: string;
  mask: string;
}

export interface SaveCredentialParams {
  workspaceId: string;
  userId: string;
  provider: ProviderType;
  rawApiKey: string;
  alias?: string;
  targetScope?: CredentialScope;
}