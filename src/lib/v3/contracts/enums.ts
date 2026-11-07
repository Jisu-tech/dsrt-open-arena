// src/lib/v3/contracts/enums.ts
// ═══════════════════════════════════════════════════════════════════════════
// Single source of truth for ALL enumerations across the DSRT Open Arena
// system. No other file may define ProviderType, TaskState, or any enum
// listed here. Import from this module only.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * All supported LLM providers. This is the ONLY ProviderType definition
 * in the entire codebase. The Dynamic Provider Infrastructure doc specifies
 * 12 providers. We include all 12 + cohere (legacy compat) = 13.
 *
 * RULE: If a new provider is added, add it here AND to the
 * v3_provider_catalogue_config table. Nowhere else.
 */
export const V3_PROVIDERS = [
  'openai',
  'anthropic',
  'google',
  'deepseek',
  'groq',
  'mistral',
  'xai',
  'openrouter',
  'cohere',
  'together',
  'fireworks',
  'cerebras',
  'perplexity',
] as const;

export type V3Provider = (typeof V3_PROVIDERS)[number];

/** Legacy alias — all legacy code should migrate to V3Provider */
export type ProviderType = V3Provider;

export function isV3Provider(value: string): value is V3Provider {
  return V3_PROVIDERS.includes(value as V3Provider);
}

/**
 * Canonical 13-state task lifecycle from Doc 04.
 * Database column v3_tasks.state stores these as lowercase text.
 */
export const TASK_STATES = [
  'created',
  'understanding',
  'planning',
  'needs_user_input',
  'ready',
  'executing',
  'evaluating',
  'verifying',
  'completed',
  'completed_with_limitations',
  'unverified',
  'failed',
  'cancelled',
] as const;

export type TaskState = (typeof TASK_STATES)[number];

export function isTaskState(value: string): value is TaskState {
  return TASK_STATES.includes(value as TaskState);
}

/**
 * Allowed state transitions. Key = from state, value = set of valid to states.
 * Enforced by state machine — no other transitions are permitted.
 */
export const VALID_TRANSITIONS: Record<TaskState, readonly TaskState[]> = {
  created: ['understanding', 'ready', 'executing', 'failed', 'cancelled'],
  understanding: ['planning', 'needs_user_input', 'ready', 'failed', 'cancelled'],
  planning: ['needs_user_input', 'ready', 'failed', 'cancelled'],
  needs_user_input: ['understanding', 'planning', 'ready', 'cancelled'],
  ready: ['executing', 'cancelled'],
  executing: ['evaluating', 'verifying', 'completed', 'completed_with_limitations', 'unverified', 'failed', 'cancelled'],
  evaluating: ['verifying', 'completed', 'completed_with_limitations', 'unverified', 'failed'],
  verifying: ['completed', 'completed_with_limitations', 'unverified', 'failed'],
  completed: [],
  completed_with_limitations: [],
  unverified: ['evaluating', 'verifying', 'completed', 'failed'],
  failed: [],
  cancelled: [],
} as const;

/**
 * Complexity classes 0-4 from Doc 03.
 */
export const COMPLEXITY_CLASSES = [0, 1, 2, 3, 4] as const;
export type ComplexityClass = (typeof COMPLEXITY_CLASSES)[number];

/**
 * Risk levels from Doc 03.
 */
export const RISK_LEVELS = ['none', 'low', 'medium', 'high'] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

/**
 * Execution strategies from Doc 03.
 */
export const EXECUTION_STRATEGIES = [
  'direct',
  'enhanced',
  'verified',
  'multi_step',
  'parallel',
  'iterative',
  'comparative',
  'constrained',
] as const;
export type ExecutionStrategy = (typeof EXECUTION_STRATEGIES)[number];

/**
 * PTIS decision actions from Doc 04.
 */
export const PTIS_ACTIONS = [
  'approve',
  'approve_with_alternative',
  'downgrade',
  'reject',
  'defer',
  'cache_hit',
] as const;
export type PTISAction = (typeof PTIS_ACTIONS)[number];

/**
 * Model invocation outcomes.
 * Stored as text in v3_model_invocations.outcome (default 'success').
 */
export const INVOCATION_OUTCOMES = [
  'success',
  'failed',
  'timeout',
  'rate_limited',
  'cancelled',
  'content_filtered',
  'invalid_request',
  'auth_failed',
] as const;
export type InvocationOutcome = (typeof INVOCATION_OUTCOMES)[number];

/**
 * Model lifecycle states from Dynamic Provider Infrastructure doc.
 */
export const MODEL_LIFECYCLE_STATES = [
  'discovered',
  'verified',
  'active',
  'preferred',
  'deprecated',
  'retirement_pending',
  'retired',
  'suspended',
  'quarantined',
  'archived',
] as const;
export type ModelLifecycleState = (typeof MODEL_LIFECYCLE_STATES)[number];

/**
 * Budget enforcement levels.
 */
export const BUDGET_ENFORCEMENTS = [
  'observational',
  'advisory',
  'soft',
  'hard',
] as const;
export type BudgetEnforcement = (typeof BUDGET_ENFORCEMENTS)[number];

/**
 * Measurement source provenance — tracks where a measurement came from.
 * "unavailable" is the default — it means "we don't have this data yet."
 */
export const MEASUREMENT_SOURCES = [
  'provider_api',
  'provider_stream_final',
  'provider_headers',
  'heuristic_estimate',
  'cached_pricing',
  'registry_snapshot',
  'unavailable',
] as const;
export type MeasurementSource = (typeof MEASUREMENT_SOURCES)[number];

/**
 * Error categories from Doc 04.
 */
export const ERROR_CATEGORIES = [
  'provider_error',
  'rate_limit',
  'auth_failure',
  'content_filter',
  'context_overflow',
  'timeout',
  'budget_exceeded',
  'validation_error',
  'state_error',
  'internal_error',
  'network_error',
  'configuration_error',
  'unknown',
] as const;
export type ErrorCategory = (typeof ERROR_CATEGORIES)[number];

/**
 * Error severity levels.
 */
export const ERROR_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
export type ErrorSeverity = (typeof ERROR_SEVERITIES)[number];

/**
 * Intelligence responsibilities I01-I12 from Doc 03.
 */
export const INTELLIGENCE_RESPONSIBILITIES = [
  'I01', 'I02', 'I03', 'I04', 'I05', 'I06',
  'I07', 'I08', 'I09', 'I10', 'I11', 'I12',
] as const;
export type IntelligenceResponsibility = (typeof INTELLIGENCE_RESPONSIBILITIES)[number];

/**
 * Execution modes — normalized to lowercase.
 */
export const EXECUTION_MODES = ['work', 'war', 'chat'] as const;
export type ExecutionMode = (typeof EXECUTION_MODES)[number];