/**
 * DSRT Open Arena V3 — Contracts Barrel Export
 * 
 * Central export point for all V3 canonical contracts.
 * Import from '@/lib/v3/contracts' — never import individual contract files
 * from outside the contracts directory.
 * 
 * @module v3/contracts
 */

// ── Enumerations ──
export {
  V3Provider,
  ModelCapability,
  ModelTier,
  TaskState,
  TERMINAL_TASK_STATES,
  ComplexityClass,
  RiskLevel,
  ExecutionStrategy,
  UserMode,
  InvocationPurpose,
  InvocationOutcome,
  UsageMeasurementSource,
  CostMeasurementSource,
  Currency,
  PTISAction,
  BudgetReservationStatus,
  ContextTrustLevel,
  CONTEXT_TRUST_ORDINAL,
  ErrorSeverity,
  ErrorCategory,
  ErrorRecoverability,
  ComparisonType,
  ComparisonStatus,
  DomainEventType,
  LEGACY_STATUS_TO_V3_STATE,
} from './enums';

// ── Typed Identifiers ──
export type {
  TaskId,
  ConversationId,
  MessageId,
  InvocationId,
  PTISDecisionId,
  BudgetReservationId,
  ComparisonExperimentId,
  ExecutionStepId,
  WorkspaceId,
  UserId,
  CredentialRefId,
  DomainEventId,
  EvaluationId,
  ErrorRecordId,
  ModelId,
  ProviderRegistryEntryId,
  LegacyExecutionId,
  LegacyEngineRunId,
} from './identifiers';

export { createId, generateId, rawId } from './identifiers';

// ── Metadata ──
export type {
  ISOTimestamp,
  DurationMs,
  AuditFields,
  WorkspaceContext,
  PaginationInput,
  PaginatedResult,
  TimeRangeFilter,
  MonetaryValue,
  Versioned,
  DualWriteLineage,
} from './metadata';

// ── Task Contracts ──
export type {
  V3Task,
  TaskClassification,
  AmplificationFlags,
  TaskCostSummary,
  TaskTiming,
  CreateTaskInput,
  TaskStateTransition,
} from './task';

export {
  createEmptyTaskCostSummary,
  createDefaultAmplificationFlags,
} from './task';

// ── Conversation Contracts ──
export type {
  V3Conversation,
  V3Message,
  MessageRole,
  CreateConversationInput,
  CreateMessageInput,
} from './conversation';

// ── Invocation Contracts ──
export type {
  V3ModelInvocation,
  InvocationRequestParams,
  ModelUsage,
  InvocationCost,
  InvocationError,
  StartInvocationInput,
  CompleteInvocationInput,
} from './invocation';

export {
  createUnavailableUsage,
  createUnavailableCost,
  createDefaultRequestParams,
} from './invocation';

// ── PTIS Contracts ──
export type {
  V3PTISDecision,
  PTISBudgetContext,
  WorkspaceBudgetSnapshot,
  IntelligenceBudget,
  V3BudgetReservation,
  RecordPTISDecisionInput,
  CreateBudgetReservationInput,
} from './ptis';

export { createObservationalBudget } from './ptis';

// ── Execution Contracts ──
export type {
  ExecutionPlan,
  ExecutionStep,
  ExecutionStepStatus,
  CreateExecutionStepInput,
} from './execution';

export { createDirectExecutionPlan } from './execution';

// ── Error Contracts ──
export type {
  V3ExecutionError,
  RecordErrorInput,
} from './errors';

export {
  V3Error,
  StateTransitionError,
  BudgetExceededError,
  ProviderError,
  ValidationError,
  ConfigurationError,
  WorkspaceIsolationError,
} from './errors';

// ── Metrics Contracts ──
export type {
  TaskMetrics,
  CostByPurpose,
  CostByModel,
  CostByProvider,
  TokenSummary,
  TimingSummary,
  AmplificationOverhead,
  WorkspaceMetrics,
  WorkspaceMetricsQuery,
  TaskMetricsQuery,
} from './metrics';

// ── Provider Registry Contracts ──
export type {
  ProviderRegistryEntry,
  ModelPricing,
  RegistryFilter,
  RegistryLookupResult,
  ProviderHealthStatus,
  CredentialReference,
} from './providers';

// ── Dynamic Registry Contracts ──
export {
  ModelLifecycleState,
  CATALOGUE_ACTIVE_STATES,
  LIFECYCLE_TRANSITIONS,
  WorkspaceAccessibility,
  SyncSource,
  PricingSource,
  CatalogueCompletenessResult,
} from './registry';

export type {
  DynamicRegistryEntry,
  WorkspaceModelAccessibility,
  ModelPricingSnapshot,
  SuppliedPrice,
  SuppliedPricing,
  ProviderCatalogueConfig,
  SyncStatus,
  SyncErrorCategory,
  ModelVerificationRecord,
  VerificationType,
  VerificationErrorCategory,
  RawCatalogueEntry,
  CatalogueSyncResult,
  SyncOperationResult,
  OperationError,
  RegistryCoverageMetrics,
  ProviderCoverageMetric,
  CatalogueCoverageMetric,
  VerifiedAvailabilityMetric,
} from './registry';

// ── Validation ──
export {
  // Primitive schemas
  uuidSchema,
  isoTimestampSchema,
  monetaryValueSchema,
  tokenCountSchema,
  durationMsSchema,
  validateUUID,

  // Enum schemas
  v3ProviderSchema,
  taskStateSchema,
  complexityClassSchema,
  riskLevelSchema,
  executionStrategySchema,
  userModeSchema,
  invocationPurposeSchema,
  invocationOutcomeSchema,
  usageMeasurementSourceSchema,
  costMeasurementSourceSchema,
  currencySchema,
  ptisActionSchema,
  budgetReservationStatusSchema,
  errorSeveritySchema,
  errorCategorySchema,
  errorRecoverabilitySchema,
  comparisonTypeSchema,
  modelTierSchema,
  modelCapabilitySchema,

  // Composite schemas
  modelUsageSchema,
  invocationCostSchema,
  taskClassificationSchema,
  amplificationFlagsSchema,
  taskCostSummarySchema,
  invocationRequestParamsSchema,
  createTaskInputSchema,
  modelPricingSchema,

  // Utility
  safeParse,
} from './validation';

export type { ParseResult } from './validation';