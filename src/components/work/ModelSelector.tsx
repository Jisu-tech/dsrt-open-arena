'use client';

import React, { useEffect, useMemo } from 'react';
import { Check, AlertCircle } from 'lucide-react';
import {
  ProviderType,
  getModelsForProvider,
  getAllProviders,
} from '@/lib/providers/registry';

interface ModelSelectorProps {
  provider: ProviderType;
  model: string;
  onProviderChange: (p: ProviderType) => void;
  onModelChange: (m: string) => void;
  configuredProviders?: ProviderType[];
  disabled?: boolean;
}

export function ModelSelector({
  provider,
  model,
  onProviderChange,
  onModelChange,
  configuredProviders = [],
  disabled = false,
}: ModelSelectorProps) {
  const providers = useMemo(() => getAllProviders(), []);
  const models = useMemo(() => getModelsForProvider(provider), [provider]);
  const configuredSet = useMemo(
    () => new Set(configuredProviders),
    [configuredProviders]
  );

  const isCurrentConfigured = configuredSet.has(provider);

  useEffect(() => {
    if (configuredProviders.length === 0) return;
    if (configuredSet.has(provider)) return;

    const firstConfigured = providers.find((p) => configuredSet.has(p.id));
    if (firstConfigured) {
      onProviderChange(firstConfigured.id);
      const firstModel = getModelsForProvider(firstConfigured.id)[0];
      if (firstModel) onModelChange(firstModel.id);
    }
  }, [configuredProviders, configuredSet, provider, providers, onProviderChange, onModelChange]);

  useEffect(() => {
    if (models.length === 0) return;
    const exists = models.some((m) => m.id === model);
    if (!exists) {
      onModelChange(models[0].id);
    }
  }, [provider, models, model, onModelChange]);

  const handleProviderChange = (p: ProviderType) => {
    onProviderChange(p);
    const firstModel = getModelsForProvider(p)[0];
    if (firstModel) onModelChange(firstModel.id);
  };

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <select
          value={provider}
          onChange={(e) => handleProviderChange(e.target.value as ProviderType)}
          disabled={disabled}
          className={`h-8 pl-7 pr-2 rounded-input border bg-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50 ${
            isCurrentConfigured
              ? 'border-border'
              : 'border-amber-300 bg-amber-50'
          }`}
          title={
            isCurrentConfigured
              ? `${provider} key configured`
              : `No API key configured for ${provider}`
          }
        >
          {providers.map((p) => {
            const configured = configuredSet.has(p.id);
            return (
              <option key={p.id} value={p.id}>
                {configured ? '● ' : '○ '}
                {p.name}
                {configured ? '' : ' (no key)'}
              </option>
            );
          })}
        </select>
        <div className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none">
          {isCurrentConfigured ? (
            <Check size={12} className="text-emerald-600" />
          ) : (
            <AlertCircle size={12} className="text-amber-600" />
          )}
        </div>
      </div>

      <select
        value={model}
        onChange={(e) => onModelChange(e.target.value)}
        disabled={disabled}
        className="h-8 px-2 rounded-input border border-border bg-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-accent min-w-48 disabled:opacity-50"
      >
        {models.length === 0 ? (
          <option value="">No models for this provider</option>
        ) : (
          models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))
        )}
      </select>
    </div>
  );
}