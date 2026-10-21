'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

/** A full page next to the map (People & access, Activity, Overview): back link + title. */
export function PageFrame({ title, children }: { title: string; children: ReactNode }) {
  const t = useTranslations('nav');
  return (
    <main className="mx-auto grid max-w-3xl gap-8 px-4 py-6 sm:px-6">
      <header className="grid gap-2">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="-ml-2 justify-self-start text-muted-foreground"
        >
          <Link href="/">
            <ArrowLeft /> {t('back')}
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">{title}</h1>
      </header>
      {children}
    </main>
  );
}

export function PageSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-3">
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}
