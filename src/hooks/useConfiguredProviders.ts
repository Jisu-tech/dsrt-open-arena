'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ProviderType } from '@/lib/providers/registry';

export function useConfiguredProviders(workspaceId?: string) {
  const [configuredProviders, setConfiguredProviders] = useState<ProviderType[]>([]);
  const [loading, setLoading] = useState<boolean>(Boolean(workspaceId));

  const refetch = useCallback(async () => {
    if (!workspaceId) {
      setConfiguredProviders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/v1/credentials?workspace_id=${encodeURIComponent(workspaceId)}`);
      if (!res.ok) throw new Error('Failed to fetch credentials');
      const data = await res.json();

      const activeList: ProviderType[] = (data.credentials || [])
        .filter((c: { status?: string; isActive?: boolean }) => {
          const st = String(c.status || '').toUpperCase();
          return st === 'ACTIVE' || c.isActive === true;
        })
        .map((c: { provider: ProviderType }) => c.provider);

      setConfiguredProviders(Array.from(new Set(activeList)));
    } catch (err) {
      console.error('[useConfiguredProviders] Error fetching active providers:', err);
      setConfiguredProviders([]);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId) {
      return;
    }

    let ignore = false;

    fetch(`/api/v1/credentials?workspace_id=${encodeURIComponent(workspaceId)}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch credentials');
        return res.json();
      })
      .then((data) => {
        if (ignore) return;
        const activeList: ProviderType[] = (data.credentials || [])
          .filter((c: { status?: string; isActive?: boolean }) => {
            const st = String(c.status || '').toUpperCase();
            return st === 'ACTIVE' || c.isActive === true;
          })
          .map((c: { provider: ProviderType }) => c.provider);

        setConfiguredProviders(Array.from(new Set(activeList)));
      })
      .catch((err) => {
        if (!ignore) {
          console.error('[useConfiguredProviders] Error fetching active providers:', err);
          setConfiguredProviders([]);
        }
      })
      .finally(() => {
        if (!ignore) {
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [workspaceId]);

  return { configuredProviders, loading, refetch };
}