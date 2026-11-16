'use client';

import { Suspense, useState, useEffect } from 'react';
import { Sidebar } from '@/components/shell/Sidebar';
import { TopBar } from '@/components/shell/TopBar';
import { CommandPalette } from '@/components/shell/CommandPalette';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);

  // ⌘K / Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-bg text-text">
      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        <Suspense
          fallback={
            <aside className="w-[60px] shrink-0 border-r border-border bg-sidebar" />
          }
        >
          <Sidebar />
        </Suspense>
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden dsrt-overlay">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative z-10 dsrt-slide-in-left">
            <Suspense fallback={null}>
              <Sidebar onMobileClose={() => setMobileOpen(false)} />
            </Suspense>
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col min-w-0 relative">
        <TopBar
          onMobileMenuToggle={() => setMobileOpen((v) => !v)}
          onCommandPalette={() => setCommandOpen(true)}
        />
        <main className="flex-1 overflow-hidden relative">{children}</main>
      </div>

      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} />
    </div>
  );
}