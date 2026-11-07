import { Suspense } from 'react';
import { Sidebar } from '@/components/shell/Sidebar';
import { TopBar } from '@/components/shell/TopBar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Suspense fallback={<aside className="w-16 shrink-0 border-r border-border bg-white" />}>
        <Sidebar />
      </Suspense>
      <div className="flex flex-1 flex-col relative min-w-0 transition-all duration-300">
        <TopBar />
        <main className="flex-1 overflow-y-auto bg-workspace relative">{children}</main>
      </div>
    </div>
  );
}