import type { Language } from '@/lib/locales';
import { helpPath } from '.';

/** The video tour's page (light: client menus import this, not video.ts with all its cues). */
export const videoPath = (language: Language, at?: number) =>
  `${helpPath(language)}/video-tour${at ? `?t=${Math.floor(at)}` : ''}`;
