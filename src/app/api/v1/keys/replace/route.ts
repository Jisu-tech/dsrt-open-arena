import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { replaceProviderCredential, testProviderKey } from '@/lib/auth/keyManager';
import type { ProviderType } from '@/lib/providers/registry';

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: {
    provider?: ProviderType;
    apiKey?: string;
    alias?: string;
    workspaceId?: string;
    testOnly?: boolean;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { provider, apiKey, alias, workspaceId, testOnly } = body;

  if (!provider || !apiKey) {
    return NextResponse.json(
      { error: 'provider and apiKey are required' },
      { status: 400 }
    );
  }

  if (testOnly) {
    const testResult = await testProviderKey(provider, apiKey);
    return NextResponse.json(testResult);
  }

  const result = await replaceProviderCredential({
    userId: user.id,
    workspaceId: workspaceId || '',
    provider,
    rawApiKey: apiKey,
    alias,
    supabase,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true, credential: result });
}