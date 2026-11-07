import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { V3Provider } from '@/lib/v3/contracts/registry';
import { createAdapterRegistry } from '@/lib/v3/registry/adapters';
import { getDueProviders } from '@/lib/v3/registry/sync-scheduler';
import { syncAllDueProviders, syncProvider, type SyncEngineConfig } from '@/lib/v3/registry/sync-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; 

function adminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function generateLockHolder(source: string, requestId: string): string {
  return `${source}:${requestId}:${Date.now()}`;
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

async function authorize(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization') ?? '';
  
  if (cronSecret && authHeader.startsWith('Bearer ')) {
    if (constantTimeEqual(authHeader.slice(7), cronSecret)) return { ok: true };
  }

  const supabase = adminSupabase();
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!jwt) return { ok: false, status: 401, error: 'Missing Authorization token' };

  const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
  if (userErr || !userData.user) return { ok: false, status: 401, error: 'Invalid session' };

  const role = (userData.user.app_metadata as any)?.role;
  if (role !== 'admin') return { ok: false, status: 403, error: 'Admin role required' };
  return { ok: true };
}

/**
 * STRICT SYSTEM CREDENTIAL RESOLUTION.
 * Catalogue syncing is a global system operation. It MUST NEVER secretly borrow a random
 * workspace's API key if the system key is missing. If auth is required and no system key exists, 
 * the adapter will safely fail and the scheduler will skip until configured by sysadmin.
 */
async function resolveSystemCatalogueCredential(provider: V3Provider): Promise<string | null> {
  const envMap: Record<V3Provider, string | undefined> = {
    openai: process.env.OPENAI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
    google: process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY,
    deepseek: process.env.DEEPSEEK_API_KEY,
    groq: process.env.GROQ_API_KEY,
    mistral: process.env.MISTRAL_API_KEY,
    openrouter: process.env.OPENROUTER_API_KEY,
    xai: process.env.XAI_API_KEY,
    cohere: process.env.COHERE_API_KEY,
  };
  return envMap[provider] || null;
}

export async function POST(req: NextRequest) {
  const requestId = req.headers.get('x-request-id') ?? req.headers.get('x-vercel-id') ?? crypto.randomUUID();

  const auth = await authorize(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: { provider?: string } = {};
  try {
    const text = await req.text();
    if (text) body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const lockHolder = generateLockHolder('cron', requestId);
  const adapters = createAdapterRegistry();
  const supabase = adminSupabase();

  const config: SyncEngineConfig = {
    supabase,
    adapters,
    lockHolder,
    resolveApiKey: resolveSystemCatalogueCredential, 
  };

  try {
    if (body.provider) {
      const provider = body.provider as V3Provider;
      if (!adapters.has(provider)) {
        return NextResponse.json({ error: `Unknown provider: ${body.provider}` }, { status: 400 });
      }
      const result = await syncProvider(provider, config);
      return NextResponse.json({ requestId, mode: 'single', provider, result });
    }

    // Pass the supabase client exactly as the scheduler contract requires
    const due = await getDueProviders(supabase);
    // Explicitly pass the due array so syncAllDueProviders processes ONLY what is due
    const results = await syncAllDueProviders(config, due);
    
    return NextResponse.json({
      requestId,
      mode: 'due',
      dueCount: due.length,
      dueProviders: due.map((d) => d.provider),
      results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[v3/registry/sync] fatal', { requestId, message });
    return NextResponse.json({ requestId, error: 'Sync failed', detail: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}