import { describe, expect, it } from 'vitest';
import { HELP_TOPICS } from '.';
import { CHAPTERS, chapterFor, clock, CUES, subtitlesVtt, VIDEO_SECONDS, videoPath } from './video';

describe('video tour', () => {
  it('has chapters in order, inside the video, each starting a sentence', () => {
    expect(CHAPTERS[0]!.start).toBe(0);
    for (const [i, c] of CHAPTERS.entries()) {
      if (i > 0) expect(c.start).toBeGreaterThan(CHAPTERS[i - 1]!.start);
      expect(c.start).toBeLessThan(VIDEO_SECONDS);
      if (i > 0) expect(CUES.some(([s]) => s === c.start)).toBe(true);
    }
  });
  it('has every sentence in all three languages, in time order', () => {
    for (const [i, [start, end, en, de, fr]] of CUES.entries()) {
      expect(end).toBeGreaterThan(start);
      expect(end).toBeLessThanOrEqual(VIDEO_SECONDS);
      if (i > 0) expect(start).toBeGreaterThanOrEqual(CUES[i - 1]![1]);
      for (const text of [en, de, fr]) expect(text.trim()).not.toBe('');
      expect(de).not.toContain('ß'); // Swiss German
    }
  });
  it('links each topic to at most one chapter', () => {
    const linked = CHAPTERS.flatMap((c) => (c.topic ? [c.topic] : []));
    expect(new Set(linked).size).toBe(linked.length);
    expect(chapterFor('moves')?.title.en).toBe('Moves');
    for (const topic of linked) expect(HELP_TOPICS).toContain(topic);
  });
  it('builds WebVTT subtitles at the top of the picture', () => {
    const vtt = subtitlesVtt('de');
    expect(vtt.startsWith('WEBVTT\n\n00:00:00.600 --> 00:00:01.840 line:5%')).toBe(true);
    expect(vtt).toContain('Willkommen bei Seatline.');
    expect(vtt.split('-->').length - 1).toBe(CUES.length);
  });
  it('formats times and addresses', () => {
    expect(clock(65.4)).toBe('1:05');
    expect(videoPath('fr')).toBe('/help/fr/video-tour');
    expect(videoPath('de', 363.42)).toBe('/help/de/video-tour?t=363');
  });
});
