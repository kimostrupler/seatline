import { Download, FileSpreadsheet } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { HelpShell } from '@/components/help/help-shell';
import { demoUrl } from '@/components/site/site-chrome';
import { Button } from '@/components/ui/button';
import { isHelpLanguage } from '@/lib/help';
import { TEMPLATE, templatePath } from '@/lib/help/template';
import { webConfig } from '@/lib/server/config';
import { siteUrl } from '@/lib/site';

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  if (!isHelpLanguage(lang)) return {};
  const base = siteUrl(webConfig().APP_URL);
  const t = TEMPLATE[lang];
  return {
    title: { absolute: t.metaTitle },
    description: t.intro,
    alternates: {
      canonical: `${base}${templatePath(lang)}`,
      languages: {
        en: `${base}${templatePath('en')}`,
        de: `${base}${templatePath('de')}`,
        fr: `${base}${templatePath('fr')}`,
        'x-default': `${base}${templatePath('en')}`,
      },
    },
    robots: { index: true, follow: true },
  };
}

/** A free Excel seating plan (for people searching "Sitzplan Vorlage"), importable later. */
export default async function ExcelTemplate({ params }: Props) {
  const { lang } = await params;
  if (!isHelpLanguage(lang)) notFound();
  const t = TEMPLATE[lang];
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    inLanguage: lang,
    mainEntity: t.faq.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };
  return (
    <HelpShell
      language={lang}
      paths={{ en: templatePath('en'), de: templatePath('de'), fr: templatePath('fr') }}
    >
      <script
        type="application/ld+json"
        // our own text; "<" escaped so it can never end the script tag
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd).replace(/</g, '\\u003c') }}
      />
      <header className="grid gap-4">
        <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
          <FileSpreadsheet className="size-6" aria-hidden />
        </span>
        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          {t.title}
        </h1>
        <p className="max-w-2xl text-lg text-pretty text-muted-foreground">{t.intro}</p>
        <div className="grid justify-items-start gap-2">
          <Button asChild size="lg">
            <a href={`/templates/${t.file}`} download data-track="cta-template">
              <Download aria-hidden /> {t.download}
            </a>
          </Button>
          <p className="text-sm text-muted-foreground">{t.size}</p>
        </div>
      </header>

      <section aria-labelledby="inside" className="grid gap-3">
        <h2 id="inside" className="text-xl font-semibold">
          {t.inside}
        </h2>
        <ol className="grid gap-3 sm:grid-cols-3">
          {t.sheets.map((sheet) => (
            <li key={sheet.name} className="grid content-start gap-1 rounded-xl border bg-card p-4">
              <span className="font-semibold">{sheet.name}</span>
              <span className="text-sm text-muted-foreground">{sheet.body}</span>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="later" className="grid gap-3 rounded-xl border bg-canvas p-5">
        <h2 id="later" className="text-xl font-semibold">
          {t.laterTitle}
        </h2>
        <p className="max-w-2xl text-pretty text-muted-foreground">{t.later}</p>
        <Button asChild variant="outline" className="justify-self-start">
          <a href={demoUrl()} data-track="cta-demo">
            {t.tryDemo}
          </a>
        </Button>
      </section>

      <section aria-labelledby="faq" className="grid gap-3">
        <h2 id="faq" className="text-xl font-semibold">
          {(await getTranslations('help'))('faq')}
        </h2>
        <div className="divide-y rounded-xl border">
          {t.faq.map(({ q, a }) => (
            <div key={q} className="grid gap-1 px-4 py-3">
              <h3 className="font-medium">{q}</h3>
              <p className="text-sm text-pretty text-muted-foreground">{a}</p>
            </div>
          ))}
        </div>
      </section>
    </HelpShell>
  );
}
