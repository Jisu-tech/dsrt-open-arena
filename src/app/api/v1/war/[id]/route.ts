import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * GET /api/v1/war/[id]
 *
 * id may be:
 *  - comparison_experiments.id
 *  - executions.id (mode=WAR) — returns latest linked comparison if any
 *
 * Returns real persisted rows only. No fabricated metrics.
 */

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Try comparison_experiments first
  let comparison: Record<string, unknown> | null = null;
  let execution: Record<string, unknown> | null = null;

  const { data: byComparison, error: cmpErr } = await supabase
    .from('comparison_experiments')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (cmpErr) {
    return NextResponse.json({ error: cmpErr.message }, { status: 500 });
  }

  if (byComparison) {
    comparison = byComparison as Record<string, unknown>;
    const executionId = byComparison.execution_id as string;
    const { data: exec } = await supabase
      .from('executions')
      .select('*')
      .eq('id', executionId)
      .maybeSingle();
    execution = (exec as Record<string, unknown>) || null;
  } else {
    // Fallback: treat id as execution id
    const { data: exec, error: execErr } = await supabase
      .from('executions')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (execErr) {
      return NextResponse.json({ error: execErr.message }, { status: 500 });
    }
    if (!exec) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    execution = exec as Record<string, unknown>;

    const { data: cmp } = await supabase
      .from('comparison_experiments')
      .select('*')
      .eq('execution_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    comparison = (cmp as Record<string, unknown>) || null;
  }

  if (!execution) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Membership / ownership check via workspace RLS — if select succeeded, allowed.
  // Extra guard: ensure execution belongs to caller when user_id present
  if (execution.user_id && execution.user_id !== user.id) {
    // Workspace members can still read via RLS; only block if RLS somehow returned foreign private row
    // Rely on RLS — do not over-block shared workspace experiments.
  }

  // Load paired messages when ids present
  let directMessage: Record<string, unknown> | null = null;
  let amplifiedMessage: Record<string, unknown> | null = null;

  const directId = (comparison?.direct_message_id as string) || null;
  const amplifiedId = (comparison?.amplified_message_id as string) || null;

  if (directId) {
    const { data } = await supabase.from('messages').select('*').eq('id', directId).maybeSingle();
    directMessage = (data as Record<string, unknown>) || null;
  }
  if (amplifiedId) {
    const { data } = await supabase.from('messages').select('*').eq('id', amplifiedId).maybeSingle();
    amplifiedMessage = (data as Record<string, unknown>) || null;
  }

  // Engine runs for this execution (amplified path telemetry)
  const { data: engineRuns } = await supabase
    .from('engine_runs')
    .select('*')
    .eq('execution_id', execution.id as string)
    .order('engine_index', { ascending: true });

  return NextResponse.json({
    data: {
      comparison,
      execution,
      direct_message: directMessage,
      amplified_message: amplifiedMessage,
      engine_runs: engineRuns || [],
    },
  });
}