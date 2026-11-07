'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Sparkles,
  Swords,
  Plus,
  MessageSquare,
  LogOut,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  BookOpen,
  Hexagon,
} from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useWorkspace } from '@/components/providers/WorkspaceProvider';
import type { Conversation } from '@/types';

const COLLAPSE_KEY = 'dsrt-sidebar-collapsed';

function readCollapsedPreference(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeConvId = searchParams.get('c');

  const { user, profile, signOut, isLoading: authLoading } = useAuth();
  const { activeWorkspaceId, isLoading: wsLoading } = useWorkspace();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingConvos, setLoadingConvos] = useState(false);
  // Lazy init from localStorage — no setState inside an effect
  const [isCollapsed, setIsCollapsed] = useState<boolean>(readCollapsedPreference);
  const [logoFailed, setLogoFailed] = useState(false);

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(COLLAPSE_KEY, String(next));
      } catch {
        /* ignore quota / private mode */
      }
      return next;
    });
  };

  useEffect(() => {
    if (!activeWorkspaceId) return;

    let cancelled = false;

    (async () => {
      setLoadingConvos(true);
      try {
        const res = await fetch(
          `/api/v1/conversations?workspace_id=${activeWorkspaceId}`
        );
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled) return;
        setConversations(data.conversations || []);
      } catch (err) {
        if (!cancelled) console.error('Failed to load conversations', err);
      } finally {
        if (!cancelled) setLoadingConvos(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeWorkspaceId, pathname, activeConvId]);

  const handleNewChat = () => {
    router.push('/work');
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace('/login');
    router.refresh();
  };

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'User';
  const initial = displayName.charAt(0).toUpperCase();
  const visibleConversations = activeWorkspaceId ? conversations : [];

  const navCls = (active: boolean) =>
    `flex items-center gap-3 px-3 py-2 rounded-input text-sm transition-colors ${
      active
        ? 'bg-blue-50 text-accent font-medium'
        : 'text-secondary hover:bg-workspace hover:text-foreground'
    }`;

  return (
    <aside
      className={`shrink-0 border-r border-border bg-white flex flex-col h-full transition-[width] duration-200 ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      <div className="h-16 px-3 flex items-center gap-2 border-b border-border overflow-hidden">
        <Link href="/work" className="flex items-center gap-2.5 min-w-0">
          <div className="relative h-8 w-8 shrink-0 flex items-center justify-center rounded-md bg-workspace border border-border overflow-hidden">
            {!logoFailed ? (
              <Image
                src="/dsrt-logo.svg"
                alt="DSRT AI"
                width={32}
                height={32}
                className="object-contain p-0.5"
                onError={() => setLogoFailed(true)}
                priority
              />
            ) : (
              <Hexagon size={18} className="text-accent" />
            )}
          </div>
          {!isCollapsed && (
            <div className="leading-tight min-w-0">
              <div className="text-xs font-bold tracking-[0.14em] text-foreground uppercase">
                DSRT AI
              </div>
              <div className="text-[9px] text-secondary font-mono truncate">
                Open Arena
              </div>
            </div>
          )}
        </Link>
      </div>

      <nav className="p-2 space-y-1">
        <Link
          href="/work"
          className={navCls(pathname.startsWith('/work') || pathname === '/')}
          title="Work Mode"
        >
          <Sparkles size={18} className="shrink-0" />
          {!isCollapsed && <span>Work Mode</span>}
        </Link>
        <Link
          href="/war"
          className={navCls(pathname.startsWith('/war'))}
          title="War Mode"
        >
          <Swords size={18} className="shrink-0" />
          {!isCollapsed && <span>War Mode</span>}
        </Link>
        <Link
          href="/docs"
          className={navCls(pathname.startsWith('/docs'))}
          title="Documentation"
        >
          <BookOpen size={18} className="shrink-0" />
          {!isCollapsed && <span>Docs</span>}
        </Link>
      </nav>

      <div className="px-2 mb-2">
        <button
          type="button"
          onClick={handleNewChat}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-input border border-border text-xs font-medium text-foreground hover:border-accent hover:text-accent transition-colors"
          title="New Chat"
        >
          <Plus size={14} />
          {!isCollapsed && <span>New Chat</span>}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {!isCollapsed && (
          <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-secondary">
            Recent
          </div>
        )}
        {wsLoading || loadingConvos ? (
          <div className="flex items-center justify-center py-6 text-secondary">
            <Loader2 size={14} className="animate-spin" />
          </div>
        ) : visibleConversations.length === 0 ? (
          !isCollapsed ? (
            <p className="px-2 py-3 text-[11px] text-secondary">No conversations yet</p>
          ) : null
        ) : (
          <ul className="space-y-0.5">
            {visibleConversations.map((c) => {
              const active = activeConvId === c.id;
              return (
                <li key={c.id}>
                  <Link
                    href={`/work?c=${c.id}`}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-input text-xs truncate transition-colors ${
                      active
                        ? 'bg-blue-50 text-accent'
                        : 'text-secondary hover:bg-workspace hover:text-foreground'
                    }`}
                    title={c.title}
                  >
                    <MessageSquare size={12} className="shrink-0" />
                    {!isCollapsed && (
                      <span className="truncate">{c.title || 'Untitled'}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="border-t border-border p-2 space-y-1">
        <div className="flex items-center gap-2 px-1">
          <div className="h-8 w-8 shrink-0 rounded-full bg-workspace border border-border flex items-center justify-center text-xs font-semibold text-foreground">
            {authLoading ? '…' : initial}
          </div>
          {!isCollapsed && (
            <>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-foreground truncate">
                  {displayName}
                </div>
                <div className="text-[10px] text-secondary truncate">{user?.email}</div>
              </div>
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="p-1.5 rounded-input text-secondary hover:text-error hover:bg-red-50 transition-colors"
                title="Sign out"
              >
                <LogOut size={14} />
              </button>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={toggleCollapse}
          className="w-full flex items-center justify-center gap-2 px-2 py-1.5 rounded-input text-secondary hover:bg-workspace hover:text-foreground transition-colors"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          {!isCollapsed && <span className="text-[11px]">Collapse</span>}
        </button>
      </div>
    </aside>
  );
}