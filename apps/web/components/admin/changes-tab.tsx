'use client';

import { APP_ROLES, type AppRole } from '@seatline/shared';
import { Mail, Save } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useDeferredValue, useId, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useApplyChanges, useDirectory, useTenant, type PersonChange } from '@/lib/queries';
import type { DirectoryPerson } from '@/lib/types';
import { cn } from '@/lib/utils';
import { teamNames } from './people-tab';

const NONE = 'none';
const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Zurich' });

type Draft = Omit<PersonChange, 'personId'>;

/**
 * HR: change several people at once like in a spreadsheet — team, role, leaving date — and
 * save it together. IT / facility get one notice e-mail (Settings → Notices).
 */
export function ChangesTab({ onSettings }: { onSettings: () => void }) {
  const t = useTranslations('admin.changes');
  const tRole = useTranslations('devLogin.role');
  const tenant = useTenant().data;
  const directory = useDirectory();
  const apply = useApplyChanges();
  const listId = useId();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [search, setSearch] = useState('');
  const q = useDeferredValue(search.trim().toLowerCase());
  if (!directory.data) return <Skeleton className="h-60" />;
  const people = directory.data.filter((p) => p.active && !p.forgottenAt);
  const teams = teamNames(people);
  const shown = people.filter(
    (p) => !q || `${p.displayName} ${p.department ?? ''}`.toLowerCase().includes(q),
  );

  const current = (p: DirectoryPerson): Required<Draft> => ({
    department: p.department,
    appRole: p.appRole,
    leavesOn: p.leavesOn ? p.leavesOn.slice(0, 10) : null,
  });
  const value = <K extends keyof Draft>(p: DirectoryPerson, key: K) =>
    (drafts[p.id] && key in drafts[p.id]!
      ? drafts[p.id]![key]
      : current(p)[key]) as Required<Draft>[K];
  const set = <K extends keyof Draft>(p: DirectoryPerson, key: K, v: Required<Draft>[K]) =>
    setDrafts((d) => {
      const next = { ...d[p.id], [key]: v };
      if (v === current(p)[key]) delete next[key];
      const copy = { ...d };
      if (Object.keys(next).length) copy[p.id] = next;
      else delete copy[p.id];
      return copy;
    });
  const changed = Object.keys(drafts).length;
  const save = () =>
    apply.mutateAsync(Object.entries(drafts).map(([personId, d]) => ({ personId, ...d }))).then(
      () => {
        toast.success(
          tenant?.notifyEmails.length
            ? t('savedNotified', { count: changed })
            : t('saved', { count: changed }),
        );
        setDrafts({});
      },
      (error: unknown) => toast.error(errorText(error)),
    );

  return (
    <div className="grid gap-4">
      <div className="grid gap-1">
        <p className="text-sm text-muted-foreground">{t('intro')}</p>
        <p className="flex flex-wrap items-center gap-1.5 text-sm">
          <Mail className="size-4 text-muted-foreground" aria-hidden />
          {tenant?.notifyEmails.length
            ? t('notifies', { emails: tenant.notifyEmails.join(', ') })
            : t('notifiesNobody')}
          <Button variant="link" size="sm" className="h-auto p-0" onClick={onSettings}>
            {t('change')}
          </Button>
        </p>
      </div>
      <Input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t('search')}
        aria-label={t('search')}
        className="sm:max-w-80"
      />
      <datalist id={listId}>
        {teams.map((team) => (
          <option key={team} value={team} />
        ))}
      </datalist>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[40rem] text-sm" data-testid="changes-table">
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">{t('person')}</th>
              <th className="px-2 py-2 font-medium">{t('team')}</th>
              <th className="px-2 py-2 font-medium">{t('role')}</th>
              <th className="px-2 py-2 pr-4 font-medium">{t('leavesOn')}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {shown.map((p) => {
              const dirty = !!drafts[p.id];
              return (
                <tr key={p.id} className={cn(dirty && 'bg-primary/5')}>
                  <td className="px-4 py-2">
                    <span className="flex items-center gap-2 font-medium">
                      {dirty && (
                        <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-primary" />
                      )}
                      {p.displayName}
                    </span>
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      list={listId}
                      value={value(p, 'department') ?? ''}
                      onChange={(e) =>
                        set(p, 'department', e.target.value.trim() ? e.target.value : null)
                      }
                      placeholder={t('noTeam')}
                      aria-label={t('teamOf', { name: p.displayName })}
                      maxLength={100}
                      className="h-8"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <select
                      value={value(p, 'appRole') ?? NONE}
                      onChange={(e) =>
                        set(
                          p,
                          'appRole',
                          e.target.value === NONE ? null : (e.target.value as AppRole),
                        )
                      }
                      aria-label={t('roleOf', { name: p.displayName })}
                      className="h-8 w-full rounded-md border bg-background px-2 text-sm"
                    >
                      {APP_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {tRole(role)}
                        </option>
                      ))}
                      <option value={NONE}>{t('noRole')}</option>
                    </select>
                  </td>
                  <td className="px-2 py-1.5 pr-4">
                    <Input
                      type="date"
                      value={value(p, 'leavesOn') ?? ''}
                      min={today()}
                      onChange={(e) => set(p, 'leavesOn', e.target.value || null)}
                      aria-label={t('leavesOnOf', { name: p.displayName })}
                      className="h-8"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">{t('leavingHint')}</p>
      {changed > 0 && (
        <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background/95 px-4 py-3 shadow-lg backdrop-blur">
          <p className="text-sm font-medium">{t('pending', { count: changed })}</p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setDrafts({})}>
              {t('discard')}
            </Button>
            <Button onClick={() => void save()} disabled={apply.isPending}>
              <Save /> {t('save')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
