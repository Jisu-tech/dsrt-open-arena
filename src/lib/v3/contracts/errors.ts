/**
 * DSRT Open Arena V3 — Error Contracts
 * 
 * Defines the canonical error types for V3. Every failure is classified,
 * observable, and either recoverable or explicitly declared non-recoverable.
 * No silent failures.
 * 
 * @module v3/contracts/errors
 */

import type {
  ErrorRecordId,
  TaskId,
  InvocationId,
  WorkspaceId,
} from './identifiers';
import type { ISOTimestamp, AuditFields } from './metadata';
import {
  ErrorSeverity,
  ErrorCategory,
  ErrorRecoverability,
} from './enums';

// ─────────────────────────────────────────────
// Execution Error Record
// ─────────────────────────────────────────────

/**
 * A recorded error event in the V3 system.
 * Persisted for observability, debugging, and pattern detection.
 */
export interface V3ExecutionError extends AuditFields {
  readonly id: ErrorRecordId;
  readonly taskId: TaskId | null;
  readonly invocationId: InvocationId | null;
  readonly workspaceId: WorkspaceId;

  /** Error category for classification. */
  readonly category: ErrorCategory;

  /** Severity level. */
  readonly severity: ErrorSeverity;

  /** Whether and how this error can be recovered from. */
  readonly recoverability: ErrorRecoverability;

  /** Human-readable error message. */
  readonly message: string;

  /** Machine-readable error code. Format: V3_ERR_{CATEGORY}_{SPECIFIC}. */
  readonly code: string;

  /** Stack trace or additional diagnostic info. Sanitized — no secrets. */
  readonly details: Record<string, unknown> | null;

  /** The component/module that raised this error. */
  readonly source: string;

  /** Whether recovery was attempted. */
  readonly recoveryAttempted: boolean;

  /** Whether recovery succeeded. */
  readonly recoverySucceeded: boolean | null;

  /** Description of recovery action taken, if any. */
  readonly recoveryAction: string | null;

  /** When the error occurred. */
  readonly occurredAt: ISOTimestamp;
}

// ─────────────────────────────────────────────
// Error Creation Input
// ─────────────────────────────────────────────

/**
 * Input for recording an error.
 */
export interface RecordErrorInput {
  readonly taskId?: TaskId;
  readonly invocationId?: InvocationId;
  readonly workspaceId: WorkspaceId;
  readonly category: ErrorCategory;
  readonly severity: ErrorSeverity;
  readonly recoverability: ErrorRecoverability;
  readonly message: string;
  readonly code: string;
  readonly details?: Record<string, unknown>;
  readonly source: string;
  readonly recoveryAttempted?: boolean;
  readonly recoverySucceeded?: boolean;
  readonly recoveryAction?: string;
}

// ─────────────────────────────────────────────
// V3 Error Classes
// ─────────────────────────────────────────────

/**
 * Base class for all V3 operational errors.
 * Carries classification metadata that the error recording system can extract.
 */
export class V3Error extends Error {
  readonly category: ErrorCategory;
  readonly severity: ErrorSeverity;
  readonly recoverability: ErrorRecoverability;
  readonly code: string;
  readonly details: Record<string, unknown> | null;
  readonly source: string;

  constructor(params: {
    message: string;
    category: ErrorCategory;
    severity: ErrorSeverity;
    recoverability: ErrorRecoverability;
    code: string;
    source: string;
    details?: Record<string, unknown>;
    cause?: unknown;
  }) {
    super(params.message, { cause: params.cause });
    this.name = 'V3Error';
    this.category = params.category;
    this.severity = params.severity;
    this.recoverability = params.recoverability;
    this.code = params.code;
    this.source = params.source;
    this.details = params.details ?? null;
  }
}

/**
 * Invalid state transition error.
 */
export class StateTransitionError extends V3Error {
  readonly fromState: string;
  readonly toState: string;

  constructor(fromState: string, toState: string, entityType: string) {
    super({
      message: `Invalid state transition: ${entityType} cannot move from '${fromState}' to '${toState}'`,
      category: ErrorCategory.STATE,
      severity: ErrorSeverity.HIGH,
      recoverability: ErrorRecoverability.NON_RECOVERABLE,
      code: 'V3_ERR_STATE_INVALID_TRANSITION',
      source: 'state-machine',
      details: { fromState, toState, entityType },
    });
    this.name = 'StateTransitionError';
    this.fromState = fromState;
    this.toState = toState;
  }
}

/**
 * Budget exceeded error.
 */
export class BudgetExceededError extends V3Error {
  constructor(
    taskId: string,
    budgetAmount: string,
    requestedAmount: string,
    source: string,
  ) {
    super({
      message: `Budget exceeded for task ${taskId}: requested ${requestedAmount}, remaining ${budgetAmount}`,
      category: ErrorCategory.BUDGET,
      severity: ErrorSeverity.HIGH,
      recoverability: ErrorRecoverability.RECOVERABLE_WITH_FALLBACK,
      code: 'V3_ERR_BUDGET_EXCEEDED',
      source,
      details: { taskId, budgetAmount, requestedAmount },
    });
    this.name = 'BudgetExceededError';
  }
}

/**
 * Provider error — wraps upstream provider failures.
 */
export class ProviderError extends V3Error {
  readonly provider: string;
  readonly httpStatus: number | null;

  constructor(params: {
    message: string;
    provider: string;
    httpStatus?: number;
    retryable: boolean;
    source: string;
    details?: Record<string, unknown>;
    cause?: unknown;
  }) {
    super({
      message: params.message,
      category: ErrorCategory.PROVIDER,
      severity: ErrorSeverity.HIGH,
      recoverability: params.retryable
        ? ErrorRecoverability.RECOVERABLE
        : ErrorRecoverability.NON_RECOVERABLE,
      code: 'V3_ERR_PROVIDER_FAILURE',
      source: params.source,
      details: { provider: params.provider, httpStatus: params.httpStatus, ...params.details },
      cause: params.cause,
    });
    this.name = 'ProviderError';
    this.provider = params.provider;
    this.httpStatus = params.httpStatus ?? null;
  }
}

/**
 * Validation error — input or output failed validation.
 */
export class ValidationError extends V3Error {
  constructor(message: string, source: string, details?: Record<string, unknown>) {
    super({
      message,
      category: ErrorCategory.VALIDATION,
      severity: ErrorSeverity.MEDIUM,
      recoverability: ErrorRecoverability.NON_RECOVERABLE,
      code: 'V3_ERR_VALIDATION_FAILED',
      source,
      details,
    });
    this.name = 'ValidationError';
  }
}

/**
 * Configuration error — missing or invalid system configuration.
 */
export class ConfigurationError extends V3Error {
  constructor(message: string, source: string, details?: Record<string, unknown>) {
    super({
      message,
      category: ErrorCategory.CONFIGURATION,
      severity: ErrorSeverity.CRITICAL,
      recoverability: ErrorRecoverability.NON_RECOVERABLE,
      code: 'V3_ERR_CONFIGURATION_INVALID',
      source,
      details,
    });
    this.name = 'ConfigurationError';
  }
}

/**
 * Workspace isolation violation — query attempted without workspace scope.
 */
export class WorkspaceIsolationError extends V3Error {
  constructor(operation: string) {
    super({
      message: `Workspace isolation violation: operation '${operation}' attempted without workspace scope`,
      category: ErrorCategory.VALIDATION,
      severity: ErrorSeverity.CRITICAL,
      recoverability: ErrorRecoverability.NON_RECOVERABLE,
      code: 'V3_ERR_WORKSPACE_ISOLATION',
      source: 'repository',
      details: { operation },
    });
    this.name = 'WorkspaceIsolationError';
  }
}