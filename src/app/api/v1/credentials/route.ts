import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspace_id');

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'workspace_id is required' },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabaseClient();

    // Query explicit existing columns (omitting target_scope to prevent DB schema column errors)
    const { data, error } = await supabase
      .from('provider_credentials')
      .select('id, workspace_id, provider, status, created_at, updated_at')
      .eq('workspace_id', workspaceId);

    if (error) {
      console.error('[credentials GET] Supabase query error:', error);
      return NextResponse.json({ credentials: [] });
    }

    const credentials = (data || []).map((item) => ({
      id: item.id,
      workspaceId: item.workspace_id,
      provider: item.provider,
      status: item.status || 'ACTIVE',
      isActive: item.status === 'ACTIVE' || item.status === 'valid',
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    }));

    return NextResponse.json({ credentials });
  } catch (err: unknown) {
    console.error('[credentials GET] Error:', err);
    return NextResponse.json({ credentials: [] });
  }
}
