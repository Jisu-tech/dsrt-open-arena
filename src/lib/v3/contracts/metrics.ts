/**
 * DSRT Open Arena V3 — Metrics Contracts
 * 
 * Defines the metrics and telemetry data structures that the system exposes.
 * These are the measured outputs — what V3 reports about where every AI dollar went.
 * 
 * @module v3/contracts/metrics
 */

import type {
  TaskId,
  WorkspaceId,
  ConversationId,
} from './identifiers';
import type {
  ISOTimestamp,
  DurationMs,
  MonetaryValue,
  TimeRangeFilter,
} from './metadata';
import {
  InvocationPurpose,
  CostMeasurementSource,
  V3Provider,
} from './enums';

// ─────────────────────────────────────────────
// Task-Level Metrics
// ─────────────────────────────────────────────

/**
 * Complete metrics for a single task — the answer to "where did the money go?"
 */
export interface TaskMetrics {
  readonly taskId: TaskId;
  readonly workspaceId: WorkspaceId;

  /** When these metrics were computed. */
  readonly computedAt: ISOTimestamp;

  /** Cost breakdown by purpose. */
  readonly costByPurpose: readonly CostByPurpose[];

  /** Cost breakdown by model. */
  readonly costByModel: readonly CostByModel[];

  /** Cost breakdown by provider. */
  readonly costByProvider: readonly CostByProvider[];

  /** Token usage summary. */
  readonly tokenSummary: TokenSummary;

  /** Timing summary. */
  readonly timingSummary: TimingSummary;

  /** Amplification overhead — how much extra was spent beyond the primary generation. */
  readonly amplificationOverhead: AmplificationOverhead;

  /** Overall measurement confidence. */
  readonly measurementSource: CostMeasurementSource;
}

// ─────────────────────────────────────────────
// Cost Breakdowns
// ─────────────────────────────────────────────

/**
 * Cost attributed to a specific purpose.
 */
export interface CostByPurpose {
  readonly purpose: InvocationPurpose;
  readonly totalCost: MonetaryValue;
  readonly invocationCount: number;
  readonly totalTokens: number | null;
  readonly measurementSource: CostMeasurementSource;
}

/**
 * Cost attributed to a specific model.
 */
export interface CostByModel {
  readonly modelId: string;
  readonly provider: V3Provider;
  readonly totalCost: MonetaryValue;
  readonly invocationCount: number;
  readonly totalInputTokens: number | null;
  readonly totalOutputTokens: number | null;
  readonly measurementSource: CostMeasurementSource;
}

/**
 * Cost attributed to a specific provider.
 */
export interface CostByProvider {
  readonly provider: V3Provider;
  readonly totalCost: MonetaryValue;
  readonly invocationCount: number;
  readonly modelCount: number;
  readonly measurementSource: CostMeasurementSource;
}

// ─────────────────────────────────────────────
// Token Summary
// ─────────────────────────────────────────────

/**
 * Aggregate token usage across all invocations for a task.
 */
export interface TokenSummary {
  readonly totalInputTokens: number | null;
  readonly totalOutputTokens: number | null;
  readonly totalReasoningTokens: number | null;
  readonly totalCachedInputTokens: number | null;
  readonly totalTokens: number | null;

  /** How many invocations reported usage vs. were unavailable. */
  readonly measuredInvocationCount: number;
  readonly unmeasuredInvocationCount: number;

  /** Overall measurement source — UNAVAILABLE if any invocation lacks measurement. */
  readonly measurementSource: CostMeasurementSource;
}

// ─────────────────────────────────────────────
// Timing Summary
// ─────────────────────────────────────────────

/**
 * Timing breakdown for a task.
 */
export interface TimingSummary {
  readonly totalDurationMs: DurationMs | null;
  readonly modelLatencyMs: DurationMs | null;
  readonly dsrtOverheadMs: DurationMs | null;

  /** Percentage of total time spent waiting for models. */
  readonly modelLatencyPercent: number | null;

  /** Percentage of total time spent in DSRT processing. */
  readonly dsrtOverheadPercent: number | null;

  /** Average per-invocation latency. */
  readonly averageInvocationLatencyMs: DurationMs | null;
}

// ─────────────────────────────────────────────
// Amplification Overhead
// ─────────────────────────────────────────────

/**
 * Quantifies the cost of intelligence/amplification relative to direct generation.
 */
export interface AmplificationOverhead {
  /** Cost of primary generation only. */
  readonly primaryCost: MonetaryValue;

  /** Cost of all non-primary invocations (amplification cost). */
  readonly amplificationCost: MonetaryValue;

  /** Total cost = primary + amplification. */
  readonly totalCost: MonetaryValue;

  /** Amplification cost as percentage of total. null if total is zero. */
  readonly overheadPercent: number | null;

  /** Number of primary invocations. */
  readonly primaryInvocationCount: number;

  /** Number of amplification invocations. */
  readonly amplificationInvocationCount: number;

  /** Whether amplification was applied to this task. */
  readonly amplificationApplied: boolean;
}

// ─────────────────────────────────────────────
// Workspace-Level Metrics
// ─────────────────────────────────────────────

/**
 * Aggregated metrics for a workspace over a time period.
 */
export interface WorkspaceMetrics {
  readonly workspaceId: WorkspaceId;
  readonly timeRange: TimeRangeFilter;
  readonly computedAt: ISOTimestamp;

  /** Total cost in the period. */
  readonly totalCost: MonetaryValue;

  /** Total number of tasks. */
  readonly taskCount: number;

  /** Total number of model invocations. */
  readonly invocationCount: number;

  /** Cost breakdown by provider. */
  readonly costByProvider: readonly CostByProvider[];

  /** Cost breakdown by purpose. */
  readonly costByPurpose: readonly CostByPurpose[];

  /** Average cost per task. */
  readonly averageCostPerTask: MonetaryValue | null;

  /** Average invocations per task. */
  readonly averageInvocationsPerTask: number | null;

  /** Overall measurement confidence. */
  readonly measurementSource: CostMeasurementSource;
}

// ─────────────────────────────────────────────
// Query Inputs
// ─────────────────────────────────────────────

/**
 * Query parameters for workspace metrics.
 */
export interface WorkspaceMetricsQuery {
  readonly workspaceId: WorkspaceId;
  readonly timeRange?: TimeRangeFilter;
  readonly groupBy?: 'provider' | 'model' | 'purpose' | 'day' | 'hour';
}

/**
 * Query parameters for task metrics.
 */
export interface TaskMetricsQuery {
  readonly taskId: TaskId;
  readonly workspaceId: WorkspaceId;
}