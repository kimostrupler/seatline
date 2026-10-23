'use client';

import { useCallback, useSyncExternalStore } from 'react';

const listeners = new Set<() => void>();

/** Something a person hid in this browser (a convenience: storage may be blocked). */
export function useDismissed(key: string) {
  const hidden = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => {
      try {
        return localStorage.getItem(key) === '1';
      } catch {
        return false;
      }
    },
    () => true, // server: don't flash it
  );
  const hide = useCallback(() => {
    try {
      localStorage.setItem(key, '1');
    } catch {
      // storage blocked — hidden until reload
    }
    listeners.forEach((l) => l());
  }, [key]);
  return [hidden, hide] as const;
}
