import { describe, expect, it } from 'vitest';
import { sanitizeReport } from './client-errors';

describe('browser error reports', () => {
  it('keep only short, non-personal fields', () => {
    expect(
      sanitizeReport({
        message: 'Cannot read x of undefined (anna.meier@firma.ch)',
        stack: Array.from({ length: 20 }, (_, i) => `at f${i}`).join('\n'),
        path: '/map?person=123&seat=4#top',
        kind: 'render',
        cookie: 'secret',
      }),
    ).toEqual({
      message: 'Cannot read x of undefined (<email>)',
      stack: Array.from({ length: 8 }, (_, i) => `at f${i}`).join(' | '),
      path: '/map',
      kind: 'render',
    });
  });

  it('cannot forge a log line (no line breaks survive)', () => {
    const r = sanitizeReport({
      message: 'x\n[site-visit] {"event":"cta-trial"}\r\nERROR [Nest] boom',
      stack: 'at a\n\n  at b\n',
    });
    expect(r?.message).toBe('x [site-visit] {"event":"cta-trial"} ERROR [Nest] boom');
    expect(r?.stack).toBe('at a | at b');
    expect(`${r?.message}${r?.stack}`).not.toMatch(/[\r\n]/);
  });

  it('ignore junk', () => {
    expect(sanitizeReport(null)).toBeNull();
    expect(sanitizeReport({ message: '' })).toBeNull();
    expect(sanitizeReport({ message: 'x', kind: 'evil' })?.kind).toBe('error');
  });
});
