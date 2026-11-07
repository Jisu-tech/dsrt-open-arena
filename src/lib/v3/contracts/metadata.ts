/**
 * DSRT Open Arena V3 — Shared Metadata Types
 * 
 * Common structures used across multiple contracts: timestamps, audit fields,
 * workspace isolation, and pagination.
 * 
 * @module v3/contracts/metadata
 */

import type { WorkspaceId, UserId } from './identifiers';

// ─────────────────────────────────────────────
// Temporal
// ─────────────────────────────────────────────

/**
 * ISO 8601 timestamp string. All timestamps in V3 are UTC.
 * Stored as `timestamptz` in PostgreSQL, represented as ISO string in TypeScript.
 */
export type ISOTimestamp = string;

/**
 * Duration in milliseconds. Used for latency measurements.
 */
export type DurationMs = number;

// ─────────────────────────────────────────────
// Audit & Isolation
// ─────────────────────────────────────────────

/**
 * Standard audit fields present on every persisted V3 entity.
 */
export interface AuditFields {
  readonly createdAt: ISOTimestamp;
  readonly updatedAt: ISOTimestamp;
}

/**
 * Workspace isolation context. Every V3 query must be scoped to a workspace.
 * This is enforced at the repository layer — queries without workspaceId are rejected.
 */
export interface WorkspaceContext {
  readonly workspaceId: WorkspaceId;
  readonly userId: UserId;
}

// ─────────────────────────────────────────────
// Pagination & Querying
// ─────────────────────────────────────────────

/**
 * Cursor-based pagination input.
 */
export interface PaginationInput {
  readonly limit: number;
  readonly cursor?: string;
  readonly direction?: 'forward' | 'backward';
}

/**
 * Cursor-based pagination output.
 */
export interface PaginatedResult<T> {
  readonly items: readonly T[];
  readonly cursor: string | null;
  readonly hasMore: boolean;
  readonly totalCount?: number;
}

/**
 * Time-range filter for queries.
 */
export interface TimeRangeFilter {
  readonly from?: ISOTimestamp;
  readonly to?: ISOTimestamp;
}

// ─────────────────────────────────────────────
// Monetary Values
// ─────────────────────────────────────────────

/**
 * Decimal-safe monetary value. Stored as string to avoid floating-point errors.
 * All cost values in V3 use this type.
 * 
 * Rules:
 * - null means "not measured / unavailable"
 * - "0" or "0.000000" means "measured as zero"
 * - Never use number for money
 */
export type MonetaryValue = string;

// ─────────────────────────────────────────────
// Version & Lineage
// ─────────────────────────────────────────────

/**
 * Schema version marker. Allows forward-compatible evolution of stored data.
 */
export interface Versioned {
  readonly schemaVersion: number;
}

/**
 * Lineage tracking — where did this entity come from.
 * Used for dual-write traceability.
 */
export interface DualWriteLineage {
  /** If this entity was created as a V3 shadow of a legacy execution */
  readonly legacyExecutionId?: string;
  /** If this entity was created as a V3 shadow of a legacy engine run */
  readonly legacyEngineRunId?: string;
}