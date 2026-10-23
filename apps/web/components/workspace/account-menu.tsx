'use client';

import { useQuery } from '@tanstack/react-query';
import { ChartColumn, FileText, LogOut } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { api } from '@/lib/api';
import { useAuthMode } from '@/lib/auth-mode';
import { useMe } from '@/lib/queries';
import { DevLogin } from './dev-login';
import { WhoAmI } from './who-am-i';

/** Who you are (company, name, role) with sign-out and the legal pages; in the top bar. */
export function AccountMenu() {
  const mode = useAuthMode();
  const t = useTranslations();
  const me = useMe();
  const [open, setOpen] = useState(false);
  // the operator's dashboard: asked only when the menu opens; everyone else gets a 404
  const owner = useQuery({
    queryKey: ['owner-check'],
    queryFn: () => api<void>('/owner/check').then(() => true),
    enabled: open && mode !== 'dev',
    retry: false,
    staleTime: Infinity,
  });

  return (
    <div className="grid gap-1">
      {mode === 'dev' ? (
        <DevLogin />
      ) : (
        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-auto w-full justify-between px-2 py-1.5 text-left max-sm:w-auto max-sm:px-1"
              data-testid="account-menu"
            >
              <WhoAmI
                company={me.data?.tenant.name ?? '…'}
                person={me.data?.person.displayName}
                line={
                  me.data
                    ? `${me.data.person.displayName} · ${t(`devLogin.role.${me.data.role}`)}`
                    : ''
                }
              />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel className="truncate font-normal text-muted-foreground">
              {me.data?.person.email}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {owner.data && (
              <DropdownMenuItem asChild>
                <Link href="/owner">
                  <ChartColumn /> {t('nav.overview')}
                </Link>
              </DropdownMenuItem>
            )}
            {(['terms', 'privacy', 'imprint'] as const).map((doc) => (
              <DropdownMenuItem key={doc} asChild>
                <Link href={`/legal/${doc}`}>
                  <FileText /> {t(`legal.${doc}`)}
                </Link>
              </DropdownMenuItem>
            ))}
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
    </div>
  );
}
