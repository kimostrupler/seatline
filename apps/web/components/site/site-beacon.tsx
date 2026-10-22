'use client';

import { useEffect } from 'react';

/**
 * Counts this page view (and clicks on links marked data-track) for the website statistics:
 * no cookies, nothing stored in the browser — see lib/site-stats.ts.
 */
export function SiteBeacon() {
  useEffect(() => {
    const send = (event: string) => {
      const body = JSON.stringify({
        event,
        path: location.pathname,
        ref: document.referrer,
        source: new URLSearchParams(location.search).get('utm_source') ?? '',
        lang: navigator.language,
      });
      try {
        if (!navigator.sendBeacon?.('/site-visit', body))
          void fetch('/site-visit', { method: 'POST', body, keepalive: true });
      } catch {
        // statistics never get in the way
      }
    };
    send('view');
    const onClick = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest?.('[data-track]');
      const event = link?.getAttribute('data-track');
      if (event) send(event);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);
  return null;
}
