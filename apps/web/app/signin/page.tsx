import Link from 'next/link';
import type React from 'react';
import { getTranslations } from 'next-intl/server';
import { Centered } from '@/components/auth/centered';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { publicApi } from '@/lib/server/auth';

const ERRORS = [
  'expired',
  'access_denied',
  'invalid',
  'failed',
  'link_invalid',
  'too_many',
  'bad_email',
] as const;

export default async function SignIn({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; signedOut?: string; email?: string }>;
}) {
  const t = await getTranslations('auth');
  const tl = await getTranslations('legal');
  const link = (doc: 'terms' | 'privacy') => (chunks: React.ReactNode) => (
    <Link href={`/legal/${doc}`} className="underline underline-offset-2 hover:text-foreground">
      {chunks}
    </Link>
  );
  const { error, signedOut, email } = await searchParams;
  const known = ERRORS.find((e) => e === error) ?? (error ? 'failed' : null);
  // sign-in by e-mail link, when the API can send e-mail
  const options = await publicApi<{ email: boolean }>('/auth/options').catch(() => null);
  const byEmail = options?.status === 200 && !!options.body?.email;
  return (
    <Centered>
      <div className="grid gap-1">
        <h1 className="text-xl font-semibold">{t('signInTitle')}</h1>
        <p className="text-sm text-muted-foreground">
          {byEmail ? t('signInBodyEmail') : t('signInBody')}
        </p>
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
      {byEmail && (
        <>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            {t('or')}
            <span className="h-px flex-1 bg-border" />
          </div>
          <form method="post" action="/auth/email/start" className="grid gap-2">
            <Label htmlFor="signin-email">{t('emailLabel')}</Label>
            <Input
              id="signin-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={320}
              defaultValue={email}
              placeholder={t('emailPlaceholder')}
            />
            <Button type="submit" variant="outline">
              {t('emailButton')}
            </Button>
          </form>
        </>
      )}
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
