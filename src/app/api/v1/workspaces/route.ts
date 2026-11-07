import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('workspace_members')
    .select(
      `
      role,
      workspace:workspaces (
        id,
        name,
        slug,
        owner_id,
        plan,
        created_at,
        updated_at
      )
    `
    )
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const workspaces = (data || [])
    .map((row) => {
      const ws = row.workspace as unknown as Record<string, unknown> | Record<string, unknown>[] | null;
      const workspace = Array.isArray(ws) ? ws[0] : ws;
      if (!workspace) return null;
      return { ...workspace, role: row.role };
    })
    .filter(Boolean);

  return NextResponse.json({ workspaces });
}