'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Plus,
  Search,
  Settings,
  LogOut,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  MoreHorizontal,
  X,
} from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useWorkspace } from '@/components/providers/WorkspaceProvider';
import {
  DsrtLogo,
  WorkModeMark,
  WarModeMark,
  DocsMark,
  ChatMark,
  PinMark,
} from '@/components/ui/DsrtMarks';
import type { Conversation } from '@/types';

const COLLAPSE_KEY = 'dsrt-sidebar-collapsed';

interface SidebarProps {
  onMobileClose?: () => void;
}

export function Sidebar({ onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeConvId = searchParams.get('c');

  const { user, profile, signOut, isLoading: authLoading } = useAuth();
  const { activeWorkspaceId, isLoading: wsLoading } = useWorkspace();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingConvos, setLoadingConvos] = useState(false);
  
  // Hydration-safe initial collapse state
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Sync collapsed state after initial mount to prevent SSR mismatch
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(COLLAPSE_KEY);
      if (stored === 'true') {
        setIsCollapsed(true);
      }
    } catch {}
  }, []);

  const isMobile = !!onMobileClose;
  const collapsed = isMobile ? false : isCollapsed;

  const toggleCollapse = () => {
    setIsCollapsed((p) => {
      const next = !p;
      try {
        window.localStorage.setItem(COLLAPSE_KEY, String(next));
      } catch {}
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
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoadingConvos(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeWorkspaceId, pathname, activeConvId]);

  const handleSignOut = async () => {
    await signOut();
    router.replace('/login');
    router.refresh();
  };

  const handleNav = (href: string) => {
    router.push(href);
    onMobileClose?.();
  };

  const displayName =
    profile?.full_name || user?.email?.split('@')[0] || 'User';
  const initial = displayName.charAt(0).toUpperCase();
  const emailPrefix = user?.email || '';

  const pinned = conversations.slice(0, 0);
  const recents = conversations;

  const navItem = (active: boolean) =>
    `flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] transition-colors ${
      active
        ? 'bg-panel text-text'
        : 'text-text-muted hover:bg-panel-hover hover:text-text'
    } ${collapsed ? 'justify-center px-0' : ''}`;

  return (
    <aside
      className={`shrink-0 h-full flex flex-col border-r border-border bg-sidebar transition-[width] duration-200 ease-out ${
        collapsed ? 'w-[60px]' : 'w-[260px]'
      }`}
    >
      {/* Brand header */}
      <div
        className={`h-14 shrink-0 flex items-center border-b border-border ${
          collapsed ? 'justify-center px-2' : 'px-3 justify-between'
        }`}
      >
        <button
          type="button"
          onClick={() => handleNav('/work')}
          className="flex items-center gap-2.5 min-w-0"
          title="DSRT AI"
        >
          <DsrtLogo size={22} />
          {!collapsed && (
            <span className="text-[13px] font-semibold text-text tracking-tight dsrt-fade">
              Dsrt AI
            </span>
          )}
        </button>
        {isMobile && (
          <button
            type="button"
            onClick={onMobileClose}
            className="p-1.5 rounded-md text-text-faint hover:text-text hover:bg-panel-hover transition-colors"
          >
            <X size={16} strokeWidth={1.8} />
          </button>
        )}
      </div>

      {/* Actions: New chat + Search */}
      <div className="shrink-0 p-2 space-y-1">
        <button
          type="button"
          onClick={() => handleNav('/work')}
          className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] text-text-muted hover:bg-panel-hover hover:text-text transition-colors ${
            collapsed ? 'justify-center px-0' : ''
          }`}
          title="New chat"
        >
          <Plus size={15} strokeWidth={1.8} className="shrink-0" />
          {!collapsed && <span className="dsrt-fade">New chat</span>}
        </button>
        <button
          type="button"
          className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] text-text-muted hover:bg-panel-hover hover:text-text transition-colors ${
            collapsed ? 'justify-center px-0' : ''
          }`}
          title="Search chats"
        >
          <Search size={14} strokeWidth={1.8} className="shrink-0" />
          {!collapsed && (
            <span className="dsrt-fade flex items-center justify-between flex-1">
              <span>Search</span>
              <kbd className="text-[9px] text-text-faint font-mono bg-panel border border-border rounded px-1 py-[1px]">
                ⌘K
              </kbd>
            </span>
          )}
        </button>
      </div>

      {/* Modes */}
      <div className="shrink-0 px-2 pt-1 pb-2">
        {!collapsed && (
          <div className="px-2.5 pb-1 text-[10px] font-medium uppercase tracking-wider text-text-faint dsrt-fade">
            Modes
          </div>
        )}
        <div className="space-y-0.5">
          <button
            type="button"
            onClick={() => handleNav('/work')}
            className={navItem(pathname.startsWith('/work') || pathname === '/')}
            title="Work Mode"
          >
            <WorkModeMark size={15} className="shrink-0" />
            {!collapsed && <span className="dsrt-fade">Work Mode</span>}
          </button>
          <button
            type="button"
            onClick={() => handleNav('/war')}
            className={navItem(pathname.startsWith('/war'))}
            title="War Mode"
          >
            <WarModeMark size={15} className="shrink-0" />
            {!collapsed && <span className="dsrt-fade">War Mode</span>}
          </button>
          <button
            type="button"
            onClick={() => handleNav('/docs')}
            className={navItem(pathname.startsWith('/docs'))}
            title="Documentation"
          >
            <DocsMark size={15} className="shrink-0" />
            {!collapsed && <span className="dsrt-fade">Docs</span>}
          </button>
        </div>
      </div>

      {/* Scrollable: Pinned + Recents */}
      <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-2">
        {!collapsed && pinned.length > 0 && (
          <>
            <div className="px-2.5 pt-2 pb-1 text-[10px] font-medium uppercase tracking-wider text-text-faint dsrt-fade">
              Pinned
            </div>
            <ul className="space-y-0.5 mb-3">
              {pinned.map((c) => (
                <ConvItem
                  key={c.id}
                  c={c}
                  active={activeConvId === c.id}
                  pinned
                  onNav={onMobileClose}
                />
              ))}
            </ul>
          </>
        )}

        {!collapsed && (
          <div className="px-2.5 pt-2 pb-1 text-[10px] font-medium uppercase tracking-wider text-text-faint dsrt-fade">
            Recents
          </div>
        )}

        {wsLoading || loadingConvos ? (
          <div className="flex items-center justify-center py-6 text-text-faint">
            <Loader2 size={13} className="animate-spin" />
          </div>
        ) : recents.length === 0 ? (
          !collapsed && (
            <p className="px-2.5 py-2 text-[11px] text-text-faint dsrt-fade">
              No conversations yet
            </p>
          )
        ) : (
          <ul className="space-y-0.5">
            {recents.map((c) => (
              <ConvItem
                key={c.id}
                c={c}
                active={activeConvId === c.id}
                collapsed={collapsed}
                onNav={onMobileClose}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-border p-2 space-y-1">
        <button
          type="button"
          onClick={() => handleNav('/settings')}
          className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] text-text-muted hover:bg-panel-hover hover:text-text transition-colors ${
            collapsed ? 'justify-center px-0' : ''
          }`}
          title="Settings"
        >
          <Settings size={14} strokeWidth={1.7} className="shrink-0" />
          {!collapsed && <span className="dsrt-fade">Settings</span>}
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => !collapsed && setUserMenuOpen((v) => !v)}
            className={`w-full flex items-center gap-2 p-1.5 rounded-md hover:bg-panel-hover transition-colors ${
              collapsed ? 'justify-center' : ''
            }`}
          >
            <div className="h-7 w-7 shrink-0 rounded-full bg-panel border border-border-strong flex items-center justify-center text-[11px] font-semibold text-text">
              {authLoading ? '…' : initial}
            </div>
            {!collapsed && (
              <>
                <div className="flex-1 min-w-0 text-left dsrt-fade">
                  <div className="text-[12px] font-medium text-text truncate leading-tight">
                    {displayName}
                  </div>
                  <div className="text-[10px] text-text-faint truncate leading-tight mt-0.5">
                    {emailPrefix}
                  </div>
                </div>
                <MoreHorizontal size={13} className="text-text-faint shrink-0" />
              </>
            )}
          </button>

          {userMenuOpen && !collapsed && (
            <div className="absolute bottom-full left-0 right-0 mb-1 bg-panel border border-border-strong rounded-md shadow-xl overflow-hidden dsrt-fade z-50">
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-text-muted hover:text-error hover:bg-error-bg transition-colors"
              >
                <LogOut size={12} />
                Sign out
              </button>
            </div>
          )}
        </div>

        {!isMobile && (
          <button
            type="button"
            onClick={toggleCollapse}
            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-text-faint hover:bg-panel-hover hover:text-text transition-colors ${
              collapsed ? 'justify-center px-0' : ''
            }`}
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? (
              <PanelLeftOpen size={14} strokeWidth={1.7} />
            ) : (
              <PanelLeftClose size={14} strokeWidth={1.7} />
            )}
            {!collapsed && (
              <span className="text-[11px] dsrt-fade">Collapse</span>
            )}
          </button>
        )}
      </div>
    </aside>
  );
}

function ConvItem({
  c,
  active,
  pinned = false,
  collapsed = false,
  onNav,
}: {
  c: Conversation;
  active: boolean;
  pinned?: boolean;
  collapsed?: boolean;
  onNav?: () => void;
}) {
  return (
    <li>
      <Link
        href={`/work?c=${c.id}`}
        onClick={() => onNav?.()}
        className={`group flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12.5px] truncate transition-colors ${
          active
            ? 'bg-panel text-text'
            : 'text-text-muted hover:bg-panel-hover hover:text-text'
        } ${collapsed ? 'justify-center px-0' : ''}`}
        title={c.title || 'Untitled'}
      >
        {pinned ? (
          <PinMark size={10} className="shrink-0 text-text-faint" />
        ) : (
          <ChatMark
            size={12}
            className="shrink-0 text-text-faint opacity-70"
          />
        )}
        {!collapsed && (
          <span className="truncate flex-1">{c.title || 'Untitled'}</span>
        )}
      </Link>
    </li>
  );
}
