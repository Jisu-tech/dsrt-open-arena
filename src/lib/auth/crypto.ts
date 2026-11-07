import {
  encryptCredential,
  decryptCredential,
  createKeyMask,
  hashCredential,
} from '@/lib/credentials/crypto';

export function encryptApiKey(plainText: string): string {
  return encryptCredential(plainText);
}

export function decryptApiKey(
  encryptedInput: string,
  ivHex?: string,
  tagHex?: string
): string | null {
  try {
    if (!encryptedInput) return null;
    if (ivHex && tagHex && !encryptedInput.includes(':')) {
      const unified = `${ivHex}:${tagHex}:${encryptedInput}`;
      return decryptCredential(unified);
    }
    return decryptCredential(encryptedInput);
  } catch (err) {
    console.error('[crypto] Decryption failed:', err);
    return null;
  }
}

export function hashApiKey(apiKey: string): string {
  return hashCredential(apiKey);
}

export { createKeyMask };