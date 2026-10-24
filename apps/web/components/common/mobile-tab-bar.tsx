'use client';

import { CircleHelp, Ellipsis } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { helpPath, helpTopicFor } from '@/lib/help';
import type { Language } from '@/lib/locales';
import { cn } from '@/lib/utils';
import { isCurrent, useNavLinks } from './nav-links';

/** Up to four pages sit in the bar; the rest (and Help) go into "More". */
const MAIN = ['/', '/map', '/moves', '/people'];

const item =
  'flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-full px-1 py-1.5 text-[11px] font-medium transition active:scale-95';

/**
 * Phones only: the pages as a floating "liquid glass" bar at the bottom, in thumb reach. The top
 * bar keeps only the logo, language and account there. Pages leave room for it (`pb-tab-bar`).
 */
export function MobileTabBar() {
  const t = useTranslations('nav');
  const short: Record<string, string> = { '/people': t('people') };
  const pathname = usePathname();
  const search = useSearchParams();
  const language = useLocale().slice(0, 2) as Language;
  const links = useNavLinks();
  if (!links.length) return null;
  const main = links.filter((l) => MAIN.includes(l.href));
  const more = links.filter((l) => !MAIN.includes(l.href));
  const moreCurrent = more.some((l) => isCurrent(l.href, pathname));

  return (
    <nav
      aria-label={t('label')}
      data-testid="tab-bar"
      className="glass fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 flex items-stretch gap-1 rounded-full p-1.5 md:hidden"
    >
      {main.map(({ href, label: long, icon: Icon }) => {
        const label = short[href] ?? long;
        const current = isCurrent(href, pathname);
        return (
          <Link
            key={href}
            href={href}
            aria-current={current ? 'page' : undefined}
            className={cn(
              item,
              current ? 'bg-primary/12 text-primary' : 'text-foreground/70 hover:text-foreground',
            )}
          >
            <Icon className="size-5" aria-hidden />
            <span className="max-w-full truncate">{label}</span>
          </Link>
        );
      })}
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            item,
            moreCurrent ? 'bg-primary/12 text-primary' : 'text-foreground/70 hover:text-foreground',
          )}
        >
          <Ellipsis className="size-5" aria-hidden />
          <span>{t('more')}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="top"
          align="end"
          sideOffset={12}
          className="glass w-56 rounded-2xl p-1.5"
        >
          {more.map(({ href, label, icon: Icon }) => (
            <DropdownMenuItem key={href} asChild className="rounded-xl py-2.5">
              <Link href={href} aria-current={isCurrent(href, pathname) ? 'page' : undefined}>
                <Icon /> {label}
              </Link>
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem asChild className="rounded-xl py-2.5">
            <Link
              href={helpPath(language, helpTopicFor(pathname, search))}
              target="_blank"
              rel="noopener"
            >
              <CircleHelp /> {t('help')}
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  );
}
