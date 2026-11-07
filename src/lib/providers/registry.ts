import type { SupabaseClient } from '@supabase/supabase-js';

export type ProviderType = 'openai' | 'anthropic' | 'google' | 'deepseek' | 'openrouter' | 'groq' | 'mistral' | 'xai' | 'cohere';

export interface ModelPricing {
  promptCostPerM: number;
  completionCostPerM: number;
  cachedPromptCostPerM?: number;
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
  supportsStreaming: boolean;
  description?: string;
  deprecated?: boolean;
}

export interface ProviderMetadata {
  id: ProviderType;
  name: string;
  baseUrl: string;
  modelsEndpoint?: string;
  authHeader: 'bearer' | 'x-api-key' | 'query-param';
  docsUrl: string;
}

export const PROVIDER_METADATA: Record<ProviderType, ProviderMetadata> = {
  openai: {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    modelsEndpoint: '/models',
    authHeader: 'bearer',
    docsUrl: 'https://platform.openai.com/docs',
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    modelsEndpoint: '/models',
    authHeader: 'x-api-key',
    docsUrl: 'https://docs.anthropic.com',
  },
  google: {
    id: 'google',
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    modelsEndpoint: '/models',
    authHeader: 'query-param',
    docsUrl: 'https://ai.google.dev/docs',
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    modelsEndpoint: '/models',
    authHeader: 'bearer',
    docsUrl: 'https://api-docs.deepseek.com',
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    modelsEndpoint: '/models',
    authHeader: 'bearer',
    docsUrl: 'https://openrouter.ai/docs',
  },
  groq: {
    id: 'groq',
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    modelsEndpoint: '/models',
    authHeader: 'bearer',
    docsUrl: 'https://console.groq.com/docs',
  },
  mistral: {
    id: 'mistral',
    name: 'Mistral AI',
    baseUrl: 'https://api.mistral.ai/v1',
    modelsEndpoint: '/models',
    authHeader: 'bearer',
    docsUrl: 'https://docs.mistral.ai',
  },
  xai: {
    id: 'xai',
    name: 'xAI (Grok)',
    baseUrl: 'https://api.x.ai/v1',
    modelsEndpoint: '/models',
    authHeader: 'bearer',
    docsUrl: 'https://docs.x.ai',
  },
  cohere: {
    id: 'cohere',
    name: 'Cohere',
    baseUrl: 'https://api.cohere.com/v2',
    modelsEndpoint: '/models',
    authHeader: 'bearer',
    docsUrl: 'https://docs.cohere.com',
  },
};

export const MODEL_REGISTRY: Record<string, ModelSpec> = {
  // ============================================================================
  // GROQ (Production & Preview Models)
  // ============================================================================
  'llama-3.3-70b-versatile': { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B (Groq)', provider: 'groq', contextWindow: 131072, maxOutputTokens: 32768, pricing: { promptCostPerM: 0.59, completionCostPerM: 0.79 }, supportsVision: false, supportsTools: true, supportsStreaming: true },
  'llama-3.1-8b-instant': { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant (Groq)', provider: 'groq', contextWindow: 131072, maxOutputTokens: 8192, pricing: { promptCostPerM: 0.05, completionCostPerM: 0.08 }, supportsVision: false, supportsTools: true, supportsStreaming: true },
  'openai/gpt-oss-120b': { id: 'openai/gpt-oss-120b', name: 'GPT-OSS 120B (Groq)', provider: 'groq', contextWindow: 131072, maxOutputTokens: 65536, pricing: { promptCostPerM: 0.15, completionCostPerM: 0.60 }, supportsVision: false, supportsTools: true, supportsStreaming: true },
  'openai/gpt-oss-20b': { id: 'openai/gpt-oss-20b', name: 'GPT-OSS 20B (Groq)', provider: 'groq', contextWindow: 131072, maxOutputTokens: 65536, pricing: { promptCostPerM: 0.075, completionCostPerM: 0.30 }, supportsVision: false, supportsTools: true, supportsStreaming: true },
  'qwen/qwen3.8-27b': { id: 'qwen/qwen3.8-27b', name: 'Qwen 3.8 27B (Groq)', provider: 'groq', contextWindow: 131072, maxOutputTokens: 16384, pricing: { promptCostPerM: 0.80, completionCostPerM: 4.00 }, supportsVision: false, supportsTools: true, supportsStreaming: true },
  'openai/gpt-oss-safeguard-20b': { id: 'openai/gpt-oss-safeguard-20b', name: 'Safety GPT-OSS 20B (Groq)', provider: 'groq', contextWindow: 131072, maxOutputTokens: 65536, pricing: { promptCostPerM: 0.075, completionCostPerM: 0.30 }, supportsVision: false, supportsTools: false, supportsStreaming: true },
  'deepseek-r1-distill-llama-70b': { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 Llama 70B (Groq)', provider: 'groq', contextWindow: 131072, maxOutputTokens: 32768, pricing: { promptCostPerM: 0.59, completionCostPerM: 0.79 }, supportsVision: false, supportsTools: true, supportsStreaming: true },
  'meta-llama/llama-prompt-guard-2-86m': { id: 'meta-llama/llama-prompt-guard-2-86m', name: 'Prompt Guard 2 86M (Groq)', provider: 'groq', contextWindow: 512, maxOutputTokens: 512, pricing: { promptCostPerM: 0.04, completionCostPerM: 0.04 }, supportsVision: false, supportsTools: false, supportsStreaming: true },

  // ============================================================================
  // GOOGLE
  // ============================================================================
  'gemini-2.5-flash': { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'google', contextWindow: 1048576, maxOutputTokens: 8192, pricing: { promptCostPerM: 0.075, completionCostPerM: 0.30 }, supportsVision: true, supportsTools: true, supportsStreaming: true },
  'gemini-2.0-flash': { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'google', contextWindow: 1048576, maxOutputTokens: 8192, pricing: { promptCostPerM: 0.10, completionCostPerM: 0.40 }, supportsVision: true, supportsTools: true, supportsStreaming: true },
  'gemini-1.5-pro': { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'google', contextWindow: 2000000, maxOutputTokens: 8192, pricing: { promptCostPerM: 1.25, completionCostPerM: 5.00 }, supportsVision: true, supportsTools: true, supportsStreaming: true },
  'gemini-1.5-flash': { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'google', contextWindow: 1000000, maxOutputTokens: 8192, pricing: { promptCostPerM: 0.075, completionCostPerM: 0.30 }, supportsVision: true, supportsTools: true, supportsStreaming: true },

  // ============================================================================
  // OPENAI
  // ============================================================================
  'gpt-4o': { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', contextWindow: 128000, maxOutputTokens: 16384, pricing: { promptCostPerM: 2.50, completionCostPerM: 10.00, cachedPromptCostPerM: 1.25 }, supportsVision: true, supportsTools: true, supportsStreaming: true },
  'gpt-4o-mini': { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', contextWindow: 128000, maxOutputTokens: 16384, pricing: { promptCostPerM: 0.15, completionCostPerM: 0.60, cachedPromptCostPerM: 0.075 }, supportsVision: true, supportsTools: true, supportsStreaming: true },
  'o1': { id: 'o1', name: 'OpenAI o1', provider: 'openai', contextWindow: 200000, maxOutputTokens: 100000, pricing: { promptCostPerM: 15.00, completionCostPerM: 60.00 }, supportsVision: true, supportsTools: true, supportsStreaming: false },
  'o1-mini': { id: 'o1-mini', name: 'OpenAI o1 Mini', provider: 'openai', contextWindow: 128000, maxOutputTokens: 65536, pricing: { promptCostPerM: 3.00, completionCostPerM: 12.00 }, supportsVision: false, supportsTools: true, supportsStreaming: false },
  'o3-mini': { id: 'o3-mini', name: 'OpenAI o3 Mini', provider: 'openai', contextWindow: 200000, maxOutputTokens: 100000, pricing: { promptCostPerM: 1.10, completionCostPerM: 4.40 }, supportsVision: false, supportsTools: true, supportsStreaming: true },

  // ============================================================================
  // ANTHROPIC
  // ============================================================================
  'claude-3-5-sonnet-20241022': { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'anthropic', contextWindow: 200000, maxOutputTokens: 8192, pricing: { promptCostPerM: 3.00, completionCostPerM: 15.00 }, supportsVision: true, supportsTools: true, supportsStreaming: true },
  'claude-3-5-haiku-20241022': { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', provider: 'anthropic', contextWindow: 200000, maxOutputTokens: 8192, pricing: { promptCostPerM: 0.80, completionCostPerM: 4.00 }, supportsVision: false, supportsTools: true, supportsStreaming: true },

  // ============================================================================
  // DEEPSEEK
  // ============================================================================
  'deepseek-chat': { id: 'deepseek-chat', name: 'DeepSeek V3', provider: 'deepseek', contextWindow: 64000, maxOutputTokens: 8192, pricing: { promptCostPerM: 0.14, completionCostPerM: 0.28 }, supportsVision: false, supportsTools: true, supportsStreaming: true },
  'deepseek-reasoner': { id: 'deepseek-reasoner', name: 'DeepSeek R1', provider: 'deepseek', contextWindow: 64000, maxOutputTokens: 8192, pricing: { promptCostPerM: 0.55, completionCostPerM: 2.19 }, supportsVision: false, supportsTools: true, supportsStreaming: true },

  // ============================================================================
  // MISTRAL
  // ============================================================================
  'mistral-large-latest': { id: 'mistral-large-latest', name: 'Mistral Large', provider: 'mistral', contextWindow: 128000, maxOutputTokens: 8192, pricing: { promptCostPerM: 2.00, completionCostPerM: 6.00 }, supportsVision: false, supportsTools: true, supportsStreaming: true },
  'mistral-small-latest': { id: 'mistral-small-latest', name: 'Mistral Small', provider: 'mistral', contextWindow: 32000, maxOutputTokens: 8192, pricing: { promptCostPerM: 0.20, completionCostPerM: 0.60 }, supportsVision: false, supportsTools: true, supportsStreaming: true },

  // ============================================================================
  // xAI
  // ============================================================================
  'grok-2-latest': { id: 'grok-2-latest', name: 'Grok 2', provider: 'xai', contextWindow: 131072, maxOutputTokens: 8192, pricing: { promptCostPerM: 2.00, completionCostPerM: 10.00 }, supportsVision: false, supportsTools: true, supportsStreaming: true },
};

/**
 * Infer provider from model ID pattern
 */
export function inferProviderFromModelId(modelId: string): ProviderType {
  const id = modelId.toLowerCase().trim();
  if (id.startsWith('openai/') || id.startsWith('gpt') || id.startsWith('o1') || id.startsWith('o3')) return 'openai';
  if (id.startsWith('anthropic/') || id.includes('claude')) return 'anthropic';
  if (id.startsWith('google/') || id.includes('gemini')) return 'google';
  if (id.startsWith('deepseek/') || id.includes('deepseek')) return 'deepseek';
  if (id.startsWith('groq/')) return 'groq';
  if (id.startsWith('mistral/') || id.includes('mistral')) return 'mistral';
  if (id.startsWith('xai/') || id.includes('grok')) return 'xai';
  if (id.startsWith('cohere/') || id.includes('command')) return 'cohere';
  if (id.startsWith('openrouter/')) return 'openrouter';
  if (id.includes('llama') || id.includes('qwen')) return 'groq'; // Safely route generic open models
  return 'openai';
}

/**
 * Get model spec with safe fallback for unlisted models
 */
export function getModelSpec(modelId: string): ModelSpec {
  if (MODEL_REGISTRY[modelId]) {
    return MODEL_REGISTRY[modelId];
  }

  const inferredProvider = inferProviderFromModelId(modelId);

  return {
    id: modelId,
    name: modelId,
    provider: inferredProvider,
    contextWindow: 128000,
    maxOutputTokens: 4096,
    pricing: { promptCostPerM: 1.00, completionCostPerM: 3.00 },
    supportsVision: false,
    supportsTools: true,
    supportsStreaming: true,
    description: 'Custom or dynamically discovered model.',
  };
}

/**
 * Calculate provider cost in USD
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

/**
 * Get all models for a specific provider
 */
export function getModelsForProvider(provider: ProviderType): ModelSpec[] {
  return Object.values(MODEL_REGISTRY).filter((m) => m.provider === provider);
}

/**
 * Get all providers list
 */
export function getAllProviders(): ProviderMetadata[] {
  return Object.values(PROVIDER_METADATA);
}

/**
 * Prefer V3 pricing snapshots. Returns nulls (not zeros) when unknown.
 * Legacy getPricing() remains for backward compatibility.
 */
export async function getPricingFromDB(
  supabase: SupabaseClient,
  provider: string,
  modelId: string,
): Promise<{
  inputPerMillion: string | null;
  outputPerMillion: string | null;
  currency: string;
} | null> {
  const { data, error } = await supabase
    .from('v3_provider_models')
    .select(
      `
      current_pricing_snapshot_id,
      v3_model_pricing_snapshots!v3_provider_models_current_pricing_snapshot_id_fkey (
        price_input_per_million,
        price_output_per_million,
        currency
      )
    `,
    )
    .eq('provider', provider)
    .eq('provider_model_id', modelId)
    .maybeSingle();

  if (error || !data) return null;

  const snap = Array.isArray(data.v3_model_pricing_snapshots)
    ? data.v3_model_pricing_snapshots[0]
    : data.v3_model_pricing_snapshots;

  if (!snap) return null;

  return {
    inputPerMillion:
      snap.price_input_per_million != null ? String(snap.price_input_per_million) : null,
    outputPerMillion:
      snap.price_output_per_million != null ? String(snap.price_output_per_million) : null,
    currency: snap.currency ?? 'USD',
  };
}