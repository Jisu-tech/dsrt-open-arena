/**
 * DSRT Open Arena V3 — PTIS (Per-Token Intelligence System) Contracts
 * 
 * Defines the contracts for PTIS decisions, budget management, and intelligence
 * budget tracking. These are the authorization contracts — every model invocation
 * must be authorized by a PTIS decision (once PTIS is active; Phase 1 records
 * decisions but does not yet enforce them).
 * 
 * @module v3/contracts/ptis
 */

import type {
  PTISDecisionId,
  TaskId,
  InvocationId,
  WorkspaceId,
  BudgetReservationId,
} from './identifiers';
import type {
  ISOTimestamp,
  AuditFields,
  MonetaryValue,
} from './metadata';
import {
  PTISAction,
  BudgetReservationStatus,
  ComplexityClass,
  RiskLevel,
  InvocationPurpose,
  CostMeasurementSource,
} from './enums';

// ─────────────────────────────────────────────
// PTIS Decision
// ─────────────────────────────────────────────

/**
 * A PTIS decision — the authorization record for a model invocation.
 * 
 * In Phase 1, decisions are recorded observationally (what PTIS *would* have decided).
 * In Phase 2+, decisions become enforcement gates.
 */
export interface V3PTISDecision extends AuditFields {
  readonly id: PTISDecisionId;
  readonly taskId: TaskId;
  readonly workspaceId: WorkspaceId;

  /** The invocation this decision authorizes. null if the decision is prospective. */
  readonly invocationId: InvocationId | null;

  /** What PTIS decided. */
  readonly action: PTISAction;

  /** Why this action was chosen. */
  readonly rationale: string;

  /** The purpose of the invocation being authorized. */
  readonly requestedPurpose: InvocationPurpose;

  /** Model requested for the invocation. */
  readonly requestedModelId: string;

  /** Alternative model suggested (when action is ROUTE_TO_ALTERNATIVE). */
  readonly alternativeModelId: string | null;

  /** Estimated cost of the requested invocation. */
  readonly estimatedCost: MonetaryValue | null;

  /** Estimated cost of the alternative (if suggested). */
  readonly alternativeCostEstimate: MonetaryValue | null;

  /** Budget context at decision time. */
  readonly budgetContext: PTISBudgetContext;

  /** The complexity class of the parent task. */
  readonly taskComplexityClass: ComplexityClass;

  /** The risk level of the parent task. */
  readonly taskRiskLevel: RiskLevel;

  /** Whether this decision was enforced (Phase 2+) or observational (Phase 1). */
  readonly enforced: boolean;

  /** Sequence of this decision within the task. */
  readonly sequence: number;

  /** When this decision was made. */
  readonly decidedAt: ISOTimestamp;
}

// ─────────────────────────────────────────────
// PTIS Budget Context
// ─────────────────────────────────────────────

/**
 * Snapshot of budget state at the time a PTIS decision was made.
 */
export interface PTISBudgetContext {
  /** Total budget allocated for this task. */
  readonly taskBudget: MonetaryValue;

  /** Amount already spent on this task. */
  readonly taskSpent: MonetaryValue;

  /** Amount remaining for this task. */
  readonly taskRemaining: MonetaryValue;

  /** Workspace-level budget information. */
  readonly workspaceBudget: WorkspaceBudgetSnapshot | null;
}

/**
 * Workspace-level budget snapshot — optional, depends on whether
 * workspace budgets are configured.
 */
export interface WorkspaceBudgetSnapshot {
  /** Total workspace budget for the current period. */
  readonly periodBudget: MonetaryValue | null;

  /** Amount spent in the current period. */
  readonly periodSpent: MonetaryValue;

  /** Budget period (e.g., 'daily', 'monthly'). */
  readonly periodType: string | null;

  /** How the budget figures were determined. */
  readonly measurementSource: CostMeasurementSource;
}

// ─────────────────────────────────────────────
// Intelligence Budget
// ─────────────────────────────────────────────

/**
 * Intelligence budget for a task — how much can be spent on AI for this task.
 * Allocated based on complexity class and workspace configuration.
 */
export interface IntelligenceBudget {
  readonly taskId: TaskId;
  readonly workspaceId: WorkspaceId;

  /** Total budget allocated for this task. */
  readonly totalBudget: MonetaryValue;

  /** Budget allocated specifically for primary generation. */
  readonly primaryBudget: MonetaryValue;

  /** Budget allocated for amplification/intelligence invocations. */
  readonly amplificationBudget: MonetaryValue;

  /** Amount reserved by active budget reservations. */
  readonly reservedAmount: MonetaryValue;

  /** Amount actually consumed. */
  readonly consumedAmount: MonetaryValue;

  /** Remaining available = totalBudget - reservedAmount - consumedAmount. */
  readonly availableAmount: MonetaryValue;

  /** Whether this budget is a hard limit (reject) or soft limit (warn). */
  readonly enforcement: 'hard' | 'soft' | 'observational';

  /** How the budget was determined. */
  readonly allocatedBy: 'default' | 'workspace_config' | 'user_specified' | 'complexity_based';

  /** Currency. */
  readonly currency: string;
}

// ─────────────────────────────────────────────
// Budget Reservation
// ─────────────────────────────────────────────

/**
 * A budget reservation — a hold placed before an invocation starts.
 * Prevents budget overcommitment when multiple invocations run in parallel.
 */
export interface V3BudgetReservation extends AuditFields {
  readonly id: BudgetReservationId;
  readonly taskId: TaskId;
  readonly workspaceId: WorkspaceId;

  /** The PTIS decision that created this reservation. */
  readonly ptisDecisionId: PTISDecisionId;

  /** The invocation this reservation is for. null until invocation starts. */
  readonly invocationId: InvocationId | null;

  /** Amount reserved. */
  readonly reservedAmount: MonetaryValue;

  /** Amount actually consumed when the invocation completed. */
  readonly consumedAmount: MonetaryValue | null;

  /** Current status. */
  readonly status: BudgetReservationStatus;

  /** When the reservation expires if not consumed. */
  readonly expiresAt: ISOTimestamp;

  /** When the reservation was consumed or released. */
  readonly resolvedAt: ISOTimestamp | null;

  /** Currency. */
  readonly currency: string;
}

// ─────────────────────────────────────────────
// Creation Inputs
// ─────────────────────────────────────────────

/**
 * Input for recording a PTIS decision.
 */
export interface RecordPTISDecisionInput {
  readonly taskId: TaskId;
  readonly workspaceId: WorkspaceId;
  readonly invocationId?: InvocationId;
  readonly action: PTISAction;
  readonly rationale: string;
  readonly requestedPurpose: InvocationPurpose;
  readonly requestedModelId: string;
  readonly alternativeModelId?: string;
  readonly estimatedCost?: MonetaryValue;
  readonly alternativeCostEstimate?: MonetaryValue;
  readonly budgetContext: PTISBudgetContext;
  readonly taskComplexityClass: ComplexityClass;
  readonly taskRiskLevel: RiskLevel;
  readonly enforced: boolean;
  readonly sequence: number;
}

/**
 * Input for creating a budget reservation.
 */
export interface CreateBudgetReservationInput {
  readonly taskId: TaskId;
  readonly workspaceId: WorkspaceId;
  readonly ptisDecisionId: PTISDecisionId;
  readonly reservedAmount: MonetaryValue;
  readonly currency: string;
  readonly expiresAt: ISOTimestamp;
}

// ─────────────────────────────────────────────
// Default Factories
// ─────────────────────────────────────────────

/**
 * Creates a default intelligence budget for observational mode.
 * In Phase 1, all budgets are observational — they record what would happen
 * but do not enforce limits.
 */
export function createObservationalBudget(
  taskId: TaskId,
  workspaceId: WorkspaceId,
): IntelligenceBudget {
  return {
    taskId,
    workspaceId,
    totalBudget: '1.00',
    primaryBudget: '0.50',
    amplificationBudget: '0.50',
    reservedAmount: '0',
    consumedAmount: '0',
    availableAmount: '1.00',
    enforcement: 'observational',
    allocatedBy: 'default',
    currency: 'USD',
  };
}