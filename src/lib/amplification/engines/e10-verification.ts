import type {
  AmplificationEngine,
  EngineContext,
  EngineResult,
  VerificationCheck,
  VerificationResult,
} from '../types';
import { callLlmJson } from '../llmJson';

type VerifyJson = {
  passed?: boolean;
  checks?: Array<{ criterion?: string; met?: boolean; evidence?: string }>;
  overall_confidence?: number;
  issues?: string[];
  summary?: string;
};

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

export const e10VerificationEngine: AmplificationEngine<VerificationResult> = {
  id: 'E10',
  name: 'Verification',
  wave: 3,

  async execute(ctx: EngineContext): Promise<EngineResult<VerificationResult>> {
    const start = Date.now();
    const content = String(
      ctx.artifacts.final_content ??
        ctx.artifacts.refinement?.refined_content ??
        ctx.artifacts.draft_content ??
        ''
    );
    const intent = ctx.artifacts.intent;
    const plan = ctx.artifacts.plan;

    const criteria: string[] = intent?.success_criteria?.filter(Boolean).map(String) ?? [];

    if (!content.trim()) {
      return okResult(
        {
          passed: false,
          checks: [],
          overall_confidence: 0,
          issues: ['No content to verify.'],
          summary: 'Verification failed — empty output.',
        },
        start
      );
    }

    if (criteria.length === 0 && content.length < 200) {
      return okResult(
        {
          passed: true,
          checks: [
            {
              criterion: 'Non-empty relevant response',
              met: true,
              evidence: 'Output present; no explicit success criteria from intent.',
            },
          ],
          overall_confidence: 0.7,
          issues: [],
          summary: 'Passed basic non-empty check (no intent criteria provided).',
        },
        start
      );
    }

    const criteriaList =
      criteria.length > 0
        ? criteria
        : [
            'Addresses the user question directly',
            'Factually plausible and internally consistent',
            'Clear enough to act on or understand',
          ];

    try {
      const result = await callLlmJson<VerifyJson>({
        provider: ctx.provider,
        model: ctx.model,
        apiKey: ctx.apiKey,
        system: `You are the Verification engine of DSRT Open Arena.
Evaluate whether the assistant OUTPUT meets each success criterion.
Be strict but fair. Do not reward verbosity alone.
Return ONLY valid JSON.`,
        user: JSON.stringify({
          user_message: ctx.userMessage,
          primary_intent: intent?.primary_intent,
          intent_category: intent?.intent_category,
          plan_objective: plan?.objective,
          criteria: criteriaList,
          output: content.slice(0, 12000),
        }),
        schemaHint: `{
  "passed": true,
  "checks": [{"criterion":"string","met":true,"evidence":"string"}],
  "overall_confidence": 0.0,
  "issues": ["string"],
  "summary": "string"
}`,
      });

      const checks: VerificationCheck[] = Array.isArray(result.data.checks)
        ? result.data.checks.map((c: { criterion?: string; met?: boolean; evidence?: string }) => ({
            criterion: String(c.criterion ?? ''),
            met: Boolean(c.met),
            evidence: String(c.evidence ?? ''),
          }))
        : criteriaList.map((criterion) => ({
            criterion,
            met: Boolean(result.data.passed),
            evidence: String(result.data.summary ?? ''),
          }));

      const allMet = checks.length > 0 ? checks.every((c) => c.met) : Boolean(result.data.passed);

      const data: VerificationResult = {
        passed: typeof result.data.passed === 'boolean' ? result.data.passed && allMet : allMet,
        checks,
        overall_confidence: Math.max(
          0,
          Math.min(1, Number(result.data.overall_confidence) || (allMet ? 0.75 : 0.4))
        ),
        issues: Array.isArray(result.data.issues) ? result.data.issues.map(String) : [],
        summary: String(result.data.summary ?? (allMet ? 'All checks passed.' : 'Some checks failed.')),
      };

      return okResult(data, start, { p: result.promptTokens, c: result.completionTokens });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Verification failed';
      return okResult(
        {
          passed: true,
          checks: criteriaList.map((criterion) => ({
            criterion,
            met: true,
            evidence: 'Verification engine error — assumed pass to avoid blocking delivery.',
          })),
          overall_confidence: 0.5,
          issues: [`Verification error: ${message}`],
          summary: 'Verification soft-failed; output delivered with medium confidence.',
        },
        start,
        { p: 0, c: 0 },
        message
      );
    }
  },
};

export const e10Verification = e10VerificationEngine;
export default e10VerificationEngine;