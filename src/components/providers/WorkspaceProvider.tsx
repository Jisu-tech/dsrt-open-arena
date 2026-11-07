'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/AuthProvider';
import type { Workspace, WorkspaceRole } from '@/types';

const STORAGE_KEY = 'dsrt_active_workspace_id';
const EMPTY_WORKSPACES: Workspace[] = [];

type WorkspaceContextValue = {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  activeWorkspaceId: string | null;
  role: WorkspaceRole | null;
  isLoading: boolean;
  setActiveWorkspaceId: (id: string) => void;
  refreshWorkspaces: () => Promise<void>;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  const [loadedWorkspaces, setLoadedWorkspaces] = useState<Workspace[]>([]);
  const [loadedActiveId, setLoadedActiveId] = useState<string | null>(null);
  const [roleMap, setRoleMap] = useState<Record<string, WorkspaceRole>>({});
  const [fetching, setFetching] = useState(false);

  const applyWorkspaceRows = useCallback(
    (
      data: Array<{ role: string; workspace: unknown }> | null
    ): { list: Workspace[]; nextRoleMap: Record<string, WorkspaceRole> } => {
      const nextRoleMap: Record<string, WorkspaceRole> = {};
      const list: Workspace[] = [];

      for (const row of data || []) {
        const ws = row.workspace as Workspace | Workspace[] | null;
        const workspace = Array.isArray(ws) ? ws[0] : ws;
        if (!workspace?.id) continue;
        list.push(workspace);
        nextRoleMap[workspace.id] = row.role as WorkspaceRole;
      }

      list.sort((a, b) => a.name.localeCompare(b.name));
      return { list, nextRoleMap };
    },
    []
  );

  const refreshWorkspaces = useCallback(async () => {
    if (!user) return;

    setFetching(true);
    try {
      const { data, error } = await supabase
        .from('workspace_members')
        .select(
          `
          role,
          workspace:workspaces (
            id,
            name,
            slug,
            owner_id,
            created_at,
            updated_at
          )
        `
        )
        .eq('user_id', user.id);

      if (error) {
        console.error('Failed to load workspaces', error);
        setLoadedWorkspaces([]);
        setRoleMap({});
        return;
      }

      const { list, nextRoleMap } = applyWorkspaceRows(
        data as Array<{ role: string; workspace: unknown }> | null
      );
      setLoadedWorkspaces(list);
      setRoleMap(nextRoleMap);

      const stored =
        typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;

      setLoadedActiveId((prev) => {
        const candidate = prev || stored;
        if (candidate && list.some((w) => w.id === candidate)) return candidate;
        return list[0]?.id ?? null;
      });
    } finally {
      setFetching(false);
    }
  }, [supabase, user, applyWorkspaceRows]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) return;

    let cancelled = false;

    (async () => {
      setFetching(true);
      try {
        const { data, error } = await supabase
          .from('workspace_members')
          .select(
            `
            role,
            workspace:workspaces (
              id,
              name,
              slug,
              owner_id,
              created_at,
              updated_at
            )
          `
          )
          .eq('user_id', user.id);

        if (cancelled) return;

        if (error) {
          console.error('Failed to load workspaces', error);
          setLoadedWorkspaces([]);
          setRoleMap({});
          return;
        }

        const { list, nextRoleMap } = applyWorkspaceRows(
          data as Array<{ role: string; workspace: unknown }> | null
        );
        setLoadedWorkspaces(list);
        setRoleMap(nextRoleMap);

        const stored =
          typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;

        setLoadedActiveId((prev) => {
          const candidate = prev || stored;
          if (candidate && list.some((w) => w.id === candidate)) return candidate;
          return list[0]?.id ?? null;
        });
      } finally {
        if (!cancelled) setFetching(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user, supabase, applyWorkspaceRows]);

  const setActiveWorkspaceId = useCallback((id: string) => {
    setLoadedActiveId(id);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, id);
    }
  }, []);

  // Stable empty array when logged out (avoids exhaustive-deps warning)
  const workspaces = user ? loadedWorkspaces : EMPTY_WORKSPACES;
  const activeWorkspaceId = user ? loadedActiveId : null;

  const activeWorkspace = useMemo(
    () => workspaces.find((w) => w.id === activeWorkspaceId) ?? null,
    [workspaces, activeWorkspaceId]
  );

  const role = activeWorkspaceId ? roleMap[activeWorkspaceId] ?? null : null;

  const value: WorkspaceContextValue = {
    workspaces,
    activeWorkspace,
    activeWorkspaceId,
    role,
    isLoading: authLoading || (!!user && fetching && workspaces.length === 0),
    setActiveWorkspaceId,
    refreshWorkspaces,
  };

  return (
    <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error('useWorkspace must be used within WorkspaceProvider');
  }
  return ctx;
}