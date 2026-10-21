import { getRequestConfig } from 'next-intl/server';

// English only for now. German/French: add messages/de.json + fr.json and pick the
// locale here (Phase 6) — every UI text already comes from messages/*.json.
// en-GB: English text with Swiss/European conventions (21 Sep 2026, 24-hour time).
export default getRequestConfig(async () => ({
  locale: 'en-GB',
  timeZone: 'Europe/Zurich',
  messages: (await import('../messages/en.json')).default,
}));
