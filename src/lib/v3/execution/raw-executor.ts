/**
 * RawExecutor — thin adapter over the existing provider gateway.
 * MUST return the unadulterated provider payload so V3 can measure it.
 *
 * This module does not invent HTTP calls. It delegates to the live
 * gateway function injected by the caller (keeps V1/V2 ownership intact).
 */

import type { V3Provider } from '../contracts/registry';
import type { RawGatewayResponse } from '../providers/gateway-wrapper';

export interface ExecutionRequest {
  readonly provider: V3Provider;
  readonly providerModelId: string;
  readonly messages: readonly { role: string; content: string }[];
  readonly temperature?: number;
  readonly maxTokens?: number | null;
  readonly stream?: boolean;
  readonly signal?: AbortSignal;
  /** Workspace BYOK key — required. V3 does not mint keys. */
  readonly apiKey: string;
  readonly extra?: Record<string, unknown>;
}

/**
 * Injected function matching whatever the existing gateway exposes.
 * Return both the app-level result and the raw provider JSON.
 */
export type LegacyGatewayCall<T = unknown> = (
  req: ExecutionRequest,
) => Promise<RawGatewayResponse<T>>;

export class RawExecutor {
  constructor(private readonly gatewayCall: LegacyGatewayCall) {}

  async execute<T = unknown>(req: ExecutionRequest): Promise<RawGatewayResponse<T>> {
    if (!req.apiKey) {
      throw new Error('RawExecutor: apiKey is required (BYOK)');
    }
    if (!req.provider || !req.providerModelId) {
      throw new Error('RawExecutor: provider and providerModelId are required');
    }
    return this.gatewayCall(req);
  }
}