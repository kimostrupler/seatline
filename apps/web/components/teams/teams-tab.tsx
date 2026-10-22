'use client';

import { ExternalLink } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Centered } from '@/components/auth/centered';
import { Button } from '@/components/ui/button';

type State = 'signing-in' | 'failed';

/**
 * Runs inside Teams / Outlook: asks Teams who the user is (single sign-on, no extra login),
 * starts a Seatline session for them and opens the map. Outside Teams it just goes to the app.
 */
export function TeamsTab() {
  const t = useTranslations('teamsTab');
  const [state, setState] = useState<State>('signing-in');

  useEffect(() => {
    let live = true;
    void (async () => {
      const teams = await import('@microsoft/teams-js');
      try {
        // outside Teams/Outlook there's no host to answer: don't wait for long
        await Promise.race([
          teams.app.initialize(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('no host')), 4000)),
        ]);
      } catch {
        if (live) location.replace('/map');
        return;
      }
      try {
        const token = await teams.authentication.getAuthToken();
        const res = await fetch('/auth/teams', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        if (!res.ok) throw new Error(String(res.status));
        const { next } = (await res.json()) as { next: string };
        teams.app.notifySuccess();
        location.replace(next === '/' ? '/map' : next);
      } catch {
        teams.app.notifyFailure({ reason: teams.app.FailedReason.AuthFailed });
        if (live) setState('failed');
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  return (
    <Centered>
      <div className="grid gap-1">
        <h1 className="text-xl font-semibold">Seatline</h1>
        <p className="text-sm text-muted-foreground" role="status">
          {state === 'signing-in' ? t('signingIn') : t('failed')}
        </p>
      </div>
      {state === 'failed' && (
        <Button asChild>
          <a href="/map" target="_blank" rel="noopener">
            {t('openInBrowser')} <ExternalLink />
          </a>
        </Button>
      )}
    </Centered>
  );
}
