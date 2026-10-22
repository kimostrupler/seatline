import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { Centered } from '@/components/auth/centered';
import { Button } from '@/components/ui/button';
import { webConfig } from '@/lib/server/config';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('demo');
  return { title: `${t('title')} · Seatline` };
}

/**
 * "Try the demo" from the website. A click (POST) opens a fresh demo workspace — not the link
 * itself, so crawlers and link previews don't create workspaces.
 */
export default async function DemoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (webConfig().AUTH_MODE !== 'entra') redirect('/'); // local dev: the dev login is the demo
  const { error } = await searchParams;
  const t = await getTranslations('demo');
  return (
    <Centered>
      <div className="grid gap-1">
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('body')}</p>
      </div>
      <ul className="grid gap-1 text-sm text-muted-foreground">
        <li>· {t('point1')}</li>
        <li>· {t('point2')}</li>
        <li>· {t('point3')}</li>
      </ul>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {t(error === 'busy' ? 'busy' : 'failed')}
        </p>
      )}
      <form method="post" action="/auth/demo/start" className="grid">
        <Button type="submit" size="lg">
          {t('button')}
        </Button>
      </form>
    </Centered>
  );
}
