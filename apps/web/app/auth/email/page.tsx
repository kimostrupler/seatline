import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { Centered } from '@/components/auth/centered';
import { Button } from '@/components/ui/button';

/**
 * The page a sign-in link opens. It doesn't sign in by itself: mail scanners open links to
 * check them, which would use up the one-time token. A click (POST) does.
 */
export default async function EmailLink({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token) redirect('/signin');
  const t = await getTranslations('auth');
  return (
    <Centered>
      <div className="grid gap-1">
        <h1 className="text-xl font-semibold">{t('linkTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('linkBody')}</p>
      </div>
      <form method="post" action="/auth/email/verify" className="grid">
        <input type="hidden" name="token" value={token} />
        <Button type="submit" size="lg">
          {t('linkButton')}
        </Button>
      </form>
    </Centered>
  );
}
