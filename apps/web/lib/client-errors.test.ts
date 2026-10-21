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
      stack: Array.from({ length: 8 }, (_, i) => `at f${i}`).join('\n'),
      path: '/map',
      kind: 'render',
    });
  });

  it('ignore junk', () => {
    expect(sanitizeReport(null)).toBeNull();
    expect(sanitizeReport({ message: '' })).toBeNull();
    expect(sanitizeReport({ message: 'x', kind: 'evil' })?.kind).toBe('error');
  });
});
