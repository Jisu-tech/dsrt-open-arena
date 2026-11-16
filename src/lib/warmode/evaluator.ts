import { callGateway } from '@/lib/providers/gateway';
import type { ProviderType } from '@/lib/providers/registry';

export interface RubricEvaluation {
  direct_overall: number;
  amplified_overall: number;
  direct_scores: Record<string, number>;
  amplified_scores: Record<string, number>;
  winner: 'direct' | 'amplified' | 'tie';
  reasoning: string;
}

export interface EvaluationResult {
  success: boolean;
  evaluation: RubricEvaluation | null;
  error?: string;
}

const EVALUATOR_PROMPT = `You are an impartial AI evaluator. You will be given a user prompt and two responses (Response A and Response B). Score each response on these criteria (0.0 to 1.0):

- **Accuracy**: Factual correctness
- **Completeness**: Thoroughness of the response
- **Clarity**: How well-structured and readable
- **Relevance**: How well it addresses the user's actual question
- **Usefulness**: Practical value of the response

Return a JSON object with this exact structure:
{
  "direct_overall": <float>,
  "amplified_overall": <float>,
  "direct_scores": {"accuracy": <float>, "completeness": <float>, "clarity": <float>, "relevance": <float>, "usefulness": <float>},
  "amplified_scores": {"accuracy": <float>, "completeness": <float>, "clarity": <float>, "relevance": <float>, "usefulness": <float>},
  "winner": "direct" | "amplified" | "tie",
  "reasoning": "<one paragraph explaining your judgment>"
}

Return ONLY the JSON object, no markdown or other text.`;

export async function evaluatePair(params: {
  userPrompt: string;
  directResponse: string;
  amplifiedResponse: string;
  apiKey: string;
  evaluatorProvider: ProviderType;
  evaluatorModel: string;
}): Promise<EvaluationResult> {
  const {
    userPrompt,
    directResponse,
    amplifiedResponse,
    apiKey,
    evaluatorProvider,
    evaluatorModel,
  } = params;

  try {
    const userContent = `## User Prompt
${userPrompt}

## Response A (Direct)
${directResponse.slice(0, 6000)}

## Response B (Amplified)
${amplifiedResponse.slice(0, 6000)}

Evaluate both responses and return the JSON.`;

    const result = await callGateway({
      provider: evaluatorProvider,
      model: evaluatorModel,
      apiKey,
      messages: [{ role: 'user', content: userContent }],
      temperature: 0.1,
      maxTokens: 2048,
      systemPrompt: EVALUATOR_PROMPT,
    });

    // Extract JSON from response
    let jsonStr = result.content.trim();

    // Try to extract JSON block if wrapped in markdown
    const jsonMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    // Parse
    const evaluation = JSON.parse(jsonStr) as RubricEvaluation;

    // Validate required fields
    if (
      typeof evaluation.direct_overall !== 'number' ||
      typeof evaluation.amplified_overall !== 'number'
    ) {
      return { success: false, evaluation: null, error: 'Invalid evaluation format: missing scores' };
    }

    // Clamp scores
    evaluation.direct_overall = Math.max(0, Math.min(1, evaluation.direct_overall));
    evaluation.amplified_overall = Math.max(0, Math.min(1, evaluation.amplified_overall));

    return { success: true, evaluation };
  } catch (err: unknown) {
    return {
      success: false,
      evaluation: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
