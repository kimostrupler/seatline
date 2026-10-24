import type { Language } from '../locales';
import { DE } from './de';
import { EN } from './en';
import { FR } from './fr';
import { HELP_TOPICS, type HelpContent, type HelpImage, type HelpTopicId } from './types';

export { HELP_TOPICS, type HelpTopicId };

/** The help center's texts; screenshots in public/help-img (e2e/help-screenshots.spec.ts). */
export const HELP: Record<Language, HelpContent> = { en: EN, de: DE, fr: FR };

export const isHelpLanguage = (l: string): l is Language => l in HELP;
export const isHelpTopic = (t: string): t is HelpTopicId =>
  (HELP_TOPICS as readonly string[]).includes(t);

export const helpPath = (language: Language, topic?: HelpTopicId) =>
  `/help/${language}${topic ? `/${topic}` : ''}`;
export const helpImage = (language: Language, image: HelpImage) =>
  `/help-img/${language}/${image}.jpg`;

/** hreflang alternates of a help page (English is the default). */
export const helpAlternates = (base: string, topic?: HelpTopicId) => ({
  en: `${base}${helpPath('en', topic)}`,
  de: `${base}${helpPath('de', topic)}`,
  fr: `${base}${helpPath('fr', topic)}`,
  'x-default': `${base}${helpPath('en', topic)}`,
});

/** The help topic for the page someone is on (the app's Help button opens it). */
export function helpTopicFor(pathname: string, search: URLSearchParams): HelpTopicId | undefined {
  if (pathname === '/') return 'getting-started';
  if (pathname === '/map/qr') return 'exports-and-qr';
  if (pathname === '/map') return search.get('mode') === 'edit' ? 'editor' : 'seating';
  if (pathname.startsWith('/moves')) return 'moves';
  if (pathname === '/people') {
    const tab = search.get('tab');
    return tab === 'teams' || tab === 'changes' ? 'teams-and-changes' : 'people';
  }
  if (pathname === '/planning' || pathname === '/activity') return 'home-planning-activity';
  if (pathname === '/billing') return 'privacy-and-billing';
  return undefined;
}
