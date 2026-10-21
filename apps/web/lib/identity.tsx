'use client';

import { DEMO_TENANTS } from '@seatline/shared';
import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

/**
 * Dev-only sign-in: which demo company + user the API headers claim to be.
 * Replaced by Microsoft Entra ID in Phase 4.
 */
export interface Identity {
  tenantId: string;
  userId: string;
}

const KEY = 'seatline.devIdentity';
const first = DEMO_TENANTS[0]!;
const DEFAULT: Identity = { tenantId: first.id, userId: first.users[0].id };

let cached: { raw: string | null; value: Identity } = { raw: null, value: DEFAULT };
const listeners = new Set<() => void>();

function read(): Identity {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    // storage blocked (private mode) — use the default
  }
  if (raw === cached.raw) return cached.value;
  let value = DEFAULT;
  try {
    const parsed = raw ? (JSON.parse(raw) as Identity) : null;
    if (parsed?.tenantId && parsed.userId) value = parsed;
  } catch {
    // ignore a corrupt value
  }
  cached = { raw, value };
  return value;
}

/** Read the current identity outside React (API client). */
export function currentIdentity(): Identity {
  return typeof window === 'undefined' ? DEFAULT : read();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const IdentityContext = createContext<{
  identity: Identity;
  setIdentity: (i: Identity) => void;
} | null>(null);

export function IdentityProvider({
  children,
  onChange,
}: {
  children: ReactNode;
  onChange?: () => void;
}) {
  const identity = useSyncExternalStore(subscribe, read, () => DEFAULT);
  const setIdentity = useCallback(
    (next: Identity) => {
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        // storage blocked — the change lasts until reload
        cached = { raw: JSON.stringify(next), value: next };
      }
      onChange?.();
      listeners.forEach((l) => l());
    },
    [onChange],
  );
  return <IdentityContext value={{ identity, setIdentity }}>{children}</IdentityContext>;
}

export function useIdentity() {
  const ctx = useContext(IdentityContext);
  if (!ctx) throw new Error('useIdentity must be used inside IdentityProvider');
  return ctx;
}
