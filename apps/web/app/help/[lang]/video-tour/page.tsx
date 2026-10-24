import { Clapperboard } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { HelpShell } from '@/components/help/help-shell';
import { VideoPlayer } from '@/components/help/video-player';
import { isHelpLanguage } from '@/lib/help';
import {
  CHAPTERS,
  clock,
  CUES,
  cueText,
  subtitlesPath,
  VIDEO,
  VIDEO_POSTER,
  VIDEO_SECONDS,
  VIDEO_UPLOADED,
  VIDEO_URL,
  videoPath,
} from '@/lib/help/video';
import { webConfig } from '@/lib/server/config';
import { siteUrl } from '@/lib/site';

type Props = {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ t?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  if (!isHelpLanguage(lang)) return {};
  const base = siteUrl(webConfig().APP_URL);
  const t = VIDEO[lang];
  return {
    title: { absolute: `${t.metaTitle} | Seatline` },
    description: t.intro,
    alternates: {
      canonical: `${base}${videoPath(lang)}`,
      languages: {
        en: `${base}${videoPath('en')}`,
        de: `${base}${videoPath('de')}`,
        fr: `${base}${videoPath('fr')}`,
        'x-default': `${base}${videoPath('en')}`,
      },
    },
    robots: { index: true, follow: true },
  };
}

/** The 9-minute video tour, big: chapters to jump around, subtitles, and the whole text. */
export default async function VideoTour({ params, searchParams }: Props) {
  const { lang } = await params;
  if (!isHelpLanguage(lang)) notFound();
  const t = VIDEO[lang];
  const at = Number((await searchParams).t);
  const start = at > 0 && at < VIDEO_SECONDS ? Math.floor(at) : undefined;
  const base = siteUrl(webConfig().APP_URL);
  // the transcript in the page's language, one paragraph per chapter
  const parts = CHAPTERS.map((c, i) => ({
    ...c,
    text: CUES.filter(([s]) => s >= c.start && s < (CHAPTERS[i + 1]?.start ?? Infinity))
      .map((cue) => cueText(cue, lang))
      .join(' '),
  }));
  const videoLd = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: t.title,
    description: t.intro,
    inLanguage: 'en',
    thumbnailUrl: `${base}${VIDEO_POSTER}`,
    uploadDate: VIDEO_UPLOADED,
    duration: `PT${Math.floor(VIDEO_SECONDS / 60)}M${VIDEO_SECONDS % 60}S`,
    contentUrl: VIDEO_URL,
    transcript: parts.map((p) => p.text).join(' '),
    hasPart: parts.map((p, i) => ({
      '@type': 'Clip',
      name: p.title[lang],
      startOffset: Math.floor(p.start),
      endOffset: Math.floor(CHAPTERS[i + 1]?.start ?? VIDEO_SECONDS),
      url: `${base}${videoPath(lang, p.start)}`,
    })),
  };
  return (
    <HelpShell
      language={lang}
      paths={{ en: videoPath('en'), de: videoPath('de'), fr: videoPath('fr') }}
    >
      <script
        type="application/ld+json"
        // our own text; "<" escaped so it can never end the script tag
        dangerouslySetInnerHTML={{ __html: JSON.stringify(videoLd).replace(/</g, '\\u003c') }}
      />
      <header className="grid gap-4">
        <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
          <Clapperboard className="size-6" aria-hidden />
        </span>
        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          {t.title}
        </h1>
        <p className="max-w-2xl text-lg text-pretty text-muted-foreground">{t.intro}</p>
        <p className="text-sm text-muted-foreground">
          {t.spoken} {t.voice}
        </p>
      </header>

      <VideoPlayer
        src={VIDEO_URL}
        poster={VIDEO_POSTER}
        start={start}
        // English is burned into the video
        track={lang === 'en' ? undefined : { src: subtitlesPath(lang), lang, label: t.subtitles }}
        chapters={CHAPTERS.map((c) => ({
          start: c.start,
          title: c.title[lang],
          clock: clock(c.start),
        }))}
        chaptersLabel={t.chapters}
      />

      <details className="group rounded-xl border">
        <summary className="cursor-pointer px-4 py-3 font-semibold">{t.transcript}</summary>
        <div className="grid gap-4 border-t px-4 py-4" lang={lang}>
          {parts.map((p) => (
            <section key={p.start} className="grid gap-1">
              <h3 className="font-medium">
                <a href={videoPath(lang, p.start)} className="hover:text-primary">
                  <span className="text-muted-foreground tabular-nums">{clock(p.start)}</span>{' '}
                  {p.title[lang]}
                </a>
              </h3>
              <p className="text-sm leading-relaxed text-pretty text-muted-foreground">{p.text}</p>
            </section>
          ))}
        </div>
      </details>
    </HelpShell>
  );
}
