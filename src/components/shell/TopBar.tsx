'use client';

import React, { useEffect, useState } from 'react';
import { Key, ChevronDown } from 'lucide-react';
import { useWorkspace } from '@/components/providers/WorkspaceProvider';
import { ApiKeyManagerModal } from '@/components/credentials/ApiKeyManagerModal';
import { Badge } from '@/components/ui/Badge';

export function TopBar() {
  const {
    workspaces,
    activeWorkspace,
    activeWorkspaceId,
    setActiveWorkspaceId,
    isLoading,
  } = useWorkspace();

  const [keysOpen, setKeysOpen] = useState(false);
  const [keyCount, setKeyCount] = useState(0);
  const [usageLabel, setUsageLabel] = useState<string>('—');

  useEffect(() => {
    if (!activeWorkspaceId) return;

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(
          `/api/v1/credentials?workspace_id=${activeWorkspaceId}`
        );
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const items = data.credentials || data.items || [];
        if (cancelled) return;
        setKeyCount(items.length);
        const total = items.reduce(
          (sum: number, c: { total_cost_usd?: number }) =>
            sum + (Number(c.total_cost_usd) || 0),
          0
        );
        setUsageLabel(total > 0 ? `$${total.toFixed(4)} provider` : '$0.00 provider');
      } catch {
        if (!cancelled) {
          setKeyCount(0);
          setUsageLabel('Unavailable');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeWorkspaceId, keysOpen]);

  // Derive display values — no sync setState when workspace is null
  const displayKeyCount = activeWorkspaceId ? keyCount : 0;
  const displayUsage = activeWorkspaceId ? usageLabel : '—';

  return (
    <>
      <header className="h-16 shrink-0 border-b border-border bg-white px-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative">
            <label className="sr-only">Workspace</label>
            <select
              disabled={isLoading || workspaces.length === 0}
              value={activeWorkspaceId ?? ''}
              onChange={(e) => setActiveWorkspaceId(e.target.value)}
              className="appearance-none bg-workspace border border-border rounded-input pl-3 pr-8 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent max-w-55"
            >
              {workspaces.length === 0 ? (
                <option value="">No workspace</option>
              ) : (
                workspaces.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))
              )}
            </select>
            <ChevronDown
              size={14}
              className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-secondary"
            />
          </div>
          {activeWorkspace && (
            <Badge variant="outline">Personal</Badge>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:block text-xs text-secondary font-mono">
            DSRT Usage:&nbsp;
            <span className="text-foreground">$0.00 (Free tier)</span>
            <span className="mx-2 text-border">|</span>
            <span className="text-foreground">{displayUsage}</span>
          </div>

          <button
            type="button"
            onClick={() => setKeysOpen(true)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-input border border-border text-xs font-medium text-foreground hover:border-accent hover:text-accent transition-colors"
          >
            <Key size={14} />
            API Keys
            {displayKeyCount > 0 && (
              <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent text-[10px] text-white px-1">
                {displayKeyCount}
              </span>
            )}
          </button>
        </div>
      </header>

      <ApiKeyManagerModal
        open={keysOpen}
        onClose={() => setKeysOpen(false)}
        workspaceId={activeWorkspaceId}
      />
    </>
  );
}