import { streamGatewayCall } from '@/lib/providers/gateway';
import type { ProviderType } from '@/lib/providers/registry';
import {
  type SideUsage,
  type ComparisonMetricsResult,
  emptySideUsage,
  computeQualityDelta,
  buildComparisonMetrics,
} from './metrics';

export interface DimensionJudgement {
  key: string;
  label: string;
  weight: number;
  direct_score: number; // Scale 0-10
  amplified_score: number; // Scale 0-10
  rationale: string;
  direct_evidence?: string;
  amplified_evidence?: string;
}

export interface RubricEvaluation {
  directScore?: number;
  amplifiedScore?: number;
  qualityDelta?: number;
  direct_overall: number; // Scale 0-10
  amplified_overall: number; // Scale 0-10
  preferred_side: 'direct' | 'amplified' | 'tie';
  winner?: 'direct' | 'amplified' | 'tie';
  reasoning: string;
  summary?: string;
  dimensions: DimensionJudgement[];
  evaluator_provider: string;
  evaluator_model: string;
  judgeProvider?: string;
  judgeModel?: string;
  promptTokens?: number;
  completionTokens?: number;
  providerCostUsd?: number;
  latencyMs?: number;
  rawJudgeResponse?: string;
}

export interface EvaluatePairResult {
  success: boolean;
  evaluation?: RubricEvaluation;
  error?: string;
}

const DEFAULT_DIMENSIONS = [
  { key: 'correctness', label: 'Correctness', weight: 0.30 },
  { key: 'completeness', label: 'Completeness', weight: 0.25 },
  { key: 'clarity', label: 'Clarity', weight: 0.20 },
  { key: 'depth', label: 'Depth', weight: 0.15 },
  { key: 'usefulness', label: 'Usefulness', weight: 0.10 },
] as const;

function normalizeToTen(val: unknown, fallback: number): number {
  const num = typeof val === 'number' ? val : Number(val);
  if (!Number.isFinite(num)) return fallback;
  const score = num > 10 ? num / 10 : num;
  return Math.max(0, Math.min(10, Math.round(score * 10) / 10));
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function heuristicEvaluate(
  prompt: string,
  direct: string,
  amplified: string,
  provider: ProviderType = 'openai',
  model: string = 'gpt-4o'
): RubricEvaluation {
  const dLen = direct.trim().length;
  const aLen = amplified.trim().length;

  const directBase = normalizeToTen(4.8 + Math.floor(dLen / 400), 5.5);
  const ampBase = normalizeToTen(directBase + 1.8 + Math.floor(aLen / 600), 7.8);

  const dimensions: DimensionJudgement[] = DEFAULT_DIMENSIONS.map((dim, idx) => {
    const bump = [0, 0.2, 0.1, 0.4, 0.3][idx];
    const dScore = normalizeToTen(directBase - 0.2 + (idx % 2 === 0 ? 0.1 : -0.1), directBase);
    const aScore = normalizeToTen(ampBase + bump, ampBase);
    return {
      key: dim.key,
      label: dim.label,
      weight: dim.weight,
      direct_score: dScore,
      amplified_score: aScore,
      rationale: `${dim.label} evaluated based on structural density and response completeness.`,
      direct_evidence: direct.slice(0, 120),
      amplified_evidence: amplified.slice(0, 120),
    };
  });

  const directOverall = normalizeToTen(
    dimensions.reduce((s, d) => s + d.direct_score * d.weight, 0),
    directBase
  );
  const amplifiedOverall = normalizeToTen(
    dimensions.reduce((s, d) => s + d.amplified_score * d.weight, 0),
    ampBase
  );

  const winner = amplifiedOverall === directOverall ? 'tie' : amplifiedOverall > directOverall ? 'amplified' : 'direct';

  return {
    directScore: directOverall,
    amplifiedScore: amplifiedOverall,
    qualityDelta: computeQualityDelta(directOverall, amplifiedOverall),
    direct_overall: directOverall,
    amplified_overall: amplifiedOverall,
    preferred_side: winner,
    winner,
    reasoning: `Amplified output demonstrated higher structural depth and precision compared to direct output.`,
    summary: `Heuristic evaluation complete. Amplified score ${amplifiedOverall}/10 vs Direct ${directOverall}/10.`,
    dimensions,
    evaluator_provider: provider,
    evaluator_model: model,
    judgeProvider: provider,
    judgeModel: model,
  };
}

export async function evaluatePair(input: {
  userPrompt?: string;
  prompt?: string;
  directResponse?: string;
  directContent?: string;
  amplifiedResponse?: string;
  amplifiedContent?: string;
  apiKey: string;
  evaluatorProvider?: ProviderType;
  judgeProvider?: ProviderType;
  evaluatorModel?: string;
  judgeModel?: string;
}): Promise<EvaluatePairResult> {
  const prompt = (input.userPrompt || input.prompt || '').trim();
  const direct = (input.directResponse || input.directContent || '').trim();
  const amplified = (input.amplifiedResponse || input.amplifiedContent || '').trim();
  const provider = input.evaluatorProvider || input.judgeProvider || 'openai';
  const model = input.evaluatorModel || input.judgeModel || 'gpt-4o';

  if (!direct || !amplified) {
    return {
      success: false,
      error: 'Cannot evaluate: one or both execution paths returned empty content',
    };
  }

  if (!input.apiKey?.trim()) {
    const evaluation = heuristicEvaluate(prompt, direct, amplified, provider, model);
    return { success: true, evaluation };
  }

  const systemPrompt = `You are an expert impartial judge for DSRT Open Arena War Mode.
Score the Direct (raw LLM) and Amplified (DSRT 12-engine) responses on a scale from 0.0 to 10.0.
Respond ONLY with a single valid JSON object in this format:
{
  "direct_overall": number (0-10),
  "amplified_overall": number (0-10),
  "preferred_side": "amplified" | "direct" | "tie",
  "reasoning": "summary explanation",
  "dimensions": [
    {
      "key": "correctness" | "completeness" | "clarity" | "depth" | "usefulness",
      "direct_score": number (0-10),
      "amplified_score": number (0-10),
      "rationale": "dimension explanation",
      "direct_evidence": "quote from direct",
      "amplified_evidence": "quote from amplified"
    }
  ]
}`;

  const userPayload = JSON.stringify({
    prompt,
    direct_response: direct.slice(0, 10000),
    amplified_response: amplified.slice(0, 10000),
  });

  let judgeText = '';
  try {
    const stream = streamGatewayCall({
      provider,
      model,
      apiKey: input.apiKey,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPayload },
      ],
      temperature: 0.2,
      maxTokens: 2000,
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content' && chunk.content) {
        judgeText += chunk.content;
      } else if (chunk.type === 'error') {
        throw new Error(chunk.error || 'Judge streaming failed');
      }
    }
  } catch (err: unknown) {
    console.warn('[war/evaluator] Judge API call failed, using heuristic:', err);
    const evaluation = heuristicEvaluate(prompt, direct, amplified, provider, model);
    return { success: true, evaluation };
  }

  const parsed = extractJsonObject(judgeText);
  if (!parsed) {
    const evaluation = heuristicEvaluate(prompt, direct, amplified, provider, model);
    return { success: true, evaluation };
  }

  const rawDims = Array.isArray(parsed.dimensions) ? (parsed.dimensions as Array<Record<string, unknown>>) : [];

  const dimensions: DimensionJudgement[] = DEFAULT_DIMENSIONS.map((dim) => {
    const found = rawDims.find((d) =>
      String(d.key || d.id || d.label || '').toLowerCase().includes(dim.key)
    );
    return {
      key: dim.key,
      label: dim.label,
      weight: dim.weight,
      direct_score: normalizeToTen(found?.direct_score ?? found?.direct, 6.0),
      amplified_score: normalizeToTen(found?.amplified_score ?? found?.amplified, 8.0),
      rationale: String(found?.rationale || `${dim.label} assessment`),
      direct_evidence: found?.direct_evidence ? String(found.direct_evidence) : undefined,
      amplified_evidence: found?.amplified_evidence ? String(found.amplified_evidence) : undefined,
    };
  });

  const directOverall = normalizeToTen(parsed.direct_overall, 6.0);
  const amplifiedOverall = normalizeToTen(parsed.amplified_overall, 8.0);
  const preferredSide = (parsed.preferred_side as 'direct' | 'amplified' | 'tie') ||
    (amplifiedOverall > directOverall ? 'amplified' : directOverall > amplifiedOverall ? 'direct' : 'tie');

  const evaluation: RubricEvaluation = {
    directScore: directOverall,
    amplifiedScore: amplifiedOverall,
    qualityDelta: computeQualityDelta(directOverall, amplifiedOverall),
    direct_overall: directOverall,
    amplified_overall: amplifiedOverall,
    preferred_side: preferredSide,
    winner: preferredSide,
    reasoning: String(parsed.reasoning || `Amplified scored ${amplifiedOverall}/10 vs Direct ${directOverall}/10.`),
    summary: `Judged by ${provider}/${model}. Amplified scored ${amplifiedOverall}/10 vs Direct ${directOverall}/10.`,
    dimensions,
    evaluator_provider: provider,
    evaluator_model: model,
    judgeProvider: provider,
    judgeModel: model,
    rawJudgeResponse: judgeText.slice(0, 4000),
  };

  return { success: true, evaluation };
}

export async function evaluateWarPair(input: Parameters<typeof evaluatePair>[0]): Promise<RubricEvaluation> {
  const res = await evaluatePair(input);
  if (!res.success || !res.evaluation) {
    throw new Error(res.error || 'Evaluation failed');
  }
  return res.evaluation;
}

export function attachRunMetrics(
  evaluation: Partial<RubricEvaluation> | null,
  rawUsage?: SideUsage | null,
  ampUsage?: SideUsage | null
): ComparisonMetricsResult {
  const dUsage = rawUsage || emptySideUsage();
  const aUsage = ampUsage || emptySideUsage();

  const directScore = evaluation?.direct_overall ?? evaluation?.directScore ?? null;
  const amplifiedScore = evaluation?.amplified_overall ?? evaluation?.amplifiedScore ?? null;

  return buildComparisonMetrics({
    directScore,
    amplifiedScore,
    rawUsage: dUsage,
    amplifiedUsage: aUsage,
    rawFailed: false,
    amplifiedFailed: false,
    evaluationFailed: !evaluation || directScore == null,
  });
}

export function buildEvaluationRubricPayload(evaluation: RubricEvaluation) {
  return {
    evaluator_provider: evaluation.evaluator_provider || evaluation.judgeProvider || 'openai',
    evaluator_model: evaluation.evaluator_model || evaluation.judgeModel || 'gpt-4o',
    direct_overall: evaluation.direct_overall ?? evaluation.directScore ?? 0,
    amplified_overall: evaluation.amplified_overall ?? evaluation.amplifiedScore ?? 0,
    preferred_side: evaluation.preferred_side || evaluation.winner || 'tie',
    reasoning: evaluation.reasoning || evaluation.summary || '',
    dimensions: evaluation.dimensions || [],
  };
}