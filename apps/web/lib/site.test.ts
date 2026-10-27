import { describe, expect, it } from 'vitest';
import { canonicalRedirect, isPublicPath, siteHosts, siteUrl, videoLink } from './site';

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

describe('one address per page (no duplicates for search engines)', () => {
  const app = 'https://app.seatline.ch';
  const go = (host: string, path: string, search = '') =>
    canonicalRedirect(app, host, path, search);
  it('www goes to the bare domain, keeping the path', () => {
    expect(go('www.seatline.ch', '/de', '?utm_source=x')).toBe(
      'https://seatline.ch/de?utm_source=x',
    );
  });
  it('/welcome on the site is the home page', () => {
    expect(go('seatline.ch', '/welcome')).toBe('https://seatline.ch/');
    expect(go('seatline.ch', '/help/de')).toBeNull();
    expect(go('seatline.ch', '/')).toBeNull();
  });
  it('website pages on the app address move to the site; the app itself stays', () => {
    expect(go('app.seatline.ch', '/help/en/moves')).toBe('https://seatline.ch/help/en/moves');
    expect(go('app.seatline.ch', '/updates/fr')).toBe('https://seatline.ch/updates/fr');
    expect(go('app.seatline.ch', '/legal/privacy')).toBe('https://seatline.ch/legal/privacy');
    expect(go('app.seatline.ch', '/welcome')).toBe('https://seatline.ch/');
    expect(go('app.seatline.ch', '/')).toBeNull();
    expect(go('app.seatline.ch', '/map')).toBeNull();
    expect(go('app.seatline.ch', '/help-img/en/home.jpg')).toBeNull();
    expect(go('app.seatline.ch', '/helpdesk')).toBeNull();
  });
  it('local and Azure addresses never redirect', () => {
    expect(canonicalRedirect('http://localhost:3000', 'localhost', '/help/en', '')).toBeNull();
  });
});
