'use client';

import { Globe } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LANGUAGE_COOKIE, LANGUAGE_NAMES, LANGUAGES, type Language } from '@/lib/locales';

/** Deutsch / Français / English — remembered in a cookie for a year. */
export function LanguageSelect({ compact }: { compact?: boolean }) {
  const t = useTranslations('nav');
  const router = useRouter();
  const current = useLocale().slice(0, 2) as Language;
  return (
    <Select
      value={current}
      onValueChange={(language) => {
        document.cookie = `${LANGUAGE_COOKIE}=${language}; path=/; max-age=31536000; samesite=lax`;
        router.refresh();
      }}
    >
      <SelectTrigger
        size="sm"
        aria-label={t('language')}
        className={compact ? 'w-auto gap-1 border-none px-2 shadow-none' : 'w-full'}
      >
        <Globe className="text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {LANGUAGES.map((l) => (
          <SelectItem key={l} value={l} lang={l}>
            {compact ? l.toUpperCase() : LANGUAGE_NAMES[l]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
