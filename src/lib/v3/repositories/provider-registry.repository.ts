import type { SupabaseClient } from '@supabase/supabase-js';
import { BaseRepository } from './base.repository';
import type { V3Provider } from '../contracts/registry';

export interface RegistryModelDto {
  id: string;
  provider: V3Provider;
  providerModelId: string;
  displayName: string;
  lifecycleState: string;
  contextWindow: number | null;
  maxOutputTokens: number | null;
  // Current active pricing
  pricing: {
    inputPerMillion: string | null;
    outputPerMillion: string | null;
    currency: string;
  } | null;
}

export class ProviderRegistryRepository extends BaseRepository {
  constructor(supabase: SupabaseClient) {
    super(supabase);
  }

  /**
   * Fetch all models currently in the 'supported' lifecycle state,
   * including their latest pricing snapshot.
   */
  async getActiveModels(): Promise<RegistryModelDto[]> {
    const { data, error } = await this.supabase
      .from('v3_provider_models')
      .select(`
        id,
        provider,
        provider_model_id,
        display_name,
        lifecycle_state,
        context_window,
        max_output_tokens,
        v3_model_pricing_snapshots (
          price_input_per_million,
          price_output_per_million,
          currency
        )
      `)
      .in('lifecycle_state', ['supported', 'stale']);

    if (error) {
      this.handleError(error, 'ProviderRegistryRepository.getActiveModels');
    }

    return (data || []).map((row: any) => {
      const snapshot = row.v3_model_pricing_snapshots?.[0]; // Supabase joins active snapshot
      return {
        id: row.id,
        provider: row.provider as V3Provider,
        providerModelId: row.provider_model_id,
        displayName: row.display_name,
        lifecycleState: row.lifecycle_state,
        contextWindow: row.context_window,
        maxOutputTokens: row.max_output_tokens,
        pricing: snapshot ? {
          // Force string representation for decimal safety
          inputPerMillion: snapshot.price_input_per_million !== null ? String(snapshot.price_input_per_million) : null,
          outputPerMillion: snapshot.price_output_per_million !== null ? String(snapshot.price_output_per_million) : null,
          currency: snapshot.currency ?? 'USD',
        } : null
      };
    });
  }

  /**
   * Retrieves specific model pricing for cost calculation.
   */
  async getModelPricing(provider: V3Provider, providerModelId: string) {
    const { data, error } = await this.supabase
      .from('v3_provider_models')
      .select(`
        v3_model_pricing_snapshots (
          price_input_per_million,
          price_output_per_million,
          price_reasoning_per_million,
          price_cached_input_per_million,
          currency
        )
      `)
      .eq('provider', provider)
      .eq('provider_model_id', providerModelId)
      .maybeSingle();

    if (error) {
      this.handleError(error, 'ProviderRegistryRepository.getModelPricing');
    }

    if (!data || !data.v3_model_pricing_snapshots) return null;
    
    // Convert array response to single object if needed, handle Supabase auto-nesting
    const snapshot = Array.isArray(data.v3_model_pricing_snapshots) 
      ? data.v3_model_pricing_snapshots[0] 
      : data.v3_model_pricing_snapshots;
      
    if (!snapshot) return null;

    return {
      inputPerMillion: snapshot.price_input_per_million !== null ? String(snapshot.price_input_per_million) : null,
      outputPerMillion: snapshot.price_output_per_million !== null ? String(snapshot.price_output_per_million) : null,
      reasoningPerMillion: snapshot.price_reasoning_per_million !== null ? String(snapshot.price_reasoning_per_million) : null,
      cachedInputPerMillion: snapshot.price_cached_input_per_million !== null ? String(snapshot.price_cached_input_per_million) : null,
      currency: snapshot.currency ?? 'USD',
    };
  }
}