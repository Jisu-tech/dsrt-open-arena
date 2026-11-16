'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Key, ChevronDown, PanelLeftOpen } from 'lucide-react';
import { useWorkspace } from '@/components/providers/WorkspaceProvider';
import { ApiKeyManagerModal } from '@/components/credentials/ApiKeyManagerModal';

interface TopBarProps {
  onMobileMenuToggle?: () => void;
  onCommandPalette?: () => void;
}

export function TopBar({ onMobileMenuToggle, onCommandPalette }: TopBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    workspaces,
    activeWorkspaceId,
    setActiveWorkspaceId,
    isLoading,
  } = useWorkspace();

  const [keysOpen, setKeysOpen] = useState(false);
  const [keyCount, setKeyCount] = useState(0);

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
        if (!cancelled) setKeyCount(items.length);
      } catch {
        if (!cancelled) setKeyCount(0);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeWorkspaceId, keysOpen]);

  const isWork = pathname.startsWith('/work') || pathname === '/';
  const isWar = pathname.startsWith('/war');

  return (
    <>
      <header className="h-14 shrink-0 border-b border-border bg-bg flex items-center justify-between px-4 md:px-6">
        {/* Left: mobile menu + workspace */}
        <div className="flex items-center gap-2 min-w-0">
          {onMobileMenuToggle && (
            <button
              type="button"
              onClick={onMobileMenuToggle}
              className="md:hidden p-1.5 rounded-md text-text-muted hover:text-text hover:bg-panel-hover transition-colors"
              title="Menu"
            >
              <PanelLeftOpen size={16} strokeWidth={1.7} />
            </button>
          )}

          <div className="relative">
            <select
              disabled={isLoading || workspaces.length === 0}
              value={activeWorkspaceId ?? ''}
              onChange={(e) => setActiveWorkspaceId(e.target.value)}
              className="appearance-none bg-panel border border-border rounded-md pl-3 pr-8 py-1.5 text-[12px] text-text font-medium hover:border-border-hover focus:outline-none focus:border-border-hover transition-colors max-w-[200px] cursor-pointer"
            >
              {workspaces.length === 0 ? (
                <option value="">No workspace</option>
              ) : (
                workspaces.map((w) => (
                  <option key={w.id} value={w.id} className="bg-panel">
                    {w.name}
                  </option>
                ))
              )}
            </select>
            <ChevronDown
              size={12}
              strokeWidth={1.8}
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-text-faint"
            />
          </div>
        </div>

        {/* Center: mode tabs */}
        <div className="flex items-center p-0.5 bg-panel border border-border rounded-full">
          <button
            type="button"
            onClick={() => router.push('/work')}
            className={`px-4 py-1 rounded-full text-[12px] font-medium transition-colors ${
              isWork
                ? 'bg-bg-elevated text-text shadow-sm'
                : 'text-text-muted hover:text-text'
            }`}
          >
            Work
          </button>
          <button
            type="button"
            onClick={() => router.push('/war')}
            className={`px-4 py-1 rounded-full text-[12px] font-medium transition-colors ${
              isWar
                ? 'bg-bg-elevated text-text shadow-sm'
                : 'text-text-muted hover:text-text'
            }`}
          >
            War
          </button>
        </div>

        {/* Right: ⌘K + API keys */}
        <div className="flex items-center gap-2">
          {onCommandPalette && (
            <button
              type="button"
              onClick={onCommandPalette}
              className="hidden sm:inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md bg-panel hover:bg-panel-hover border border-border hover:border-border-hover text-[11px] font-mono text-text-faint transition-colors"
              title="Command palette"
            >
              ⌘K
            </button>
          )}

          <button
            type="button"
            onClick={() => setKeysOpen(true)}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-panel hover:bg-panel-hover border border-border hover:border-border-hover text-[12px] font-medium text-text transition-colors"
          >
            <Key size={12} strokeWidth={1.8} />
            <span className="hidden sm:inline">API Keys</span>
            {keyCount > 0 && (
              <span className="inline-flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-text text-bg text-[9px] px-1 font-semibold leading-none">
                {keyCount}
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