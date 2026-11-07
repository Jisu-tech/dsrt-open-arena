/**
 * Task lifecycle state machine.
 * Illegal transitions throw — never silently skipped.
 */

export type TaskStatus =
  | 'pending'
  | 'deciding'
  | 'awaiting_budget'
  | 'invoking'
  | 'completed'
  | 'failed'
  | 'rejected'
  | 'cancelled';

const ALLOWED: Record<TaskStatus, readonly TaskStatus[]> = {
  pending: ['deciding', 'cancelled'],
  deciding: ['awaiting_budget', 'invoking', 'rejected', 'failed', 'cancelled'],
  awaiting_budget: ['invoking', 'rejected', 'failed', 'cancelled'],
  invoking: ['completed', 'failed', 'cancelled'],
  completed: [],
  failed: [],
  rejected: [],
  cancelled: [],
};

export function assertTransition(from: TaskStatus, to: TaskStatus): void {
  const ok = ALLOWED[from]?.includes(to);
  if (!ok) {
    throw new Error(`Illegal task transition ${from} → ${to}`);
  }
}

export function isTerminal(status: TaskStatus): boolean {
  return ALLOWED[status]?.length === 0;
}