'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { LANGUAGE_NAMES, type Language } from '@/lib/locales';
import { sampleDeskMail, sampleMovesMail } from '@/lib/site/notice-sample';

/** The next Monday, Wednesday and Friday: moving days to pick from. */
function nextDays(): Date[] {
  const out: Date[] = [];
  const d = new Date();
  while (out.length < 3) {
    d.setDate(d.getDate() + 1);
    if ([1, 3, 5].includes(d.getDay())) out.push(new Date(d));
  }
  return out;
}

/**
 * The features section: the reader sets up a move plan's notices (day, address, language,
 * people told) and sees the e-mail Seatline would send, worded like the real one.
 */
export function NoticeDemo() {
  const t = useTranslations('site.notice');
  const locale = useLocale();
  const [days] = useState(nextDays);
  const [day, setDay] = useState(0);
  const [to, setTo] = useState('it@muster.ch');
  const [lang, setLang] = useState<Language>(locale.slice(0, 2) as Language);
  const [people, setPeople] = useState(true);
  const mail = sampleMovesMail(lang);
  const desk = sampleDeskMail(lang);
  const when = (d: Date, long = false) =>
    d.toLocaleDateString(locale, {
      weekday: long ? 'long' : 'short',
      day: 'numeric',
      month: long ? 'long' : 'short',
    });

  const block = (key: 'day' | 'to' | 'lang' | 'people', control: React.ReactNode, i: number) => (
    <div className="ld-block" data-reveal style={{ '--i': i } as React.CSSProperties}>
      <p className="ld-block__claim">{t(`${key}.title`)}</p>
      <p>{t(`${key}.body`)}</p>
      {control}
    </div>
  );

  return (
    <section className="ld-notice ld-field" id="notices" aria-labelledby="notices-title">
      <div className="ld-notice__stage">
        <figure className="ld-mail" style={{ margin: 0 }}>
          <div className="ld-mail__meta">
            <span>
              <b>Seatline</b> &lt;hello@seatline.ch&gt;
            </span>
            <span>→ {to || '…'}</span>
            <span suppressHydrationWarning>{when(days[day]!, true)}, 06:00</span>
            <b>{mail.subject}</b>
          </div>
          <pre className="ld-mail__body">{mail.text}</pre>
          {people && (
            <div
              className="ld-mail__meta"
              style={{ marginTop: 16, borderBottom: 0, paddingBottom: 0 }}
            >
              <span>→ Anna Keller</span>
              <b>{desk.subject}</b>
            </div>
          )}
          <figcaption className="ld-mail__caption">{t('output')}</figcaption>
        </figure>
      </div>
      <div className="ld-notice__read">
        <h2 id="notices-title" className="ld-head">
          {t('title')}
        </h2>
        {block(
          'day',
          <div className="ld-seg" role="group" aria-label={t('day.label')}>
            {days.map((d, i) => (
              <button
                key={i}
                type="button"
                aria-pressed={i === day}
                onClick={() => setDay(i)}
                suppressHydrationWarning
              >
                {when(d)}
              </button>
            ))}
          </div>,
          0,
        )}
        {block(
          'to',
          <label className="grid gap-2">
            <span className="ld-label">{t('to.label')}</span>
            <input
              className="ld-input"
              type="email"
              value={to}
              maxLength={80}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>,
          1,
        )}
        {block(
          'lang',
          <div className="ld-seg" role="group" aria-label={t('lang.label')}>
            {(['de', 'fr', 'en'] as const).map((l) => (
              <button
                key={l}
                type="button"
                lang={l}
                aria-pressed={l === lang}
                onClick={() => setLang(l)}
              >
                {LANGUAGE_NAMES[l]}
              </button>
            ))}
          </div>,
          2,
        )}
        {block(
          'people',
          <button
            type="button"
            role="switch"
            className="ld-switch"
            aria-checked={people}
            onClick={() => setPeople((p) => !p)}
          >
            <span className="ld-switch__knob" aria-hidden />
            {t('people.label')}
          </button>,
          3,
        )}
      </div>
    </section>
  );
}
