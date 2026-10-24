import { describe, expect, it } from 'vitest';
import { isPublicPath, siteHosts, siteUrl, videoLink } from './site';

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
    expect(isPublicPath('/help/de/moves')).toBe(true);
    expect(isPublicPath('/help-img/de/home.jpg')).toBe(true);
    expect(isPublicPath('/indexnow.txt')).toBe(true);
    expect(isPublicPath('/site-video/seatline-promo.mp4')).toBe(true);
    expect(isPublicPath('/help/de/excel-template')).toBe(true);
    expect(isPublicPath('/templates/seatline-sitzplan.xlsx')).toBe(true);
    expect(isPublicPath('/legal')).toBe(false);
    expect(isPublicPath('/map')).toBe(false);
  });
});

describe('video short links', () => {
  it('lead to the promo video on the landing page in that language, keeping the campaign', () => {
    const app = 'https://app.seatline.ch';
    expect(videoLink(app, '/video', '')).toBe('https://seatline.ch/#video');
    expect(videoLink(app, '/de/video', '?utm_source=email')).toBe(
      'https://seatline.ch/de?utm_source=email#video',
    );
    expect(videoLink(app, '/fr/video/', '')).toBe('https://seatline.ch/fr#video');
    expect(videoLink('http://localhost:3000', '/video', '')).toBe(
      'http://localhost:3000/welcome#video',
    );
    expect(videoLink(app, '/videos', '')).toBeNull();
    expect(videoLink(app, '/it/video', '')).toBeNull();
  });
});
