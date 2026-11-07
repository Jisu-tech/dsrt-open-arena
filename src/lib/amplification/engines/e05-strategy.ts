import type { AmplificationEngine, EngineContext, EngineResult, StrategyResult, StrategyName } from '../types';

export const e05StrategyEngine: AmplificationEngine<StrategyResult> = {
  id: 'E05',
  name: 'Strategy Selection',
  wave: 2,

  async execute(ctx: EngineContext): Promise<EngineResult<StrategyResult>> {
    const started = Date.now();
    const intent = ctx.artifacts.intent;
    const plan = ctx.artifacts.plan;

    const category = intent?.intent_category || 'other';
    const complexity = intent?.complexity || 'medium';
    const requiresTools = Boolean(intent?.requires_tools);
    const planStrategy = plan?.recommended_strategy;

    let strategy: StrategyName = 'direct';
    if (requiresTools) {
      strategy = 'tool-augmented';
    } else if (planStrategy === 'verify-first' || category === 'debugging') {
      strategy = 'verify-first';
    } else if (planStrategy === 'creative-explore' || category === 'creative') {
      strategy = 'creative-explore';
    } else if (planStrategy === 'stepwise' || complexity === 'high') {
      strategy = 'stepwise';
    }

    const temperature =
      strategy === 'creative-explore'
        ? 0.85
        : strategy === 'direct'
          ? 0.3
          : strategy === 'verify-first'
            ? 0.2
            : 0.5;

    const topP = strategy === 'creative-explore' ? 0.95 : 0.9;
    const maxTokens = complexity === 'high' ? 4096 : complexity === 'medium' ? 2048 : 1024;

    const result: StrategyResult = {
      strategy,
      temperature,
      top_p: topP,
      max_tokens: maxTokens,
      verify_after: strategy === 'verify-first' || complexity === 'high',
      use_tools: requiresTools,
      reasoning: `category=${category}, complexity=${complexity}, plan=${planStrategy ?? 'n/a'}, requires_tools=${requiresTools}`,
    };

    ctx.artifacts.strategy = result;

    return {
      success: true,
      data: result,
      tokens_prompt: 0,
      tokens_completion: 0,
      latency_ms: Date.now() - started,
    };
  },
};

export const e05Strategy = e05StrategyEngine;
export default e05StrategyEngine;