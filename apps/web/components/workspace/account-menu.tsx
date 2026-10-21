'use client';

import { ChartPie, ChevronsUpDown, History, LogOut, Users } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuthMode } from '@/lib/auth-mode';
import { useMe } from '@/lib/queries';
import { DevLogin } from './dev-login';

/** Top of the sidebar: who you are, and links to the other pages (by role). */
export function AccountMenu() {
  const mode = useAuthMode();
  const t = useTranslations();
  const me = useMe();
  const isAdmin = me.data?.role === 'admin';
  const canEdit = isAdmin || me.data?.role === 'editor';

  return (
    <div className="grid gap-1">
      {mode === 'dev' ? (
        <DevLogin />
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-auto w-full justify-between px-2 py-1.5 text-left"
              data-testid="account-menu"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">
                  {me.data?.tenant.name ?? '…'}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {me.data
                    ? `${me.data.person.displayName} · ${t(`devLogin.role.${me.data.role}`)}`
                    : ''}
                </span>
              </span>
              <ChevronsUpDown className="text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel className="truncate font-normal text-muted-foreground">
              {me.data?.person.email}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <form action="/auth/logout" method="post">
              <DropdownMenuItem asChild>
                <button type="submit" className="w-full">
                  <LogOut /> {t('auth.signOut')}
                </button>
              </DropdownMenuItem>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <nav aria-label={t('nav.label')} className="grid">
        {me.data && (
          <NavLink href="/overview" icon={<ChartPie />}>
            {t('nav.overview')}
          </NavLink>
        )}
        {canEdit && (
          <NavLink href="/activity" icon={<History />}>
            {t('nav.activity')}
          </NavLink>
        )}
        {isAdmin && (
          <NavLink href="/people" icon={<Users />}>
            {t('admin.link')}
          </NavLink>
        )}
      </nav>
    </div>
  );
}

function NavLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Button asChild variant="ghost" size="sm" className="justify-start text-muted-foreground">
      <Link href={href}>
        {icon} {children}
      </Link>
    </Button>
  );
}
