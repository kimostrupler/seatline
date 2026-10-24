import type { Language } from '@/lib/locales';
import { helpPath, type HelpTopicId } from '.';
import { VIDEO_TOUR_URL } from '@/lib/media';
import { CUES } from './video-cues';

export { CUES };

/** The 9-minute video tour (the file is in Blob Storage, see lib/media.ts). */
export const VIDEO_URL = VIDEO_TOUR_URL;
export const VIDEO_POSTER = '/site-video/seatline-tutorial.webp';
export const VIDEO_SECONDS = 538;
export const VIDEO_UPLOADED = '2026-10-24';

export const videoPath = (language: Language, at?: number) =>
  `${helpPath(language)}/video-tour${at ? `?t=${Math.floor(at)}` : ''}`;
export const subtitlesPath = (language: Language) => `${helpPath(language)}/video-tour/subtitles`;

/** 1:05 */
export const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

/** Chapters (start in seconds); `topic` = the help topic whose page links to this part. */
export const CHAPTERS: {
  start: number;
  title: Record<Language, string>;
  topic?: HelpTopicId;
}[] = [
  { start: 0, title: { en: 'Welcome', de: 'Willkommen', fr: 'Bienvenue' } },
  {
    start: 12.68,
    title: { en: 'Sign up', de: 'Registrieren', fr: 'Inscription' },
    topic: 'getting-started',
  },
  { start: 45.48, title: { en: 'Home', de: 'Start', fr: 'Accueil' } },
  {
    start: 60.58,
    title: { en: 'Building and floor', de: 'Gebäude und Stockwerk', fr: 'Bâtiment et étage' },
    topic: 'floors',
  },
  {
    start: 101.16,
    title: { en: 'Edit layout', de: 'Plan bearbeiten', fr: 'Modifier le plan' },
    topic: 'editor',
  },
  {
    start: 182.78,
    title: { en: 'Architect plans', de: 'Architektenpläne', fr: 'Plans d’architecte' },
  },
  {
    start: 215.54,
    title: { en: 'People and roles', de: 'Personen und Rollen', fr: 'Personnes et rôles' },
    topic: 'people',
  },
  {
    start: 265.6,
    title: { en: 'Giving people desks', de: 'Plätze vergeben', fr: 'Attribuer les postes' },
    topic: 'seating',
  },
  {
    start: 328.74,
    title: { en: 'Teams and changes', de: 'Teams und Änderungen', fr: 'Équipes et changements' },
    topic: 'teams-and-changes',
  },
  { start: 347.6, title: { en: 'Notices', de: 'Mitteilungen', fr: 'Avis' } },
  { start: 363.42, title: { en: 'Moves', de: 'Umzüge', fr: 'Déménagements' }, topic: 'moves' },
  {
    start: 417.58,
    title: { en: 'QR codes and exports', de: 'QR-Codes und Exporte', fr: 'QR codes et exports' },
    topic: 'exports-and-qr',
  },
  {
    start: 440.46,
    title: {
      en: 'Home, planning, activity',
      de: 'Start, Planung, Aktivität',
      fr: 'Accueil, planification, activité',
    },
    topic: 'home-planning-activity',
  },
  { start: 463.66, title: { en: 'On the phone', de: 'Auf dem Handy', fr: 'Sur le téléphone' } },
  {
    start: 474.8,
    title: { en: 'Data protection', de: 'Datenschutz', fr: 'Protection des données' },
    topic: 'privacy-and-billing',
  },
  { start: 499.57, title: { en: 'Price', de: 'Preis', fr: 'Prix' } },
  { start: 518.42, title: { en: 'Wrap-up', de: 'Zusammenfassung', fr: 'Pour finir' } },
];

export const chapterFor = (topic: HelpTopicId) => CHAPTERS.find((c) => c.topic === topic);

const LANGUAGE_INDEX: Record<Language, 2 | 3 | 4> = { en: 2, de: 3, fr: 4 };
export const cueText = (cue: (typeof CUES)[number], language: Language) =>
  cue[LANGUAGE_INDEX[language]];

const vttTime = (s: number) => {
  const ms = Math.round(s * 1000);
  const hh = String(Math.floor(ms / 3_600_000)).padStart(2, '0');
  const mm = String(Math.floor(ms / 60_000) % 60).padStart(2, '0');
  const ss = String(Math.floor(ms / 1000) % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}.${String(ms % 1000).padStart(3, '0')}`;
};

/** WebVTT subtitles; placed at the top so they don't cover the English burned into the video. */
export const subtitlesVtt = (language: Language) =>
  [
    'WEBVTT',
    ...CUES.map(
      (cue) =>
        `${vttTime(cue[0])} --> ${vttTime(cue[1])} line:5% position:50% align:center\n${cueText(cue, language)}`,
    ),
  ].join('\n\n') + '\n';

/** The page's texts. */
export const VIDEO: Record<
  Language,
  {
    short: string;
    title: string;
    metaTitle: string;
    intro: string;
    spoken: string;
    chapters: string;
    transcript: string;
    voice: string;
    watchPart: string;
    subtitles: string;
    /** the 48-second overview (the old landing page video) on the help home */
    quick: string;
    quickBody: string;
  }
> = {
  en: {
    short: 'Video tour',
    title: 'Video tour: Seatline in 9 minutes',
    metaTitle: 'Video tour: set up your office with Seatline in 9 minutes',
    intro:
      'From sign-up to your first team move, step by step: building and floor, desks, people, seating, moves, QR codes and data protection.',
    spoken: 'Spoken in English, with captions.',
    chapters: 'Chapters',
    transcript: 'Read the whole video',
    voice: 'The voice is AI-generated (Google AI Studio).',
    watchPart: 'Watch this part in the video tour',
    subtitles: 'English',
    quick: 'Seatline in 48 seconds',
    quickBody: 'The short version: sign in, draw a floor, seat people, plan moves.',
  },
  de: {
    short: 'Video-Tour',
    title: 'Video-Tour: Seatline in 9 Minuten',
    metaTitle: 'Video-Tour: Ihr Büro mit Seatline in 9 Minuten einrichten',
    intro:
      'Von der Anmeldung bis zum ersten Team-Umzug, Schritt für Schritt: Gebäude und Stockwerk, Plätze, Personen, Plätze vergeben, Umzüge, QR-Codes und Datenschutz.',
    spoken: 'Auf Englisch gesprochen, mit deutschen Untertiteln (oben im Bild).',
    chapters: 'Kapitel',
    transcript: 'Das ganze Video zum Lesen',
    voice: 'Die Stimme ist KI-generiert (Google AI Studio).',
    watchPart: 'Diesen Teil in der Video-Tour ansehen',
    subtitles: 'Deutsch',
    quick: 'Seatline in 48 Sekunden',
    quickBody:
      'Die Kurzfassung: anmelden, Stockwerk zeichnen, Plätze vergeben, Umzüge planen. Auf Englisch, mit englischen Untertiteln.',
  },
  fr: {
    short: 'Visite vidéo',
    title: 'Visite vidéo : Seatline en 9 minutes',
    metaTitle: 'Visite vidéo : configurer votre bureau avec Seatline en 9 minutes',
    intro:
      'De l’inscription au premier déménagement d’équipe, étape par étape : bâtiment et étage, postes, personnes, attribution des places, déménagements, QR codes et protection des données.',
    spoken: 'En anglais, avec des sous-titres en français (en haut de l’image).',
    chapters: 'Chapitres',
    transcript: 'Toute la vidéo à lire',
    voice: 'La voix est générée par IA (Google AI Studio).',
    watchPart: 'Voir cette partie dans la visite vidéo',
    subtitles: 'Français',
    quick: 'Seatline en 48 secondes',
    quickBody:
      'La version courte : connexion, dessin de l’étage, attribution des places, déménagements planifiés. En anglais, sous-titres en anglais.',
  },
};
