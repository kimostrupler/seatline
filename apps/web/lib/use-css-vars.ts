'use client';

import { useEffect, useState } from 'react';

/**
 * The canvas can't use CSS variables directly, so read the theme tokens and re-read
 * them when the system switches between light and dark.
 */
export function useCssVars<const K extends string>(names: readonly K[]): Record<K, string> | null {
  const [values, setValues] = useState<Record<K, string> | null>(null);
  const key = names.join(',');

  useEffect(() => {
    const read = () => {
      const style = getComputedStyle(document.documentElement);
      setValues(
        Object.fromEntries(
          names.map((n) => [n, style.getPropertyValue(`--${n}`).trim()]),
        ) as Record<K, string>,
      );
    };
    read();
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', read);
    return () => media.removeEventListener('change', read);
  }, [key]);

  return values;
}
