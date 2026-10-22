import { describe, expect, it } from 'vitest';
import { siteVisit } from './site-stats';

const own = ['seatline.ch', 'www.seatline.ch', 'app.seatline.ch'];
const desktop = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15';

describe('website statistics', () => {
  it('keeps only page, referring site, campaign, language and device type', () => {
    expect(
      siteVisit(
        {
          event: 'view',
          path: '/',
          ref: 'https://www.google.ch/search?q=seatline+mia@example.ch',
          source: 'LinkedIn<script>',
          lang: 'de-CH',
          ip: '1.2.3.4',
        },
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile',
        own,
      ),
    ).toEqual({
      event: 'view',
      path: '/',
      ref: 'google.ch',
      source: 'linkedinscript',
      lang: 'de',
      device: 'mobile',
    });
  });

  it('counts our own pages as direct and refuses anything else', () => {
    expect(
      siteVisit(
        { event: 'cta-demo', path: '/welcome', ref: 'https://seatline.ch/legal/terms' },
        desktop,
        own,
      ),
    ).toMatchObject({ event: 'cta-demo', path: '/', ref: 'direct', device: 'desktop' });
    expect(siteVisit({ event: 'view', path: '/legal/dpa' }, desktop, own)).toMatchObject({
      path: '/legal/dpa',
    });
    expect(siteVisit({ event: 'view', path: '/map' }, desktop, own)).toBeNull();
    expect(siteVisit({ event: 'buy', path: '/' }, desktop, own)).toBeNull();
    expect(siteVisit('nonsense', desktop, own)).toBeNull();
  });
});
