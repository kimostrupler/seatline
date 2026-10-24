'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

/** The operator's two pages: the business overview and the outreach leads. */
export function OwnerNav({ current }: { current: 'overview' | 'leads' }) {
  const t = useTranslations('owner.nav');
  return (
    <nav className="-mt-4 flex gap-1 border-b text-sm" aria-label={t('overview')}>
      {(['overview', 'leads'] as const).map((page) => (
        <Link
          key={page}
          href={page === 'overview' ? '/owner' : '/owner/leads'}
          aria-current={page === current ? 'page' : undefined}
          className={cn(
            '-mb-px border-b-2 border-transparent px-3 py-2 text-muted-foreground hover:text-foreground',
            page === current && 'border-primary font-medium text-foreground',
          )}
        >
          {t(page)}
        </Link>
      ))}
    </nav>
  );
}
