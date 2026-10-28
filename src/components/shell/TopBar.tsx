'use client';

import React, { useState } from 'react';
import { Key, Layers, ExternalLink } from 'lucide-react';
import { ApiKeyManagerModal } from '@/components/credentials/ApiKeyManagerModal';

interface TopBarProps {
  workspaceName?: string;
  activeModeTitle?: string;
}

export function TopBar({ workspaceName = 'Default Workspace', activeModeTitle = 'Work Mode' }: TopBarProps) {
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [credentials, setCredentials] = useState<any[]>([]);

  return (
    <>
      <header className="h-[64px] border-b border-border flex items-center justify-between px-6 bg-white shrink-0">
        {/* Left Status Indicator */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-medium text-foreground bg-workspace px-3 py-1.5 rounded-input border border-border">
            <Layers size={14} className="text-accent" />
            <span>{workspaceName}</span>
          </div>
          <span className="text-border">|</span>
          <span className="text-xs font-semibold text-secondary uppercase tracking-wider">{activeModeTitle}</span>
        </div>

        {/* Right Actions & Metrics */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsKeyModalOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-foreground border border-border rounded-input hover:bg-workspace transition-colors"
          >
            <Key size={14} className="text-accent" />
            <span>API Keys</span>
          </button>

          <div className="h-8 px-3 rounded-input border border-border bg-workspace flex items-center text-xs font-mono font-medium text-secondary">
            DSRT Usage: <span className="ml-1 font-semibold text-foreground">$0.00 (Free tier)</span>
          </div>
        </div>
      </header>

      {/* API Key Modal */}
      <ApiKeyManagerModal
        isOpen={isKeyModalOpen}
        onClose={() => setIsKeyModalOpen(false)}
        workspaceId="default-workspace-id"
        credentials={credentials}
        onRefreshCredentials={() => {}}
      />
    </>
  );
}