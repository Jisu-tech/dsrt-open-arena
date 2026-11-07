/**
 * GET /api/v3/tasks/:id/metrics
 * Returns decision trail + invocations + cost rollup for one task.
 * Auth: authenticated workspace member.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function userClient(jwt: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: taskId } = await ctx.params;
  const auth = req.headers.get('authorization') ?? '';
  if (!auth.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const jwt = auth.slice(7);
  const supabase = userClient(jwt);

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }

  // Task
  const { data: task, error: taskErr } = await supabase
    .from('v3_tasks')
    .select('*')
    .eq('id', taskId)
    .maybeSingle();

  if (taskErr) {
    return NextResponse.json({ error: taskErr.message }, { status: 500 });
  }
  if (!task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  // Decisions (explainability)
  const { data: decisions, error: decErr } = await supabase
    .from('v3_ptis_decisions')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true });

  if (decErr) {
    return NextResponse.json({ error: decErr.message }, { status: 500 });
  }

  // Invocations (measurement)
  const { data: invocations, error: invErr } = await supabase
    .from('v3_invocations')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true });

  if (invErr) {
    return NextResponse.json({ error: invErr.message }, { status: 500 });
  }

  // Cost rollup — string-safe sum of non-null costs only
  let totalCostUsd: string | null = null;
  let measuredInvocations = 0;
  let unmeasuredInvocations = 0;
  let acc = 0;
  let any = false;

  for (const inv of invocations ?? []) {
    if (inv.cost_usd != null && inv.cost_usd !== '') {
      const n = parseFloat(String(inv.cost_usd));
      if (Number.isFinite(n)) {
        acc += n;
        any = true;
        measuredInvocations += 1;
      } else {
        unmeasuredInvocations += 1;
      }
    } else {
      unmeasuredInvocations += 1;
    }
  }
  if (any) totalCostUsd = acc.toFixed(8);

  return NextResponse.json({
    task,
    decisions: decisions ?? [],
    invocations: invocations ?? [],
    rollup: {
      totalCostUsd,
      measuredInvocations,
      unmeasuredInvocations,
      // Explicit: null total means "not fully measured", NOT zero
      fullyMeasured: unmeasuredInvocations === 0 && (invocations?.length ?? 0) > 0,
    },
  });
}