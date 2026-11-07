import type { V3Provider } from '../contracts/registry';
import type { ProviderRegistryRepository } from '../repositories/provider-registry.repository';
import { normalizeProviderUsage } from './usage-normalizer';
import { calculateCost } from './cost-calculator';
import type { InvocationRecorder, GatewayInvocationContext } from './invocation-recorder';

export interface V3GatewayContext extends GatewayInvocationContext {
  provider: V3Provider; 
}

export interface RawGatewayResponse<T> {
  // The actual mapped result your V1/V2 app uses today
  result: T;
  // The unadulterated JSON payload from the LLM provider
  rawProviderPayload: Record<string, any>;
}

/**
 * The V3 Gateway Interceptor.
 * Wraps ANY existing AI engine invocation, extracts precise telemetry, 
 * calculates exact cost against the V3 Registry, and logs it.
 * 
 * Usage:
 * const result = await executeWithV3Telemetry(v3Context, deps, async () => {
 *   return await legacyEngine.generate(...);
 * });
 */
export async function executeWithV3Telemetry<T>(
  context: V3GatewayContext,
  dependencies: {
    registryRepo: ProviderRegistryRepository;
    invocationRecorder: InvocationRecorder;
  },
  executeCall: () => Promise<RawGatewayResponse<T>>
): Promise<RawGatewayResponse<T>> {
  
  const startTime = Date.now();
  let durationMs: number | null = null;
  
  try {
    // 1. Execute the actual LLM call
    const response = await executeCall();
    
    // 2. Execution complete. Stop timer.
    durationMs = Date.now() - startTime;

    // 3. Telemetry Extraction phase (Background safe)
    // We execute telemetry processing concurrently or after so we don't delay the return.
    processTelemetry(context, dependencies, {
      durationMs,
      status: 'success',
      rawPayload: response.rawProviderPayload
    });

    // 4. Return unaltered response to the legacy caller
    return response;

  } catch (error) {
    // Invocation Failed
    durationMs = Date.now() - startTime;
    const isTimeout = (error instanceof Error && error.name === 'TimeoutError');
    const status = isTimeout ? 'timeout' : 'failed';
    const errorMessage = error instanceof Error ? error.message : String(error);

    processTelemetry(context, dependencies, {
      durationMs,
      status,
      rawPayload: null, // failed calls usually lack clean payloads
      errorObj: { errorMessage }
    });

    // We MUST rethrow to allow the application's native fallback/error logic to handle it
    throw error;
  }
}

/**
 * Internal helper to run the telemetry pipeline.
 * Separated to ensure tight, predictable execution.
 */
async function processTelemetry(
  context: V3GatewayContext,
  deps: { registryRepo: ProviderRegistryRepository; invocationRecorder: InvocationRecorder },
  data: {
    durationMs: number;
    status: 'success' | 'failed' | 'timeout';
    rawPayload: Record<string, any> | null;
    errorObj?: { errorMessage: string };
  }
) {
  try {
    // A. Extract usage
    const usage = normalizeProviderUsage(context.provider, data.rawPayload);

    // B. Fetch exact active pricing
    const pricing = await deps.registryRepo.getModelPricing(context.provider, context.providerModelId);

    // C. Calculate financial cost
    const cost = calculateCost(usage, pricing);

    // D. Record to invocation tables
    await deps.invocationRecorder.record(
      context,
      data.status,
      usage,
      cost,
      {
        durationMs: data.durationMs,
        timeToFirstTokenMs: null, // V1/V2 streaming is handled via a different wrapper if needed
      },
      data.errorObj
    );
  } catch (err) {
    // Fallback error logging if telemetry pipeline crashes.
    console.error(`[V3/GatewayWrapper] Critical error in processing telemetry:`, err);
  }
}