/**
 * AmplificationRuntime — production persistence layer
 * DSRT Open Arena
 */

import { createAdminClient } from '@/lib/supabase/admin';
import type { ExecutionState } from './types';
import type { SupabaseClient } from '@supabase/supabase-js';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const STATUS_MAP: Record<string, string> = {
  CREATED: 'CREATED',
  VALIDATING: 'VALIDATING',
  UNDERSTANDING: 'UNDERSTANDING',
  PLANNING: 'PLANNING',
  PREPARING_CONTEXT: 'PREPARING_CONTEXT',
  RETRIEVING: 'RETRIEVING',
  STRATEGY_SELECTION: 'STRATEGY_SELECTION',
  INSTRUCTION_SYNTHESIS: 'INSTRUCTION_SYNTHESIS',
  MODEL_EXECUTION: 'MODEL_EXECUTION',
  TOOL_EXECUTION: 'TOOL_EXECUTION',
  REFINEMENT: 'REFINEMENT',
  VERIFICATION: 'VERIFICATION',
  EVALUATION: 'EVALUATION',
  EVALUATING: 'EVALUATING',
  OPTIMIZATION: 'OPTIMIZATION',
  STREAMING: 'STREAMING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  created: 'CREATED',
  pending: 'CREATED',
  running: 'MODEL_EXECUTION',
  completed: 'COMPLETED',
  failed: 'FAILED',
  cancelled: 'CANCELLED',
};

const ENGINE_ID_CANDIDATES: Record<string, string[]> = {
  E01: ['E01', 'e01-intent', 'e01', 'intent'],
  E02: ['E02', 'e02-planning', 'e02', 'planning'],
  E03: ['E03', 'e03-context', 'e03', 'context'],
  E04: ['E04', 'e04-retrieval', 'e04', 'retrieval'],
  E05: ['E05', 'e05-strategy', 'e05', 'strategy'],
  E06: ['E06', 'e06-instruction', 'e06', 'instruction'],
  E07: ['E07', 'e07-orchestration', 'e07', 'orchestration'],
  E08: ['E08', 'e08-tools', 'e08', 'tools'],
  E09: ['E09', 'e09-refinement', 'e09', 'refinement'],
  E10: ['E10', 'e10-verification', 'e10', 'verification'],
  E11: ['E11', 'e11-quality', 'e11', 'quality'],
  E12: ['E12', 'e12-cost', 'e12', 'cost'],
};

const ENGINE_NAME: Record<number, string> = {
  1: 'Intent',
  2: 'Planning',
  3: 'Context',
  4: 'Retrieval',
  5: 'Strategy',
  6: 'Instruction',
  7: 'Orchestration',
  8: 'Tools',
  9: 'Refinement',
  10: 'Verification',
  11: 'Quality',
  12: 'Cost',
};

const ENGINE_STATUS_SUCCESS_CANDIDATES = ['SUCCESS', 'success', 'completed', 'ok', 'PENDING'];
const ENGINE_STATUS_FAILED_CANDIDATES = ['FAILED', 'failed', 'error'];

export function isUuid(value: string | null | undefined): boolean {
  return typeof value === 'string' && UUID_RE.test(value.trim());
}

export function mapExecutionStatus(status: ExecutionState | string): string {
  const key = String(status || 'CREATED').trim();
  return STATUS_MAP[key] || STATUS_MAP[key.toUpperCase()] || 'CREATED';
}

export function resolveEngineIndex(engineId: string): number {
  const match = String(engineId || '').match(/(\d{1,2})/);
  if (!match) return 1;
  const n = parseInt(match[1], 10);
  if (!Number.isFinite(n)) return 1;
  return Math.min(12, Math.max(1, n));
}

function normalizeEngineKey(engineId: string): string {
  const raw = String(engineId || '').trim();
  const upper = raw.toUpperCase();
  if (/^E0?\d{1,2}$/i.test(raw)) {
    const n = parseInt(raw.replace(/\D/g, ''), 10);
    return `E${String(n).padStart(2, '0')}`;
  }
  if (ENGINE_ID_CANDIDATES[raw]) return raw;
  if (ENGINE_ID_CANDIDATES[upper]) return upper;
  return raw;
}

function engineIdCandidates(engineId: string): string[] {
  const key = normalizeEngineKey(engineId);
  const listed = ENGINE_ID_CANDIDATES[key] || ENGINE_ID_CANDIDATES[engineId] || [];
  const out = [engineId, key, ...listed].filter(Boolean);
  return Array.from(new Set(out));
}

export type InitializeExecutionInput = {
  conversationId: string;
  workspaceId: string;
  userId: string;
  mode?: 'work' | 'war' | 'chat';
  provider?: string;
  model?: string;
  userPrompt?: string;
  status?: ExecutionState | string;
};

export type FinalizeExecutionInput = {
  status: ExecutionState | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  rawResponse?: string | null;
  amplifiedResponse?: string | null;
  directScore?: number | null;
  amplifiedScore?: number | null;
  qualityDeltaPct?: number | null;
  winningSide?: string | null;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  providerCostUsd?: number;
  dsrtCostUsd?: number;
  latencyMs?: number;
  rawLatencyMs?: number | null;
  amplifiedLatencyMs?: number | null;
  rawProviderCostUsd?: number | null;
  amplifiedProviderCostUsd?: number | null;
  errorMessage?: string | null;
  evaluationJson?: unknown;
  metricsJson?: unknown;
  artifactsJson?: unknown;
  provider?: string;
  model?: string;
};

export type LogEngineRunInput = {
  executionId: string;
  engineId: string;
  engineName?: string;
  durationMs: number;
  promptTokens: number;
  completionTokens: number;
  status: 'SUCCESS' | 'FAILED' | 'success' | 'failed';
  outputSummary?: string;
  errorMessage?: string;
};

export type PersistMessageInput = {
  conversationId: string;
  workspaceId?: string;
  userId?: string | null;
  role: 'user' | 'assistant' | 'system';
  content: string;
  isAmplified?: boolean;
  provider?: string;
  model?: string;
  executionId?: string;
  tokenCountPrompt?: number;
  tokenCountCompletion?: number;
  providerCostUsd?: number;
  dsrtCostUsd?: number;
  latencyMs?: number;
};

export type CreateComparisonInput = {
  executionId: string;
  workspaceId: string;
  conversationId: string;
  userId: string;
  provider: string;
  model: string;
  userPrompt: string;
  directMessageId?: string | null;
  amplifiedMessageId?: string | null;
  directScore?: number | null;
  amplifiedScore?: number | null;
  qualityDeltaPct?: number | null;
  winningSide?: string | null;
  metricsJson?: unknown;
  evaluationJson?: unknown;
  rawUsageJson?: unknown;
  amplifiedUsageJson?: unknown;
  status?: string;
  errorMessage?: string | null;
};

function stripKeys(payload: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const next = { ...payload };
  for (const k of keys) delete next[k];
  return next;
}

export class AmplificationRuntime {
  private supabase: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.supabase = client ?? createAdminClient();
  }

  async initialize(input: InitializeExecutionInput): Promise<string> {
    if (!isUuid(input.conversationId)) {
      throw new Error(`initialize: conversationId must be a UUID (got "${input.conversationId}")`);
    }
    if (!isUuid(input.workspaceId)) {
      throw new Error(`initialize: workspaceId must be a UUID (got "${input.workspaceId}")`);
    }
    if (!isUuid(input.userId)) {
      throw new Error(`initialize: userId must be a UUID (got "${input.userId}")`);
    }

    const status = mapExecutionStatus(input.status || 'CREATED');
    const now = new Date().toISOString();
    const promptText = (input.userPrompt || '').trim() || '(empty prompt)';

    const fullPayload: Record<string, unknown> = {
      conversation_id: input.conversationId,
      workspace_id: input.workspaceId,
      user_id: input.userId,
      status,
      mode: input.mode || 'work',
      provider: input.provider ?? null,
      model: input.model ?? null,
      prompt: promptText,
      user_prompt: promptText,
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
      provider_cost_usd: 0,
      dsrt_cost_usd: 0,
      latency_ms: 0,
      updated_at: now,
    };

    const attempts: Array<Record<string, unknown>> = [
      fullPayload,
      stripKeys(fullPayload, [
        'mode',
        'user_prompt',
        'prompt_tokens',
        'completion_tokens',
        'total_tokens',
        'provider_cost_usd',
        'dsrt_cost_usd',
        'latency_ms',
      ]),
      {
        conversation_id: input.conversationId,
        workspace_id: input.workspaceId,
        user_id: input.userId,
        status,
        prompt: promptText,
        provider: input.provider ?? null,
        model: input.model ?? null,
      },
      {
        conversation_id: input.conversationId,
        workspace_id: input.workspaceId,
        user_id: input.userId,
        status,
        prompt: promptText,
      },
    ];

    let lastError: string | null = null;

    for (let i = 0; i < attempts.length; i++) {
      const payload = attempts[i];
      const { data, error } = await this.supabase
        .from('executions')
        .insert(payload)
        .select('id')
        .single();

      if (!error && data?.id && isUuid(String(data.id))) {
        return String(data.id);
      }

      lastError = error?.message || 'unknown insert error';
    }

    throw new Error(`executions insert failed: ${lastError}`);
  }

  async updateState(executionId: string, status: ExecutionState | string): Promise<void> {
    try {
      if (!isUuid(executionId)) return;
      const dbStatus = mapExecutionStatus(status);
      await this.supabase
        .from('executions')
        .update({ status: dbStatus, updated_at: new Date().toISOString() })
        .eq('id', executionId);
    } catch (err) {
      console.warn('[AmplificationRuntime.updateState] warning:', err);
    }
  }

  async logEngineRun(input: LogEngineRunInput): Promise<void> {
    try {
      if (!isUuid(input.executionId)) return;

      const engineIndex = resolveEngineIndex(input.engineId);
      const isFailed = String(input.status).toUpperCase() === 'FAILED';
      const statusCandidates = isFailed
        ? ENGINE_STATUS_FAILED_CANDIDATES
        : ENGINE_STATUS_SUCCESS_CANDIDATES;
      const idCandidates = engineIdCandidates(input.engineId);

      const base = {
        execution_id: input.executionId,
        engine_index: engineIndex,
        engine_name: input.engineName || ENGINE_NAME[engineIndex] || input.engineId,
        duration_ms: Math.max(0, Math.round(input.durationMs || 0)),
        tokens_prompt: Math.max(0, Math.round(input.promptTokens || 0)),
        tokens_completion: Math.max(0, Math.round(input.completionTokens || 0)),
        tokens_used: Math.max(
          0,
          Math.round((input.promptTokens || 0) + (input.completionTokens || 0))
        ),
        output_summary: input.outputSummary ?? null,
        error_message: input.errorMessage ?? null,
      };

      for (const engineIdValue of idCandidates) {
        for (const statusValue of statusCandidates) {
          const variants: Array<Record<string, unknown>> = [
            { ...base, engine_id: engineIdValue, status: statusValue },
            {
              execution_id: input.executionId,
              engine_id: engineIdValue,
              engine_index: engineIndex,
              status: statusValue,
              duration_ms: base.duration_ms,
              tokens_used: base.tokens_used,
            },
            {
              execution_id: input.executionId,
              engine_id: engineIdValue,
              engine_index: engineIndex,
              status: statusValue,
            },
          ];

          for (const payload of variants) {
            const { error } = await this.supabase.from('engine_runs').insert(payload);
            if (!error) return;
          }
        }
      }
    } catch (err) {
      console.warn('[AmplificationRuntime.logEngineRun] telemetry warning:', err);
    }
  }

  async finalize(executionId: string, input: FinalizeExecutionInput): Promise<void> {
    try {
      if (!isUuid(executionId)) return;

      const status = mapExecutionStatus(input.status);
      const now = new Date().toISOString();
      const promptTokens = Math.max(0, Math.round(input.promptTokens || 0));
      const completionTokens = Math.max(0, Math.round(input.completionTokens || 0));
      const totalTokens =
        input.totalTokens != null
          ? Math.max(0, Math.round(input.totalTokens))
          : promptTokens + completionTokens;

      const fullPayload: Record<string, unknown> = {
        status,
        updated_at: now,
        completed_at: status === 'COMPLETED' || status === 'FAILED' ? now : null,
        raw_response: input.rawResponse ?? null,
        amplified_response: input.amplifiedResponse ?? null,
        direct_score: input.directScore ?? null,
        amplified_score: input.amplifiedScore ?? null,
        quality_delta_pct: input.qualityDeltaPct ?? null,
        winning_side: input.winningSide ?? null,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: totalTokens,
        provider_cost_usd: Number(input.providerCostUsd || 0),
        dsrt_cost_usd: Number(input.dsrtCostUsd || 0),
        latency_ms: Math.max(0, Math.round(input.latencyMs || 0)),
        raw_latency_ms: input.rawLatencyMs ?? null,
        amplified_latency_ms: input.amplifiedLatencyMs ?? null,
        raw_provider_cost_usd: input.rawProviderCostUsd ?? null,
        amplified_provider_cost_usd: input.amplifiedProviderCostUsd ?? null,
        error_message: input.errorMessage ?? null,
        evaluation_json: input.evaluationJson ?? null,
        metrics_json: input.metricsJson ?? null,
        artifacts_json: input.artifactsJson ?? null,
      };

      if (input.provider) fullPayload.provider = input.provider;
      if (input.model) fullPayload.model = input.model;

      const { error } = await this.supabase
        .from('executions')
        .update(fullPayload)
        .eq('id', executionId);

      if (!error) return;

      const minimal: Record<string, unknown> = {
        status,
        updated_at: now,
        error_message: input.errorMessage ?? error.message,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        provider_cost_usd: Number(input.providerCostUsd || 0),
        dsrt_cost_usd: Number(input.dsrtCostUsd || 0),
        latency_ms: Math.max(0, Math.round(input.latencyMs || 0)),
      };

      if (input.rawResponse != null) minimal.raw_response = input.rawResponse;
      if (input.amplifiedResponse != null) minimal.amplified_response = input.amplifiedResponse;

      await this.supabase.from('executions').update(minimal).eq('id', executionId);
    } catch (err) {
      console.warn('[AmplificationRuntime.finalize] warning:', err);
    }
  }

  async persistMessage(input: PersistMessageInput): Promise<string | null> {
    try {
      if (!isUuid(input.conversationId)) return null;

      const fullPayload: Record<string, unknown> = {
        conversation_id: input.conversationId,
        role: input.role,
        content: input.content,
        is_amplified: Boolean(input.isAmplified),
        token_count_prompt: Math.max(0, Math.round(input.tokenCountPrompt || 0)),
        token_count_completion: Math.max(0, Math.round(input.tokenCountCompletion || 0)),
        provider_cost_usd: Number(input.providerCostUsd || 0),
        dsrt_cost_usd: Number(input.dsrtCostUsd || 0),
        latency_ms: Math.max(0, Math.round(input.latencyMs || 0)),
      };

      if (input.workspaceId && isUuid(input.workspaceId)) {
        fullPayload.workspace_id = input.workspaceId;
      }
      if (input.userId !== undefined) {
        fullPayload.user_id = input.userId;
      }
      if (input.provider) fullPayload.provider = input.provider;
      if (input.model) fullPayload.model = input.model;
      if (input.executionId && isUuid(input.executionId)) {
        fullPayload.execution_id = input.executionId;
      }

      const attempts = [
        fullPayload,
        stripKeys(fullPayload, ['workspace_id', 'execution_id', 'provider', 'model']),
        {
          conversation_id: input.conversationId,
          role: input.role,
          content: input.content,
          user_id: input.userId ?? null,
        },
      ];

      for (let i = 0; i < attempts.length; i++) {
        const { data, error } = await this.supabase
          .from('messages')
          .insert(attempts[i])
          .select('id')
          .single();

        if (!error && data?.id) return String(data.id);
      }
    } catch (err) {
      console.warn('[AmplificationRuntime.persistMessage] warning:', err);
    }

    return null;
  }

  async createComparison(input: CreateComparisonInput): Promise<string | null> {
    try {
      if (!isUuid(input.executionId)) return null;

      const now = new Date().toISOString();
      const promptText = input.userPrompt || '';

      const fullPayload: Record<string, unknown> = {
        execution_id: input.executionId,
        workspace_id: input.workspaceId,
        conversation_id: input.conversationId,
        user_id: input.userId,
        provider: input.provider,
        model: input.model,
        user_prompt: promptText,
        direct_message_id: input.directMessageId ?? null,
        amplified_message_id: input.amplifiedMessageId ?? null,
        direct_score: input.directScore ?? null,
        amplified_score: input.amplifiedScore ?? null,
        quality_delta_pct: input.qualityDeltaPct ?? null,
        winning_side: input.winningSide ?? null,
        metrics_json: input.metricsJson ?? null,
        evaluation_json: input.evaluationJson ?? null,
        raw_usage_json: input.rawUsageJson ?? null,
        amplified_usage_json: input.amplifiedUsageJson ?? null,
        status: input.status || 'completed',
        error_message: input.errorMessage ?? null,
        created_at: now,
        updated_at: now,
      };

      const attempts = [
        fullPayload,
        stripKeys(fullPayload, [
          'user_prompt',
          'metrics_json',
          'evaluation_json',
          'raw_usage_json',
          'amplified_usage_json',
          'error_message',
          'winning_side',
          'quality_delta_pct',
          'workspace_id',
          'conversation_id',
          'user_id',
          'provider',
          'model',
          'status',
          'created_at',
          'updated_at',
        ]),
        {
          execution_id: input.executionId,
          direct_message_id: input.directMessageId ?? null,
          amplified_message_id: input.amplifiedMessageId ?? null,
        },
        {
          execution_id: input.executionId,
        },
      ];

      for (let i = 0; i < attempts.length; i++) {
        const { data, error } = await this.supabase
          .from('comparison_experiments')
          .insert(attempts[i])
          .select('id')
          .single();

        if (!error && data?.id) return String(data.id);
      }
    } catch (err) {
      console.warn('[AmplificationRuntime.createComparison] warning:', err);
    }

    return null;
  }
}

export default AmplificationRuntime;