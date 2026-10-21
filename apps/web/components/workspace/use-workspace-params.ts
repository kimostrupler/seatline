'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

export interface WorkspaceParams {
  building: string | null;
  floor: string | null;
  seat: string | null;
  person: string | null;
  /** 'edit' = layout editor */
  mode: string | null;
}

/**
 * What's selected lives in the URL (?building=&floor=&seat=&person=&mode=), so links can be
 * shared and the browser's back button works.
 */
export function useWorkspaceParams() {
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const params: WorkspaceParams = {
    building: search.get('building'),
    floor: search.get('floor'),
    seat: search.get('seat'),
    person: search.get('person'),
    mode: search.get('mode'),
  };

  const update = useCallback(
    (patch: Partial<WorkspaceParams>, mode: 'push' | 'replace' = 'push') => {
      const next = new URLSearchParams(search.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v) next.set(k, v);
        else next.delete(k);
      }
      const url = next.size ? `${pathname}?${next}` : pathname;
      if (mode === 'push') router.push(url, { scroll: false });
      else router.replace(url, { scroll: false });
    },
    [search, router, pathname],
  );

  return [params, update] as const;
}
