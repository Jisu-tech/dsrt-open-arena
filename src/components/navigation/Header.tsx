'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles, Swords, Key, ShieldCheck, Cpu } from 'lucide-react';
import { KeyManagerModal } from '@/components/keys/KeyManagerModal';

interface HeaderProps {
  userId?: string;
  activeWorkspaceName?: string;
}

export function Header({ userId = 'usr_default', activeWorkspaceName = 'Default Workspace' }: HeaderProps) {
  const pathname = usePathname();
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);

  const isWorkMode = pathname === '/' || pathname.startsWith('/work');
  const isWarMode = pathname.startsWith('/war');

  return (
    <>
      <header className="h-14 border-b border-neutral-800 bg-neutral-950/90 backdrop-blur-md px-4 flex items-center justify-between z-30 sticky top-0">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 font-bold text-sm tracking-tight text-white hover:opacity-90">
            <div className="w-7 h-7 rounded-lg bg-neutral-800 border border-neutral-700 flex items-center justify-center">
              <Cpu className="w-4 h-4 text-white" />
            </div>
            <span>DSRT Open Arena</span>
          </Link>
          <span className="text-neutral-700">/</span>
          <span className="text-xs text-neutral-400 font-mono">{activeWorkspaceName}</span>
        </div>

        <div className="flex items-center p-1 bg-neutral-900 border border-neutral-800 rounded-lg">
          <Link
            href="/"
            className={`flex items-center gap-2 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              isWorkMode
                ? 'bg-neutral-800 text-white shadow-xs'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Work Mode</span>
          </Link>
          <Link
            href="/war"
            className={`flex items-center gap-2 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              isWarMode
                ? 'bg-neutral-800 text-white shadow-xs'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Swords className="w-3.5 h-3.5" />
            <span>War Mode</span>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsKeyModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-xs font-medium text-neutral-300 transition-colors"
            title="Manage API Keys"
          >
            <Key className="w-3.5 h-3.5 text-neutral-400" />
            <span className="hidden sm:inline">API Keys</span>
            <ShieldCheck className="w-3 h-3 text-neutral-500" />
          </button>
        </div>
      </header>

      <KeyManagerModal
        isOpen={isKeyModalOpen}
        onClose={() => setIsKeyModalOpen(false)}
        userId={userId}
      />
    </>
  );
}