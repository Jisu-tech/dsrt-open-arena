/**
 * DSRT Open Arena V3 — Typed Identifiers
 * 
 * Branded types for all entity identifiers to prevent accidental cross-assignment.
 * A TaskId cannot be passed where a ConversationId is expected, even though both
 * are strings at runtime. This catches bugs at compile time.
 * 
 * @module v3/contracts/identifiers
 */

// ─────────────────────────────────────────────
// Brand infrastructure
// ─────────────────────────────────────────────

/**
 * Unique symbol per identifier type. This is erased at runtime but enforced at compile time.
 */
declare const __brand: unique symbol;

/**
 * Branded string type. The Brand parameter makes each ID type unique to TypeScript
 * while remaining a plain string at runtime.
 */
type BrandedId<Brand extends string> = string & { readonly [__brand]: Brand };

// ─────────────────────────────────────────────
// Entity Identifiers
// ─────────────────────────────────────────────

/** Unique identifier for a V3 Task. Format: UUID v4. */
export type TaskId = BrandedId<'TaskId'>;

/** Unique identifier for a Conversation. Format: UUID v4. */
export type ConversationId = BrandedId<'ConversationId'>;

/** Unique identifier for a Message within a conversation. Format: UUID v4. */
export type MessageId = BrandedId<'MessageId'>;

/** Unique identifier for a single model invocation. Format: UUID v4. */
export type InvocationId = BrandedId<'InvocationId'>;

/** Unique identifier for a PTIS decision. Format: UUID v4. */
export type PTISDecisionId = BrandedId<'PTISDecisionId'>;

/** Unique identifier for a budget reservation. Format: UUID v4. */
export type BudgetReservationId = BrandedId<'BudgetReservationId'>;

/** Unique identifier for a comparison experiment. Format: UUID v4. */
export type ComparisonExperimentId = BrandedId<'ComparisonExperimentId'>;

/** Unique identifier for an execution step within a task. Format: UUID v4. */
export type ExecutionStepId = BrandedId<'ExecutionStepId'>;

/** Unique identifier for a workspace. Format: UUID v4. */
export type WorkspaceId = BrandedId<'WorkspaceId'>;

/** Unique identifier for a user. Format: UUID v4 (from Supabase Auth). */
export type UserId = BrandedId<'UserId'>;

/** Unique identifier for a credential reference. Never contains the actual secret. */
export type CredentialRefId = BrandedId<'CredentialRefId'>;

/** Unique identifier for a domain event. Format: UUID v4. */
export type DomainEventId = BrandedId<'DomainEventId'>;

/** Unique identifier for an evaluation result. Format: UUID v4. */
export type EvaluationId = BrandedId<'EvaluationId'>;

/** Unique identifier for an error record. Format: UUID v4. */
export type ErrorRecordId = BrandedId<'ErrorRecordId'>;

/** Unique identifier for a model in the provider registry. Format: provider/model-name. */
export type ModelId = BrandedId<'ModelId'>;

/** Unique identifier for a provider registry entry. Format: UUID v4. */
export type ProviderRegistryEntryId = BrandedId<'ProviderRegistryEntryId'>;

// ─────────────────────────────────────────────
// Existing system identifiers (for dual-write mapping)
// ─────────────────────────────────────────────

/** ID from the existing V2 executions table. */
export type LegacyExecutionId = BrandedId<'LegacyExecutionId'>;

/** ID from the existing V2 engine_runs table. */
export type LegacyEngineRunId = BrandedId<'LegacyEngineRunId'>;

// ─────────────────────────────────────────────
// Factory functions
// ─────────────────────────────────────────────

/**
 * Creates a typed identifier from a raw string.
 * No validation — this is a compile-time-only brand.
 * Use `validateUUID` from validation.ts if runtime format checking is needed.
 * 
 * @example
 * const taskId = createId<TaskId>('550e8400-e29b-41d4-a716-446655440000');
 * const invId = createId<InvocationId>(crypto.randomUUID());
 */
export function createId<T extends BrandedId<string>>(raw: string): T {
  return raw as T;
}

/**
 * Generates a new UUID v4 and returns it as the specified branded type.
 * Uses the Web Crypto API (available in Node.js 19+ and all modern browsers).
 * 
 * @example
 * const taskId = generateId<TaskId>();
 */
export function generateId<T extends BrandedId<string>>(): T {
  return crypto.randomUUID() as T;
}

/**
 * Extracts the raw string value from a branded identifier.
 * Useful when passing IDs to database queries or external APIs.
 */
export function rawId(id: BrandedId<string>): string {
  return id as string;
}