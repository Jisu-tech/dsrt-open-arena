/**
 * DSRT Open Arena V3 — Conversation & Message Contracts
 * 
 * A Conversation is a sequence of messages between a user and the system within a workspace.
 * Messages are ordered, immutable once created, and linked to tasks for cost attribution.
 * 
 * @module v3/contracts/conversation
 */

import type {
  ConversationId,
  MessageId,
  TaskId,
  WorkspaceId,
  UserId,
} from './identifiers';
import type { ISOTimestamp, AuditFields, MonetaryValue } from './metadata';
import { UserMode } from './enums';

// ─────────────────────────────────────────────
// Conversation
// ─────────────────────────────────────────────

/**
 * A conversation session between a user and the system.
 */
export interface V3Conversation extends AuditFields {
  readonly id: ConversationId;
  readonly workspaceId: WorkspaceId;
  readonly userId: UserId;

  /** Display title — may be auto-generated or user-set. */
  readonly title: string | null;

  /** The mode active when this conversation was started. */
  readonly mode: UserMode;

  /** Total number of messages in this conversation. */
  readonly messageCount: number;

  /** Running total cost of all tasks in this conversation. */
  readonly totalCost: MonetaryValue;

  /** Whether the conversation is archived. */
  readonly isArchived: boolean;
}

// ─────────────────────────────────────────────
// Message
// ─────────────────────────────────────────────

/**
 * Message role — who authored the message.
 */
export type MessageRole = 'user' | 'assistant' | 'system';

/**
 * A single message in a conversation.
 */
export interface V3Message extends AuditFields {
  readonly id: MessageId;
  readonly conversationId: ConversationId;
  readonly workspaceId: WorkspaceId;

  /** Message ordering within the conversation. 0-indexed, monotonically increasing. */
  readonly sequence: number;

  /** Who authored this message. */
  readonly role: MessageRole;

  /** The message content. */
  readonly content: string;

  /** The V3 task that produced this message (for assistant messages). null for user/system messages. */
  readonly taskId: TaskId | null;

  /** Cost attributed to producing this message. null for user messages. */
  readonly cost: MonetaryValue | null;

  /** Model that generated this message. null for user/system messages. */
  readonly modelId: string | null;

  /** Provider that generated this message. null for user/system messages. */
  readonly provider: string | null;
}

// ─────────────────────────────────────────────
// Creation Inputs
// ─────────────────────────────────────────────

/**
 * Input for creating a new conversation.
 */
export interface CreateConversationInput {
  readonly workspaceId: WorkspaceId;
  readonly userId: UserId;
  readonly title?: string;
  readonly mode: UserMode;
}

/**
 * Input for appending a message to a conversation.
 */
export interface CreateMessageInput {
  readonly conversationId: ConversationId;
  readonly workspaceId: WorkspaceId;
  readonly role: MessageRole;
  readonly content: string;
  readonly taskId?: TaskId;
  readonly cost?: MonetaryValue;
  readonly modelId?: string;
  readonly provider?: string;
}