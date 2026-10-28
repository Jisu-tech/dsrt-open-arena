import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { encryptCredential, createKeyMask } from '@/lib/security/encryption';
import { validateProviderKey } from '@/lib/providers/validator';
import { ProviderType } from '@/lib/providers/registry';

// GET /api/v1/credentials - List masked credentials for active workspace
export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get('workspace_id');

  if (!workspaceId) {
    return NextResponse.json({ error: 'workspace_id is required' }, { status: 400 });
  }

  const { data: credentials, error } = await supabase
    .from('provider_credentials')
    .select('id, workspace_id, provider, key_mask, status, last_validated_at, total_cost_usd, created_at')
    .eq('workspace_id', workspaceId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ credentials });
}

// POST /api/v1/credentials - Validate, Encrypt & Save new API key
export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { workspace_id, provider, api_key } = body as {
      workspace_id: string;
      provider: ProviderType;
      api_key: string;
    };

    if (!workspace_id || !provider || !api_key) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Live API Key Validation
    const validation = await validateProviderKey(provider, api_key);
    if (!validation.valid) {
      return NextResponse.json({
        error: `Provider Validation Failed: ${validation.message}`
      }, { status: 422 });
    }

    // 2. Encrypt Key & Generate Mask
    const encrypted_api_key = encryptCredential(api_key);
    const key_mask = createKeyMask(api_key);

    // 3. Upsert into database
    const { data, error } = await supabase
      .from('provider_credentials')
      .upsert({
        workspace_id,
        provider,
        key_mask,
        encrypted_api_key,
        status: 'ACTIVE',
        last_validated_at: new Date().toISOString(),
      }, { onConflict: 'workspace_id,provider' })
      .select('id, workspace_id, provider, key_mask, status, last_validated_at, created_at')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ credential: data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}