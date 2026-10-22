import {
  ArrowRight,
  CalendarClock,
  FileUp,
  Check,
  History,
  Languages,
  Lock,
  Map,
  FileSpreadsheet,
  Mail,
  MessagesSquare,
  QrCode,
  TrendingUp,
  MousePointerClick,
  Presentation,
  Table2,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { FloorIllustration } from '@/components/site/floor-illustration';
import { demoUrl, SitePage, signInUrl } from '@/components/site/site-chrome';
import { Button } from '@/components/ui/button';
import { OPERATOR } from '@/lib/legal/operator';
import { LOCALES, type Language } from '@/lib/locales';
import { webConfig } from '@/lib/server/config';
import { landingJsonLd, languageAlternates, pageUrl } from '@/lib/seo';
import { SITE_PRICE_CHF, siteUrl } from '@/lib/site';

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

const FEATURES: [LucideIcon, `f${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12}`][] = [
  [Map, 'f1'],
  [FileUp, 'f2'],
  [MousePointerClick, 'f3'],
  [CalendarClock, 'f4'],
  [History, 'f5'],
  [FileSpreadsheet, 'f6'],
  [Presentation, 'f7'],
  [Table2, 'f8'],
  [Mail, 'f9'],
  [MessagesSquare, 'f10'],
  [TrendingUp, 'f11'],
  [QrCode, 'f12'],
];

/** The public landing page: seatline.ch (and /welcome on any address). */
const FAQ = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

export default async function Welcome() {
  const t = await getTranslations('site');
  const price = `CHF ${SITE_PRICE_CHF}`;
  const jsonLd = landingJsonLd({
    base: siteUrl(webConfig().APP_URL),
    language: (await getLocale()).slice(0, 2) as Language,
    name: t('metaTitle'),
    description: t('metaDescription'),
    faq: FAQ.map((n) => ({ q: t(`q${n}`), a: t(`a${n}`) })),
  });
  return (
    <SitePage sections>
      <script
        type="application/ld+json"
        // our own data; "<" escaped so text can never end the script tag
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      {/* hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-14 pb-20 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:pt-20">
        <div className="grid gap-6">
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            {t('heroTitle')}
          </h1>
          <p className="text-lg text-pretty text-muted-foreground">{t('heroBody')}</p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <a href={signInUrl()} data-track="cta-trial">
                {t('ctaTrial')} <ArrowRight />
              </a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href={demoUrl()} data-track="cta-demo">
                {t('ctaDemo')}
              </a>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">{t('ctaNote')}</p>
        </div>
        <FloorIllustration label={t('mapAlt')} floor={t('mapFloor')} cardSince={t('cardSince')} />
      </section>

      {/* trust */}
      <section className="border-y bg-canvas">
        <ul className="mx-auto grid max-w-6xl gap-4 px-4 py-6 text-sm sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
          {(
            [
              [Lock, 'trustSwiss'],
              [ShieldCheck, 'trustPrivacy'],
              [MicrosoftIcon, 'trustMicrosoft'],
              [Languages, 'trustLanguages'],
            ] as const
          ).map(([Icon, key]) => (
            <li key={key} className="flex items-center gap-2.5">
              <Icon className="size-4 shrink-0 text-primary" aria-hidden />
              {t(key)}
            </li>
          ))}
        </ul>
      </section>

      {/* features */}
      <section
        id="features"
        className="mx-auto grid max-w-6xl scroll-mt-20 gap-10 px-4 py-20 sm:px-6"
      >
        <div className="grid max-w-2xl gap-3">
          <h2 className="text-3xl font-semibold tracking-tight text-balance">
            {t('featuresTitle')}
          </h2>
        </div>
        <ul className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(([Icon, key]) => (
            <li key={key} className="grid content-start gap-2">
              <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-4.5" aria-hidden />
              </span>
              <h3 className="font-medium">{t(`${key}Title`)}</h3>
              <p className="text-sm text-muted-foreground">{t(`${key}Body`)}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* how to start */}
      <section className="border-t bg-canvas">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6">
          <h2 className="text-3xl font-semibold tracking-tight text-balance">{t('stepsTitle')}</h2>
          <ol className="grid gap-8 sm:grid-cols-3">
            {(['1', '2', '3'] as const).map((n) => (
              <li key={n} className="grid content-start gap-2">
                <span className="grid size-9 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {n}
                </span>
                <h3 className="font-medium">{t(`s${n}Title`)}</h3>
                <p className="text-sm text-muted-foreground">{t(`s${n}Body`)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* pricing */}
      <section
        id="pricing"
        className="mx-auto grid max-w-6xl scroll-mt-20 gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:items-center"
      >
        <div className="grid gap-3">
          <h2 className="text-3xl font-semibold tracking-tight">{t('pricingTitle')}</h2>
          <p className="text-muted-foreground">{t('pricingBody')}</p>
        </div>
        <div className="grid gap-6 rounded-2xl border bg-background p-8 shadow-sm">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
            <span className="text-5xl font-semibold tracking-tight">{price}</span>
            <span className="text-muted-foreground">{t('perSeat')}</span>
            <span className="ml-auto rounded-full bg-[var(--seat-free-fill)] px-3 py-1 text-xs font-medium text-[var(--seat-free-text)]">
              {t('trialBadge')}
            </span>
          </div>
          <ul className="grid gap-2.5 text-sm">
            {(['p1', 'p2', 'p3'] as const).map((key) => (
              <li key={key} className="flex gap-2.5">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                {t(key)}
              </li>
            ))}
          </ul>
          <Button asChild size="lg">
            <a href={signInUrl()} data-track="cta-trial">
              {t('ctaTrial')} <ArrowRight />
            </a>
          </Button>
        </div>
      </section>

      {/* faq */}
      <section id="faq" className="border-t bg-canvas">
        <div className="mx-auto grid max-w-3xl scroll-mt-20 gap-8 px-4 py-20 sm:px-6">
          <h2 className="text-3xl font-semibold tracking-tight">{t('faqTitle')}</h2>
          <div className="grid gap-3">
            {FAQ.map((n) => (
              <details key={n} className="group rounded-xl border bg-background px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                  {t(`q${n}`)}
                  <span
                    aria-hidden
                    className="text-muted-foreground transition group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm text-muted-foreground">{t(`a${n}`)}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* final call */}
      <section className="mx-auto grid max-w-6xl justify-items-center gap-4 px-4 py-20 text-center sm:px-6">
        <h2 className="text-3xl font-semibold tracking-tight text-balance">{t('finalTitle')}</h2>
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <a href={signInUrl()} data-track="cta-trial">
              {t('ctaTrial')} <ArrowRight />
            </a>
          </Button>
          <Button asChild size="lg" variant="outline">
            <a href={demoUrl()} data-track="cta-demo">
              {t('ctaDemo')}
            </a>
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          {t.rich('contact', {
            email: OPERATOR.email,
            mail: (chunks) => (
              <a className="underline underline-offset-4" href={`mailto:${OPERATOR.email}`}>
                {chunks}
              </a>
            ),
          })}
        </p>
      </section>
    </SitePage>
  );
}

function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 21 21" className={className}>
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}
