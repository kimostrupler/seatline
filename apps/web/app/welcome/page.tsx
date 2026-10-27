import {
  ArrowRight,
  Check,
  ChevronDown,
  Gift,
  LogIn,
  MapPin,
  PlayCircle,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';
import type { CSSProperties, ReactNode } from 'react';
import { Logo } from '@/components/common/logo';
import { LiveFloor } from '@/components/site/landing/live-floor';
import { NoticeDemo } from '@/components/site/landing/notice-demo';
import { PriceCalculator } from '@/components/site/landing/price-calculator';
import { HelpMenu } from '@/components/common/help-menu';
import { Reveal } from '@/components/site/landing/reveal';
import { ZurichTime } from '@/components/site/landing/zurich-time';
import '@/components/site/landing/landing.css';
import { SiteBeacon } from '@/components/site/site-beacon';
import { appHomeUrl, demoUrl, LegalLinks, signInUrl } from '@/components/site/site-chrome';
import { looksSignedIn } from '@/lib/server/auth';
import { Button } from '@/components/ui/button';
import { helpPath, type HelpTopicId } from '@/lib/help';
import { TEMPLATE, templatePath } from '@/lib/help/template';
import { VIDEO, videoPath } from '@/lib/help/video';
import { updatesPath } from '@/lib/updates';
import { OPERATOR } from '@/lib/legal/operator';
import { LANGUAGES, LANGUAGE_NAMES, LOCALES, type Language } from '@/lib/locales';
import { webConfig } from '@/lib/server/config';
import { landingJsonLd, languageAlternates, pageUrl } from '@/lib/seo';
import { SITE_LANGUAGE_PATHS, siteUrl } from '@/lib/site';
import { cn } from '@/lib/utils';

/** The rows of the comparison under the promo video (texts in site.compare.rows). */
const COMPARE = ['price', 'trial', 'contract', 'setup', 'focus', 'data'] as const;

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
      images: [{ url: `${base}/og-image`, width: 1200, height: 630, alt: t('heroTitle') }],
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

/** One part of the app per seat state, with a phone picture and its help topic. */
const CHAPTERS: Array<{ key: 'free' | 'taken' | 'moving'; dot: string; topic: HelpTopicId }> = [
  { key: 'free', dot: 'var(--seat-free-stroke)', topic: 'seating' },
  { key: 'taken', dot: 'var(--seat-taken-stroke)', topic: 'exports-and-qr' },
  { key: 'moving', dot: 'var(--seat-reserved-stroke)', topic: 'moves' },
];
const STEPS = ['signup', 'floor', 'people', 'seat'] as const;
const FEATURES: Array<['floor' | 'seat' | 'moves' | 'people' | 'qr' | 'privacy', HelpTopicId]> = [
  ['floor', 'floors'],
  ['seat', 'seating'],
  ['moves', 'moves'],
  ['people', 'people'],
  ['qr', 'exports-and-qr'],
  ['privacy', 'privacy-and-billing'],
];
const TRUST = [
  ['swiss', MapPin],
  ['privacy', ShieldCheck],
  ['microsoft', LogIn],
  ['trial', Gift],
] as const;

const delay = (i: number) => ({ '--i': i }) as CSSProperties;

function Section({
  id,
  title,
  lead,
  children,
  className,
}: {
  id?: string;
  title: string;
  lead?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn('scroll-mt-20 py-20 sm:py-28', className)}>
      <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6">
        <div className="grid max-w-2xl gap-3" data-reveal>
          <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {title}
          </h2>
          {lead && <p className="text-lg text-pretty text-muted-foreground">{lead}</p>}
        </div>
        {children}
      </div>
    </section>
  );
}

/** The public landing page: seatline.ch (and /welcome on any address). */
export default async function Welcome() {
  const t = await getTranslations('site');
  const tl = await getTranslations('legal');
  const language = (await getLocale()).slice(0, 2) as Language;
  const signedIn = await looksSignedIn();
  // site.* texts stay on the server (app/layout.tsx); the two live parts get just theirs
  const { live, notice, calc } = (await getMessages()).site;
  const liveMessages = { site: { live, notice, calc } };
  const jsonLd = landingJsonLd({
    base: siteUrl(webConfig().APP_URL),
    language,
    name: t('metaTitle'),
    description: t('metaDescription'),
    faq: FAQ.map((n) => ({ q: t(`q${n}`), a: t(`a${n}`) })),
  });
  const ctas = (light = false) => (
    <div className="flex flex-wrap justify-center gap-3">
      <Button
        asChild
        size="lg"
        className={cn('h-12 px-6 text-base', light && 'bg-white text-primary hover:bg-white/90')}
      >
        <a href={signInUrl()} data-track="cta-trial">
          {t('ctaTrial')} <ArrowRight />
        </a>
      </Button>
      <Button
        asChild
        size="lg"
        variant="outline"
        className={cn(
          'h-12 px-6 text-base',
          light && 'border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white',
        )}
      >
        <a href={demoUrl()} data-track="cta-demo">
          {t('ctaDemo')}
        </a>
      </Button>
    </div>
  );

  return (
    <div className="ld min-h-dvh bg-background text-foreground">
      <script
        type="application/ld+json"
        // our own data; "<" escaped so text can never end the script tag
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />

      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:px-6">
          <a
            href={SITE_LANGUAGE_PATHS[language]}
            className="mr-auto flex items-center gap-2 font-semibold"
          >
            <Logo className="size-7" />
            Seatline
          </a>
          <nav className="flex items-center max-md:hidden" aria-label={t('footerNav')}>
            {(
              [
                ['#features', t('navFeatures')],
                ['#pricing', t('navPricing')],
                ['#faq', t('navFaq')],
              ] as const
            ).map(([href, label]) => (
              <Button
                key={href}
                asChild
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
              >
                <a href={href}>{label}</a>
              </Button>
            ))}
          </nav>
          <HelpMenu
            label={t('navHelp')}
            items={[
              { href: helpPath(language), label: t('navHelpCenter'), icon: 'help' },
              { href: videoPath(language), label: VIDEO[language].short, icon: 'video' },
              { href: updatesPath(language), label: t('navUpdates'), icon: 'updates' },
            ]}
          />
          <nav aria-label="Language" className="flex items-center text-xs font-medium">
            {LANGUAGES.map((l) => (
              <a
                key={l}
                href={SITE_LANGUAGE_PATHS[l]}
                hrefLang={l}
                lang={l}
                title={LANGUAGE_NAMES[l]}
                aria-current={l === language ? 'page' : undefined}
                className={cn(
                  'rounded px-1.5 py-1',
                  l === language
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {l.toUpperCase()}
              </a>
            ))}
          </nav>
          <Button asChild size="sm">
            {signedIn ? (
              <a href={appHomeUrl()}>{t('openApp')}</a>
            ) : (
              <a href={signInUrl()}>{t('signIn')}</a>
            )}
          </Button>
        </div>
      </header>

      <main>
        {/* hero */}
        <section className="overflow-hidden px-4 pt-16 pb-20 sm:px-6 sm:pt-24 sm:pb-28">
          <div className="mx-auto grid max-w-3xl justify-items-center gap-6 text-center">
            <h1
              className="text-5xl font-semibold tracking-tight text-balance sm:text-7xl"
              data-reveal
            >
              {t('heroTitle')}
            </h1>
            <p
              className="max-w-2xl text-lg text-pretty text-muted-foreground sm:text-xl"
              data-reveal
              style={delay(1)}
            >
              {t('heroLead')}
            </p>
            <div data-reveal style={delay(2)}>
              {ctas()}
            </div>
            <p className="text-sm text-muted-foreground" data-reveal style={delay(3)}>
              {t('ctaNote')}
            </p>
          </div>
          <div className="mx-auto mt-14 max-w-5xl" data-reveal style={delay(4)}>
            <NextIntlClientProvider messages={liveMessages}>
              <LiveFloor />
            </NextIntlClientProvider>
          </div>
        </section>

        {/* trust */}
        <section className="border-y bg-canvas">
          <ul className="mx-auto grid max-w-6xl gap-4 px-4 py-6 text-sm sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
            {TRUST.map(([key, Icon]) => (
              <li key={key} className="flex items-center gap-2.5">
                <Icon className="size-4 shrink-0 text-primary" aria-hidden />
                {t(`trust.${key}`)}
              </li>
            ))}
          </ul>
        </section>

        {/* the promo video (a story: the usual way vs Seatline), nothing loads until play (poster
            13 KB, video 4.6 MB, 1080p); subtitles in all three languages (no captions burned in) */}
        <Section id="video" title={t('videoTitle')} lead={t('videoLead')} className="pb-0 sm:pb-0">
          <video
            controls
            playsInline
            preload="none"
            poster="/site-video/seatline-promo-2.webp"
            width={1280}
            height={720}
            className="aspect-video h-auto w-full rounded-2xl border bg-card shadow-xl shadow-black/5"
            data-reveal
            data-testid="promo-video"
          >
            <source src="/site-video/seatline-promo-2.mp4" type="video/mp4" />
            {LANGUAGES.map((l) => (
              <track
                key={l}
                kind="subtitles"
                srcLang={l}
                label={LANGUAGE_NAMES[l]}
                src={`/site-video/seatline-promo-2.${l}.vtt`}
                default={l === language}
              />
            ))}
          </video>

          {/* the same story in a table: no names, only what's true of us */}
          <div className="grid gap-3" data-reveal>
            <h3 className="text-2xl font-semibold tracking-tight">{t('compare.title')}</h3>
            <p className="max-w-2xl text-pretty text-muted-foreground">{t('compare.lead')}</p>
            <div className="overflow-hidden rounded-2xl border bg-card">
              <table className="w-full text-left text-sm" data-testid="compare">
                <thead className="bg-canvas text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className="w-1/4 px-4 py-3 font-medium max-sm:hidden">
                      <span className="sr-only">{t('compare.rows.price.label')}</span>
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      {t('compare.usual')}
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold text-primary">
                      <span className="inline-flex items-center gap-1.5">
                        <Logo className="size-4" /> {t('compare.us')}
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {COMPARE.map((row) => (
                    <tr key={row} className="align-top">
                      <th scope="row" className="px-4 py-3 font-medium max-sm:hidden">
                        {t(`compare.rows.${row}.label`)}
                      </th>
                      <td className="px-4 py-3 text-muted-foreground">
                        <span className="flex gap-2">
                          {row === 'data' ? (
                            <span
                              className="grid size-4 shrink-0 translate-y-0.5 place-items-center rounded-full bg-muted text-[10px] font-bold"
                              aria-label={t('compare.depends')}
                            >
                              ?
                            </span>
                          ) : (
                            <X
                              className="size-4 shrink-0 translate-y-0.5 text-destructive"
                              aria-label={t('compare.no')}
                            />
                          )}
                          <span>
                            <span className="block text-xs font-medium text-foreground sm:hidden">
                              {t(`compare.rows.${row}.label`)}
                            </span>
                            {t(`compare.rows.${row}.usual`)}
                          </span>
                        </span>
                      </td>
                      <td className="bg-primary/5 px-4 py-3 font-medium">
                        <span className="flex gap-2">
                          <Check
                            className="size-4 shrink-0 translate-y-0.5 text-seat-free"
                            aria-label={t('compare.yes')}
                          />
                          <span>
                            <span className="block text-xs text-muted-foreground sm:hidden">
                              &nbsp;
                            </span>
                            {t(`compare.rows.${row}.us`)}
                          </span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">{t('compare.note')}</p>
          </div>

          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <a href={signInUrl()} data-track="cta-compare-trial">
                {t('ctaTrial')} <ArrowRight aria-hidden />
              </a>
            </Button>
            <Button asChild variant="outline" size="lg">
              <a href={videoPath(language)} data-track="cta-video-tour">
                <PlayCircle aria-hidden /> {t('videoTour')}
              </a>
            </Button>
          </div>
        </Section>

        {/* the three parts of the app, with pictures */}
        <section id="features" className="scroll-mt-20 py-20 sm:py-28">
          <div className="mx-auto grid max-w-6xl gap-20 px-4 sm:gap-28 sm:px-6">
            {CHAPTERS.map((c, i) => (
              <div
                key={c.key}
                className="grid items-center gap-10 md:grid-cols-2 md:gap-16"
                aria-labelledby={`${c.key}-title`}
              >
                <div className={cn('grid gap-4', i % 2 === 1 && 'md:order-2')} data-reveal>
                  <span
                    aria-hidden
                    className="h-1.5 w-12 rounded-full"
                    style={{ background: c.dot }}
                  />
                  <h2
                    id={`${c.key}-title`}
                    className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl"
                  >
                    {t(`chapters.${c.key}.title`)}
                  </h2>
                  <p className="text-lg text-pretty text-muted-foreground">
                    {t(`chapters.${c.key}.body`)}
                  </p>
                  <a
                    href={helpPath(language, c.topic)}
                    className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
                  >
                    {t(`chapters.${c.key}.link`)} <ArrowRight className="size-4" aria-hidden />
                  </a>
                </div>
                <figure
                  className="m-0 grid place-items-center rounded-3xl bg-canvas px-6 py-10 sm:py-14"
                  data-reveal
                  style={delay(1)}
                >
                  <img
                    src={`/site-img/${language}/${c.key}.jpg`}
                    alt={t(`chapters.alt.${c.key}`)}
                    width={780}
                    height={1040}
                    loading="lazy"
                    className="h-auto w-full max-w-72 rounded-[1.75rem] border-[6px] border-foreground/90 shadow-2xl shadow-black/15"
                  />
                </figure>
              </div>
            ))}
          </div>
        </section>

        {/* what it does: six short items, each opens its help topic */}
        <Section title={t('indexTitle')} className="border-t bg-canvas">
          <ul className="grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(([key, topic], i) => (
              <li key={key} data-reveal style={delay(i % 3)}>
                <a href={helpPath(language, topic)} className="group grid gap-1.5">
                  <span className="flex items-center gap-1.5 text-lg font-semibold">
                    {t(`features.${key}.title`)}
                    <ArrowRight
                      className="size-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary"
                      aria-hidden
                    />
                  </span>
                  <span className="text-muted-foreground">{t(`features.${key}.body`)}</span>
                </a>
              </li>
            ))}
          </ul>
          <a
            href={helpPath(language)}
            className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
          >
            {t('indexAll')} <ArrowRight className="size-4" aria-hidden />
          </a>
        </Section>

        {/* getting started */}
        <Section title={t('stepsTitle')}>
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((key, i) => (
              <li
                key={key}
                className="grid content-start gap-3 rounded-xl border bg-card p-5"
                data-reveal
                style={delay(i)}
              >
                <span className="text-sm font-medium text-primary">{t(`steps.${key}.time`)}</span>
                <p>{t(`steps.${key}.text`)}</p>
              </li>
            ))}
          </ol>
        </Section>

        {/* notices to IT */}
        <section className="border-t bg-canvas px-4 py-20 sm:px-6 sm:py-28">
          <div className="mx-auto max-w-6xl">
            <NextIntlClientProvider messages={liveMessages}>
              <NoticeDemo />
            </NextIntlClientProvider>
          </div>
        </section>

        {/* pricing */}
        {/* price card and calculator: side by side on wide screens, stacked below */}
        <section id="pricing" className="scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28">
          <div className="mx-auto grid max-w-xl gap-6 lg:max-w-5xl lg:grid-cols-2">
            <div
              className="grid justify-items-center gap-6 rounded-3xl border bg-card p-8 text-center shadow-xl shadow-black/5 sm:p-12 lg:content-center"
              data-reveal
            >
              <h2 className="text-2xl font-semibold tracking-tight">{t('priceTitle')}</h2>
              <p className="grid gap-1">
                <span className="text-6xl font-semibold tracking-tight sm:text-7xl">
                  {t('priceFigure')}
                </span>
                <span className="text-muted-foreground">{t('perDesk')}</span>
                <span className="text-sm font-medium">{t('priceVolume')}</span>
              </p>
              <p className="flex gap-2.5 text-left text-muted-foreground">
                <Check
                  className="mt-1 size-4 shrink-0 text-[var(--seat-free-stroke)]"
                  aria-hidden
                />
                {t('priceBody')}
              </p>
              <Button asChild size="lg" className="h-12 w-full text-base">
                <a href={signInUrl()} data-track="cta-trial">
                  {t('ctaTrial')} <ArrowRight />
                </a>
              </Button>
              <a
                href={demoUrl()}
                data-track="cta-demo"
                className="text-sm font-medium text-primary hover:underline"
              >
                {t('priceDemo')}
              </a>
            </div>
            <NextIntlClientProvider messages={liveMessages}>
              <PriceCalculator />
            </NextIntlClientProvider>
          </div>
        </section>

        {/* questions, one open at a time if you like */}
        <section id="faq" className="scroll-mt-20 border-t bg-canvas px-4 py-20 sm:px-6 sm:py-28">
          <div className="mx-auto grid max-w-3xl gap-8">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl" data-reveal>
              {t('faqTitle')}
            </h2>
            <div className="grid gap-3">
              {FAQ.map((n) => (
                <details key={n} className="group rounded-xl border bg-card px-5 py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
                    {t(`q${n}`)}
                    <ChevronDown
                      aria-hidden
                      className="size-4 shrink-0 text-muted-foreground transition group-open:rotate-180"
                    />
                  </summary>
                  <p className="mt-3 text-muted-foreground">{t(`a${n}`)}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* closing call */}
        <section className="bg-primary px-4 py-20 text-primary-foreground sm:px-6 sm:py-24">
          <div
            className="mx-auto grid max-w-3xl justify-items-center gap-6 text-center"
            data-reveal
          >
            <h2 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              {t('ctaTitle')}
            </h2>
            <p className="text-lg text-pretty text-primary-foreground/80">{t('ctaBody')}</p>
            {ctas(true)}
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[2fr_1fr_1fr]">
          <div className="grid content-start gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-2 text-base font-semibold text-foreground">
              <Logo className="size-6" /> Seatline
            </span>
            <p>{t('madeIn')}</p>
            <p>
              {t('footerPlace')} · {t('footerTime')} <ZurichTime />
              <br />
              {t('footerHosted')}
            </p>
          </div>
          <nav className="grid content-start gap-2 text-sm" aria-label={t('footerNav')}>
            <p className="font-medium">{t('footerNav')}</p>
            {(
              [
                ['#features', t('navFeatures')],
                ['#pricing', t('navPricing')],
                ['#faq', t('navFaq')],
                [helpPath(language), t('navHelp')],
                [videoPath(language), VIDEO[language].short],
                [templatePath(language), TEMPLATE[language].title],
                [updatesPath(language), t('navUpdates')],
                [signInUrl(), t('signIn')],
              ] as const
            ).map(([href, label]) => (
              <a key={href} href={href} className="text-muted-foreground hover:text-foreground">
                {label}
              </a>
            ))}
          </nav>
          <div className="grid content-start gap-2 text-sm">
            <p className="font-medium">{t('footerMail')}</p>
            <a
              href={`mailto:${OPERATOR.email}`}
              className="text-muted-foreground hover:text-foreground"
            >
              {OPERATOR.email}
            </a>
            <nav aria-label={tl('legalLinks')} className="mt-3 grid gap-2 text-muted-foreground">
              <LegalLinks className="hover:text-foreground" />
            </nav>
          </div>
        </div>
        <p className="mx-auto max-w-6xl px-4 pb-10 text-xs text-muted-foreground sm:px-6">
          {t('copyright', { year: new Date().getFullYear() })}
        </p>
      </footer>
      <Reveal />
      <SiteBeacon />
    </div>
  );
}
