/**
 * DSRT Open Arena V3 — Model Invocation Contracts
 * 
 * A ModelInvocation represents a single call to a model provider. This is the
 * fundamental unit of measurement in V3. Every token consumed, every dollar spent,
 * every millisecond of latency is recorded at the invocation level.
 * 
 * Multiple invocations may be made per task (primary + amplification).
 * Each invocation has exactly one purpose, one model, one provider, one outcome.
 * 
 * @module v3/contracts/invocation
 */

import type {
  InvocationId,
  TaskId,
  WorkspaceId,
  PTISDecisionId,
  BudgetReservationId,
  ExecutionStepId,
} from './identifiers';
import type {
  ISOTimestamp,
  DurationMs,
  AuditFields,
  MonetaryValue,
} from './metadata';
import {
  V3Provider,
  InvocationPurpose,
  InvocationOutcome,
  UsageMeasurementSource,
  CostMeasurementSource,
  Currency,
} from './enums';

// ─────────────────────────────────────────────
// Model Invocation
// ─────────────────────────────────────────────

/**
 * A single model invocation — the atomic unit of AI expenditure in V3.
 */
export interface V3ModelInvocation extends AuditFields {
  readonly id: InvocationId;
  readonly taskId: TaskId;
  readonly workspaceId: WorkspaceId;

  /** Which execution step triggered this invocation. null for direct/simple tasks. */
  readonly executionStepId: ExecutionStepId | null;

  /** Why this invocation was made. */
  readonly purpose: InvocationPurpose;

  /** Sequence number within the task (0-indexed, ordered by start time). */
  readonly sequence: number;

  // ── Provider & Model ──

  /** The provider that handled this invocation. */
  readonly provider: V3Provider;

  /** The model identifier as known to the provider. */
  readonly modelId: string;

  /** The model identifier as resolved from the V3 provider registry. */
  readonly registryModelId: string | null;

  // ── Authorization ──

  /** PTIS decision that authorized this invocation. null if PTIS not yet active. */
  readonly ptisDecisionId: PTISDecisionId | null;

  /** Budget reservation consumed by this invocation. null if no reservation was made. */
  readonly budgetReservationId: BudgetReservationId | null;

  // ── Request Details ──

  /** Request parameters sent to the provider (temperature, max_tokens, etc). */
  readonly requestParams: InvocationRequestParams;

  // ── Response & Usage ──

  /** What happened. */
  readonly outcome: InvocationOutcome;

  /** Token usage from this invocation. */
  readonly usage: ModelUsage;

  /** Calculated cost of this invocation. */
  readonly cost: InvocationCost;

  // ── Timing ──

  /** When the request was sent to the provider. */
  readonly startedAt: ISOTimestamp;

  /** When the response was fully received. null if still in progress or failed before response. */
  readonly completedAt: ISOTimestamp | null;

  /** Total round-trip latency. null if not completed. */
  readonly latencyMs: DurationMs | null;

  /** Time to first token for streaming responses. null if not streaming or not measured. */
  readonly timeToFirstTokenMs: DurationMs | null;

  // ── Error ──

  /** Error details if outcome is not SUCCESS. */
  readonly error: InvocationError | null;

  /** Raw provider response metadata (model version, finish reason, etc). */
  readonly providerMetadata: Record<string, unknown> | null;
}

// ─────────────────────────────────────────────
// Request Parameters
// ─────────────────────────────────────────────

/**
 * Parameters sent with the invocation request.
 * All fields optional because different providers/models support different params.
 */
export interface InvocationRequestParams {
  readonly temperature: number | null;
  readonly maxTokens: number | null;
  readonly topP: number | null;
  readonly frequencyPenalty: number | null;
  readonly presencePenalty: number | null;
  readonly stopSequences: readonly string[] | null;
  readonly systemPrompt: string | null;
  /** Whether streaming was requested for this invocation. */
  readonly stream: boolean;
  /** Additional provider-specific parameters. */
  readonly extra: Record<string, unknown> | null;
}

// ─────────────────────────────────────────────
// Token Usage
// ─────────────────────────────────────────────

/**
 * Token usage from a single model invocation.
 * 
 * Critical rules:
 * - null means "not measured / unavailable"
 * - 0 means "measured as zero"
 * - Never conflate null and 0
 * - measurementSource MUST be set on every instance
 * - rawProviderUsage preserves the exact provider response for debugging
 */
export interface ModelUsage {
  /** Number of input/prompt tokens. */
  readonly inputTokens: number | null;

  /** Number of output/completion tokens. */
  readonly outputTokens: number | null;

  /** Number of reasoning tokens (for models that report them, e.g., o1, o3). */
  readonly reasoningTokens: number | null;

  /** Number of cached input tokens (for providers that support prompt caching). */
  readonly cachedInputTokens: number | null;

  /** Total tokens (may not equal sum of parts if provider reports a separate total). */
  readonly totalTokens: number | null;

  /** How these token counts were determined. */
  readonly measurementSource: UsageMeasurementSource;

  /** Raw usage object from the provider response, preserved verbatim. */
  readonly rawProviderUsage: Record<string, unknown> | null;
}

// ─────────────────────────────────────────────
// Cost
// ─────────────────────────────────────────────

/**
 * Cost breakdown for a single model invocation.
 * All values are decimal-safe strings.
 * 
 * Rules:
 * - null means "cost could not be determined"
 * - "0" or "0.000000" means "calculated as zero cost"
 * - measurementSource MUST be set on every instance
 */
export interface InvocationCost {
  /** Cost for input tokens. */
  readonly inputCost: MonetaryValue | null;

  /** Cost for output tokens. */
  readonly outputCost: MonetaryValue | null;

  /** Cost for reasoning tokens. */
  readonly reasoningCost: MonetaryValue | null;

  /** Cost for cached input tokens (typically discounted). */
  readonly cachedInputCost: MonetaryValue | null;

  /** Total cost of this invocation. */
  readonly totalCost: MonetaryValue;

  /** Currency. */
  readonly currency: Currency;

  /** Version of pricing data used for calculation. */
  readonly pricingVersion: string | null;

  /** How this cost was determined. */
  readonly measurementSource: CostMeasurementSource;
}

// ─────────────────────────────────────────────
// Invocation Error
// ─────────────────────────────────────────────

/**
 * Error details for failed invocations.
 */
export interface InvocationError {
  /** Provider-reported error code. */
  readonly code: string | null;

  /** Human-readable error message. */
  readonly message: string;

  /** HTTP status code from the provider, if applicable. */
  readonly httpStatus: number | null;

  /** Whether this error is retryable. */
  readonly retryable: boolean;

  /** Number of retry attempts made before this final error. */
  readonly retryAttempts: number;
}

// ─────────────────────────────────────────────
// Creation Input
// ─────────────────────────────────────────────

/**
 * Input required to start recording a model invocation.
 * Outcome, usage, and cost are recorded upon completion.
 */
export interface StartInvocationInput {
  readonly taskId: TaskId;
  readonly workspaceId: WorkspaceId;
  readonly executionStepId?: ExecutionStepId;
  readonly purpose: InvocationPurpose;
  readonly sequence: number;
  readonly provider: V3Provider;
  readonly modelId: string;
  readonly registryModelId?: string;
  readonly ptisDecisionId?: PTISDecisionId;
  readonly budgetReservationId?: BudgetReservationId;
  readonly requestParams: InvocationRequestParams;
}

/**
 * Input to complete a model invocation with results.
 */
export interface CompleteInvocationInput {
  readonly invocationId: InvocationId;
  readonly outcome: InvocationOutcome;
  readonly usage: ModelUsage;
  readonly cost: InvocationCost;
  readonly completedAt: ISOTimestamp;
  readonly latencyMs: DurationMs;
  readonly timeToFirstTokenMs?: DurationMs;
  readonly error?: InvocationError;
  readonly providerMetadata?: Record<string, unknown>;
}

// ─────────────────────────────────────────────
// Default Factories
// ─────────────────────────────────────────────

/**
 * Creates a ModelUsage with all values unavailable.
 * Used when provider does not report usage data.
 */
export function createUnavailableUsage(): ModelUsage {
  return {
    inputTokens: null,
    outputTokens: null,
    reasoningTokens: null,
    cachedInputTokens: null,
    totalTokens: null,
    measurementSource: UsageMeasurementSource.UNAVAILABLE,
    rawProviderUsage: null,
  };
}

/**
 * Creates an InvocationCost marked as unavailable.
 * Used when cost cannot be determined (no pricing data, no usage data).
 */
export function createUnavailableCost(): InvocationCost {
  return {
    inputCost: null,
    outputCost: null,
    reasoningCost: null,
    cachedInputCost: null,
    totalCost: '0',
    currency: Currency.USD,
    pricingVersion: null,
    measurementSource: CostMeasurementSource.UNAVAILABLE,
  };
}

/**
 * Creates default request parameters.
 */
export function createDefaultRequestParams(
  overrides?: Partial<InvocationRequestParams>,
): InvocationRequestParams {
  return {
    temperature: null,
    maxTokens: null,
    topP: null,
    frequencyPenalty: null,
    presencePenalty: null,
    stopSequences: null,
    systemPrompt: null,
    stream: false,
    extra: null,
    ...overrides,
  };
}