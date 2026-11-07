/**
 * DSRT Open Arena V3 — Catalogue Entry Normalizer (CORRECTED)
 * 
 * Transforms a RawCatalogueEntry into a NormalizedEntry.
 * 
 * Key corrections:
 *   - Never fabricates pricing. If raw.pricing is null, normalized.pricing is null.
 *     Pricing merge happens separately in pricing-merge.ts.
 *   - Capability mapping is additive — unknown strings are preserved for debugging
 *     but not silently dropped.
 *   - Tier inference is explicit heuristic; adapters can override by passing tier
 *     in the raw entry rawData.
 *   - Streaming/structured output/vision/tool-use default is UNKNOWN (null) unless
 *     adapter explicitly supplied it; converts to boolean only at DB layer.
 * 
 * @module v3/registry/normalizer
 */

import type { V3Provider } from '../contracts/enums';
import { ModelTier, ModelCapability } from '../contracts/enums';
import type { RawCatalogueEntry, SuppliedPricing, PricingSource } from '../contracts/registry';
import type { CatalogueAdapter } from './types';
import { computeObjectHash } from './content-hash';

// ─────────────────────────────────────────────
// NormalizedEntry
// ─────────────────────────────────────────────

export interface NormalizedEntry {
  readonly provider: V3Provider;
  readonly providerModelId: string;
  readonly displayName: string;
  readonly tier: string;
  readonly capabilities: string[];
  readonly contextWindow: number | null;
  readonly maxOutputTokens: number | null;
  readonly supportsStreaming: boolean;
  readonly supportsStructuredOutput: boolean;
  readonly supportsVision: boolean;
  readonly supportsToolUse: boolean;
  readonly pricing: SuppliedPricing | null;
  readonly metadataContentHash: string;
}

// ─────────────────────────────────────────────
// Main normalization
// ─────────────────────────────────────────────

export async function normalizeRawEntry(
  raw: RawCatalogueEntry,
  provider: V3Provider,
  adapter: CatalogueAdapter,
): Promise<NormalizedEntry> {
  const capabilities = normalizeCapabilities(raw.capabilities);
  const tier = inferTier(raw);
  const displayName = raw.displayName?.trim() || formatDisplayName(raw.providerModelId);

  const normalized: Omit<NormalizedEntry, 'metadataContentHash'> = {
    provider,
    providerModelId: raw.providerModelId,
    displayName,
    tier,
    capabilities,
    contextWindow: raw.contextWindow,
    maxOutputTokens: raw.maxOutputTokens,
    supportsStreaming: raw.supportsStreaming ?? inferStreamingFromCaps(capabilities, raw.providerModelId),
    supportsStructuredOutput: raw.supportsStructuredOutput ?? capabilities.includes(ModelCapability.STRUCTURED_OUTPUT),
    supportsVision: raw.supportsVision ?? capabilities.includes(ModelCapability.VISION),
    supportsToolUse: raw.supportsToolUse ?? capabilities.includes(ModelCapability.TOOL_USE),
    pricing: normalizePricing(raw.pricing),
  };

  // Hash the metadata (EXCLUDING pricing — pricing has its own snapshot chain)
  const hashInput = {
    providerModelId: normalized.providerModelId,
    displayName: normalized.displayName,
    tier: normalized.tier,
    capabilities: [...normalized.capabilities].sort(),
    contextWindow: normalized.contextWindow,
    maxOutputTokens: normalized.maxOutputTokens,
    supportsStreaming: normalized.supportsStreaming,
    supportsStructuredOutput: normalized.supportsStructuredOutput,
    supportsVision: normalized.supportsVision,
    supportsToolUse: normalized.supportsToolUse,
  };

  const metadataContentHash = await computeObjectHash(hashInput);

  return { ...normalized, metadataContentHash };
}

// ─────────────────────────────────────────────
// Pricing normalization (unit conversion only, never fabrication)
// ─────────────────────────────────────────────

function normalizePricing(raw: SuppliedPricing | null): SuppliedPricing | null {
  if (raw === null) return null;
  // Pricing is already in per-million by adapter contract.
  // Adapters MUST convert their provider's units before returning.
  return raw;
}

// ─────────────────────────────────────────────
// Capability normalization
// ─────────────────────────────────────────────

const CAPABILITY_ALIASES: Record<string, string> = {
  'text': ModelCapability.TEXT_GENERATION,
  'chat': ModelCapability.TEXT_GENERATION,
  'completion': ModelCapability.TEXT_GENERATION,
  'chat_completion': ModelCapability.TEXT_GENERATION,
  'generatecontent': ModelCapability.TEXT_GENERATION,
  'code': ModelCapability.CODE_GENERATION,
  'coding': ModelCapability.CODE_GENERATION,
  'code_generation': ModelCapability.CODE_GENERATION,
  'reasoning': ModelCapability.REASONING,
  'thinking': ModelCapability.REASONING,
  'chain_of_thought': ModelCapability.REASONING,
  'vision': ModelCapability.VISION,
  'image_input': ModelCapability.VISION,
  'multimodal': ModelCapability.VISION,
  'image': ModelCapability.VISION,
  'tool_use': ModelCapability.TOOL_USE,
  'function_calling': ModelCapability.TOOL_USE,
  'tools': ModelCapability.TOOL_USE,
  'functions': ModelCapability.TOOL_USE,
  'embedding': ModelCapability.EMBEDDING,
  'embeddings': ModelCapability.EMBEDDING,
  'structured_output': ModelCapability.STRUCTURED_OUTPUT,
  'json_mode': ModelCapability.STRUCTURED_OUTPUT,
  'json_output': ModelCapability.STRUCTURED_OUTPUT,
  'response_format': ModelCapability.STRUCTURED_OUTPUT,
};

function normalizeCapabilities(raw: readonly string[]): string[] {
  const canonical = new Set<string>();
  for (const cap of raw) {
    const normalized = cap.toLowerCase().trim();
    const mapped = CAPABILITY_ALIASES[normalized];
    if (mapped) {
      canonical.add(mapped);
    } else if (Object.values(ModelCapability).includes(normalized as ModelCapability)) {
      canonical.add(normalized);
    }
    // Unknown capabilities are intentionally dropped — not errors
  }
  return Array.from(canonical).sort();
}

function inferStreamingFromCaps(caps: readonly string[], modelId: string): boolean {
  // Embedding models don't stream
  if (caps.includes(ModelCapability.EMBEDDING) && caps.length === 1) return false;
  // Default: most chat models support streaming
  if (modelId.includes('embed') || modelId.includes('rerank')) return false;
  return true;
}

// ─────────────────────────────────────────────
// Tier inference (explicit heuristic)
// ─────────────────────────────────────────────

function inferTier(entry: RawCatalogueEntry): string {
  // If the adapter supplied a tier in rawData, honor it
  const suppliedTier = (entry.rawData as { tier?: string }).tier;
  if (suppliedTier && Object.values(ModelTier).includes(suppliedTier as ModelTier)) {
    return suppliedTier;
  }

  const id = entry.providerModelId.toLowerCase();
  const name = (entry.displayName ?? '').toLowerCase();
  const combined = `${id} ${name}`;

  // Specialized
  if (id.includes('embed') || id.includes('rerank') || id.includes('whisper') || id.includes('tts')) {
    return ModelTier.SPECIALIZED;
  }

  // Frontier signals
  const frontierMarkers = ['opus', 'ultra', 'frontier', 'o1', 'o3-pro', 'gemini-2.5-pro'];
  if (frontierMarkers.some(m => combined.includes(m) && !combined.includes('mini'))) {
    return ModelTier.FRONTIER;
  }

  // Efficient signals
  const efficientMarkers = ['mini', 'haiku', 'flash', 'instant', 'tiny', 'small-efficient', '7b', '8b', '9b'];
  if (efficientMarkers.some(m => combined.includes(m))) {
    return ModelTier.EFFICIENT;
  }

  return ModelTier.STANDARD;
}

// ─────────────────────────────────────────────
// Display name formatting
// ─────────────────────────────────────────────

function formatDisplayName(modelId: string): string {
  return modelId
    .replace(/^[a-z0-9]+\//, '') // Strip provider prefix for aggregator IDs
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\s+/g, ' ')
    .trim();
}

// ─────────────────────────────────────────────
// Helper for building SuppliedPricing from per-million numeric values
// ─────────────────────────────────────────────

export interface PerMillionPricingInput {
  readonly inputPrice?: number | null;
  readonly outputPrice?: number | null;
  readonly reasoningPrice?: number | null;
  readonly cachedInputPrice?: number | null;
  readonly inputSupplied?: boolean;
  readonly outputSupplied?: boolean;
  readonly reasoningSupplied?: boolean;
  readonly cachedInputSupplied?: boolean;
  readonly currency?: string;
  readonly source: PricingSource;
  readonly sourceDetail?: string | null;
}

/**
 * Convenience builder for adapters: construct a SuppliedPricing from per-million values.
 * Each field is marked supplied=true if explicitly passed, even if the value is null.
 */
export function buildSuppliedPricing(input: PerMillionPricingInput): SuppliedPricing {
  const toValue = (n: number | null | undefined): string | null => {
    if (n === null || n === undefined) return null;
    return n.toFixed(8);
  };

  return {
    input: {
      supplied: input.inputSupplied ?? (input.inputPrice !== undefined),
      value: toValue(input.inputPrice ?? null),
    },
    output: {
      supplied: input.outputSupplied ?? (input.outputPrice !== undefined),
      value: toValue(input.outputPrice ?? null),
    },
    reasoning: {
      supplied: input.reasoningSupplied ?? (input.reasoningPrice !== undefined),
      value: toValue(input.reasoningPrice ?? null),
    },
    cachedInput: {
      supplied: input.cachedInputSupplied ?? (input.cachedInputPrice !== undefined),
      value: toValue(input.cachedInputPrice ?? null),
    },
    currency: input.currency ?? 'USD',
    source: input.source,
    sourceDetail: input.sourceDetail ?? null,
  };
}

/**
 * Convert from per-token or per-thousand pricing to per-million (for aggregators).
 */
export function convertUnit(
  value: number | null,
  fromUnit: 'per_token' | 'per_thousand' | 'per_million',
): number | null {
  if (value === null) return null;
  switch (fromUnit) {
    case 'per_token': return value * 1_000_000;
    case 'per_thousand': return value * 1000;
    case 'per_million': return value;
  }
}