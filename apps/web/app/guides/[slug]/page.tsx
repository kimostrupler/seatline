import { ArrowRight } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { demoUrl, SitePage, signInUrl } from '@/components/site/site-chrome';
import { Button } from '@/components/ui/button';
import { GUIDES, GUIDE_TEXT, guideAlternates, guideBySlug, guidePath } from '@/lib/guides';
import { LOCALES } from '@/lib/locales';
import { webConfig } from '@/lib/server/config';
import { siteUrl } from '@/lib/site';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const found = guideBySlug((await params).slug);
  if (!found) return {};
  const text = GUIDE_TEXT[found.language][found.guide];
  const base = siteUrl(webConfig().APP_URL);
  const url = `${base}${guidePath(found.guide, found.language)}`;
  return {
    title: { absolute: `${text.title} · Seatline` },
    description: text.description,
    alternates: { canonical: url, languages: guideAlternates(base, found.guide) },
    openGraph: {
      type: 'article',
      url,
      siteName: 'Seatline',
      title: text.title,
      description: text.description,
      locale: LOCALES[found.language].replace('-', '_'),
      images: [{ url: `${base}/og-image`, width: 1200, height: 630 }],
    },
    robots: { index: true, follow: true },
  };
}

/**
 * A guide for people comparing ways to keep a seating plan (the middleware sets the page's
 * language from its address, so header and footer match it).
 */
export default async function GuidePage({ params }: Props) {
  const found = guideBySlug((await params).slug);
  if (!found) notFound();
  const { guide, language } = found;
  const text = GUIDE_TEXT[language][guide];
  const t = await getTranslations('site');
  const base = siteUrl(webConfig().APP_URL);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: text.title,
    description: text.description,
    inLanguage: language,
    url: `${base}${guidePath(guide, language)}`,
    publisher: { '@id': `${base}/#organization` },
    about: { '@id': `${base}/#software` },
  };
  return (
    <SitePage
      languagePaths={{
        en: guidePath(guide, 'en'),
        de: guidePath(guide, 'de'),
        fr: guidePath(guide, 'fr'),
      }}
    >
      <script
        type="application/ld+json"
        // our own text; "<" escaped so it can never end the script tag
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <article className="mx-auto grid max-w-3xl gap-10 px-4 py-12 sm:px-6" lang={language}>
        <header className="grid gap-4">
          <p className="text-sm font-medium text-primary">{t('guides')}</p>
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {text.title}
          </h1>
          <p className="text-lg leading-relaxed text-pretty text-muted-foreground">{text.intro}</p>
        </header>

        {/* phones: one card per row */}
        {text.table && (
          <dl className="grid gap-3 sm:hidden">
            {text.table.rows.map(([label, ...cells]) => (
              <div key={label} className="grid gap-1.5 rounded-xl border p-4 text-sm">
                <dt className="font-medium">{label}</dt>
                {cells.map((c, i) => (
                  <dd key={i} className="grid">
                    <span
                      className={
                        i === cells.length - 1
                          ? 'text-xs font-semibold text-primary'
                          : 'text-xs font-semibold text-muted-foreground'
                      }
                    >
                      {text.table!.columns[i]}
                    </span>
                    <span className={i === cells.length - 1 ? '' : 'text-muted-foreground'}>
                      {c}
                    </span>
                  </dd>
                ))}
              </div>
            ))}
          </dl>
        )}
        {text.table && (
          <div className="overflow-x-auto rounded-xl border max-sm:hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-4 py-2.5 font-medium">
                    <span className="sr-only">{t('guideTopic')}</span>
                  </th>
                  {text.table.columns.map((c, i) => (
                    <th
                      key={c}
                      className={`px-4 py-2.5 font-semibold ${i === text.table!.columns.length - 1 ? 'text-primary' : ''}`}
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {text.table.rows.map(([label, ...cells]) => (
                  <tr key={label} className="border-t align-top">
                    <th scope="row" className="px-4 py-3 text-left font-medium">
                      {label}
                    </th>
                    {cells.map((c, i) => (
                      <td
                        key={i}
                        className={
                          i === cells.length - 1 ? 'px-4 py-3' : 'px-4 py-3 text-muted-foreground'
                        }
                      >
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {text.sections.map((s) => (
          <section key={s.heading} className="grid gap-3">
            <h2 className="text-xl font-semibold">{s.heading}</h2>
            {s.paragraphs.map((p) => (
              <p key={p} className="leading-relaxed text-pretty text-muted-foreground">
                {p}
              </p>
            ))}
            {s.bullets && (
              <ul className="grid list-disc gap-1.5 pl-5 text-muted-foreground">
                {s.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            )}
          </section>
        ))}

        <section className="grid gap-4 rounded-xl border bg-canvas p-6">
          <h2 className="text-xl font-semibold">{t('finalTitle')}</h2>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <a href={signInUrl()} data-track="cta-trial-guide">
                {t('ctaTrial')} <ArrowRight />
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href={demoUrl()} data-track="cta-demo-guide">
                {t('ctaDemo')}
              </a>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">{t('ctaNote')}</p>
        </section>

        <nav aria-label={t('moreGuides')} className="grid gap-2">
          <h2 className="text-sm font-semibold">{t('moreGuides')}</h2>
          {GUIDES.filter((g) => g !== guide).map((g) => (
            <Link
              key={g}
              href={guidePath(g, language)}
              className="text-sm text-primary underline-offset-4 hover:underline"
            >
              {GUIDE_TEXT[language][g].title}
            </Link>
          ))}
        </nav>
      </article>
    </SitePage>
  );
}
