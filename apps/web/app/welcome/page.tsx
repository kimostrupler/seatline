import { ArrowUpRight } from 'lucide-react';
import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';
import type { CSSProperties } from 'react';
import { Logo } from '@/components/common/logo';
import { FeatureIndex } from '@/components/site/landing/feature-index';
import { LiveFloor } from '@/components/site/landing/live-floor';
import { NoticeDemo } from '@/components/site/landing/notice-demo';
import { Reveal } from '@/components/site/landing/reveal';
import { ZurichTime } from '@/components/site/landing/zurich-time';
import '@/components/site/landing/landing.css';
import { SiteBeacon } from '@/components/site/site-beacon';
import { demoUrl, LegalLinks, signInUrl } from '@/components/site/site-chrome';
import { HELP, HELP_TOPICS, helpImage, helpPath, type HelpTopicId } from '@/lib/help';
import { OPERATOR } from '@/lib/legal/operator';
import { LANGUAGES, LANGUAGE_NAMES, LOCALES, type Language } from '@/lib/locales';
import { webConfig } from '@/lib/server/config';
import { landingJsonLd, languageAlternates, pageUrl } from '@/lib/seo';
import { SITE_LANGUAGE_PATHS, siteUrl } from '@/lib/site';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('site');
  const language = (await getLocale()).slice(0, 2) as Language;
  const base = siteUrl(webConfig().APP_URL);
  const url = pageUrl(base, language);
  return {
    title: { absolute: t('metaTitle') },
    description: t('metaDescription'),
    alternates: { canonical: url, languages: languageAlternates(base) },
    openGraph: {
      type: 'website',
      url,
      siteName: 'Seatline',
      title: t('metaTitle'),
      description: t('metaDescription'),
      locale: LOCALES[language].replace('-', '_'),
      images: [{ url: `${base}/og-image`, width: 1200, height: 630, alt: t('metaTitle') }],
    },
    twitter: {
      card: 'summary_large_image',
      title: t('metaTitle'),
      description: t('metaDescription'),
      images: [`${base}/og-image`],
    },
    robots: { index: true, follow: true },
  };
}

const FAQ = ['1', '2', '3', '4', '5', '6', '7', '8'] as const;

/** The three chapters: one seat state each, with a phone picture of the app and its help topic. */
const CHAPTERS: Array<{
  key: 'free' | 'taken' | 'moving';
  bg: string;
  ink: string;
  topic: HelpTopicId;
}> = [
  { key: 'free', bg: 'var(--free)', ink: 'var(--on-free)', topic: 'seating' },
  { key: 'taken', bg: 'var(--taken)', ink: 'var(--on-taken)', topic: 'exports-and-qr' },
  { key: 'moving', bg: 'var(--reserved)', ink: 'var(--on-reserved)', topic: 'moves' },
];

/** The hero's folders, back to front: each tab opens its chapter. The front one is "free". */
const FOLDERS = [
  { tab: 'faq', href: '#faq', bg: 'var(--paper)', ink: 'var(--on-paper)', left: '80%' },
  { tab: 'price', href: '#price', bg: 'var(--brand)', ink: 'var(--on-brand)', left: '60%' },
  { tab: 'moving', href: '#moving', bg: 'var(--reserved)', ink: 'var(--on-reserved)', left: '40%' },
  { tab: 'taken', href: '#taken', bg: 'var(--taken)', ink: 'var(--on-taken)', left: '20%' },
] as const;

/** Getting started, as one bar: each part as wide as the time it takes. */
const STAGES = [
  { key: 'signup', grow: 1, bg: 'var(--brand)', ink: 'var(--on-brand)' },
  { key: 'floor', grow: 10, bg: 'var(--free)', ink: 'var(--on-free)' },
  { key: 'people', grow: 2, bg: 'var(--reserved)', ink: 'var(--on-reserved)' },
  { key: 'seat', grow: 60, bg: 'var(--taken)', ink: 'var(--on-taken)' },
] as const;

const vars = (v: Record<string, string | number>) => v as CSSProperties;

/** The public landing page: seatline.ch (and /welcome on any address). */
export default async function Welcome() {
  const t = await getTranslations('site');
  const tl = await getTranslations('legal');
  const language = (await getLocale()).slice(0, 2) as Language;
  const help = HELP[language];
  // site.* texts stay on the server (app/layout.tsx); the two live parts get just theirs
  const { live, notice } = (await getMessages()).site;
  const liveMessages = { site: { live, notice } };
  const jsonLd = landingJsonLd({
    base: siteUrl(webConfig().APP_URL),
    language,
    name: t('metaTitle'),
    description: t('metaDescription'),
    faq: FAQ.map((n) => ({ q: t(`q${n}`), a: t(`a${n}`) })),
  });
  const trial = () => (
    <a className="ld-button" href={signInUrl()} data-track="cta-trial">
      {t('ctaTrial')}
    </a>
  );

  return (
    <div className="ld">
      <script
        type="application/ld+json"
        // our own data; "<" escaped so text can never end the script tag
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />

      <header className="ld-hero">
        <div className="ld-top">
          <nav className="ld-top__langs" aria-label="Language">
            {LANGUAGES.map((l) => (
              <a
                key={l}
                href={SITE_LANGUAGE_PATHS[l]}
                hrefLang={l}
                lang={l}
                title={LANGUAGE_NAMES[l]}
                aria-current={l === language ? 'page' : undefined}
              >
                {l.toUpperCase()}
              </a>
            ))}
          </nav>
          <a className="ld-top__brand" href={SITE_LANGUAGE_PATHS[language]} aria-label="Seatline">
            <Logo className="size-8" />
          </a>
          <nav className="ld-top__links" aria-label={t('footerNav')}>
            <a href={helpPath(language)}>{t('navHelp')}</a>
            <a href={signInUrl()}>{t('signIn')}</a>
          </nav>
        </div>
        <div className="ld-hero__title">
          <h1 className="ld-display">Seatline</h1>
          <p className="ld-hero__lead">{t('heroLead')}</p>
        </div>
        <div className="ld-folders">
          {FOLDERS.map((f, i) => (
            <div
              key={f.tab}
              className="ld-folder"
              style={vars({
                '--f-bg': f.bg,
                '--f-ink': f.ink,
                '--tab-left': f.left,
                top: `${(FOLDERS.length - i) * -14}px`,
              })}
            >
              <a className="ld-folder__tab" href={f.href}>
                {t(`tabs.${f.tab}`)}
              </a>
            </div>
          ))}
          <div
            className="ld-folder ld-folder--front"
            style={vars({
              '--f-bg': 'var(--free)',
              '--f-ink': 'var(--on-free)',
              '--tab-left': '0%',
            })}
          >
            <a className="ld-folder__tab" href="#free">
              {t('tabs.free')}
            </a>
            <div className="ld-folder__body">
              <div className="ld-folder__cta">
                {trial()}
                <a className="ld-link" href={demoUrl()} data-track="cta-demo">
                  {t('demoLink')}
                </a>
              </div>
              <NextIntlClientProvider messages={liveMessages}>
                <LiveFloor />
              </NextIntlClientProvider>
            </div>
          </div>
        </div>
      </header>

      <main>
        {CHAPTERS.map((c) => (
          <section
            key={c.key}
            id={c.key}
            className="ld-chapter ld-field"
            style={vars({ '--c-bg': c.bg, '--c-ink': c.ink })}
            aria-labelledby={`${c.key}-title`}
          >
            <h2 id={`${c.key}-title`} className="ld-chapter__title" data-reveal>
              {t(`chapters.${c.key}.title`)}
            </h2>
            <figure className="ld-chapter__picture">
              <img
                src={`/site-img/${language}/${c.key}.jpg`}
                alt={t(`chapters.alt.${c.key}`)}
                width={780}
                height={1040}
                loading="lazy"
              />
            </figure>
            <p className="ld-chapter__text" data-reveal style={vars({ '--i': 1 })}>
              {t(`chapters.${c.key}.body`)}
            </p>
            <a
              className="ld-chapter__link ld-link"
              href={helpPath(language, c.topic)}
              data-reveal
              style={vars({ '--i': 2 })}
            >
              {t(`chapters.${c.key}.link`)}
            </a>
          </section>
        ))}

        <section className="ld-index ld-field" id="features" aria-labelledby="features-title">
          <div className="ld-index__head" data-reveal>
            <h2 id="features-title" className="ld-head">
              {t('indexTitle')}
            </h2>
            <p>{t('indexBody')}</p>
          </div>
          <FeatureIndex
            rows={HELP_TOPICS.map((id) => {
              const topic = help.topics[id];
              const image = topic.steps.find((s) => s.image)?.image;
              return {
                href: helpPath(language, id),
                name: topic.title,
                summary: topic.summary,
                image: image && helpImage(language, image),
              };
            })}
          />
          <a className="ld-index__all ld-link" href={helpPath(language)}>
            {t('indexAll')}
          </a>
        </section>

        <section className="ld-stages ld-field" aria-labelledby="steps-title">
          <h2 id="steps-title" className="ld-head" data-reveal>
            {t('stepsTitle')}
          </h2>
          <ol className="ld-bar" role="list">
            {STAGES.map((s, i) => (
              <li
                key={s.key}
                className="ld-bar__seg"
                data-reveal
                style={vars({ flexGrow: s.grow, '--s-bg': s.bg, '--s-ink': s.ink, '--i': i })}
              >
                <span className="ld-bar__time">{t(`steps.${s.key}.time`)}</span>
                <p className="ld-bar__text">{t(`steps.${s.key}.text`)}</p>
              </li>
            ))}
          </ol>
        </section>

        <NextIntlClientProvider messages={liveMessages}>
          <NoticeDemo />
        </NextIntlClientProvider>

        <section className="ld-price ld-field" id="price" aria-labelledby="price-title">
          <h2 id="price-title" className="ld-display" data-reveal>
            {t('priceLine1')} <span className="ld-price__fig">{t('priceFigure')}</span>{' '}
            {t('priceLine2')}
          </h2>
          <div className="ld-price__foot" data-reveal style={vars({ '--i': 1 })}>
            <p>{t('priceBody')}</p>
            <div className="ld-price__act">
              {trial()}
              <a className="ld-link" href={demoUrl()} data-track="cta-demo">
                {t('priceDemo')}
              </a>
            </div>
          </div>
        </section>

        <section id="faq" className="ld-field" aria-labelledby="faq-title">
          <div className="ld-faq__head">
            <h2 id="faq-title" className="ld-display" data-reveal>
              {t('faqTitle')}
            </h2>
          </div>
          <div>
            {FAQ.map((n) => (
              <div key={n} className="ld-band">
                <h3>{t(`q${n}`)}</h3>
                <p>{t(`a${n}`)}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="ld-cta ld-field" aria-labelledby="cta-title">
          <h2 id="cta-title" className="ld-display" data-reveal>
            {t('ctaTitle')}
          </h2>
          <div className="ld-cta__foot" data-reveal style={vars({ '--i': 1 })}>
            <p>{t('ctaBody')}</p>
            {trial()}
          </div>
        </section>
      </main>

      <footer className="ld-foot">
        <div className="ld-tile ld-tile--statement">
          <p>{t('footerStatement')}</p>
          <div>
            <nav className="ld-tile--legal" aria-label={tl('legalLinks')}>
              <LegalLinks className="hover:underline" />
            </nav>
            <p className="mt-2" style={{ fontSize: 'var(--step-small)' }}>
              {t('copyright', { year: new Date().getFullYear() })}
            </p>
          </div>
        </div>
        <div className="ld-tile ld-tile--nav">
          <p className="ld-label">{t('footerNav')}</p>
          <ul>
            <li>
              <a href={helpPath(language)}>{t('navHelp')}</a>
            </li>
            <li>
              <a href="#features">{t('indexTitle')}</a>
            </li>
            <li>
              <a href="#price">{t('tabs.price')}</a>
            </li>
            <li>
              <a href="#faq">{t('tabs.faq')}</a>
            </li>
            <li>
              <a href={signInUrl()}>{t('signIn')}</a>
            </li>
          </ul>
        </div>
        <div className="ld-tile ld-tile--place">
          <p>{t('footerPlace')}</p>
          <p>
            {t('footerTime')} <ZurichTime />
            <br />
            {t('footerHosted')}
          </p>
        </div>
        <div className="ld-tile ld-tile--mail">
          <p className="ld-label">{t('footerMail')}</p>
          <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>
        </div>
        <div className="ld-tile ld-tile--word" aria-hidden>
          <span>Seatline</span>
        </div>
        <a className="ld-tile ld-tile--invite" href={demoUrl()} data-track="cta-demo">
          <span>{t('footerInvite')}</span>
          <ArrowUpRight className="size-12" aria-hidden />
        </a>
      </footer>
      <Reveal />
      <SiteBeacon />
    </div>
  );
}
