'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { WorkWorkspace } from '@/components/work/WorkWorkspace';
import { Loader2 } from 'lucide-react';

function WorkPageInner() {
  const searchParams = useSearchParams();
  const c = searchParams.get('c') ?? 'new';
  // Remount when conversation id changes → clean state, no setState-in-effect
  return <WorkWorkspace key={c} />;
}

export default function WorkPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center text-sm text-secondary gap-2">
          <Loader2 className="animate-spin" size={16} />
          Loading Work…
        </div>
      }
    >
      <WorkPageInner />
    </Suspense>
  );
}