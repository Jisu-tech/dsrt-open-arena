'use client';

import React, { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { WarWorkspace } from '@/components/war/WarWorkspace';

export default function WarPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center text-sm text-text-muted gap-2">
          <Loader2 className="animate-spin" size={16} />
          Loading…
        </div>
      }
    >
      <WarWorkspace />
    </Suspense>
  );
}