'use client';

import { useCallback, useSyncExternalStore } from 'react';

// How strongly the plan image shows behind the layout. A per-device preference.
const KEY = 'seatline.planOpacity';
const DEFAULT = 0.6;
const listeners = new Set<() => void>();

function read(): number {
  try {
    const v = Number(localStorage.getItem(KEY));
    return localStorage.getItem(KEY) !== null && v >= 0 && v <= 1 ? v : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

export function usePlanOpacity() {
  const value = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    read,
    () => DEFAULT,
  );
  const set = useCallback((v: number) => {
    try {
      localStorage.setItem(KEY, String(v));
    } catch {
      // storage blocked — keep the default
    }
    listeners.forEach((l) => l());
  }, []);
  return [value, set] as const;
}
