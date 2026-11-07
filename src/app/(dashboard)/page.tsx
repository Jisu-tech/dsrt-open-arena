'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { WorkWorkspace } from '@/components/work/WorkWorkspace';
import { Loader2 } from 'lucide-react';

function HomeInner() {
  const searchParams = useSearchParams();
  const c = searchParams.get('c') ?? 'new';
  return <WorkWorkspace key={c} />;
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center text-sm text-secondary gap-2">
          <Loader2 className="animate-spin" size={16} />
          Loading…
        </div>
      }
    >
      <HomeInner />
    </Suspense>
  );
}