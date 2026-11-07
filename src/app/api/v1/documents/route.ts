/**
 * Document Ingestion & RAG Retrieval API Endpoint (Phase 7: Endless Context)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { indexDocument, searchVectorStore, deleteDocument } from '@/lib/context/vectorStore';
import { decryptCredential } from '@/lib/security/encryption';

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const workspaceId = request.nextUrl.searchParams.get('workspace_id');
  const query = request.nextUrl.searchParams.get('query');

  if (!workspaceId) {
    return NextResponse.json({ error: 'workspace_id is required' }, { status: 400 });
  }

  if (query) {
    const snippets = await searchVectorStore({
      workspaceId,
      query,
      limit: 10,
    });
    return NextResponse.json({ snippets });
  }

  const { data, error } = await supabase
    .from('documents')
    .select('id, workspace_id, conversation_id, title, content, metadata, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ documents: data || [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: {
    workspace_id?: string;
    conversation_id?: string;
    title?: string;
    content?: string;
    metadata?: Record<string, unknown>;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { workspace_id, conversation_id, title, content, metadata } = body;

  if (!workspace_id || !title || !content) {
    return NextResponse.json(
      { error: 'workspace_id, title, and content are required' },
      { status: 400 }
    );
  }

  // Attempt to fetch OpenAI API key for real high-fidelity embeddings
  let apiKey: string | undefined;
  const { data: cred } = await supabase
    .from('provider_credentials')
    .select('encrypted_api_key')
    .eq('workspace_id', workspace_id)
    .eq('provider', 'openai')
    .maybeSingle();

  if (cred?.encrypted_api_key) {
    try {
      apiKey = decryptCredential(cred.encrypted_api_key as string);
    } catch {
      /* fallback to deterministic embeddings */
    }
  }

  const result = await indexDocument({
    workspaceId: workspace_id,
    conversationId: conversation_id,
    title,
    content,
    metadata,
    apiKey,
  });

  return NextResponse.json(
    {
      success: true,
      document_ids: result.documentIds,
      chunk_count: result.chunkCount,
    },
    { status: 201 }
  );
}

export async function DELETE(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const documentId = request.nextUrl.searchParams.get('id');
  const workspaceId = request.nextUrl.searchParams.get('workspace_id');

  if (!documentId || !workspaceId) {
    return NextResponse.json({ error: 'id and workspace_id required' }, { status: 400 });
  }

  const ok = await deleteDocument(documentId, workspaceId);
  if (!ok) {
    return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}