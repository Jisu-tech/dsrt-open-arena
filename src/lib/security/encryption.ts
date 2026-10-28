import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Standard for GCM

function getMasterKey(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) {
    throw new Error('ENCRYPTION_SECRET is not defined in environment variables.');
  }
  // Ensure the key is exactly 32 bytes (256 bits)
  if (secret.length === 64) {
    return Buffer.from(secret, 'hex');
  }
  // Fallback: Hash the secret to generate a consistent 32-byte key
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts a raw text string (API key) into format `iv:authTag:encryptedData`
 */
export function encryptCredential(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const key = getMasterKey();
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts an encrypted payload back to raw plaintext
 */
export function decryptCredential(ciphertext: string): string {
  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid ciphertext format');
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const key = getMasterKey();

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Creates a visual mask for API keys (e.g. sk-proj-...4A1f)
 */
export function createKeyMask(apiKey: string): string {
  if (apiKey.length <= 8) {
    return '****' + apiKey.slice(-2);
  }
  const prefix = apiKey.slice(0, 7);
  const suffix = apiKey.slice(-4);
  return `${prefix}...${suffix}`;
}