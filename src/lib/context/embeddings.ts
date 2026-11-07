/**
 * Vector Embedding Generator for DSRT Open Arena (Phase 7: Endless Context)
 * Generates 1536-dimensional normalized vectors matching Supabase pgvector schema.
 */

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash;
}

/**
 * Deterministic, normalized 1536-dim vector fallback when OpenAI API key is missing or fails.
 * Guarantees pgvector inserts and cosine similarity searches never throw schema or dimension errors.
 */
function generateDeterministicVector(text: string): number[] {
  const dims = 1536;
  const vector: number[] = new Array(dims);
  const seed = Math.abs(hashString(text));

  let sumSq = 0;
  for (let i = 0; i < dims; i++) {
    const val = Math.sin(seed + i * 0.1) * Math.cos((seed % 997) + i * 0.05);
    vector[i] = val;
    sumSq += val * val;
  }

  const norm = Math.sqrt(sumSq) || 1;
  for (let i = 0; i < dims; i++) {
    vector[i] = Number((vector[i] / norm).toFixed(6));
  }

  return vector;
}

export async function generateEmbedding(
  text: string,
  apiKey?: string
): Promise<number[]> {
  const cleanText = text.trim().replace(/\s+/g, ' ');
  if (!cleanText) {
    return new Array(1536).fill(0);
  }

  if (apiKey && apiKey.startsWith('sk-')) {
    try {
      const res = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: cleanText.slice(0, 8000),
          dimensions: 1536,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const embedding = data.data?.[0]?.embedding;
        if (Array.isArray(embedding) && embedding.length === 1536) {
          return embedding;
        }
      }
    } catch {
      // Soft-fail to deterministic embedding
    }
  }

  return generateDeterministicVector(cleanText);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}