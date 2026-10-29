'use client';

import { ArrowLeftRight, FileText, LogOut } from 'lucide-react';
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
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useMe } from '@/lib/queries';
import { DevLogin } from './dev-login';
import { WhoAmI } from './who-am-i';

/** Who you are (company, name, role) with sign-out and the legal pages; in the top bar. */
export function AccountMenu() {
  const mode = useAuthMode();
  const t = useTranslations();
  const me = useMe();
  // the other workspaces this address belongs to (e-mail sign-in), to switch between them
  const workspaces = useQuery({
    queryKey: ['me', 'workspaces'],
    queryFn: () => api<Array<{ id: string; name: string; current: boolean }>>('/me/workspaces'),
    enabled: mode === 'entra' && !!me.data,
  });
  const others = workspaces.data?.filter((w) => !w.current) ?? [];

  return (
    <div className="grid gap-1">
      {mode === 'dev' ? (
        <DevLogin />
      ) : (
        <DropdownMenu>
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
            {others.length > 0 && (
              <>
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                  {t('nav.switchWorkspace')}
                </DropdownMenuLabel>
                {others.map((w) => (
                  <form key={w.id} action="/auth/email/workspace" method="post">
                    <input type="hidden" name="tenantId" value={w.id} />
                    <DropdownMenuItem asChild>
                      <button type="submit" className="w-full">
                        <ArrowLeftRight /> <span className="truncate">{w.name}</span>
                      </button>
                    </DropdownMenuItem>
                  </form>
                ))}
                <DropdownMenuSeparator />
              </>
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
