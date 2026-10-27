import { ArrowRight, Sparkles } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SitePage } from '@/components/site/site-chrome';
import { helpPath, isHelpLanguage } from '@/lib/help';
import type { Language } from '@/lib/locales';
import { webConfig } from '@/lib/server/config';
import { siteUrl } from '@/lib/site';
import { POSTS, UPDATES_PAGE, updateImage, updatesPath } from '@/lib/updates';
import { cn } from '@/lib/utils';

type Props = { params: Promise<{ lang: string }> };

const LOCALE: Record<Language, string> = { en: 'en-GB', de: 'de-CH', fr: 'fr-CH' };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  if (!isHelpLanguage(lang)) return {};
  const base = siteUrl(webConfig().APP_URL);
  const page = UPDATES_PAGE[lang];
  return {
    title: { absolute: `${page.title} · Seatline` },
    description: page.intro,
    alternates: {
      canonical: `${base}${updatesPath(lang)}`,
      languages: {
        en: `${base}${updatesPath('en')}`,
        de: `${base}${updatesPath('de')}`,
        fr: `${base}${updatesPath('fr')}`,
        'x-default': `${base}${updatesPath('en')}`,
      },
    },
    robots: { index: true, follow: true },
  };
}

/** What's new: every change customers notice, newest first, with a picture each (blog style). */
export default async function Updates({ params }: Props) {
  const { lang } = await params;
  if (!isHelpLanguage(lang)) notFound();
  const page = UPDATES_PAGE[lang];
  const base = siteUrl(webConfig().APP_URL);
  const day = (d: string) =>
    new Date(`${d}T12:00:00Z`).toLocaleDateString(LOCALE[lang], { dateStyle: 'long' });
  const blogLd = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: page.title,
    url: `${base}${updatesPath(lang)}`,
    inLanguage: lang,
    blogPost: POSTS.map((p) => ({
      '@type': 'BlogPosting',
      headline: p.text[lang].title,
      description: p.text[lang].summary,
      datePublished: p.date,
      url: `${base}${updatesPath(lang, p.slug)}`,
      image: `${base}${updateImage(lang, p.image)}`,
      author: { '@type': 'Organization', name: 'Seatline' },
    })),
  };

  return (
    <SitePage
      languagePaths={{ en: updatesPath('en'), de: updatesPath('de'), fr: updatesPath('fr') }}
    >
      <script
        type="application/ld+json"
        // our own text; "<" escaped so it can never end the script tag
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogLd).replace(/</g, '\\u003c') }}
      />
      <div className="mx-auto grid max-w-3xl gap-12 px-4 py-12 sm:px-6 sm:py-16">
        <header className="grid gap-4">
          <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="size-6" aria-hidden />
          </span>
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {page.title}
          </h1>
          <p className="text-lg text-pretty text-muted-foreground">{page.intro}</p>
        </header>

        {/* a timeline: one dot per update along the left edge */}
        <ol className="relative grid gap-14 border-l pl-6 sm:pl-8">
          {POSTS.map((post) => {
            const t = post.text[lang];
            return (
              <li key={post.slug} id={post.slug} className="relative grid scroll-mt-24 gap-4">
                <span
                  className="absolute top-1.5 -left-[calc(1.5rem+5px)] size-2.5 rounded-full bg-primary ring-4 ring-background sm:-left-[calc(2rem+5px)]"
                  aria-hidden
                />
                <article className="grid gap-4">
                  <header className="grid gap-1.5">
                    <time dateTime={post.date} className="text-sm text-muted-foreground">
                      {day(post.date)}
                    </time>
                    <h2 className="text-2xl font-semibold tracking-tight text-balance">
                      <a href={`#${post.slug}`} className="hover:underline">
                        {t.title}
                      </a>
                    </h2>
                  </header>
                  <p className="text-pretty">{t.summary}</p>
                  {/* eslint-disable-next-line @next/next/no-img-element -- static screenshots */}
                  <img
                    src={updateImage(lang, post.image)}
                    alt={t.alt}
                    loading="lazy"
                    className={cn(
                      'rounded-xl border shadow-lg shadow-black/5',
                      // app screenshots are wide; the updates' own pictures are cards
                      'help' in post.image ? 'w-full' : 'w-full max-w-sm justify-self-center',
                    )}
                  />
                  <ul className="grid list-disc gap-1.5 pl-5 text-muted-foreground marker:text-primary">
                    {t.points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                  {post.topic && (
                    <a
                      href={helpPath(lang, post.topic)}
                      className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                    >
                      {page.read} <ArrowRight className="size-4" aria-hidden />
                    </a>
                  )}
                </article>
              </li>
            );
          })}
        </ol>
      </div>
    </SitePage>
  );
}
