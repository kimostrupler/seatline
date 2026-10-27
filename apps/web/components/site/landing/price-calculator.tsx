'use client';

import { monthlyPrice, PRICE_TIERS, typicalToolPrice } from '@seatline/shared/dist/pricing';
import { Minus, Plus } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

const MAX_SLIDER = 300;
const MAX_DESKS = 10_000;
const [FIRST, REST] = PRICE_TIERS as [
  { upTo: number; amount: number },
  { upTo: null; amount: number },
];

/** Follows `target` with a short ease-out, so the total counts up instead of jumping. */
function useTween(target: number, ms = 450) {
  const [shown, setShown] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      from.current = target;
      setShown(target);
      return;
    }
    const start = performance.now();
    const begin = from.current;
    let frame = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / ms);
      const value = begin + (target - begin) * (1 - (1 - p) ** 3);
      from.current = value;
      setShown(value);
      if (p < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, ms]);
  return shown;
}

/** "How many desks?" → the monthly price, split into the two tiers (landing page, under the price). */
export function PriceCalculator() {
  const t = useTranslations('site.calc');
  const format = useFormatter();
  const id = useId();
  const [desks, setDesks] = useState(30);
  const [typed, setTyped] = useState('30');

  const set = (n: number) => {
    const v = Math.max(1, Math.min(MAX_DESKS, Math.round(n) || 1));
    setDesks(v);
    setTyped(String(v));
  };
  const total = monthlyPrice(desks);
  const first = Math.min(desks, FIRST.upTo);
  const rest = desks - first;
  const firstCost = first * FIRST.amount;
  const restCost = Math.round(rest * REST.amount * 100) / 100;
  const shown = useTween(total);
  const chf = (n: number) =>
    format.number(n, { style: 'currency', currency: 'CHF', minimumFractionDigits: 2 });
  const saving = Math.round((desks * FIRST.amount - total) * 100) / 100;
  const others = typicalToolPrice(desks);
  const lessThanOthers = Math.round((others.low - total) * 100) / 100;

  return (
    <div
      className="mx-auto mt-6 grid max-w-xl gap-6 rounded-3xl border bg-card p-6 shadow-xl shadow-black/5 sm:p-8"
      data-reveal
      style={{ '--i': 1 } as React.CSSProperties}
    >
      <div className="grid gap-1 text-center">
        <h3 className="text-xl font-semibold tracking-tight">{t('title')}</h3>
        <p className="text-sm text-muted-foreground">{t('lead')}</p>
      </div>

      <div className="grid gap-3">
        <label htmlFor={`${id}-n`} className="text-sm font-medium">
          {t('desks')}
        </label>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={t('fewer')}
            onClick={() => set(desks - 1)}
            disabled={desks <= 1}
          >
            <Minus />
          </Button>
          <input
            id={`${id}-n`}
            inputMode="numeric"
            className="h-11 w-full min-w-0 rounded-md border bg-background px-3 text-center text-2xl font-semibold tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={typed}
            onChange={(e) => {
              const raw = e.target.value.replace(/\D/g, '').slice(0, 5);
              setTyped(raw);
              if (raw) set(Number(raw));
            }}
            onBlur={() => setTyped(String(desks))}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={t('more')}
            onClick={() => set(desks + 1)}
            disabled={desks >= MAX_DESKS}
          >
            <Plus />
          </Button>
        </div>
        <input
          type="range"
          min={1}
          max={MAX_SLIDER}
          value={Math.min(desks, MAX_SLIDER)}
          onChange={(e) => set(Number(e.target.value))}
          aria-label={t('desks')}
          className="w-full accent-[var(--primary)]"
        />
        {/* marks where they really are on the slider: 50 is where the cheaper price starts */}
        <div className="relative h-4 text-xs text-muted-foreground tabular-nums" aria-hidden>
          <span className="absolute left-0">1</span>
          <span
            className="absolute -translate-x-1/2 font-medium text-[var(--seat-free-stroke)]"
            style={{ left: `${((FIRST.upTo - 1) / (MAX_SLIDER - 1)) * 100}%` }}
          >
            {FIRST.upTo + 1}+
          </span>
          <span className="absolute right-0">{MAX_SLIDER}+</span>
        </div>
      </div>

      <div className="grid justify-items-center gap-1 text-center">
        <p aria-hidden className="text-5xl font-semibold tracking-tight tabular-nums sm:text-6xl">
          {chf(shown)}
        </p>
        <p className="sr-only" aria-live="polite">
          {t('total', { price: chf(total), desks })}
        </p>
        <p className="text-muted-foreground">{t('perMonth')}</p>
      </div>

      {/* the bill as one bar: the first 50 desks, then the cheaper rest */}
      <div className="grid gap-3">
        <div className="flex h-4 overflow-hidden rounded-full bg-muted" aria-hidden>
          <div
            className="h-full bg-primary transition-[width] duration-500 ease-out"
            style={{ width: `${(firstCost / total) * 100}%` }}
          />
          <div
            className="h-full bg-[var(--seat-free-stroke)] transition-[width] duration-500 ease-out"
            style={{ width: `${(restCost / total) * 100}%` }}
          />
        </div>
        <dl className="grid gap-1.5 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-primary" aria-hidden />
              {t('tier', { count: first, price: chf(FIRST.amount) })}
            </dt>
            <dd className="font-medium tabular-nums">{chf(firstCost)}</dd>
          </div>
          <div
            className={`flex items-center justify-between gap-3 transition-opacity duration-300 ${rest ? '' : 'opacity-40'}`}
          >
            <dt className="flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-[var(--seat-free-stroke)]" aria-hidden />
              {rest
                ? t('tier', { count: rest, price: chf(REST.amount) })
                : t('restHint', { from: FIRST.upTo + 1, price: chf(REST.amount) })}
            </dt>
            <dd className="font-medium tabular-nums">{chf(restCost)}</dd>
          </div>
        </dl>
      </div>

      <div className="grid grid-cols-2 gap-3 border-t pt-4 text-center text-sm">
        <div>
          <p className="font-semibold tabular-nums">{chf(total / desks)}</p>
          <p className="text-muted-foreground">{t('average')}</p>
        </div>
        <div>
          <p className="font-semibold tabular-nums">{chf(total * 12)}</p>
          <p className="text-muted-foreground">{t('perYear')}</p>
        </div>
      </div>
      {saving > 0 && (
        <p className="ld-pop justify-self-center rounded-full text-center bg-[color-mix(in_oklab,var(--seat-free-stroke)_15%,transparent)] px-3 py-1 text-sm font-medium">
          {t('saving', { price: chf(saving) })}
        </p>
      )}

      {/* typical tools' list prices for the same desks (never named): a range bar against ours */}
      <div className="grid gap-2 border-t pt-4 text-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <p className="font-medium">{t('othersTitle')}</p>
          <p className="text-muted-foreground tabular-nums">
            {t('others', { low: chf(others.low), high: chf(others.high), desks })}
          </p>
        </div>
        <div className="relative h-3 rounded-full bg-muted" aria-hidden>
          <div
            className="absolute inset-y-0 rounded-full bg-muted-foreground/35 transition-[left,width] duration-500 ease-out"
            style={{ left: `${(others.low / others.high) * 100}%`, right: 0 }}
          />
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-500 ease-out"
            style={{ width: `${(total / others.high) * 100}%` }}
          />
        </div>
        <p className="font-medium">{t('othersSaving', { price: chf(lessThanOthers) })}</p>
        <p className="text-xs text-muted-foreground">{t('othersNote')}</p>
      </div>
    </div>
  );
}
