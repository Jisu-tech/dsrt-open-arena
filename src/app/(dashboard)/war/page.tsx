import { Suspense } from 'react';
import { WarWorkspace } from '@/components/war/WarWorkspace';

function WarWorkspaceLoading() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-black text-neutral-400">
      <div className="flex items-center gap-3">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
        <span className="font-mono text-xs uppercase tracking-widest text-neutral-300">
          Loading War Arena...
        </span>
      </div>
    </div>
  );
}

export default function WarPage() {
  return (
    <Suspense fallback={<WarWorkspaceLoading />}>
      <WarWorkspace />
    </Suspense>
  );
}