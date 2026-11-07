import type { AmplificationEngine, EngineContext, EngineResult, OrchestrationResult } from '../types';

export const e07OrchestrationEngine: AmplificationEngine<OrchestrationResult> = {
  id: 'E07',
  name: 'Model Orchestration',
  wave: 2,

  async execute(ctx: EngineContext): Promise<EngineResult<OrchestrationResult>> {
    const started = Date.now();

    const chosenProvider = ctx.provider;
    const chosenModel = ctx.model;

    const result: OrchestrationResult = {
      chosen_provider: chosenProvider,
      chosen_model: chosenModel,
      fallback_used: false,
      attempts: [{ provider: chosenProvider, model: chosenModel, success: true }],
    };

    ctx.artifacts.orchestration = result;

    return {
      success: true,
      data: result,
      tokens_prompt: 0,
      tokens_completion: 0,
      latency_ms: Date.now() - started,
    };
  },
};

// 🚨 FALLBACK_CHAIN has been intentionally emptied to enforce fair-play rules.
// The system must NEVER silently switch the user's selected model.
// Kept as empty export to preserve import compatibility with orchestrator.ts.
export const FALLBACK_CHAIN: Array<{ provider: never; model: never }> = [];

export const e07Orchestration = e07OrchestrationEngine;
export default e07OrchestrationEngine;