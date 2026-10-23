'use client';

import { Undo2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { cn } from '@/lib/utils';

type Desk = { label: string; state: 'free' | 'taken' | 'reserved'; person?: string };

const START: Desk[] = [
  { label: '1.01', state: 'taken', person: 'Anna Keller' },
  { label: '1.02', state: 'free' },
  { label: '1.03', state: 'taken', person: 'Luca Rossi' },
  { label: '1.04', state: 'reserved', person: 'Marc Weber' },
  { label: '1.05', state: 'free' },
  { label: '1.06', state: 'taken', person: 'Sara Meier' },
  { label: '1.07', state: 'free' },
  { label: '1.08', state: 'taken', person: 'Jonas Frei' },
];
const WAITING = ['Chloé Martin', 'Noah Brunner', 'Lea Fischer'];
const initials = (name: string) =>
  name
    .split(' ')
    .map((p) => p[0])
    .join('');

/** The app's seat colours (app/globals.css), so the sample looks like the real map. */
const DESK = {
  free: 'border-[var(--seat-free-stroke)] bg-[var(--seat-free-fill)] text-[var(--seat-free-text)]',
  taken:
    'border-[var(--seat-taken-stroke)] bg-[var(--seat-taken-fill)] text-[var(--seat-taken-text)]',
  reserved:
    'border-[var(--seat-reserved-stroke)] bg-[var(--seat-reserved-fill)] text-[var(--seat-reserved-text)]',
};
const DOT = {
  free: 'var(--seat-free-stroke)',
  taken: 'var(--seat-taken-stroke)',
  reserved: 'var(--seat-reserved-stroke)',
};

/** A small floor the visitor can seat people on: tap a green desk, the next person gets it. */
export function LiveFloor() {
  const t = useTranslations('site.live');
  const [desks, setDesks] = useState(START);
  const [last, setLast] = useState<{ label: string; person: string } | null>(null);
  const seated = new Set(desks.map((d) => d.person));
  const waiting = WAITING.filter((p) => !seated.has(p));
  const count = (s: Desk['state']) => desks.filter((d) => d.state === s).length;

  const give = (label: string) => {
    const person = waiting[0];
    if (!person) return;
    setDesks((all) => all.map((d) => (d.label === label ? { label, state: 'taken', person } : d)));
    setLast({ label, person });
  };
  const undo = () => {
    if (!last) return;
    setDesks((all) =>
      all.map((d) => (d.label === last.label ? { label: d.label, state: 'free' } : d)),
    );
    setLast(null);
  };

  return (
    <div className="grid gap-4 rounded-2xl border bg-card p-4 text-card-foreground shadow-xl shadow-black/5 sm:p-6 md:grid-cols-[1.6fr_1fr]">
      <p className="font-medium md:col-span-2">{t('title')}</p>
      <div className="grid gap-3 rounded-xl bg-canvas p-3 sm:p-4">
        <div className="grid grid-cols-[2.2fr_1fr] gap-3">
          <div className="relative rounded-lg border border-[var(--room-stroke)] bg-[var(--room-fill)] px-3 pt-7 pb-3">
            <span className="absolute top-2 left-3 text-xs text-[var(--room-label)]">
              {t('room')}
            </span>
            <ul className="grid grid-cols-4 gap-x-2 gap-y-3" role="list">
              {desks.map((d) => {
                const free = d.state === 'free';
                return (
                  <li key={d.label}>
                    <button
                      type="button"
                      className="group grid w-full justify-items-center gap-1 disabled:cursor-default"
                      disabled={!free || !waiting.length}
                      aria-label={
                        free
                          ? t('seatFree', { label: d.label, person: waiting[0] ?? '–' })
                          : d.state === 'reserved'
                            ? t('seatReserved', { label: d.label, person: d.person! })
                            : t('seatTaken', { label: d.label, person: d.person! })
                      }
                      onClick={() => give(d.label)}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          'grid aspect-[64/40] w-full max-w-14 place-items-center rounded-md border-2 text-[11px] font-semibold transition',
                          DESK[d.state],
                          free && 'group-hover:-translate-y-0.5 group-active:scale-95',
                          d.label === last?.label && 'ld-pop',
                        )}
                      >
                        {free ? '' : d.state === 'reserved' ? 'R' : initials(d.person!)}
                      </span>
                      <span aria-hidden className="text-[11px] text-muted-foreground tabular-nums">
                        {d.label}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="relative rounded-lg border border-[var(--room-stroke)] bg-[var(--room-meeting-fill)]">
            <span className="absolute top-2 left-3 text-xs text-[var(--room-label)]">
              {t('meeting')}
            </span>
          </div>
        </div>
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground tabular-nums">
          {(['free', 'taken', 'reserved'] as const).map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span aria-hidden className="size-2 rounded-full" style={{ background: DOT[s] }} />
              {t(s, { count: count(s) })}
            </span>
          ))}
        </p>
      </div>
      <div className="grid content-start gap-2">
        <p className="text-sm font-medium text-muted-foreground">{t('waiting')}</p>
        {waiting.length ? (
          <ol className="grid gap-2">
            {waiting.map((p, i) => (
              <li
                key={p}
                className={cn(
                  'flex items-center gap-3 rounded-lg border px-3 py-2 text-sm',
                  i === 0 && 'border-primary/40 bg-primary/5',
                )}
              >
                <span
                  aria-hidden
                  className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-xs font-medium"
                >
                  {initials(p)}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">{p}</span>
                {i === waiting.length - 1 && (
                  <span className="text-xs text-muted-foreground">{t('newHire')}</span>
                )}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm">{t('everyone')}</p>
        )}
        <div aria-live="polite">
          {last && (
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-foreground px-3 py-2 text-sm text-background">
              {t('assigned', { person: last.person, desk: last.label })}
              <button
                type="button"
                onClick={undo}
                className="inline-flex items-center gap-1 font-medium underline underline-offset-4"
              >
                <Undo2 className="size-3.5" aria-hidden /> {t('undo')}
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
