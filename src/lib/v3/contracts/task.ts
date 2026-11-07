/**
 * DSRT Open Arena V3 — Task Contract
 * 
 * A Task is the top-level unit of work in V3. It represents a single user request
 * from receipt to completion, including all amplification, invocations, evaluations,
 * and cost accounting.
 * 
 * @module v3/contracts/task
 */

import type {
  TaskId,
  ConversationId,
  UserId,
  WorkspaceId,
  LegacyExecutionId,
} from './identifiers';
import type {
  ISOTimestamp,
  DurationMs,
  AuditFields,
  MonetaryValue,
  Versioned,
} from './metadata';
import {
  TaskState,
  ComplexityClass,
  RiskLevel,
  ExecutionStrategy,
  UserMode,
  CostMeasurementSource,
} from './enums';

// ─────────────────────────────────────────────
// Core Task Contract
// ─────────────────────────────────────────────

/**
 * Canonical V3 Task entity.
 */
export interface V3Task extends AuditFields, Versioned {
  readonly id: TaskId;
  readonly workspaceId: WorkspaceId;
  readonly userId: UserId;
  readonly conversationId: ConversationId;

  /** The user's original request text, preserved verbatim. */
  readonly userMessage: string;

  /** Current state in the task lifecycle. */
  readonly state: TaskState;

  /** User-selected mode. Determines UI and comparison behavior. */
  readonly mode: UserMode;

  /** Classification results — null until understanding phase completes. */
  readonly classification: TaskClassification | null;

  /** Amplification flags — what was requested, enabled, and applied. */
  readonly amplification: AmplificationFlags;

  /** Selected execution strategy — null until planning phase completes. */
  readonly strategy: ExecutionStrategy | null;

  /** Aggregate cost summary — updated as invocations complete. */
  readonly costSummary: TaskCostSummary;

  /** Timing information. */
  readonly timing: TaskTiming;

  /** Model used for primary generation (the user-facing response). */
  readonly primaryModelId: string | null;

  /** Provider used for primary generation. */
  readonly primaryProvider: string | null;

  /** Number of model invocations made for this task. */
  readonly invocationCount: number;

  /** Dual-write lineage — links to legacy V2 execution if applicable. */
  readonly legacyExecutionId: LegacyExecutionId | null;

  /** Optional structured metadata — for future extensibility. */
  readonly metadata: Record<string, unknown> | null;
}

// ─────────────────────────────────────────────
// Task Classification
// ─────────────────────────────────────────────

/**
 * Results of the understanding/classification phase.
 * Drives strategy selection and budget allocation.
 */
export interface TaskClassification {
  /** Assessed complexity class (0–4). */
  readonly complexityClass: ComplexityClass;

  /** Assessed risk level. */
  readonly riskLevel: RiskLevel;

  /** Whether classification was performed by a model or deterministic heuristics. */
  readonly classifiedBy: 'deterministic' | 'model_assisted';

  /** The model used for classification, if model_assisted. */
  readonly classificationModelId: string | null;

  /** Confidence score 0.0–1.0. null if deterministic (deterministic = implicit 1.0). */
  readonly confidence: number | null;

  /** Free-form classification rationale for observability. */
  readonly rationale: string | null;

  /** When classification was performed. */
  readonly classifiedAt: ISOTimestamp;
}

// ─────────────────────────────────────────────
// Amplification Flags
// ─────────────────────────────────────────────

/**
 * Three-state amplification tracking per Doc 04.
 * A task can have requested: true, enabled: true, applied: false
 * when direct execution suffices (e.g., Class 0 complexity).
 */
export interface AmplificationFlags {
  /** User explicitly requested amplification (or workspace default is on). */
  readonly requested: boolean;

  /** System determined amplification is permitted for this task. */
  readonly enabled: boolean;

  /** Amplification transformations were actually performed. */
  readonly applied: boolean;
}

// ─────────────────────────────────────────────
// Task Cost Summary
// ─────────────────────────────────────────────

/**
 * Aggregate cost information for the entire task.
 * Updated incrementally as each invocation completes.
 * All monetary values are decimal-safe strings.
 */
export interface TaskCostSummary {
  /** Total cost of all model invocations for this task. */
  readonly totalCost: MonetaryValue;

  /** Cost of the primary user-facing generation only. */
  readonly primaryGenerationCost: MonetaryValue;

  /** Cost of amplification/intelligence invocations (everything except primary). */
  readonly amplificationCost: MonetaryValue;

  /** Currency code. */
  readonly currency: string;

  /** How the cost was determined. */
  readonly measurementSource: CostMeasurementSource;

  /** Total input tokens across all invocations. null if any invocation is unmeasured. */
  readonly totalInputTokens: number | null;

  /** Total output tokens across all invocations. null if any invocation is unmeasured. */
  readonly totalOutputTokens: number | null;

  /** Total reasoning tokens across all invocations (for reasoning models). null if unavailable. */
  readonly totalReasoningTokens: number | null;
}

// ─────────────────────────────────────────────
// Task Timing
// ─────────────────────────────────────────────

/**
 * Timing breakdown for the task lifecycle.
 */
export interface TaskTiming {
  /** When the task was received by the system. */
  readonly receivedAt: ISOTimestamp;

  /** When the first model invocation started. null if no invocations yet. */
  readonly firstInvocationAt: ISOTimestamp | null;

  /** When the last model invocation completed. null if not yet completed. */
  readonly lastInvocationAt: ISOTimestamp | null;

  /** When the task reached a terminal state. null if still in progress. */
  readonly completedAt: ISOTimestamp | null;

  /** Total end-to-end duration in milliseconds. null if not yet completed. */
  readonly totalDurationMs: DurationMs | null;

  /** Time spent waiting for model responses (sum of invocation latencies). */
  readonly modelLatencyMs: DurationMs | null;

  /** Time spent in DSRT processing (total - model latency). */
  readonly dsrtOverheadMs: DurationMs | null;
}

// ─────────────────────────────────────────────
// Task Creation Input
// ─────────────────────────────────────────────

/**
 * Input required to create a new V3 Task.
 * Used by the task controller in Subphase 1.6.
 */
export interface CreateTaskInput {
  readonly workspaceId: WorkspaceId;
  readonly userId: UserId;
  readonly conversationId: ConversationId;
  readonly userMessage: string;
  readonly mode: UserMode;
  readonly amplificationRequested: boolean;
  readonly primaryModelId: string | null;
  readonly primaryProvider: string | null;
  readonly legacyExecutionId?: LegacyExecutionId;
  readonly metadata?: Record<string, unknown>;
}

// ─────────────────────────────────────────────
// Task State Transition
// ─────────────────────────────────────────────

/**
 * Records a state transition event for a task.
 * Every state change is recorded for auditability — state is never silently mutated.
 */
export interface TaskStateTransition {
  readonly taskId: TaskId;
  readonly fromState: TaskState;
  readonly toState: TaskState;
  readonly reason: string;
  readonly triggeredBy: 'system' | 'user' | 'error' | 'timeout';
  readonly transitionedAt: ISOTimestamp;
  readonly metadata: Record<string, unknown> | null;
}

// ─────────────────────────────────────────────
// Default Factory
// ─────────────────────────────────────────────

/**
 * Creates a new task cost summary with zero values.
 * Zero is correct here — it means "measured as zero so far" not "unmeasured".
 * Token counts start as null because no invocations have been measured yet.
 */
export function createEmptyTaskCostSummary(): TaskCostSummary {
  return {
    totalCost: '0',
    primaryGenerationCost: '0',
    amplificationCost: '0',
    currency: 'USD',
    measurementSource: CostMeasurementSource.UNAVAILABLE,
    totalInputTokens: null,
    totalOutputTokens: null,
    totalReasoningTokens: null,
  };
}

/**
 * Creates default amplification flags — not requested, not enabled, not applied.
 */
export function createDefaultAmplificationFlags(): AmplificationFlags {
  return {
    requested: false,
    enabled: false,
    applied: false,
  };
}