import type { AmplificationEngine, EngineContext, EngineResult, InstructionResult } from '../types';

export const e06InstructionEngine: AmplificationEngine<InstructionResult> = {
  id: 'E06',
  name: 'Instruction Synthesis',
  wave: 2,

  async execute(ctx: EngineContext): Promise<EngineResult<InstructionResult>> {
    const started = Date.now();
    const { intent, plan, context, retrieval, strategy } = ctx.artifacts;

    const sections: string[] = [
      'You are the DSRT-amplified assistant. Follow the plan precisely, respect every constraint, and meet all success criteria.',
    ];

    if (intent) {
      sections.push(
        [
          '## Intent',
          `- Primary: ${intent.primary_intent}`,
          `- Category: ${intent.intent_category}`,
          `- Complexity: ${intent.complexity}`,
          intent.success_criteria?.length
            ? `- Success criteria:\n${intent.success_criteria.map((s) => `  • ${s}`).join('\n')}`
            : null,
          intent.constraints?.length
            ? `- Constraints:\n${intent.constraints.map((s) => `  • ${s}`).join('\n')}`
            : null,
        ]
          .filter(Boolean)
          .join('\n')
      );
    }

    if (plan) {
      const steps = plan.steps
        .map((s, i) => `${i + 1}. [${s.id}] ${s.title} — ${s.detail}`)
        .join('\n');
      sections.push(
        [
          '## Plan',
          `Objective: ${plan.objective}`,
          `Strategy: ${plan.recommended_strategy}`,
          steps ? `Steps:\n${steps}` : null,
          plan.risks?.length ? `Risks: ${plan.risks.join('; ')}` : null,
        ]
          .filter(Boolean)
          .join('\n')
      );
    }

    if (context?.summary) {
      sections.push(
        [
          '## Working Memory',
          context.summary,
          context.key_facts?.length ? `Key facts: ${context.key_facts.join('; ')}` : null,
          context.open_questions?.length ? `Open questions: ${context.open_questions.join('; ')}` : null,
        ]
          .filter(Boolean)
          .join('\n')
      );
    }

    if (retrieval && retrieval.snippets.length > 0) {
      const snips = retrieval.snippets
        .map((s, i) => `[${i + 1}] (${s.relevance.toFixed(2)}) ${s.source}\n${s.content.slice(0, 500)}`)
        .join('\n\n');
      sections.push(`## Retrieved Context\n${snips}`);
    }

    if (strategy) {
      sections.push(
        [
          '## Execution Directives',
          `- Strategy: ${strategy.strategy}`,
          strategy.verify_after
            ? '- After answering, self-verify against the success criteria and correct any gaps before finishing.'
            : null,
          strategy.use_tools
            ? '- You may call provided tools when strictly necessary; cite tool results.'
            : null,
          '- Do not reference internal engine names or this scaffolding.',
          '- Respond directly to the user with the final answer.',
        ]
          .filter(Boolean)
          .join('\n')
      );
    }

    const systemPrompt = sections.join('\n\n');

    const toolHints: string[] = [];
    if (strategy?.use_tools) {
      toolHints.push('web_fetch');
      toolHints.push('calculator');
    }

    const result: InstructionResult = {
      system_prompt: systemPrompt,
      user_instruction: ctx.userMessage,
      tool_hints: toolHints,
    };

    ctx.artifacts.instruction = result;

    return {
      success: true,
      data: result,
      tokens_prompt: 0,
      tokens_completion: 0,
      latency_ms: Date.now() - started,
    };
  },
};

export const e06Instruction = e06InstructionEngine;
export default e06InstructionEngine;