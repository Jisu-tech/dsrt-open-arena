export type ProviderType = 'openai' | 'anthropic' | 'google' | 'deepseek' | 'openrouter';

export interface ModelPricing {
  promptCostPerM: number;     // USD per 1M prompt tokens
  completionCostPerM: number; // USD per 1M completion tokens
}

export interface ModelSpec {
  id: string;
  name: string;
  provider: ProviderType;
  contextWindow: number;
  maxOutputTokens: number;
  pricing: ModelPricing;
  supportsVision: boolean;
  supportsTools: boolean;
  description?: string;
}

export const MODEL_REGISTRY: Record<string, ModelSpec> = {
  // ============================================================================
  // OPENAI MODELS
  // ============================================================================
  'gpt-4o': {
    id: 'gpt-4o',
    name: 'GPT-4o (Omni)',
    provider: 'openai',
    contextWindow: 128000,
    maxOutputTokens: 16384,
    pricing: { promptCostPerM: 2.50, completionCostPerM: 10.00 },
    supportsVision: true,
    supportsTools: true,
    description: 'Flagship multimodal model for high-intelligence task orchestration.',
  },
  'gpt-4o-mini': {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    contextWindow: 128000,
    maxOutputTokens: 16384,
    pricing: { promptCostPerM: 0.15, completionCostPerM: 0.60 },
    supportsVision: true,
    supportsTools: true,
    description: 'Fast, cost-efficient model ideal for lightweight background engines.',
  },
  'o1': {
    id: 'o1',
    name: 'OpenAI o1',
    provider: 'openai',
    contextWindow: 200000,
    maxOutputTokens: 100000,
    pricing: { promptCostPerM: 15.00, completionCostPerM: 60.00 },
    supportsVision: true,
    supportsTools: true,
    description: 'Advanced reasoning model designed for complex logic and math decomposition.',
  },
  'o1-mini': {
    id: 'o1-mini',
    name: 'OpenAI o1 Mini',
    provider: 'openai',
    contextWindow: 128000,
    maxOutputTokens: 65536,
    pricing: { promptCostPerM: 3.00, completionCostPerM: 12.00 },
    supportsVision: false,
    supportsTools: true,
    description: 'Specialized reasoning model optimized for coding and STEM tasks.',
  },
  'o3-mini': {
    id: 'o3-mini',
    name: 'OpenAI o3 Mini',
    provider: 'openai',
    contextWindow: 200000,
    maxOutputTokens: 100000,
    pricing: { promptCostPerM: 1.10, completionCostPerM: 4.40 },
    supportsVision: false,
    supportsTools: true,
    description: 'Next-gen compact reasoning model balancing speed and execution quality.',
  },
  'gpt-4-turbo': {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: 'openai',
    contextWindow: 128000,
    maxOutputTokens: 4096,
    pricing: { promptCostPerM: 10.00, completionCostPerM: 30.00 },
    supportsVision: true,
    supportsTools: true,
  },

  // ============================================================================
  // ANTHROPIC MODELS
  // ============================================================================
  'claude-3-5-sonnet-20241022': {
    id: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    pricing: { promptCostPerM: 3.00, completionCostPerM: 15.00 },
    supportsVision: true,
    supportsTools: true,
    description: 'Industry benchmark for code generation, writing, and instruction follower.',
  },
  'claude-3-5-haiku-20241022': {
    id: 'claude-3-5-haiku-20241022',
    name: 'Claude 3.5 Haiku',
    provider: 'anthropic',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    pricing: { promptCostPerM: 0.80, completionCostPerM: 4.00 },
    supportsVision: false,
    supportsTools: true,
    description: 'Ultra-fast model built for high-throughput evaluation and intent classification.',
  },
  'claude-3-opus-20240229': {
    id: 'claude-3-opus-20240229',
    name: 'Claude 3 Opus',
    provider: 'anthropic',
    contextWindow: 200000,
    maxOutputTokens: 4096,
    pricing: { promptCostPerM: 15.00, completionCostPerM: 75.00 },
    supportsVision: true,
    supportsTools: true,
    description: 'Deep reasoning model for extreme context comprehension.',
  },

  // ============================================================================
  // GOOGLE GEMINI MODELS
  // ============================================================================
  'gemini-1.5-pro': {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    provider: 'google',
    contextWindow: 2000000,
    maxOutputTokens: 8192,
    pricing: { promptCostPerM: 1.25, completionCostPerM: 5.00 },
    supportsVision: true,
    supportsTools: true,
    description: '2M token context window model for massive document synthesis.',
  },
  'gemini-1.5-flash': {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    provider: 'google',
    contextWindow: 1000000,
    maxOutputTokens: 8192,
    pricing: { promptCostPerM: 0.075, completionCostPerM: 0.30 },
    supportsVision: true,
    supportsTools: true,
    description: 'Sub-second latency model for search and context retrieval tasks.',
  },
  'gemini-2.0-flash-exp': {
    id: 'gemini-2.0-flash-exp',
    name: 'Gemini 2.0 Flash',
    provider: 'google',
    contextWindow: 1048576,
    maxOutputTokens: 8192,
    pricing: { promptCostPerM: 0.10, completionCostPerM: 0.40 },
    supportsVision: true,
    supportsTools: true,
    description: 'Next-gen multimodal model with real-time tool calling.',
  },

  // ============================================================================
  // DEEPSEEK MODELS
  // ============================================================================
  'deepseek-chat': {
    id: 'deepseek-chat',
    name: 'DeepSeek V3',
    provider: 'deepseek',
    contextWindow: 64000,
    maxOutputTokens: 8192,
    pricing: { promptCostPerM: 0.14, completionCostPerM: 0.28 },
    supportsVision: false,
    supportsTools: true,
    description: 'High performance open-weights architecture with low token costs.',
  },
  'deepseek-reasoner': {
    id: 'deepseek-reasoner',
    name: 'DeepSeek R1',
    provider: 'deepseek',
    contextWindow: 64000,
    maxOutputTokens: 8192,
    pricing: { promptCostPerM: 0.55, completionCostPerM: 2.19 },
    supportsVision: false,
    supportsTools: true,
    description: 'Reinforcement-learning driven reasoning model.',
  },
};

/**
 * Retrieves model spec or creates a safe fallback for unlisted / dynamic model IDs
 */
export function getModelSpec(modelId: string): ModelSpec {
  if (MODEL_REGISTRY[modelId]) {
    return MODEL_REGISTRY[modelId];
  }

  // Dynamic Fallback for user-specified or future models
  let inferredProvider: ProviderType = 'openai';
  if (modelId.includes('claude')) inferredProvider = 'anthropic';
  if (modelId.includes('gemini')) inferredProvider = 'google';
  if (modelId.includes('deepseek')) inferredProvider = 'deepseek';

  return {
    id: modelId,
    name: modelId,
    provider: inferredProvider,
    contextWindow: 128000,
    maxOutputTokens: 4096,
    pricing: { promptCostPerM: 1.00, completionCostPerM: 3.00 }, // Reasonable default estimate
    supportsVision: false,
    supportsTools: true,
    description: 'Custom or unlisted provider model.',
  };
}

/**
 * Calculates raw Provider Cost in USD based on model pricing
 */
export function calculateProviderCost(
  modelId: string,
  promptTokens: number,
  completionTokens: number
): number {
  const model = getModelSpec(modelId);
  const promptCost = (promptTokens / 1_000_000) * model.pricing.promptCostPerM;
  const completionCost = (completionTokens / 1_000_000) * model.pricing.completionCostPerM;

  return Number((promptCost + completionCost).toFixed(6));
}