import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HELP, HELP_TOPICS, helpAlternates, helpImage, helpTopicFor, isHelpTopic } from './index';

const LANGS = ['en', 'de', 'fr'] as const;

describe('help center', () => {
  it('every language has every topic, with the same steps and pictures', () => {
    for (const id of HELP_TOPICS) {
      const en = HELP.en.topics[id];
      for (const l of LANGS) {
        const t = HELP[l].topics[id];
        expect(t.steps.map((s) => s.image ?? null)).toEqual(en.steps.map((s) => s.image ?? null));
        expect(t.tips?.length ?? 0).toBe(en.tips?.length ?? 0);
        expect(t.summary.length).toBeLessThanOrEqual(160); // search result description
      }
    }
    for (const l of LANGS) expect(HELP[l].faq).toHaveLength(HELP.en.faq.length);
  });

  it('every screenshot it shows exists', () => {
    for (const l of LANGS)
      for (const id of HELP_TOPICS)
        for (const s of HELP[l].topics[id].steps)
          if (s.image)
            expect(existsSync(join(__dirname, '../../public', helpImage(l, s.image)))).toBe(true);
  });

  it('German uses Swiss spelling', () => {
    expect(JSON.stringify(HELP.de)).not.toContain('ß');
  });

  it('addresses', () => {
    expect(isHelpTopic('moves')).toBe(true);
    expect(isHelpTopic('nope')).toBe(false);
    expect(helpAlternates('https://seatline.ch', 'moves').de).toBe(
      'https://seatline.ch/help/de/moves',
    );
  });
});

describe('the Help button opens the topic of the current page', () => {
  const at = (path: string, query = '') => helpTopicFor(path, new URLSearchParams(query));
  it('picks the matching topic', () => {
    expect(at('/')).toBe('getting-started');
    expect(at('/map')).toBe('seating');
    expect(at('/map', 'mode=edit&floor=x')).toBe('editor');
    expect(at('/map/qr', 'floor=x')).toBe('exports-and-qr');
    expect(at('/moves/123')).toBe('moves');
    expect(at('/people', 'tab=changes')).toBe('teams-and-changes');
    expect(at('/people')).toBe('people');
    expect(at('/billing')).toBe('privacy-and-billing');
    expect(at('/owner')).toBeUndefined();
  });
});
