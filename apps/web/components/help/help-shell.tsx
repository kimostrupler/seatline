import {
  ArrowRightLeft,
  BarChart3,
  Building2,
  CreditCard,
  FileDown,
  MousePointerClick,
  PencilRuler,
  Rocket,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { SitePage } from '@/components/site/site-chrome';
import { HELP, HELP_TOPICS, helpPath, type HelpTopicId } from '@/lib/help';
import type { Language } from '@/lib/locales';
import { OPERATOR } from '@/lib/legal/operator';
import { cn } from '@/lib/utils';

export const TOPIC_ICONS: Record<HelpTopicId, LucideIcon> = {
  'getting-started': Rocket,
  floors: Building2,
  editor: PencilRuler,
  seating: MousePointerClick,
  people: Users,
  'teams-and-changes': UserCog,
  moves: ArrowRightLeft,
  'home-planning-activity': BarChart3,
  'exports-and-qr': FileDown,
  'privacy-and-billing': CreditCard,
};

/** Website chrome with language links to the same help page, a topic list on the side. */
export async function HelpShell({
  language,
  topic,
  children,
}: {
  language: Language;
  topic?: HelpTopicId;
  children: ReactNode;
}) {
  const t = await getTranslations('help');
  return (
    <SitePage
      languagePaths={{
        en: helpPath('en', topic),
        de: helpPath('de', topic),
        fr: helpPath('fr', topic),
      }}
    >
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <nav aria-label={t('topics')} className="max-lg:hidden">
          <div className="sticky top-20 grid gap-0.5 text-sm">
            <Link
              href={helpPath(language)}
              className={cn(
                'rounded-md px-2 py-1.5 font-semibold hover:bg-muted',
                !topic && 'bg-muted',
              )}
            >
              {t('title')}
            </Link>
            {HELP_TOPICS.map((id) => {
              const Icon = TOPIC_ICONS[id];
              return (
                <Link
                  key={id}
                  href={helpPath(language, id)}
                  aria-current={id === topic ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-2 rounded-md px-2 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground',
                    id === topic && 'bg-muted font-medium text-foreground',
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  {HELP[language].topics[id].title}
                </Link>
              );
            })}
          </div>
        </nav>
        <div className="grid min-w-0 content-start gap-10">
          {children}
          <section className="grid gap-1 rounded-xl border bg-canvas p-5 text-sm">
            <h2 className="font-semibold">{t('stuck')}</h2>
            <p className="text-muted-foreground">
              {t.rich('contact', {
                email: OPERATOR.email,
                mail: (chunks) => (
                  <a
                    className="text-primary underline-offset-4 hover:underline"
                    href={`mailto:${OPERATOR.email}`}
                  >
                    {chunks}
                  </a>
                ),
              })}
            </p>
          </section>
        </div>
      </div>
    </SitePage>
  );
}
