/**
 * DSRT Open Arena V3 — Validation Utilities
 * 
 * Zod schemas for runtime validation of V3 contracts.
 * These validate data at system boundaries (API inputs, database reads, provider responses).
 * Internal code passes typed objects — these schemas are for boundary enforcement.
 * 
 * Uses Zod 4.x (v4.6.7 per the existing project dependency).
 * 
 * @module v3/contracts/validation
 */

import { z } from 'zod';

import {
  V3Provider,
  TaskState,
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
  ErrorSeverity,
  ErrorCategory,
  ErrorRecoverability,
  ComparisonType,
  ModelTier,
  ModelCapability,
} from './enums';

// ─────────────────────────────────────────────
// Primitive Validators
// ─────────────────────────────────────────────

/**
 * UUID v4 format validator.
 */
export const uuidSchema = z.string().uuid();

/**
 * Validates a string is a valid UUID v4 at runtime.
 */
export function validateUUID(value: string): boolean {
  return uuidSchema.safeParse(value).success;
}

/**
 * ISO 8601 timestamp string validator.
 * Accepts the standard format produced by Date.toISOString().
 */
export const isoTimestampSchema = z.string().datetime({ offset: true }).or(
  z.string().datetime()
);

/**
 * Monetary value — a string that represents a valid decimal number.
 * Must be non-negative. Must not be empty.
 */
export const monetaryValueSchema = z.string().refine(
  (val) => {
    if (val === '') return false;
    const num = Number(val);
    return !isNaN(num) && isFinite(num) && num >= 0;
  },
  { message: 'Monetary value must be a non-negative decimal string' },
);

/**
 * Non-negative integer (for token counts).
 */
export const tokenCountSchema = z.number().int().nonneg();

/**
 * Duration in milliseconds — non-negative number.
 */
export const durationMsSchema = z.number().nonneg();

// ─────────────────────────────────────────────
// Enum Schemas
// ─────────────────────────────────────────────

export const v3ProviderSchema = z.nativeEnum(V3Provider);
export const taskStateSchema = z.nativeEnum(TaskState);
export const complexityClassSchema = z.nativeEnum(ComplexityClass);
export const riskLevelSchema = z.nativeEnum(RiskLevel);
export const executionStrategySchema = z.nativeEnum(ExecutionStrategy);
export const userModeSchema = z.nativeEnum(UserMode);
export const invocationPurposeSchema = z.nativeEnum(InvocationPurpose);
export const invocationOutcomeSchema = z.nativeEnum(InvocationOutcome);
export const usageMeasurementSourceSchema = z.nativeEnum(UsageMeasurementSource);
export const costMeasurementSourceSchema = z.nativeEnum(CostMeasurementSource);
export const currencySchema = z.nativeEnum(Currency);
export const ptisActionSchema = z.nativeEnum(PTISAction);
export const budgetReservationStatusSchema = z.nativeEnum(BudgetReservationStatus);
export const errorSeveritySchema = z.nativeEnum(ErrorSeverity);
export const errorCategorySchema = z.nativeEnum(ErrorCategory);
export const errorRecoverabilitySchema = z.nativeEnum(ErrorRecoverability);
export const comparisonTypeSchema = z.nativeEnum(ComparisonType);
export const modelTierSchema = z.nativeEnum(ModelTier);
export const modelCapabilitySchema = z.nativeEnum(ModelCapability);

// ─────────────────────────────────────────────
// Composite Schemas
// ─────────────────────────────────────────────

/**
 * ModelUsage validation schema.
 */
export const modelUsageSchema = z.object({
  inputTokens: tokenCountSchema.nullable(),
  outputTokens: tokenCountSchema.nullable(),
  reasoningTokens: tokenCountSchema.nullable(),
  cachedInputTokens: tokenCountSchema.nullable(),
  totalTokens: tokenCountSchema.nullable(),
  measurementSource: usageMeasurementSourceSchema,
  rawProviderUsage: z.record(z.unknown()).nullable(),
});

/**
 * InvocationCost validation schema.
 */
export const invocationCostSchema = z.object({
  inputCost: monetaryValueSchema.nullable(),
  outputCost: monetaryValueSchema.nullable(),
  reasoningCost: monetaryValueSchema.nullable(),
  cachedInputCost: monetaryValueSchema.nullable(),
  totalCost: monetaryValueSchema,
  currency: currencySchema,
  pricingVersion: z.string().nullable(),
  measurementSource: costMeasurementSourceSchema,
});

/**
 * TaskClassification validation schema.
 */
export const taskClassificationSchema = z.object({
  complexityClass: complexityClassSchema,
  riskLevel: riskLevelSchema,
  classifiedBy: z.enum(['deterministic', 'model_assisted']),
  classificationModelId: z.string().nullable(),
  confidence: z.number().min(0).max(1).nullable(),
  rationale: z.string().nullable(),
  classifiedAt: isoTimestampSchema,
});

/**
 * AmplificationFlags validation schema.
 */
export const amplificationFlagsSchema = z.object({
  requested: z.boolean(),
  enabled: z.boolean(),
  applied: z.boolean(),
});

/**
 * TaskCostSummary validation schema.
 */
export const taskCostSummarySchema = z.object({
  totalCost: monetaryValueSchema,
  primaryGenerationCost: monetaryValueSchema,
  amplificationCost: monetaryValueSchema,
  currency: z.string(),
  measurementSource: costMeasurementSourceSchema,
  totalInputTokens: tokenCountSchema.nullable(),
  totalOutputTokens: tokenCountSchema.nullable(),
  totalReasoningTokens: tokenCountSchema.nullable(),
});

/**
 * InvocationRequestParams validation schema.
 */
export const invocationRequestParamsSchema = z.object({
  temperature: z.number().min(0).max(2).nullable(),
  maxTokens: z.number().int().positive().nullable(),
  topP: z.number().min(0).max(1).nullable(),
  frequencyPenalty: z.number().min(-2).max(2).nullable(),
  presencePenalty: z.number().min(-2).max(2).nullable(),
  stopSequences: z.array(z.string()).nullable(),
  systemPrompt: z.string().nullable(),
  stream: z.boolean(),
  extra: z.record(z.unknown()).nullable(),
});

/**
 * CreateTaskInput validation schema — used to validate API inputs.
 */
export const createTaskInputSchema = z.object({
  workspaceId: uuidSchema,
  userId: uuidSchema,
  conversationId: uuidSchema,
  userMessage: z.string().min(1).max(100_000),
  mode: userModeSchema,
  amplificationRequested: z.boolean(),
  primaryModelId: z.string().nullable(),
  primaryProvider: z.string().nullable(),
  legacyExecutionId: uuidSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * ModelPricing validation schema.
 */
export const modelPricingSchema = z.object({
  inputPricePerMillion: monetaryValueSchema.nullable(),
  outputPricePerMillion: monetaryValueSchema.nullable(),
  reasoningPricePerMillion: monetaryValueSchema.nullable(),
  cachedInputPricePerMillion: monetaryValueSchema.nullable(),
  pricingVersion: z.string(),
  lastVerifiedAt: isoTimestampSchema,
  source: z.enum(['provider_api', 'provider_docs', 'manual_entry', 'static_fallback']),
});

// ─────────────────────────────────────────────
// Utility: Safe Parse with typed result
// ─────────────────────────────────────────────

/**
 * Type-safe wrapper around Zod safeParse that returns a discriminated union.
 * Avoids the need for callers to handle Zod's internal error types.
 */
export type ParseResult<T> =
  | { success: true; data: T }
  | { success: false; errors: readonly string[] };

/**
 * Parse a value against a schema and return a clean result.
 */
export function safeParse<T>(
  schema: z.ZodType<T>,
  value: unknown,
): ParseResult<T> {
  const result = schema.safeParse(value);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const errors = result.error.issues.map(
    (issue) => `${issue.path.join('.')}: ${issue.message}`,
  );
  return { success: false, errors };
}