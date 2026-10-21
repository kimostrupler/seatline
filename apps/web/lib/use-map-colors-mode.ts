'use client';

import { useCallback, useSyncExternalStore } from 'react';

export type ColorBy = 'status' | 'team';
const KEY = 'seatline.mapColorBy';
const listeners = new Set<() => void>();

function read(): ColorBy {
  try {
    return localStorage.getItem(KEY) === 'team' ? 'team' : 'status';
  } catch {
    return 'status';
  }
}

/** Map colours by seat status or by team — remembered per browser. */
export function useColorBy() {
  const value = useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    read,
    () => 'status' as const,
  );
  const set = useCallback((next: ColorBy) => {
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // private mode: only this page view remembers it
    }
    listeners.forEach((l) => l());
  }, []);
  return [value, set] as const;
}
