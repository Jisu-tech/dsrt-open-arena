/**
 * DSRT Performance & Metrics Tracker
 * Live tracking for TTFT, tokens/sec, latency, costs, and engine execution timeline.
 */

export interface ToolTiming {
  name: string;
  durationMs: number;
  status: 'success' | 'error' | 'pending';
  startTime?: number;
  endTime?: number;
}

export interface EngineTiming {
  phase: string;
  durationMs: number;
  status: 'completed' | 'running' | 'failed' | 'idle';
  tools?: ToolTiming[];
  details?: string;
}

export interface PerformanceSnapshot {
  ttftMs: number | null;
  totalDurationMs: number;
  tokensPerSecond: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  estimatedCostUsd: number;
  memoryUsageMb?: number;
  engineTimings?: EngineTiming[];
}

export type MetricsListener = (snapshot: PerformanceSnapshot) => void;

export class PerformanceTracker {
  private startTime: number | null = null;
  private firstTokenTime: number | null = null;
  private promptTokens = 0;
  private completionTokens = 0;
  private estimatedCostUsd = 0;
  private engineTimings: EngineTiming[] = [];
  private listeners: Set<MetricsListener> = new Set();

  public start(): void {
    this.startTime = performance.now();
    this.firstTokenTime = null;
    this.promptTokens = 0;
    this.completionTokens = 0;
    this.estimatedCostUsd = 0;
    this.engineTimings = [];
    this.notify();
  }

  public markFirstToken(): void {
    if (!this.firstTokenTime && this.startTime) {
      this.firstTokenTime = performance.now();
      this.notify();
    }
  }

  public addTokens(prompt: number, completion: number): void {
    this.promptTokens += prompt;
    this.completionTokens += completion;
    this.notify();
  }

  public setCost(costUsd: number): void {
    this.estimatedCostUsd = costUsd;
    this.notify();
  }

  public addEngineTiming(timing: EngineTiming): void {
    this.engineTimings.push(timing);
    this.notify();
  }

  public getSnapshot(): PerformanceSnapshot {
    const now = performance.now();
    const start = this.startTime ?? now;
    const totalDurationMs = Math.max(0, now - start);

    const ttftMs =
      this.firstTokenTime && this.startTime
        ? Math.max(0, this.firstTokenTime - this.startTime)
        : null;

    const streamDurationSec = this.firstTokenTime
      ? Math.max(0.001, (now - this.firstTokenTime) / 1000)
      : Math.max(0.001, totalDurationMs / 1000);

    const tokensPerSecond =
      this.completionTokens > 0
        ? Math.round((this.completionTokens / streamDurationSec) * 10) / 10
        : 0;

    return {
      ttftMs,
      totalDurationMs: Math.round(totalDurationMs),
      tokensPerSecond,
      totalTokens: this.promptTokens + this.completionTokens,
      promptTokens: this.promptTokens,
      completionTokens: this.completionTokens,
      estimatedCostUsd: this.estimatedCostUsd,
      engineTimings: [...this.engineTimings],
    };
  }

  public subscribe(listener: MetricsListener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const snapshot = this.getSnapshot();
    this.listeners.forEach((fn) => fn(snapshot));
  }
}

// Format millisecond latency values
export function formatMs(ms: number | undefined | null): string {
  if (ms == null || isNaN(ms)) return '0ms';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

// Format monetary amounts in USD
export function formatCost(cost: number | undefined | null): string {
  if (cost == null || isNaN(cost)) return '$0.0000';
  if (cost === 0) return '$0.0000';
  if (cost < 0.0001) return `<$0.0001`;
  return `$${cost.toFixed(4)}`;
}

// Export alias formatUsd to guarantee compatibility with all panel components
export const formatUsd = formatCost;

// Format memory and byte sizes
export function formatBytes(bytes: number | undefined | null): string {
  if (bytes == null || isNaN(bytes)) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Format integer token counts
export function formatTokens(tokens: number | undefined | null): string {
  if (tokens == null || isNaN(tokens)) return '0';
  return tokens.toLocaleString();
}