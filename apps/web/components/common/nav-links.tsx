'use client';

import { ArrowRightLeft, ChartPie, CreditCard, History, House, Map, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { useMe } from '@/lib/queries';
import { cn } from '@/lib/utils';

/** The app's pages, by role: Home, Map, Overview, Activity (editors), People & access (admins). */
export function NavLinks({
  orientation = 'vertical',
}: {
  orientation?: 'vertical' | 'horizontal';
}) {
  const t = useTranslations();
  const pathname = usePathname();
  const me = useMe();
  const role = me.data?.role;
  if (!role) return null;
  const links = [
    { href: '/', label: t('nav.home'), icon: House },
    { href: '/map', label: t('nav.map'), icon: Map },
    ...(role !== 'viewer'
      ? [
          { href: '/moves', label: t('nav.moves'), icon: ArrowRightLeft },
          { href: '/activity', label: t('nav.activity'), icon: History },
        ]
      : []),
    ...(role === 'admin' ? [{ href: '/people', label: t('admin.link'), icon: Users }] : []),
    ...(role === 'admin' && me.data?.billing.state !== 'off'
      ? [{ href: '/billing', label: t('nav.billing'), icon: CreditCard }]
      : []),
  ];
  return (
    <nav
      aria-label={t('nav.label')}
      className={cn(
        orientation === 'vertical' ? 'grid' : 'flex gap-1 overflow-x-auto [scrollbar-width:none]',
      )}
    >
      {links.map(({ href, label, icon: Icon }) => {
        const current = href === '/' ? pathname === '/' : pathname.startsWith(href);
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
