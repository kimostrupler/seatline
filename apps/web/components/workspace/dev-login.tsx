'use client';

import { DEMO_TENANTS } from '@seatline/shared';
import { Check, ChevronsUpDown } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useIdentity } from '@/lib/identity';
import { useMe } from '@/lib/queries';

/** Company + user switcher for local development. Replaced by Microsoft sign-in (Phase 4). */
export function DevLogin() {
  const t = useTranslations('devLogin');
  const { identity, setIdentity } = useIdentity();
  const me = useMe();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className="h-auto w-full justify-between px-2 py-1.5 text-left"
          data-testid="dev-login"
        >
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">
              {me.data?.tenant.name ?? '…'}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {me.data
                ? `${me.data.person.displayName} · ${t(`role.${me.data.role}`)}`
                : t('label')}
            </span>
          </span>
          <ChevronsUpDown className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-1">
        <p className="px-2 pt-1.5 pb-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{t('label')}.</span> {t('hint')}
        </p>
        {DEMO_TENANTS.map((tenant) => (
          <div key={tenant.id} className="py-1">
            <p className="px-2 py-1 text-xs font-medium text-muted-foreground">{tenant.name}</p>
            {tenant.users.map((user) => {
              const active = identity.tenantId === tenant.id && identity.userId === user.id;
              return (
                <button
                  key={user.id}
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                  onClick={() => {
                    setOpen(false);
                    if (active) return;
                    setIdentity({ tenantId: tenant.id, userId: user.id });
                    router.replace(pathname); // the old selection belongs to the other company
                  }}
                >
                  <Check className={active ? 'size-4' : 'invisible size-4'} />
                  <span className="flex-1 truncate text-left">{user.displayName}</span>
                  <span className="text-xs text-muted-foreground">{t(`role.${user.role}`)}</span>
                </button>
              );
            })}
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
}
