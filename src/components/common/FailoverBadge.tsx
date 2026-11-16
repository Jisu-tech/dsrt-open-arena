'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import type { FailoverEvent } from '@/lib/providers/failover';

interface FailoverBadgeProps {
  failoverEvents: FailoverEvent[];
  finalProvider: string;
  finalModel: string;
}

export function FailoverBadge({
  failoverEvents,
  finalProvider,
  finalModel,
}: FailoverBadgeProps) {
  if (!failoverEvents || failoverEvents.length === 0) return null;

  const firstEvent = failoverEvents[0];

  return (
    <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-input border border-border rounded-md text-xs text-text-muted">
      <span>
        Failover active: Switched from{' '}
        <strong className="text-text font-mono">{firstEvent.originalProvider}</strong> to{' '}
        <strong className="text-text font-mono">
          {finalProvider} ({finalModel})
        </strong>
      </span>
      <Loader2 className="w-3 h-3 text-text-dim animate-spin ml-1" />
    </div>
  );
}