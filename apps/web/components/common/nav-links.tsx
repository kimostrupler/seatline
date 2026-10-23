'use client';

import {
  ArrowRightLeft,
  ChartPie,
  CreditCard,
  History,
  House,
  type LucideIcon,
  Map,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { useMe } from '@/lib/queries';
import { cn } from '@/lib/utils';

export interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** The app's pages, by role: Home, Map, Moves/Planning/Activity (editors), People, Billing (admins). */
export function useNavLinks(): NavLink[] {
  const t = useTranslations();
  const me = useMe();
  const role = me.data?.role;
  if (!role) return [];
  return [
    { href: '/', label: t('nav.home'), icon: House },
    { href: '/map', label: t('nav.map'), icon: Map },
    ...(role !== 'viewer'
      ? [
          { href: '/moves', label: t('nav.moves'), icon: ArrowRightLeft },
          { href: '/planning', label: t('nav.planning'), icon: ChartPie },
          { href: '/activity', label: t('nav.activity'), icon: History },
        ]
      : []),
    ...(role === 'admin' ? [{ href: '/people', label: t('admin.link'), icon: Users }] : []),
    ...(role === 'admin' && me.data?.billing.state !== 'off'
      ? [{ href: '/billing', label: t('nav.billing'), icon: CreditCard }]
      : []),
  ];
}

export const isCurrent = (href: string, pathname: string) =>
  href === '/' ? pathname === '/' : pathname.startsWith(href);

export function NavLinks({
  orientation = 'vertical',
}: {
  orientation?: 'vertical' | 'horizontal';
}) {
  const t = useTranslations();
  const pathname = usePathname();
  const links = useNavLinks();
  if (!links.length) return null;
  return (
    <nav
      aria-label={t('nav.label')}
      className={cn(
        orientation === 'vertical' ? 'grid' : 'flex gap-1 overflow-x-auto [scrollbar-width:none]',
      )}
    >
      {links.map(({ href, label, icon: Icon }) => {
        const current = isCurrent(href, pathname);
        return (
          <Button
            key={href}
            asChild
            variant={current ? 'secondary' : 'ghost'}
            size="sm"
            className={cn('shrink-0 justify-start', !current && 'text-muted-foreground')}
          >
            <Link
              href={href}
              aria-current={current ? 'page' : undefined}
              title={orientation === 'horizontal' ? label : undefined}
            >
              <Icon />{' '}
              {/* smaller screens: icons only in the top bar (the name stays for screen readers) */}
              <span className={cn(orientation === 'horizontal' && 'max-lg:sr-only')}>{label}</span>
            </Link>
          </Button>
        );
      })}
    </nav>
  );
}
