import Link from 'next/link';
import type React from 'react';
import { getTranslations } from 'next-intl/server';
import { Centered } from '@/components/auth/centered';
import { Button } from '@/components/ui/button';

const ERRORS = ['expired', 'access_denied', 'invalid', 'failed'] as const;

export default async function SignIn({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; signedOut?: string }>;
}) {
  const t = await getTranslations('auth');
  const tl = await getTranslations('legal');
  const link = (doc: 'terms' | 'privacy') => (chunks: React.ReactNode) => (
    <Link href={`/legal/${doc}`} className="underline underline-offset-2 hover:text-foreground">
      {chunks}
    </Link>
  );
  const { error, signedOut } = await searchParams;
  const known = ERRORS.find((e) => e === error) ?? (error ? 'failed' : null);
  return (
    <Centered>
      <div className="grid gap-1">
        <h1 className="text-xl font-semibold">{t('signInTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('signInBody')}</p>
      </div>
      {known && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm"
        >
          {t(`errors.${known}`)}
        </p>
      )}
      {signedOut && !known && <p className="text-sm text-muted-foreground">{t('signedOut')}</p>}
      <Button asChild size="lg">
        {/* full page navigation: the server redirects to Microsoft */}
        <a href="/auth/login">
          <MicrosoftLogo />
          {t('signInButton')}
        </a>
      </Button>
      <p className="text-xs text-muted-foreground">{t('privacy')}</p>
      <p className="text-xs text-muted-foreground">
        {tl.rich('agree', { terms: link('terms'), privacy: link('privacy') })}
      </p>
      <p className="flex gap-3 text-xs text-muted-foreground">
        <Link href="/welcome" className="hover:text-foreground">
          {tl('about')}
        </Link>
        <Link href="/legal/imprint" className="hover:text-foreground">
          {tl('imprint')}
        </Link>
      </p>
    </Centered>
  );
}

function MicrosoftLogo() {
  return (
    <svg aria-hidden viewBox="0 0 21 21" className="size-4">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}
