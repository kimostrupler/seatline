'use client';

import { ArrowLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

/** Back to the landing page (seatline.ch) from the sign-in and sign-up pages. */
export function BackToWebsite({ href }: { href: string }) {
  const t = useTranslations('auth');
  return (
    <Button asChild variant="ghost" size="sm">
      <a href={href}>
        <ArrowLeft /> {t('backToWebsite')}
      </a>
    </Button>
  );
}
