'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

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
    <div className="ld-live">
      <p className="ld-live__title">{t('title')}</p>
      <div className="ld-floor">
        <div className="ld-room">
          <span className="ld-room__name">{t('room')}</span>
          <ul className="ld-desks" role="list">
            {desks.map((d) => {
              const free = d.state === 'free';
              return (
                <li key={d.label}>
                  <button
                    type="button"
                    className="ld-desk"
                    data-state={d.state}
                    data-new={d.person === last?.person && d.label === last?.label}
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
                    <span className="ld-desk__top" aria-hidden>
                      {free ? '' : d.state === 'reserved' ? 'R' : initials(d.person!)}
                    </span>
                    <span className="ld-desk__label" aria-hidden>
                      {d.label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="ld-room">
          <span className="ld-room__name">{t('meeting')}</span>
        </div>
        <p className="ld-floor__legend">
          <span style={{ '--dot': '#16a34a' } as React.CSSProperties}>
            {t('free', { count: count('free') })}
          </span>
          <span style={{ '--dot': '#71717a' } as React.CSSProperties}>
            {t('taken', { count: count('taken') })}
          </span>
          <span style={{ '--dot': '#d97706' } as React.CSSProperties}>
            {t('reserved', { count: count('reserved') })}
          </span>
        </p>
      </div>
      <div className="ld-queue">
        <h3>{t('waiting')}</h3>
        {waiting.length ? (
          <ol>
            {waiting.map((p, i) => (
              <li key={p}>
                {p}
                {i === waiting.length - 1 && <> · {t('newHire')}</>}
              </li>
            ))}
          </ol>
        ) : (
          <p>{t('everyone')}</p>
        )}
        <div aria-live="polite">
          {last && (
            <p className="ld-queue__done">
              {t('assigned', { person: last.person, desk: last.label })}
              <button type="button" onClick={undo}>
                {t('undo')}
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
