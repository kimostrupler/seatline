'use client';

import { FileText, LogOut, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
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
import type { Language } from '@/lib/locales';
import { useMe } from '@/lib/queries';
import { updatesPath } from '@/lib/updates/path';
import { DevLogin } from './dev-login';
import { WhoAmI } from './who-am-i';

/** Who you are (company, name, role) with sign-out and the legal pages; in the top bar. */
export function AccountMenu() {
  const mode = useAuthMode();
  const t = useTranslations();
  const me = useMe();
  const language = useLocale().slice(0, 2) as Language;

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
            <DropdownMenuItem asChild>
              <Link href={updatesPath(language)} target="_blank" rel="noopener">
                <Sparkles /> {t('nav.updates')}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
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
