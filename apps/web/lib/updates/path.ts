import type { Language } from '../locales';

/** The updates page: /updates/<language>, each post at #<slug> (no texts here: client-safe). */
export const updatesPath = (language: Language, slug?: string) =>
  `/updates/${language}${slug ? `#${slug}` : ''}`;
