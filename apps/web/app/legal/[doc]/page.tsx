import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { SitePage } from '@/components/site/site-chrome';
import { legalText, LEGAL_DOCS, type LegalDoc } from '@/lib/legal/docs';
import { LEGAL_UPDATED, OPERATOR } from '@/lib/legal/operator';
import type { Language } from '@/lib/locales';
import { webConfig } from '@/lib/server/config';
import { siteUrl } from '@/lib/site';

const DOCS = [...LEGAL_DOCS, 'imprint'] as const;
type Doc = (typeof DOCS)[number];
const isDoc = (d: string): d is Doc => (DOCS as readonly string[]).includes(d);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ doc: string }>;
}): Promise<Metadata> {
  const { doc } = await params;
  if (!isDoc(doc)) return {};
  const t = await getTranslations('legal');
  const url = `${siteUrl(webConfig().APP_URL)}/legal/${doc}`;
  return {
    title: `${t(doc)} · Seatline`,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
  };
}

/** Terms of service, privacy policy and imprint — public, on the website and the app. */
export default async function LegalPage({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  if (!isDoc(doc)) notFound();
  const t = await getTranslations('legal');
  const format = await getFormatter();
  const language = (await getLocale()).slice(0, 2) as Language;
  return (
    <SitePage>
      <article className="mx-auto grid max-w-3xl gap-8 px-4 py-12 sm:px-6">
        <header className="grid gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">{t(doc)}</h1>
          <p className="text-sm text-muted-foreground">
            {t('updated', {
              date: format.dateTime(new Date(`${LEGAL_UPDATED}T12:00:00Z`), { dateStyle: 'long' }),
            })}
          </p>
        </header>
        {doc === 'imprint' ? <Imprint /> : <Sections doc={doc} language={language} />}
      </article>
    </SitePage>
  );
}

function Sections({ doc, language }: { doc: LegalDoc; language: Language }) {
  return legalText(doc, language).map((s) => (
    <section key={s.heading} className="grid gap-3">
      <h2 className="text-lg font-semibold">{s.heading}</h2>
      {s.paragraphs.map((p) => (
        <p key={p} className="leading-relaxed text-pretty text-muted-foreground">
          {p}
        </p>
      ))}
    </section>
  ));
}

async function Imprint() {
  const t = await getTranslations('legal');
  return (
    <>
      <p className="leading-relaxed text-muted-foreground">{t('imprintBody')}</p>
      <section className="grid gap-2">
        <h2 className="text-lg font-semibold">{t('operator')}</h2>
        <address className="leading-relaxed not-italic">
          {OPERATOR.name}
          <br />
          {OPERATOR.street}
          <br />
          {OPERATOR.place}
          <br />
          {t('country')}
        </address>
        {OPERATOR.uid && (
          <p>
            {t('uid')}: {OPERATOR.uid}
          </p>
        )}
      </section>
      <section className="grid gap-2">
        <h2 className="text-lg font-semibold">{t('contact')}</h2>
        <a className="w-fit underline underline-offset-4" href={`mailto:${OPERATOR.email}`}>
          {OPERATOR.email}
        </a>
      </section>
      <section className="grid gap-2">
        <h2 className="text-lg font-semibold">{t('responsible')}</h2>
        <p>{OPERATOR.name}</p>
      </section>
      <p className="text-sm leading-relaxed text-muted-foreground">{t('disclaimer')}</p>
    </>
  );
}
