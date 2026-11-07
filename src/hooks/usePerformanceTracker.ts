'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  PerformanceTracker,
  PerformanceSnapshot,
} from '@/lib/metrics/performance';

/**
 * React hook that owns a PerformanceTracker lifecycle for one amplification run.
 */
export function usePerformanceTracker() {
  const trackerRef = useRef<PerformanceTracker | null>(null);
  const [snapshot, setSnapshot] = useState<PerformanceSnapshot | null>(null);

  const start = useCallback((executionId: string, amplified = true) => {
    const tracker = new PerformanceTracker(executionId, amplified);
    trackerRef.current = tracker;
    const unsub = tracker.subscribe(setSnapshot);
    setSnapshot(tracker.getSnapshot());
    return () => {
      unsub();
    };
  }, []);

  const getTracker = useCallback(() => trackerRef.current, []);

  useEffect(() => {
    return () => {
      trackerRef.current = null;
    };
  }, []);

  return {
    snapshot,
    start,
    getTracker,
    setSnapshot,
  };
}