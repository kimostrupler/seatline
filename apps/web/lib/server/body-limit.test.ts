import { describe, expect, it } from 'vitest';
import { tooLarge } from './body-limit';

const req = (length?: string) => ({
  headers: new Headers(length === undefined ? {} : { 'content-length': length }),
});

describe('body limit on public routes', () => {
  it('refuses big, missing and nonsense lengths before the body is read', () => {
    expect(tooLarge(req('120'), 5000)).toBe(false);
    expect(tooLarge(req('5000'), 5000)).toBe(false);
    expect(tooLarge(req('5001'), 5000)).toBe(true);
    expect(tooLarge(req('500000000'), 5000)).toBe(true);
    expect(tooLarge(req(), 5000)).toBe(true); // chunked: unknown size
    expect(tooLarge(req('abc'), 5000)).toBe(true);
    expect(tooLarge(req('0'), 5000)).toBe(true);
  });
});
