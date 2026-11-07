import { SupabaseClient } from '@supabase/supabase-js';

export interface DocumentSnippet {
  id: string;
  documentId: string;
  content: string;
  score: number;
  metadata?: Record<string, unknown>;
}

/**
 * Executes semantic vector or keyword fallback search across uploaded workspace documents.
 */
export async function searchVectorStore(
  supabase: SupabaseClient,
  query: string,
  topK: number = 3,
  workspaceId?: string
): Promise<DocumentSnippet[]> {
  try {
    // Attempt RPC match_documents (pgvector)
    const { data, error } = await supabase.rpc('match_documents', {
      query_text: query,
      match_count: topK,
      filter_workspace_id: workspaceId || null,
    });

    if (!error && Array.isArray(data) && data.length > 0) {
      return data.map((item: Record<string, unknown>) => ({
        id: String(item.id || item.document_id || Math.random()),
        documentId: String(item.document_id || item.id || ''),
        content: String(item.content || item.chunk_content || ''),
        score: typeof item.similarity === 'number' ? item.similarity : (Number(item.score) || 0.85),
        metadata: (item.metadata as Record<string, unknown>) || { title: item.title },
      }));
    }

    // Fallback: Plain text search on documents table if RPC is unpopulated
    let queryBuilder = supabase
      .from('documents')
      .select('id, workspace_id, name, content, metadata')
      .ilike('content', `%${query}%`)
      .limit(topK);

    if (workspaceId) {
      queryBuilder = queryBuilder.eq('workspace_id', workspaceId);
    }

    const { data: textData } = await queryBuilder;

    if (!textData || textData.length === 0) {
      return [];
    }

    return textData.map((doc: Record<string, unknown>) => ({
      id: String(doc.id),
      documentId: String(doc.id),
      content: String(doc.content || ''),
      score: 0.82,
      metadata: { ...(doc.metadata as Record<string, unknown>), title: doc.name },
    }));
  } catch (err) {
    console.warn('[vector/store] Vector search exception fallback:', err);
    return [];
  }
}