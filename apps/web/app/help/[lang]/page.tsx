import { Play } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { HelpShell, TOPIC_ICONS } from '@/components/help/help-shell';
import { HELP, HELP_TOPICS, helpAlternates, helpPath, isHelpLanguage } from '@/lib/help';
import { VIDEO, VIDEO_POSTER, videoPath } from '@/lib/help/video';
import { webConfig } from '@/lib/server/config';
import { siteUrl } from '@/lib/site';

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  if (!isHelpLanguage(lang)) return {};
  const t = await getTranslations('help');
  const base = siteUrl(webConfig().APP_URL);
  return {
    title: { absolute: t('metaTitle') },
    description: t('intro'),
    alternates: { canonical: `${base}${helpPath(lang)}`, languages: helpAlternates(base) },
    robots: { index: true, follow: true },
  };
}

/** The help center: every topic as a card, then the questions and answers. */
export default async function HelpIndex({ params }: Props) {
  const { lang } = await params;
  if (!isHelpLanguage(lang)) notFound();
  const t = await getTranslations('help');
  const content = HELP[lang];
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    inLanguage: lang,
    mainEntity: content.faq.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };
  return (
    <HelpShell language={lang}>
      <script
        type="application/ld+json"
        // our own text; "<" escaped so it can never end the script tag
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd).replace(/</g, '\\u003c') }}
      />
      <header className="grid gap-3">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t('title')}</h1>
        <p className="max-w-2xl text-lg text-pretty text-muted-foreground">{t('intro')}</p>
      </header>

      {/* the video tour first, big: many people would rather watch than read */}
      <a
        href={videoPath(lang)}
        className="group grid overflow-hidden rounded-2xl border bg-card transition-colors hover:border-primary/50 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"
        data-testid="help-video"
      >
        <span className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element -- small poster, sized */}
          <img
            src={VIDEO_POSTER}
            alt=""
            width={1280}
            height={720}
            className="aspect-video h-auto w-full object-cover"
          />
          <span className="absolute bottom-3 left-3 grid size-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform group-hover:scale-110">
            <Play className="ml-0.5 size-5 fill-current" aria-hidden />
          </span>
        </span>
        <span className="grid content-center gap-2 p-5">
          <span className="text-xl font-semibold">{VIDEO[lang].title}</span>
          <span className="text-sm text-pretty text-muted-foreground">{VIDEO[lang].intro}</span>
          <span className="text-xs text-muted-foreground">{VIDEO[lang].spoken}</span>
        </span>
      </a>

      <section aria-labelledby="topics" className="grid gap-4">
        <h2 id="topics" className="text-xl font-semibold">
          {t('topics')}
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-testid="help-topics">
          {HELP_TOPICS.map((id) => {
            const Icon = TOPIC_ICONS[id];
            const topic = content.topics[id];
            return (
              <li key={id}>
                {/* plain links: each help page is a full page load (client navigation here got lost in CI) */}
                <a
                  href={helpPath(lang, id)}
                  className="grid h-full gap-2 rounded-xl border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-primary/5"
                >
                  <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className="font-semibold">{topic.title}</span>
                  <span className="text-sm text-muted-foreground">{topic.summary}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="faq" className="grid gap-3">
        <h2 id="faq" className="text-xl font-semibold">
          {t('faq')}
        </h2>
        <div className="divide-y rounded-xl border" data-testid="help-faq">
          {content.faq.map(({ q, a }) => (
            <details key={q} className="group px-4 py-3 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium">
                {q}
                <span
                  className="text-muted-foreground transition-transform group-open:rotate-45"
                  aria-hidden
                >
                  +
                </span>
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-pretty text-muted-foreground">{a}</p>
            </details>
          ))}
        </div>
      </section>
    </HelpShell>
  );
}
