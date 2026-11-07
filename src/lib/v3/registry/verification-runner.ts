/**
 * DSRT Open Arena V3 — Verification Runner (NEW)
 * 
 * Actually executes verification tests against provider APIs.
 * Records results in v3_model_verification_records.
 * 
 * A verification test makes a minimal real API call using workspace credentials
 * and records the outcome. This is the ONLY authoritative signal for whether
 * a workspace can actually use a given model.
 * 
 * @module v3/registry/verification-runner
 */

import { createAdminClient } from '@/lib/supabase/admin';
import type { V3Provider } from '../contracts/enums';
import type { WorkspaceId, UserId, ProviderRegistryEntryId } from '../contracts/identifiers';
import type { VerificationType, VerificationErrorCategory } from '../contracts/registry';

// ─────────────────────────────────────────────
// Verification request + result
// ─────────────────────────────────────────────

export interface VerificationRequest {
  readonly modelEntryId: ProviderRegistryEntryId;
  readonly workspaceId: WorkspaceId | null;
  readonly userId: UserId | null;
  readonly provider: V3Provider;
  readonly providerModelId: string;
  readonly apiKey: string;
  readonly verificationType: VerificationType;
  /** Minimal probe payload — defaults to "ping" prompt. */
  readonly probePrompt?: string;
  readonly timeoutMs?: number;
}

export interface VerificationOutcome {
  readonly success: boolean;
  readonly httpStatus: number | null;
  readonly errorCode: string | null;
  readonly errorMessage: string | null;
  readonly errorCategory: VerificationErrorCategory | null;
  readonly responseTimeMs: number;
  readonly testInputTokens: number | null;
  readonly testOutputTokens: number | null;
  readonly verificationRecordId: string | null;
}

// ─────────────────────────────────────────────
// Minimal provider probe
// ─────────────────────────────────────────────

/**
 * Perform a verification probe against a provider.
 * This uses a minimal payload — enough to prove the model responds.
 * 
 * Each provider's probe logic is encapsulated here. Gateway-based probing
 * is intentionally avoided to keep verification independent of gateway state.
 */
export async function runVerification(req: VerificationRequest): Promise<VerificationOutcome> {
  const startTime = Date.now();
  const probePrompt = req.probePrompt ?? 'ping';
  const timeoutMs = req.timeoutMs ?? 20_000;

  try {
    const probeResult = await probeProvider(req, probePrompt, timeoutMs);
    const responseTimeMs = Date.now() - startTime;

    const outcome: Omit<VerificationOutcome, 'verificationRecordId'> = {
      success: probeResult.success,
      httpStatus: probeResult.httpStatus,
      errorCode: probeResult.errorCode,
      errorMessage: probeResult.errorMessage,
      errorCategory: probeResult.errorCategory,
      responseTimeMs,
      testInputTokens: probeResult.inputTokens,
      testOutputTokens: probeResult.outputTokens,
    };

    const recordId = await recordVerification(req, outcome);
    return { ...outcome, verificationRecordId: recordId };
  } catch (unexpected) {
    const responseTimeMs = Date.now() - startTime;
    const outcome: Omit<VerificationOutcome, 'verificationRecordId'> = {
      success: false,
      httpStatus: null,
      errorCode: 'UNEXPECTED_ERROR',
      errorMessage: unexpected instanceof Error ? unexpected.message : String(unexpected),
      errorCategory: 'unknown' as VerificationErrorCategory,
      responseTimeMs,
      testInputTokens: null,
      testOutputTokens: null,
    };
    const recordId = await recordVerification(req, outcome);
    return { ...outcome, verificationRecordId: recordId };
  }
}

// ─────────────────────────────────────────────
// Provider-specific probes
// ─────────────────────────────────────────────

interface ProbeResult {
  readonly success: boolean;
  readonly httpStatus: number | null;
  readonly errorCode: string | null;
  readonly errorMessage: string | null;
  readonly errorCategory: VerificationErrorCategory | null;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
}

async function probeProvider(
  req: VerificationRequest,
  prompt: string,
  timeoutMs: number,
): Promise<ProbeResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    switch (req.provider) {
      case 'openai':
      case 'groq':
      case 'deepseek':
      case 'xai':
      case 'openrouter':
      case 'mistral':
        return await probeOpenAICompatible(req, prompt, controller.signal);
      case 'anthropic':
        return await probeAnthropic(req, prompt, controller.signal);
      case 'google':
        return await probeGoogle(req, prompt, controller.signal);
      case 'cohere':
        return await probeCohere(req, prompt, controller.signal);
      default:
        return {
          success: false,
          httpStatus: null,
          errorCode: 'UNSUPPORTED_PROVIDER',
          errorMessage: `No verification probe implemented for ${req.provider}`,
          errorCategory: 'unknown' as VerificationErrorCategory,
          inputTokens: null,
          outputTokens: null,
        };
    }
  } finally {
    clearTimeout(timer);
  }
}

async function probeOpenAICompatible(
  req: VerificationRequest,
  prompt: string,
  signal: AbortSignal,
): Promise<ProbeResult> {
  const baseUrls: Record<string, string> = {
    openai: 'https://api.openai.com/v1',
    groq: 'https://api.groq.com/openai/v1',
    deepseek: 'https://api.deepseek.com',
    xai: 'https://api.x.ai/v1',
    openrouter: 'https://openrouter.ai/api/v1',
    mistral: 'https://api.mistral.ai/v1',
  };
  const url = `${baseUrls[req.provider]}/chat/completions`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${req.apiKey}`,
    },
    body: JSON.stringify({
      model: req.providerModelId,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 5,
      temperature: 0,
    }),
    signal,
  });

  return parseOpenAICompatibleResponse(response);
}

async function parseOpenAICompatibleResponse(response: Response): Promise<ProbeResult> {
  if (response.ok) {
    const body = await response.json() as {
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    return {
      success: true,
      httpStatus: response.status,
      errorCode: null,
      errorMessage: null,
      errorCategory: null,
      inputTokens: body.usage?.prompt_tokens ?? null,
      outputTokens: body.usage?.completion_tokens ?? null,
    };
  }

  const errorText = await response.text();
  return {
    success: false,
    httpStatus: response.status,
    errorCode: `HTTP_${response.status}`,
    errorMessage: errorText.slice(0, 500),
    errorCategory: classifyHttpStatus(response.status),
    inputTokens: null,
    outputTokens: null,
  };
}

async function probeAnthropic(
  req: VerificationRequest,
  prompt: string,
  signal: AbortSignal,
): Promise<ProbeResult> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': req.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: req.providerModelId,
      max_tokens: 5,
      messages: [{ role: 'user', content: prompt }],
    }),
    signal,
  });

  if (response.ok) {
    const body = await response.json() as {
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    return {
      success: true,
      httpStatus: response.status,
      errorCode: null,
      errorMessage: null,
      errorCategory: null,
      inputTokens: body.usage?.input_tokens ?? null,
      outputTokens: body.usage?.output_tokens ?? null,
    };
  }

  const errorText = await response.text();
  return {
    success: false,
    httpStatus: response.status,
    errorCode: `HTTP_${response.status}`,
    errorMessage: errorText.slice(0, 500),
    errorCategory: classifyHttpStatus(response.status),
    inputTokens: null,
    outputTokens: null,
  };
}

async function probeGoogle(
  req: VerificationRequest,
  prompt: string,
  signal: AbortSignal,
): Promise<ProbeResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${req.providerModelId}:generateContent?key=${req.apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 5 },
    }),
    signal,
  });

  if (response.ok) {
    const body = await response.json() as {
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    };
    return {
      success: true,
      httpStatus: response.status,
      errorCode: null,
      errorMessage: null,
      errorCategory: null,
      inputTokens: body.usageMetadata?.promptTokenCount ?? null,
      outputTokens: body.usageMetadata?.candidatesTokenCount ?? null,
    };
  }

  const errorText = await response.text();
  return {
    success: false,
    httpStatus: response.status,
    errorCode: `HTTP_${response.status}`,
    errorMessage: errorText.slice(0, 500),
    errorCategory: classifyHttpStatus(response.status),
    inputTokens: null,
    outputTokens: null,
  };
}

async function probeCohere(
  req: VerificationRequest,
  prompt: string,
  signal: AbortSignal,
): Promise<ProbeResult> {
  const response = await fetch('https://api.cohere.com/v2/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${req.apiKey}`,
    },
    body: JSON.stringify({
      model: req.providerModelId,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 5,
    }),
    signal,
  });

  if (response.ok) {
    const body = await response.json() as {
      usage?: { tokens?: { input_tokens?: number; output_tokens?: number } };
    };
    return {
      success: true,
      httpStatus: response.status,
      errorCode: null,
      errorMessage: null,
      errorCategory: null,
      inputTokens: body.usage?.tokens?.input_tokens ?? null,
      outputTokens: body.usage?.tokens?.output_tokens ?? null,
    };
  }

  const errorText = await response.text();
  return {
    success: false,
    httpStatus: response.status,
    errorCode: `HTTP_${response.status}`,
    errorMessage: errorText.slice(0, 500),
    errorCategory: classifyHttpStatus(response.status),
    inputTokens: null,
    outputTokens: null,
  };
}

// ─────────────────────────────────────────────
// HTTP status classification
// ─────────────────────────────────────────────

function classifyHttpStatus(status: number): VerificationErrorCategory {
  if (status === 401) return 'authentication';
  if (status === 403) return 'authorization';
  if (status === 404) return 'model_not_found';
  if (status === 429) return 'rate_limit';
  if (status === 402) return 'quota_exceeded';
  if (status >= 400 && status < 500) return 'invalid_request';
  if (status >= 500) return 'provider_error';
  return 'unknown';
}

// ─────────────────────────────────────────────
// Record verification outcome
// ─────────────────────────────────────────────

async function recordVerification(
  req: VerificationRequest,
  outcome: Omit<VerificationOutcome, 'verificationRecordId'>,
): Promise<string | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('v3_model_verification_records')
    .insert({
      model_entry_id: req.modelEntryId,
      workspace_id: req.workspaceId,
      user_id: req.userId,
      provider: req.provider,
      provider_model_id: req.providerModelId,
      success: outcome.success,
      http_status: outcome.httpStatus,
      error_code: outcome.errorCode,
      error_message: outcome.errorMessage,
      error_category: outcome.errorCategory,
      response_time_ms: outcome.responseTimeMs,
      test_input_tokens: outcome.testInputTokens,
      test_output_tokens: outcome.testOutputTokens,
      test_cost: null, // Cost is not calculated here; too small to matter
      verification_type: req.verificationType,
      verified_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('[v3-verification] Failed to record verification:', error?.message);
    return null;
  }

  return data.id as string;
}