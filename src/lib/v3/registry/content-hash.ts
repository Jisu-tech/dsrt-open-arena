/**
 * DSRT Open Arena V3 — Content Hashing (NEW)
 * 
 * SHA-256 content hashing using Web Crypto API.
 * Used for:
 *   - Catalogue entry change detection
 *   - Pricing snapshot content hashing
 *   - Raw catalogue response audit
 * 
 * @module v3/registry/content-hash
 */

/**
 * Compute SHA-256 hash of a string. Returns lowercase hex.
 */
export async function computeContentHash(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const buffer = await crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(buffer);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i]!;
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Compute SHA-256 hash of an arbitrary JSON-serializable object.
 * Keys are sorted to ensure deterministic output.
 */
export async function computeObjectHash(obj: unknown): Promise<string> {
  return computeContentHash(canonicalJson(obj));
}

/**
 * Deterministic JSON serialization with sorted keys at all levels.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalJson).join(',') + ']';
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const parts = keys.map(k => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`);
  return '{' + parts.join(',') + '}';
}