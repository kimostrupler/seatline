import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { MailCheck } from 'lucide-react';
import { Centered } from '@/components/auth/centered';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { webConfig } from '@/lib/server/config';
import { websiteHref } from '@/lib/site';

const ERRORS = ['code_invalid', 'too_many_codes'] as const;

/**
 * After "Send me a link": where to look, what to do if nothing arrives — and a field for the
 * code from the same e-mail (an app on a phone's home screen can't use the link: it opens Safari).
 */
export default async function CheckEmail({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; error?: string }>;
}) {
  const t = await getTranslations('auth');
  const { email = '', error } = await searchParams;
  const known = ERRORS.find((e) => e === error);
  return (
    <Centered backHref={websiteHref(webConfig().APP_URL)}>
      <MailCheck aria-hidden className="size-8 text-primary" />
      <div className="grid gap-1">
        <h1 className="text-xl font-semibold">{t('checkTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('checkBody', { email })}</p>
      </div>
      {known && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm"
        >
          {t(`errors.${known}`)}
        </p>
      )}
      <form method="post" action="/auth/email/code" className="grid gap-2">
        <input type="hidden" name="email" value={email} />
        <Label htmlFor="signin-code">{t('codeLabel')}</Label>
        <Input
          id="signin-code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\s*\d{3}\s*\d{3}\s*"
          maxLength={9}
          required
          placeholder="123 456"
          className="text-center text-lg tracking-widest tabular-nums"
        />
        <Button type="submit" variant="outline">
          {t('codeButton')}
        </Button>
        <p className="text-xs text-muted-foreground">{t('codeHint')}</p>
      </form>
      <p className="text-xs text-muted-foreground">{t('checkHint')}</p>
      <Link
        href={`/signin?email=${encodeURIComponent(email)}`}
        className="text-sm underline underline-offset-2"
      >
        {t('checkOther')}
      </Link>
    </Centered>
  );
}
