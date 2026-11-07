import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { CredentialService } from '@/lib/credentials/service';
import type { ProviderType } from '@/lib/providers/registry';

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const workspaceId = request.nextUrl.searchParams.get('workspace_id') || '';

  try {
    // Query credentials that match EITHER the workspace OR the user
    // This ensures UI sees both user-scoped and workspace-scoped keys
    let query = supabase
      .from('provider_credentials')
      .select('id, provider, status, updated_at, workspace_id, user_id, target_scope')
      .eq('status', 'ACTIVE');

    if (workspaceId) {
      query = query.or(`workspace_id.eq.${workspaceId},user_id.eq.${user.id}`);
    } else {
      query = query.eq('user_id', user.id);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[credentials GET] Supabase error:', error);
      // Fallback to service-based listing if direct query fails
      try {
        const service = new CredentialService(supabase);
        const credentials = await service.listCredentials(workspaceId, user.id);
        return NextResponse.json({ credentials });
      } catch (fallbackErr: unknown) {
        return NextResponse.json(
          { error: (fallbackErr as Error).message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ credentials: data || [] });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const workspaceId = String(body.workspace_id || '');
  const provider = body.provider as ProviderType | undefined;
  const apiKey = body.api_key as string | undefined;

  if (!provider || !apiKey) {
    return NextResponse.json(
      { error: 'provider and api_key are required' },
      { status: 400 }
    );
  }

  const service = new CredentialService(supabase);
  try {
    const credential = await service.saveCredential({
      workspaceId: workspaceId || '',
      userId: user.id,
      provider,
      rawApiKey: apiKey,
      targetScope: workspaceId ? 'workspace' : 'user',
    });
    return NextResponse.json({ credential }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}