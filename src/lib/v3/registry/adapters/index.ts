import type { V3Provider } from '../../contracts/registry';
import type { CatalogueAdapter } from '../types';

import { OpenAICatalogueAdapter } from './openai';
import { AnthropicCatalogueAdapter } from './anthropic';
import { GoogleCatalogueAdapter } from './google';
import { DeepSeekCatalogueAdapter } from './deepseek';
import { GroqCatalogueAdapter } from './groq';
import { MistralCatalogueAdapter } from './mistral';
import { OpenRouterCatalogueAdapter } from './openrouter';
import { XaiCatalogueAdapter } from './xai';
import { CohereCatalogueAdapter } from './cohere';

export { BaseCatalogueAdapter, pricingFromApiFields, toPerMillion } from './base';
export { OpenAICatalogueAdapter, AnthropicCatalogueAdapter, GoogleCatalogueAdapter, DeepSeekCatalogueAdapter, GroqCatalogueAdapter, MistralCatalogueAdapter, OpenRouterCatalogueAdapter, XaiCatalogueAdapter, CohereCatalogueAdapter };

const ADAPTER_CTORS: Record<V3Provider, () => CatalogueAdapter> = {
  openai: () => new OpenAICatalogueAdapter(),
  anthropic: () => new AnthropicCatalogueAdapter(),
  google: () => new GoogleCatalogueAdapter(),
  deepseek: () => new DeepSeekCatalogueAdapter(),
  groq: () => new GroqCatalogueAdapter(),
  mistral: () => new MistralCatalogueAdapter(),
  openrouter: () => new OpenRouterCatalogueAdapter(),
  xai: () => new XaiCatalogueAdapter(),
  cohere: () => new CohereCatalogueAdapter(),
};

export function createAdapter(provider: V3Provider): CatalogueAdapter {
  const ctor = ADAPTER_CTORS[provider];
  if (!ctor) throw new Error(`No catalogue adapter registered for provider: ${provider}`);
  return ctor();
}

export function createAdapterRegistry(): ReadonlyMap<V3Provider, CatalogueAdapter> {
  const map = new Map<V3Provider, CatalogueAdapter>();
  for (const provider of Object.keys(ADAPTER_CTORS) as V3Provider[]) {
    map.set(provider, createAdapter(provider));
  }
  return map;
}

export function listRegisteredProviders(): readonly V3Provider[] {
  return Object.keys(ADAPTER_CTORS) as V3Provider[];
}