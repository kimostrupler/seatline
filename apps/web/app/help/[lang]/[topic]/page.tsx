import { ChevronLeft, ChevronRight, Lightbulb, PlayCircle } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { HelpShell } from '@/components/help/help-shell';
import {
  HELP,
  HELP_TOPICS,
  helpAlternates,
  helpImage,
  helpPath,
  isHelpLanguage,
  isHelpTopic,
} from '@/lib/help';
import { chapterFor, clock, VIDEO, videoPath } from '@/lib/help/video';
import { webConfig } from '@/lib/server/config';
import { siteUrl } from '@/lib/site';

type Props = { params: Promise<{ lang: string; topic: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, topic } = await params;
  if (!isHelpLanguage(lang) || !isHelpTopic(topic)) return {};
  const t = await getTranslations('help');
  const text = HELP[lang].topics[topic];
  const base = siteUrl(webConfig().APP_URL);
  return {
    title: { absolute: `${text.title} · ${t('title')} · Seatline` },
    description: text.summary,
    alternates: {
      canonical: `${base}${helpPath(lang, topic)}`,
      languages: helpAlternates(base, topic),
    },
    robots: { index: true, follow: true },
  };
}

/** One help topic: numbered steps, each with a screenshot of the app, then tips. */
export default async function HelpTopic({ params }: Props) {
  const { lang, topic } = await params;
  if (!isHelpLanguage(lang) || !isHelpTopic(topic)) notFound();
  const t = await getTranslations('help');
  const text = HELP[lang].topics[topic];
  const i = HELP_TOPICS.indexOf(topic);
  const prev = HELP_TOPICS[i - 1];
  const next = HELP_TOPICS[i + 1];
  const chapter = chapterFor(topic);
  const base = siteUrl(webConfig().APP_URL);
  const howTo = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: text.title,
    description: text.summary,
    inLanguage: lang,
    step: text.steps.map((s, n) => ({
      '@type': 'HowToStep',
      position: n + 1,
      name: s.title,
      text: s.text.join(' '),
      ...(s.image ? { image: `${base}${helpImage(lang, s.image)}` } : {}),
    })),
  };
  return (
    <HelpShell language={lang} topic={topic}>
      <script
        type="application/ld+json"
        // our own text; "<" escaped so it can never end the script tag
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howTo).replace(/</g, '\\u003c') }}
      />
      <header className="grid gap-3">
        <a href={helpPath(lang)} className="text-sm font-medium text-primary hover:underline">
          ← {t('all')}
        </a>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{text.title}</h1>
        <p className="max-w-2xl text-lg text-pretty text-muted-foreground">{text.summary}</p>
        {chapter && (
          <a
            href={videoPath(lang, chapter.start)}
            className="flex items-center gap-2 justify-self-start rounded-full border px-3 py-1.5 text-sm font-medium hover:border-primary/50 hover:bg-primary/5"
            data-testid="watch-part"
          >
            <PlayCircle className="size-4 text-primary" aria-hidden />
            {VIDEO[lang].watchPart}
            <span className="text-muted-foreground tabular-nums">{clock(chapter.start)}</span>
          </a>
        )}
      </header>

      <ol className="grid gap-12" data-testid="help-steps">
        {text.steps.map((step, n) => (
          <li key={step.title} className="grid gap-4">
            <div className="flex items-start gap-3">
              <span
                className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
                aria-hidden
              >
                {n + 1}
              </span>
              <div className="grid gap-2">
                <h2 className="text-xl font-semibold">
                  <span className="sr-only">{t('step', { n: n + 1 })}: </span>
                  {step.title}
                </h2>
                {step.text.map((p) => (
                  <p key={p} className="leading-relaxed text-pretty text-muted-foreground">
                    {p}
                  </p>
                ))}
              </div>
            </div>
            {step.image && (
              // tap to see it full size (small on phones)
              <a href={helpImage(lang, step.image)} target="_blank" rel="noopener">
                {/* eslint-disable-next-line @next/next/no-img-element -- plain screenshots, sized */}
                <img
                  src={helpImage(lang, step.image)}
                  alt={step.title}
                  width={1280}
                  height={800}
                  loading={n === 0 ? 'eager' : 'lazy'}
                  className="h-auto w-full rounded-xl border shadow-sm"
                />
              </a>
            )}
          </li>
        ))}
      </ol>

      {text.tips && (
        <section className="grid gap-2 rounded-xl border border-primary/30 bg-primary/5 p-5">
          <h2 className="flex items-center gap-2 font-semibold">
            <Lightbulb className="size-4 text-primary" aria-hidden /> {t('tips')}
          </h2>
          <ul className="grid list-disc gap-1.5 pl-5 text-sm text-muted-foreground">
            {text.tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </section>
      )}

      <nav className="flex flex-wrap justify-between gap-3 border-t pt-6 text-sm">
        {prev ? (
          <a href={helpPath(lang, prev)} className="grid gap-0.5 hover:text-primary">
            <span className="flex items-center gap-1 text-muted-foreground">
              <ChevronLeft className="size-4" aria-hidden /> {t('previous')}
            </span>
            <span className="font-medium">{HELP[lang].topics[prev].title}</span>
          </a>
        ) : (
          <span />
        )}
        {next && (
          <a
            href={helpPath(lang, next)}
            className="grid justify-items-end gap-0.5 hover:text-primary"
          >
            <span className="flex items-center gap-1 text-muted-foreground">
              {t('next')} <ChevronRight className="size-4" aria-hidden />
            </span>
            <span className="font-medium">{HELP[lang].topics[next].title}</span>
          </a>
        )}
      </nav>
    </HelpShell>
  );
}
