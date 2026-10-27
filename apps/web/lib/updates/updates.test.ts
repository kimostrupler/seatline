import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LANGUAGES } from '../locales';
import { POSTS, updateImage } from '.';

describe('updates', () => {
  it('newest first, unique anchors, real dates', () => {
    const dates = POSTS.map((p) => p.date);
    expect([...dates].sort().reverse()).toEqual(dates);
    expect(new Set(POSTS.map((p) => p.slug)).size).toBe(POSTS.length);
    for (const p of POSTS) {
      expect(p.slug).toMatch(/^[a-z0-9-]+$/);
      expect(Number.isNaN(Date.parse(p.date))).toBe(false);
    }
  });

  it('every post says the same in every language, with its picture there', () => {
    for (const p of POSTS)
      for (const l of LANGUAGES) {
        const t = p.text[l];
        expect(t.title && t.summary && t.alt, `${p.slug} ${l}`).toBeTruthy();
        expect(t.points.length, `${p.slug} ${l}`).toBe(p.text.en.points.length);
        if (l === 'de') expect(JSON.stringify(t)).not.toContain('ß');
        expect(existsSync(join(__dirname, '../../public', updateImage(l, p.image)))).toBe(true);
      }
  });
});
