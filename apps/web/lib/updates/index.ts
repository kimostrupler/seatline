import { helpImage } from '../help';
import type { Language } from '../locales';
import { POSTS, type UpdateImage, type UpdatePost } from './posts';

export { POSTS, type UpdatePost };

export { updatesPath } from './path';

export const updateImage = (language: Language, image: UpdateImage) =>
  'help' in image ? helpImage(language, image.help) : `/updates-img/${language}/${image.own}.jpg`;

/** The page's title and intro in each language. */
export const UPDATES_PAGE: Record<
  Language,
  { title: string; intro: string; read: string; helpLink: string }
> = {
  en: {
    title: 'What’s new in Seatline',
    intro: 'New features and improvements, newest first.',
    read: 'Read more in the help center',
    helpLink: 'Help center',
  },
  de: {
    title: 'Neu in Seatline',
    intro: 'Neue Funktionen und Verbesserungen, die neusten zuerst.',
    read: 'Mehr dazu im Hilfe-Center',
    helpLink: 'Hilfe-Center',
  },
  fr: {
    title: 'Nouveautés de Seatline',
    intro: 'Nouvelles fonctions et améliorations, les plus récentes en premier.',
    read: 'En savoir plus dans le centre d’aide',
    helpLink: 'Centre d’aide',
  },
};
