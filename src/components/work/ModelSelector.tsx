'use client';

import React, { useEffect, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
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
  const configuredSet = useMemo(() => new Set(configuredProviders), [configuredProviders]);

  useEffect(() => {
    if (configuredProviders.length === 0) return;
    if (configuredSet.has(provider)) return;
    const first = providers.find((p) => configuredSet.has(p.id));
    if (first) {
      onProviderChange(first.id);
      const fm = getModelsForProvider(first.id)[0];
      if (fm) onModelChange(fm.id);
    }
  }, [configuredProviders, configuredSet, provider, providers, onProviderChange, onModelChange]);

  useEffect(() => {
    if (models.length === 0) return;
    const exists = models.some((m) => m.id === model);
    if (!exists) onModelChange(models[0].id);
  }, [provider, models, model, onModelChange]);

  const handleProviderChange = (p: ProviderType) => {
    onProviderChange(p);
    const fm = getModelsForProvider(p)[0];
    if (fm) onModelChange(fm.id);
  };

  const selectBase =
    'appearance-none h-8 rounded-md bg-transparent hover:bg-panel-hover text-[12px] font-medium text-text focus:outline-none disabled:opacity-50 transition-colors cursor-pointer';

  return (
    <div className="flex items-center gap-1">
      <div className="relative">
        <select
          value={provider}
          onChange={(e) => handleProviderChange(e.target.value as ProviderType)}
          disabled={disabled}
          className={`${selectBase} pl-3 pr-7`}
        >
          {providers.map((p) => (
            <option key={p.id} value={p.id} className="bg-panel">
              {p.name}
            </option>
          ))}
        </select>
        <ChevronDown size={11} strokeWidth={2} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-faint pointer-events-none" />
      </div>

      <span className="text-text-faint">·</span>

      <div className="relative">
        <select
          value={model}
          onChange={(e) => onModelChange(e.target.value)}
          disabled={disabled}
          className={`${selectBase} pl-3 pr-7 font-mono`}
        >
          {models.length === 0 ? (
            <option value="">No models</option>
          ) : (
            models.map((m) => (
              <option key={m.id} value={m.id} className="bg-panel font-mono">
                {m.name}
              </option>
            ))
          )}
        </select>
        <ChevronDown size={11} strokeWidth={2} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-faint pointer-events-none" />
      </div>
    </div>
  );
}