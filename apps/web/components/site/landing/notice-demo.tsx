'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
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
 * The reader sets up a move plan's notices (day, address, language, people told) and sees the
 * e-mail Seatline would send, worded like the real one.
 */
export function NoticeDemo() {
  const t = useTranslations('site.notice');
  const locale = useLocale();
  const id = useId();
  const [days] = useState(nextDays);
  const [day, setDay] = useState('0');
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

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_1.1fr]">
      <div className="grid gap-5 rounded-2xl border bg-card p-5 sm:p-6">
        <div className="grid gap-2">
          <Label id={`${id}-day`}>{t('day.label')}</Label>
          <ToggleGroup
            type="single"
            variant="outline"
            value={day}
            onValueChange={(v) => v && setDay(v)}
            aria-labelledby={`${id}-day`}
            className="w-full"
          >
            {days.map((d, i) => (
              <ToggleGroupItem
                key={i}
                value={String(i)}
                className="flex-1"
                suppressHydrationWarning
              >
                {when(d)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${id}-to`}>{t('to.label')}</Label>
          <Input
            id={`${id}-to`}
            type="email"
            value={to}
            maxLength={80}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label id={`${id}-lang`}>{t('lang.label')}</Label>
          <Select value={lang} onValueChange={(v) => setLang(v as Language)}>
            <SelectTrigger aria-labelledby={`${id}-lang`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(['de', 'fr', 'en'] as const).map((l) => (
                <SelectItem key={l} value={l} lang={l}>
                  {LANGUAGE_NAMES[l]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-start justify-between gap-4">
          <div className="grid gap-1">
            <Label htmlFor={`${id}-people`}>{t('people.label')}</Label>
          </div>
          <Switch id={`${id}-people`} checked={people} onCheckedChange={setPeople} />
        </div>
      </div>

      <figure className="m-0 grid gap-3">
        <div className="rounded-2xl border bg-card p-5 text-sm shadow-xl shadow-black/5 sm:p-6">
          <div className="grid gap-0.5 border-b pb-3 text-muted-foreground">
            <span>
              <span className="font-medium text-foreground">Seatline</span>{' '}
              &lt;hello@seatline.ch&gt;
            </span>
            <span className="truncate">→ {to || '…'}</span>
            <span suppressHydrationWarning>{when(days[Number(day)]!, true)}, 06:00</span>
            <span className="mt-1 font-medium text-foreground">{mail.subject}</span>
          </div>
          <pre className="m-0 mt-3 font-sans text-[13px] leading-relaxed whitespace-pre-wrap">
            {mail.text}
          </pre>
        </div>
        {people && (
          <div className="rounded-2xl border bg-card px-5 py-3 text-sm sm:px-6">
            <span className="text-muted-foreground">→ Anna Keller · </span>
            <span className="font-medium">{desk.subject}</span>
          </div>
        )}
        <figcaption className="text-sm text-muted-foreground">{t('output')}</figcaption>
      </figure>
    </div>
  );
}
