import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { MailCheck } from 'lucide-react';
import { Centered } from '@/components/auth/centered';
import { webConfig } from '@/lib/server/config';
import { websiteHref } from '@/lib/site';

/** After "Send me a link": where to look, and what to do if nothing arrives. */
export default async function CheckEmail({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const t = await getTranslations('auth');
  const { email = '' } = await searchParams;
  return (
    <Centered backHref={websiteHref(webConfig().APP_URL)}>
      <MailCheck aria-hidden className="size-8 text-primary" />
      <div className="grid gap-1">
        <h1 className="text-xl font-semibold">{t('checkTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('checkBody', { email })}</p>
      </div>
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
