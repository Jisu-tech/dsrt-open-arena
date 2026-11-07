import type {
  AmplificationEngine,
  EngineContext,
  EngineResult,
  QualityDimension,
  QualityResult,
  VerificationResult,
} from '../types';
import { callLlmJson } from '../llmJson';

const DIMENSIONS: QualityDimension[] = [
  'accuracy',
  'completeness',
  'clarity',
  'actionability',
  'relevance',
];

const WEIGHTS: Record<QualityDimension, number> = {
  accuracy: 0.25,
  completeness: 0.2,
  clarity: 0.2,
  actionability: 0.15,
  relevance: 0.2,
};

type QualityJson = {
  scores?: Partial<Record<QualityDimension, number>>;
  rationale?: string;
  strengths?: string[];
  weaknesses?: string[];
};

function clampScore(n: unknown): number {
  const v = Number(n);
  if (Number.isNaN(v)) return 5;
  return Math.max(0, Math.min(10, v));
}

function weightedOverall(scores: Record<QualityDimension, number>): number {
  let sum = 0;
  for (const d of DIMENSIONS) sum += scores[d] * WEIGHTS[d];
  return Math.round(sum * 10) / 10;
}

function heuristicQuality(content: string, verification?: VerificationResult): QualityResult {
  const len = content.trim().length;
  const hasStructure = /^#{1,3}\s|^\d+\.|^- /m.test(content);
  const hasCode = /```/.test(content);

  const clarity = hasStructure ? 7.5 : len > 80 ? 6.5 : 5.5;
  const completeness = len > 800 ? 8 : len > 300 ? 7 : len > 80 ? 6 : 4.5;
  const actionability =
    hasCode || /\b(step|should|use|run|apply)\b/i.test(content) ? 7.5 : 6;
  const relevance = 7;
  let accuracy = 6.5;
  if (verification) {
    accuracy = verification.passed
      ? 6.5 + verification.overall_confidence * 2.5
      : 4 + verification.overall_confidence * 2;
  }

  const scores = {
    accuracy: clampScore(accuracy),
    completeness: clampScore(completeness),
    clarity: clampScore(clarity),
    actionability: clampScore(actionability),
    relevance: clampScore(relevance),
  };

  return {
    scores,
    overall: weightedOverall(scores),
    rationale: 'Heuristic quality estimate (LLM scoring skipped or unavailable).',
    strengths: [
      hasStructure ? 'Structured formatting' : 'Concise reply',
      hasCode ? 'Includes code/examples' : 'Direct language',
    ],
    weaknesses: len < 100 ? ['Possibly under-specified'] : [],
  };
}

function okResult<T>(data: T, start: number, tokens = { p: 0, c: 0 }, error?: string): EngineResult<T> {
  return {
    success: true,
    data,
    tokens_prompt: tokens.p,
    tokens_completion: tokens.c,
    latency_ms: Date.now() - start,
    error,
  };
}

export const e11QualityEngine: AmplificationEngine<QualityResult> = {
  id: 'E11',
  name: 'Quality Measurement',
  wave: 3,

  async execute(ctx: EngineContext): Promise<EngineResult<QualityResult>> {
    const start = Date.now();
    const content = String(
      ctx.artifacts.final_content ??
        ctx.artifacts.refinement?.refined_content ??
        ctx.artifacts.draft_content ??
        ''
    );
    const intent = ctx.artifacts.intent;
    const verification = ctx.artifacts.verification;

    if (!content.trim()) {
      return okResult(
        {
          scores: { accuracy: 0, completeness: 0, clarity: 0, actionability: 0, relevance: 0 },
          overall: 0,
          rationale: 'Empty output.',
          strengths: [],
          weaknesses: ['No content'],
        },
        start
      );
    }

    if (content.length < 60) {
      return okResult(heuristicQuality(content, verification), start);
    }

    try {
      const result = await callLlmJson<QualityJson>({
        provider: ctx.provider,
        model: ctx.model,
        apiKey: ctx.apiKey,
        system: `You are the Quality Measurement engine of DSRT Open Arena.
Score the assistant OUTPUT for a fair amplified-vs-raw comparison rubric.
Score each dimension 0–10 (float allowed):
- accuracy: factual correctness / internal consistency
- completeness: covers the ask and success criteria
- clarity: structure, readability
- actionability: user can act on it
- relevance: on-topic, minimal filler

Return ONLY valid JSON. Be calibrated — 10 is rare, 7 is solid, 5 is mediocre.`,
        user: JSON.stringify({
          user_message: ctx.userMessage,
          primary_intent: intent?.primary_intent,
          intent_category: intent?.intent_category,
          complexity: intent?.complexity,
          success_criteria: intent?.success_criteria ?? [],
          verification_passed: verification?.passed,
          output: content.slice(0, 12000),
        }),
        schemaHint: `{
  "scores": {
    "accuracy": 0,
    "completeness": 0,
    "clarity": 0,
    "actionability": 0,
    "relevance": 0
  },
  "rationale": "string",
  "strengths": ["string"],
  "weaknesses": ["string"]
}`,
      });

      const scores = {
        accuracy: clampScore(result.data.scores?.accuracy),
        completeness: clampScore(result.data.scores?.completeness),
        clarity: clampScore(result.data.scores?.clarity),
        actionability: clampScore(result.data.scores?.actionability),
        relevance: clampScore(result.data.scores?.relevance),
      };

      const data: QualityResult = {
        scores,
        overall: weightedOverall(scores),
        rationale: String(result.data.rationale ?? ''),
        strengths: Array.isArray(result.data.strengths) ? result.data.strengths.map(String) : [],
        weaknesses: Array.isArray(result.data.weaknesses) ? result.data.weaknesses.map(String) : [],
      };

      return okResult(data, start, { p: result.promptTokens, c: result.completionTokens });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Quality scoring failed';
      return okResult(heuristicQuality(content, verification), start, { p: 0, c: 0 }, message);
    }
  },
};

export const e11Quality = e11QualityEngine;
export default e11QualityEngine;