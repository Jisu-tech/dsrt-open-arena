/**
 * Vector Store & Document Chunk Indexing Engine (Phase 7: Endless Context)
 * Handles document chunking, embedding generation, pgvector indexing, and semantic similarity search.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { generateEmbedding, cosineSimilarity } from './embeddings';

export type DocumentSnippet = {
  id: string;
  source: string;
  content: string;
  relevance: number;
  metadata?: Record<string, unknown>;
};

export function chunkText(
  text: string,
  chunkSize = 1000,
  overlap = 200
): string[] {
  const cleaned = text.trim();
  if (cleaned.length <= chunkSize) return [cleaned];

  const chunks: string[] = [];
  let start = 0;

  while (start < cleaned.length) {
    let end = start + chunkSize;
    if (end < cleaned.length) {
      const lastSpace = cleaned.lastIndexOf(' ', end);
      if (lastSpace > start + chunkSize / 2) {
        end = lastSpace;
      }
    }
    const chunk = cleaned.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    start = end - overlap;
  }

  return chunks;
}

export async function indexDocument(input: {
  workspaceId: string;
  conversationId?: string;
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
  apiKey?: string;
}): Promise<{ documentIds: string[]; chunkCount: number }> {
  const supabase = createAdminClient();
  const chunks = chunkText(input.content);
  const documentIds: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const chunkTitle = chunks.length > 1 ? `${input.title} (Part ${i + 1}/${chunks.length})` : input.title;
    const embedding = await generateEmbedding(chunk, input.apiKey);

    const { data, error } = await supabase
      .from('documents')
      .insert({
        workspace_id: input.workspaceId,
        conversation_id: input.conversationId || null,
        title: chunkTitle,
        content: chunk,
        embedding: JSON.stringify(embedding),
        metadata: {
          ...(input.metadata || {}),
          chunk_index: i,
          total_chunks: chunks.length,
          original_title: input.title,
        },
      })
      .select('id')
      .single();

    if (!error && data) {
      documentIds.push(data.id as string);
    }
  }

  return { documentIds, chunkCount: chunks.length };
}

export async function searchVectorStore(input: {
  workspaceId: string;
  query: string;
  apiKey?: string;
  limit?: number;
  matchThreshold?: number;
  conversationId?: string;
}): Promise<DocumentSnippet[]> {
  const supabase = createAdminClient();
  const limit = input.limit ?? 5;
  const threshold = input.matchThreshold ?? 0.15;

  const queryVector = await generateEmbedding(input.query, input.apiKey);

  let query = supabase
    .from('documents')
    .select('id, title, content, embedding, metadata, conversation_id')
    .eq('workspace_id', input.workspaceId)
    .limit(50);

  if (input.conversationId) {
    query = query.or(`conversation_id.eq.${input.conversationId},conversation_id.is.null`);
  }

  const { data: docs, error } = await query;

  if (error || !docs || docs.length === 0) {
    return [];
  }

  const scored: DocumentSnippet[] = [];

  for (const doc of docs) {
    let similarity = 0;
    if (doc.embedding) {
      try {
        const parsedEmbedding = typeof doc.embedding === 'string'
          ? JSON.parse(doc.embedding)
          : doc.embedding;
        if (Array.isArray(parsedEmbedding)) {
          similarity = cosineSimilarity(queryVector, parsedEmbedding);
        }
      } catch {
        similarity = 0;
      }
    }

    if (similarity < threshold) {
      // Fallback lexical overlap if similarity is low
      const qWords = input.query.toLowerCase().split(/\W+/).filter((w) => w.length > 2);
      if (qWords.length > 0) {
        const textLow = doc.content.toLowerCase();
        let hits = 0;
        for (const w of qWords) {
          if (textLow.includes(w)) hits++;
        }
        const lexicalScore = hits / qWords.length;
        similarity = Math.max(similarity, lexicalScore * 0.5);
      }
    }

    if (similarity >= threshold) {
      scored.push({
        id: doc.id,
        source: doc.title || 'Workspace Document',
        content: doc.content,
        relevance: Number(similarity.toFixed(4)),
        metadata: (doc.metadata as Record<string, unknown>) || {},
      });
    }
  }

  return scored
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, limit);
}

export async function deleteDocument(documentId: string, workspaceId: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('id', documentId)
    .eq('workspace_id', workspaceId);
  return !error;
}