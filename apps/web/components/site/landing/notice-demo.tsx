'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { Language } from '@/lib/locales';
import { sampleMovesMail } from '@/lib/site/notice-sample';

/** Notices to IT, kept short: one line, a language switch and the e-mail's moves. */
export function NoticeDemo() {
  const t = useTranslations('site.notice');
  const [lang, setLang] = useState<Language>(useLocale().slice(0, 2) as Language);
  const mail = sampleMovesMail(lang);

  return (
    <div className="grid items-center gap-8 md:grid-cols-2 md:gap-14">
      <div className="grid gap-4" data-reveal>
        <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          {t('title')}
        </h2>
        <p className="text-lg text-pretty text-muted-foreground">{t('lead')}</p>
        <ToggleGroup
          type="single"
          variant="outline"
          value={lang}
          onValueChange={(v) => v && setLang(v as Language)}
          aria-label={t('lang.label')}
          className="justify-self-start"
        >
          {(['de', 'fr', 'en'] as const).map((l) => (
            <ToggleGroupItem key={l} value={l} lang={l} className="px-4">
              {l.toUpperCase()}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <figure
        className="m-0 rounded-2xl border bg-card p-5 text-sm shadow-xl shadow-black/5 sm:p-6"
        data-reveal
        style={{ '--i': 1 } as React.CSSProperties}
      >
        <p className="text-muted-foreground">Seatline &lt;hello@seatline.ch&gt;</p>
        <p className="mt-1 font-medium">{mail.subject}</p>
        <ul className="mt-4 grid gap-1.5 border-t pt-4">
          {mail.lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </figure>
    </div>
  );
}
