'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ProviderType } from '@/lib/providers/registry';

export interface UseConfiguredProvidersResult {
  configuredProviders: ProviderType[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useConfiguredProviders(
  workspaceId: string | null
): UseConfiguredProvidersResult {
  const [configuredProviders, setConfiguredProviders] = useState<ProviderType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!workspaceId) {
      setConfiguredProviders([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/credentials?workspace_id=${workspaceId}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          (data as { error?: string }).error || 'Failed to load credentials'
        );
      }
      const data = await res.json();
      const providers = Array.from(
        new Set(
          (data.credentials || [])
            .filter((c: { status?: string; isActive?: boolean }) => {
              const s = String(c.status || '').toLowerCase();
              return s === 'active' || s === 'valid' || c.isActive === true;
            })
            .map((c: { provider: string }) => c.provider as ProviderType)
        )
      ) as ProviderType[];
      setConfiguredProviders(providers);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load credentials');
      setConfiguredProviders([]);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      if (!cancelled) {
        void refresh();
      }
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [refresh]);

  return { configuredProviders, loading, error, refresh };
}