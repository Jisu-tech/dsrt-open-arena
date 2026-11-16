import crypto from 'crypto';

export function sha256Hex(data: string | Uint8Array | Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

export function canonicalJson(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalJson).join(',') + ']';
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const parts = keys.map(
    (k) => JSON.stringify(k) + ':' + canonicalJson((obj as Record<string, unknown>)[k])
  );
  return '{' + parts.join(',') + '}';
}

export function computeObjectHash(obj: unknown): string {
  const serialized = canonicalJson(obj);
  return sha256Hex(serialized);
}

export const computeContentHash = computeObjectHash;
