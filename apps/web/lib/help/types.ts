/** The help center's topics, in reading order (the address is /help/<language>/<topic>). */
export const HELP_TOPICS = [
  'getting-started',
  'floors',
  'editor',
  'seating',
  'people',
  'teams-and-changes',
  'moves',
  'home-planning-activity',
  'exports-and-qr',
  'privacy-and-billing',
] as const;
export type HelpTopicId = (typeof HELP_TOPICS)[number];

/** Screenshots in public/help-img/<language>/, made by e2e/help-screenshots.spec.ts. */
export type HelpImage =
  | 'home'
  | 'map-seat'
  | 'export-menu'
  | 'edit'
  | 'edit-template'
  | 'edit-example'
  | 'people'
  | 'people-add'
  | 'people-import'
  | 'teams'
  | 'changes'
  | 'settings'
  | 'privacy'
  | 'moves'
  | 'move-plan'
  | 'move-map'
  | 'planning'
  | 'activity'
  | 'qr'
  | 'desk-phone';

export interface HelpStep {
  title: string;
  /** paragraphs */
  text: string[];
  image?: HelpImage;
}

export interface HelpTopic {
  title: string;
  /** one sentence: what this topic helps with (also the page's description) */
  summary: string;
  steps: HelpStep[];
  tips?: string[];
}

export interface HelpContent {
  topics: Record<HelpTopicId, HelpTopic>;
  faq: Array<{ q: string; a: string }>;
}
