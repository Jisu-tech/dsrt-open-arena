export interface EngineTiming {
  engineId: string;
  name: string;
  durationMs: number;
  success: boolean;
  tokensPrompt?: number;
  tokensCompletion?: number;
}

export interface ToolTiming {
  name: string;
  durationMs: number;
  success: boolean;
}

export interface PerformanceSnapshot {
  executionId: string;
  startedAt: number;
  completedAt?: number;
  totalLatencyMs: number;
  timeToFirstTokenMs: number | null;
  engineTimings: EngineTiming[];
  toolTimings: ToolTiming[];
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  providerCostUsd: number;
  dsrtCostUsd: number;
  totalCostUsd: number;
  qualityOverall: number | null;
  verificationPassed: boolean | null;
  fallbackUsed: boolean;
  chosenProvider: string | null;
  chosenModel: string | null;
  amplified: boolean;
  currentState: string;
}

export type MetricsListener = (snapshot: PerformanceSnapshot) => void;

/**
 * In-memory real-time performance aggregator for a single execution lifecycle.
 */
export class PerformanceTracker {
  private snapshot: PerformanceSnapshot;
  private listeners: Set<MetricsListener> = new Set();
  private firstTokenAt: number | null = null;

  constructor(executionId: string, amplified = true) {
    this.snapshot = {
      executionId,
      startedAt: Date.now(),
      totalLatencyMs: 0,
      timeToFirstTokenMs: null,
      engineTimings: [],
      toolTimings: [],
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      providerCostUsd: 0,
      dsrtCostUsd: 0,
      totalCostUsd: 0,
      qualityOverall: null,
      verificationPassed: null,
      fallbackUsed: false,
      chosenProvider: null,
      chosenModel: null,
      amplified,
      currentState: 'INITIALIZING',
    };
  }

  subscribe(listener: MetricsListener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    const snap = this.getSnapshot();
    this.listeners.forEach((l) => l(snap));
  }

  getSnapshot(): PerformanceSnapshot {
    return {
      ...this.snapshot,
      totalLatencyMs: (this.snapshot.completedAt ?? Date.now()) - this.snapshot.startedAt,
      totalTokens: this.snapshot.promptTokens + this.snapshot.completionTokens,
      totalCostUsd: this.snapshot.providerCostUsd + this.snapshot.dsrtCostUsd,
      timeToFirstTokenMs: this.firstTokenAt
        ? this.firstTokenAt - this.snapshot.startedAt
        : null,
      engineTimings: [...this.snapshot.engineTimings],
      toolTimings: [...this.snapshot.toolTimings],
    };
  }

  setState(state: string): void {
    this.snapshot.currentState = state;
    this.emit();
  }

  recordEngineStart(engineId: string, name: string): void {
    this.snapshot.currentState = `ENGINE:${engineId}:${name}`;
    this.emit();
  }

  recordEngineDone(
    engineId: string,
    name: string,
    success: boolean,
    durationMs: number,
    tokensPrompt = 0,
    tokensCompletion = 0
  ): void {
    this.snapshot.engineTimings.push({
      engineId,
      name,
      durationMs,
      success,
      tokensPrompt,
      tokensCompletion,
    });
    this.emit();
  }

  recordTool(name: string, success: boolean, durationMs: number): void {
    this.snapshot.toolTimings.push({ name, durationMs, success });
    this.emit();
  }

  recordFirstToken(): void {
    if (this.firstTokenAt === null) {
      this.firstTokenAt = Date.now();
      this.emit();
    }
  }

  recordContent(): void {
    this.recordFirstToken();
  }

  complete(input: {
    promptTokens: number;
    completionTokens: number;
    providerCostUsd: number;
    dsrtCostUsd: number;
    qualityOverall?: number | null;
    verificationPassed?: boolean | null;
    fallbackUsed?: boolean;
    chosenProvider?: string;
    chosenModel?: string;
  }): PerformanceSnapshot {
    this.snapshot.completedAt = Date.now();
    this.snapshot.promptTokens = input.promptTokens;
    this.snapshot.completionTokens = input.completionTokens;
    this.snapshot.providerCostUsd = input.providerCostUsd;
    this.snapshot.dsrtCostUsd = input.dsrtCostUsd;
    this.snapshot.qualityOverall = input.qualityOverall ?? null;
    this.snapshot.verificationPassed = input.verificationPassed ?? null;
    this.snapshot.fallbackUsed = Boolean(input.fallbackUsed);
    this.snapshot.chosenProvider = input.chosenProvider ?? null;
    this.snapshot.chosenModel = input.chosenModel ?? null;
    this.snapshot.currentState = 'COMPLETED';
    this.emit();
    return this.getSnapshot();
  }

  fail(error: string): void {
    this.snapshot.completedAt = Date.now();
    this.snapshot.currentState = `FAILED: ${error}`;
    this.emit();
  }
}

export function formatMs(ms: number | null | undefined): string {
  if (ms == null || Number.isNaN(ms)) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function formatUsd(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) return '$0.0000';
  if (amount < 0.01) return `$${amount.toFixed(5)}`;
  return `$${amount.toFixed(4)}`;
}

export function formatTokens(n: number | null | undefined): string {
  if (n == null) return '0';
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}