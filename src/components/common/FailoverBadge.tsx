'use client';

import React from 'react';
import { ShieldAlert, RefreshCw } from 'lucide-react';
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
    <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-neutral-900 border border-neutral-800 rounded-md text-xs text-neutral-300">
      <ShieldAlert className="w-3.5 h-3.5 text-neutral-400" />
      <span>
        Failover active: Switched from{' '}
        <strong className="text-white font-mono">{firstEvent.originalProvider}</strong> to{' '}
        <strong className="text-white font-mono">
          {finalProvider} ({finalModel})
        </strong>
      </span>
      <RefreshCw className="w-3 h-3 text-neutral-500 animate-spin ml-1" />
    </div>
  );
}