import { CredentialService } from '@/lib/credentials/service';

export async function getDecryptedKey(
  provider: string,
  workspaceId?: string,
  userId?: string
): Promise<string | null> {
  try {
    const credential = await CredentialService.resolveCredential(
      workspaceId || null,
      provider
    );
    return credential ? credential.apiKey : null;
  } catch (err) {
    console.error(`[keyManager] Failed to fetch decrypted key for ${provider}:`, err);
    return null;
  }
}

export async function testProviderKey(
  provider: string,
  apiKey: string
): Promise<{ success: boolean; message: string }> {
  try {
    const { validateCredentialKey } = await import('@/lib/credentials/validator');
    const isValid = await validateCredentialKey(provider, apiKey);
    return {
      success: isValid,
      message: isValid
        ? `Successfully validated ${provider} API key.`
        : `Validation failed for ${provider} API key.`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || `Failed to test key for ${provider}`,
    };
  }
}

export async function replaceProviderCredential(
  workspaceId: string,
  provider: string,
  apiKey: string,
  keyAlias?: string
): Promise<void> {
  await CredentialService.saveCredential({
    workspaceId,
    provider,
    apiKey,
    keyAlias: keyAlias || `${provider}-key`,
  });
}
