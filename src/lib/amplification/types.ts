import type { Message } from '@/types';
import type { ProviderType } from '@/lib/providers/registry';

export type ExecutionState =
  | 'CREATED'
  | 'VALIDATING'
  | 'UNDERSTANDING'
  | 'PLANNING'
  | 'PREPARING_CONTEXT'
  | 'RETRIEVING'
  | 'STRATEGY_SELECTION'
  | 'INSTRUCTION_SYNTHESIS'
  | 'MODEL_EXECUTION'
  | 'TOOL_EXECUTION'
  | 'REFINEMENT'
  | 'VERIFICATION'
  | 'EVALUATION'
  | 'OPTIMIZATION'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export type IntentResult = {
  primary_intent: string;
  intent_category:
    | 'question'
    | 'code'
    | 'analysis'
    | 'creative'
    | 'planning'
    | 'debugging'
    | 'other';
  entities: string[];
  constraints: string[];
  success_criteria: string[];
  complexity: 'low' | 'medium' | 'high';
  requires_tools: boolean;
  requires_retrieval: boolean;
};

export type PlanStep = {
  id: string;
  title: string;
  detail: string;
  depends_on: string[];
};

export type PlanResult = {
  objective: string;
  steps: PlanStep[];
  risks: string[];
  recommended_strategy: string;
};

export type ContextResult = {
  summary: string;
  key_facts: string[];
  open_questions: string[];
  token_estimate: number;
};

export type RetrievalResult = {
  snippets: Array<{ source: string; content: string; relevance: number }>;
  query_used: string;
  hit_count: number;
};

// ─── Wave 2 ────────────────────────────────────────────────────────

export type StrategyName =
  | 'direct'
  | 'stepwise'
  | 'verify-first'
  | 'creative-explore'
  | 'tool-augmented';

export type StrategyResult = {
  strategy: StrategyName;
  temperature: number;
  top_p: number;
  max_tokens: number;
  verify_after: boolean;
  use_tools: boolean;
  reasoning: string;
};

export type InstructionResult = {
  system_prompt: string;
  user_instruction: string;
  tool_hints: string[];
};

export type OrchestrationResult = {
  chosen_provider: string;
  chosen_model: string;
  fallback_used: boolean;
  attempts: Array<{
    provider: string;
    model: string;
    success: boolean;
    error?: string;
  }>;
};

export type ToolSpec = {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
};

export type ToolCall = {
  id: string;
  name: string;
  args: Record<string, unknown>;
};

export type ToolCallResult = {
  id: string;
  name: string;
  success: boolean;
  output: string;
  error?: string;
  duration_ms: number;
};

// ─── Wave 3 ────────────────────────────────────────────────────────

export type RefinementResult = {
  refined_content: string;
  critique: string;
  changes_made: string[];
  refinement_applied: boolean;
  /** 0–1 confidence that refinement improved the draft */
  improvement_confidence: number;
};

export type VerificationCheck = {
  criterion: string;
  met: boolean;
  evidence: string;
};

export type VerificationResult = {
  passed: boolean;
  checks: VerificationCheck[];
  overall_confidence: number;
  issues: string[];
  summary: string;
};

export type QualityDimension =
  | 'accuracy'
  | 'completeness'
  | 'clarity'
  | 'actionability'
  | 'relevance';

export type QualityResult = {
  scores: Record<QualityDimension, number>;
  overall: number;
  rationale: string;
  strengths: string[];
  weaknesses: string[];
};

export type CostOptimizationResult = {
  provider_cost_usd: number;
  amplification_overhead_usd: number;
  total_cost_usd: number;
  token_breakdown: {
    prompt: number;
    completion: number;
    engine_overhead: number;
  };
  latency_ms: number;
  quality_overall: number | null;
  quality_per_dollar: number | null;
  suggestion: string | null;
  suggested_provider: string | null;
  suggested_model: string | null;
};

/** Single merged artifacts bag (Wave 1 + 2 + 3). Do not declare twice. */
export type AmplificationArtifacts = {
  intent?: IntentResult;
  plan?: PlanResult;
  context?: ContextResult;
  retrieval?: RetrievalResult;
  strategy?: StrategyResult;
  instruction?: InstructionResult;
  orchestration?: OrchestrationResult;
  tool_calls?: ToolCallResult[];
  system_prompt_addon?: string;
  /** Set by orchestrator after primary model stream (E09 input) */
  draft_content?: string;
  /** Set after refinement / repair (E10–E12 input) */
  final_content?: string;
  refinement?: RefinementResult;
  verification?: VerificationResult;
  quality?: QualityResult;
  cost?: CostOptimizationResult;
};

export type EngineContext = {
  executionId: string;
  conversationId: string;
  workspaceId: string;
  userId: string;
  history: Message[];
  provider: ProviderType;
  model: string;
  apiKey: string;
  userMessage: string;
  artifacts: AmplificationArtifacts;
  /**
   * Optional metrics bag used by E12 (and future engines).
   * Orchestrator fills these before calling Cost engine.
   */
  metrics?: {
    promptTokens?: number;
    completionTokens?: number;
    engineOverheadTokens?: number;
    latencyMs?: number;
  };
};

export type EngineResult<T = unknown> = {
  success: boolean;
  data?: T;
  raw_output?: string;
  tokens_prompt: number;
  tokens_completion: number;
  latency_ms: number;
  error?: string;
};

export interface AmplificationEngine<T = unknown> {
  id: string;
  name: string;
  wave: 1 | 2 | 3 | 4;
  execute(ctx: EngineContext): Promise<EngineResult<T>>;
}