import { describe, expect, it } from 'vitest';
import { isPublicPath, siteHosts, siteUrl } from './site';

describe('site domain', () => {
  it('is the parent of an app.* address', () => {
    expect(siteHosts('https://app.seatline.ch')).toEqual(['seatline.ch', 'www.seatline.ch']);
    expect(siteUrl('https://app.seatline.ch')).toBe('https://seatline.ch');
  });
  it('does not exist for local or Azure addresses', () => {
    expect(siteHosts('http://localhost:3000')).toEqual([]);
    expect(siteHosts('https://web.x-1.switzerlandnorth.azurecontainerapps.io')).toEqual([]);
    expect(siteUrl('http://localhost:3000')).toBe('http://localhost:3000');
  });
  it('opens only the website without signing in', () => {
    expect(isPublicPath('/welcome')).toBe(true);
    expect(isPublicPath('/legal/privacy')).toBe(true);
    expect(isPublicPath('/guides/seatline-vs-excel')).toBe(true);
    expect(isPublicPath('/indexnow.txt')).toBe(true);
    expect(isPublicPath('/legal')).toBe(false);
    expect(isPublicPath('/map')).toBe(false);
  });
});
