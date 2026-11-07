import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const VERSION_PREFIX = 'v1:';

export function cleanApiKey(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';
  let cleaned = raw.trim();

  // Strip wrapping double, single, or backtick quotes
  while (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'")) ||
    (cleaned.startsWith('`') && cleaned.endsWith('`'))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }

  // Strip accidental "Bearer " prefix if user pasted "Bearer sk-..."
  if (cleaned.toLowerCase().startsWith('bearer ')) {
    cleaned = cleaned.slice(7).trim();
  }

  return cleaned;
}

function getMasterKey(): Buffer {
  const secret =
    process.env.ENCRYPTION_SECRET ||
    process.env.ENCRYPTION_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'dsrt-open-arena-fallback-secret-key-32-chars!!';

  if (secret.length === 64 && /^[0-9a-fA-F]+$/.test(secret)) {
    return Buffer.from(secret, 'hex');
  }

  return createHash('sha256').update(secret).digest();
}

export function encryptCredential(plaintext: string): string {
  const clean = cleanApiKey(plaintext);
  if (!clean) {
    throw new Error('encryptCredential: clean plaintext is required');
  }

  const iv = randomBytes(IV_LENGTH);
  const key = getMasterKey();
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(clean, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');

  return `${VERSION_PREFIX}${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decryptCredential(ciphertext: string): string {
  if (!ciphertext || typeof ciphertext !== 'string') {
    throw new Error('decryptCredential: ciphertext is required');
  }

  const trimmed = ciphertext.trim();

  // Plaintext fallback for legacy/raw strings
  if (
    (trimmed.startsWith('sk-') ||
      trimmed.startsWith('gsk_') ||
      trimmed.startsWith('xai-') ||
      trimmed.startsWith('AIza') ||
      trimmed.startsWith('or-') ||
      trimmed.startsWith('mi-') ||
      trimmed.startsWith('deepseek-')) &&
    !trimmed.includes(':')
  ) {
    return cleanApiKey(trimmed);
  }

  let body = trimmed;
  if (trimmed.startsWith(VERSION_PREFIX)) {
    body = trimmed.slice(VERSION_PREFIX.length);
  }

  const parts = body.split(':');
  if (parts.length !== 3) {
    throw new Error(`decryptCredential: Invalid ciphertext format (expected 3 parts, got ${parts.length})`);
  }

  const [ivHex, authTagHex, encryptedHex] = parts;

  let iv: Buffer;
  let authTag: Buffer;
  try {
    iv = Buffer.from(ivHex, 'hex');
    authTag = Buffer.from(authTagHex, 'hex');
  } catch {
    throw new Error('decryptCredential: Failed to parse IV or auth tag hex');
  }

  if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error('decryptCredential: Invalid IV or Auth Tag length');
  }

  const key = getMasterKey();
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  try {
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return cleanApiKey(decrypted);
  } catch (err) {
    throw new Error(`decryptCredential: Decryption failed (${(err as Error).message})`);
  }
}

export function createKeyMask(apiKey: string): string {
  const clean = cleanApiKey(apiKey);
  if (!clean) return '••••';
  if (clean.length <= 8) {
    return '••••' + clean.slice(-4);
  }
  const prefix = clean.slice(0, 4);
  const suffix = clean.slice(-4);
  return `${prefix}••••${suffix}`;
}

export function hashCredential(apiKey: string): string {
  const clean = cleanApiKey(apiKey);
  if (!clean) return '';
  return createHash('sha256').update(clean).digest('hex');
}