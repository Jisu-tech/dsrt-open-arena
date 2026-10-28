'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageSquare, Swords, Plus, Pin } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface ChatItem {
  id: string;
  title: string;
  is_pinned?: boolean;
}

interface SidebarProps {
  recentChats?: ChatItem[];
  onNewChat?: () => void;
}

export function Sidebar({ recentChats = [], onNewChat }: SidebarProps) {
  const pathname = usePathname();

  const isWorkMode = pathname.startsWith('/work') || pathname === '/';
  const isWarMode = pathname.startsWith('/war');

  return (
    <aside className="w-[220px] h-screen border-r border-border bg-workspace flex flex-col shrink-0 select-none">
      {/* Brand Logo */}
      <div className="h-[64px] border-b border-border px-6 flex items-center justify-between">
        <Link href="/" className="font-extrabold text-lg tracking-wider font-mono text-foreground flex items-center gap-2">
          <span className="bg-foreground text-white px-2 py-0.5 rounded-md text-xs">DSRT</span>
          <span>ARENA</span>
        </Link>
      </div>

      {/* Mode Navigation */}
      <div className="p-4 space-y-1">
        <div className="text-[10px] font-bold text-secondary uppercase tracking-widest px-2 mb-2">Modes</div>
        
        <Link href="/work">
          <div
            className={`flex items-center gap-2.5 px-3 py-2 rounded-input text-xs font-semibold transition-all ${
              isWorkMode
                ? 'bg-white text-accent border border-border shadow-sm'
                : 'text-secondary hover:text-foreground hover:bg-white/60'
            }`}
          >
            <MessageSquare size={16} />
            <span>Work Mode</span>
          </div>
        </Link>

        <Link href="/war">
          <div
            className={`flex items-center gap-2.5 px-3 py-2 rounded-input text-xs font-semibold transition-all ${
              isWarMode
                ? 'bg-white text-accent border border-border shadow-sm'
                : 'text-secondary hover:text-foreground hover:bg-white/60'
            }`}
          >
            <Swords size={16} />
            <span>War Mode</span>
          </div>
        </Link>
      </div>

      {/* New Chat Button */}
      <div className="px-4 py-2">
        <Button onClick={onNewChat} variant="outline" size="sm" className="w-full justify-start text-xs font-semibold gap-2">
          <Plus size={14} /> New Amplified Chat
        </Button>
      </div>

      {/* Recent Conversations List */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1">
        <div className="text-[10px] font-bold text-secondary uppercase tracking-widest px-2 mb-2">Recent Chats</div>
        {recentChats.length === 0 ? (
          <div className="text-xs text-secondary/60 px-2 italic py-4">No recent sessions</div>
        ) : (
          recentChats.map((chat) => (
            <Link key={chat.id} href={`/work?c=${chat.id}`}>
              <div className="flex items-center justify-between px-3 py-1.5 rounded-input text-xs text-secondary hover:text-foreground hover:bg-white/80 transition-colors group">
                <span className="truncate">{chat.title}</span>
                {chat.is_pinned && <Pin size={10} className="text-accent shrink-0" />}
              </div>
            </Link>
          ))
        )}
      </div>

      {/* Footer Profile Stub */}
      <div className="p-4 border-t border-border bg-white/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-slate-200 border border-border flex items-center justify-center font-bold text-xs">
            U
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-foreground">Workspace Admin</span>
            <span className="text-[10px] text-secondary">Free Tier</span>
          </div>
        </div>
      </div>
    </aside>
  );
}