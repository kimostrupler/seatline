'use client';

import { ClipboardList, Settings, Users, UsersRound } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { PageFrame } from '@/components/common/page-frame';
import { useMe } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { ChangesTab } from './changes-tab';
import { PeopleTab } from './people-tab';
import { SettingsTab, type ConsentBase } from './settings-tab';
import { TeamsTab } from './teams-tab';

const TABS = [
  { id: 'people', icon: Users },
  { id: 'teams', icon: UsersRound },
  { id: 'changes', icon: ClipboardList },
  { id: 'settings', icon: Settings },
] as const;
type Tab = (typeof TABS)[number]['id'];

/** Admins: People · Teams · Changes (HR) · Settings — the tab lives in the URL (?tab=). */
export function PeopleAdmin({ consentBase }: { consentBase: ConsentBase }) {
  const t = useTranslations('admin');
  const me = useMe();
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab: Tab = TABS.some((x) => x.id === search.get('tab'))
    ? (search.get('tab') as Tab)
    : 'people';
  const show = (next: Tab) => {
    const params = new URLSearchParams(search);
    if (next === 'people') params.delete('tab');
    else params.set('tab', next);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  if (me.data && me.data.role !== 'admin')
    return (
      <PageFrame title={t('title')}>
        <p className="text-sm text-muted-foreground">{t('onlyAdmins')}</p>
      </PageFrame>
    );
  return (
    <PageFrame title={t('title')} wide="medium">
      <div className="-mt-3 grid gap-6">
        <div role="tablist" aria-label={t('title')} className="flex gap-1 overflow-x-auto border-b">
          {TABS.map(({ id, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`tab-${id}`}
              aria-selected={tab === id}
              aria-controls={`panel-${id}`}
              onClick={() => show(id)}
              className={cn(
                '-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors',
                tab === id
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="size-4" aria-hidden /> {t(`tabs.${id}`)}
            </button>
          ))}
        </div>
        <div
          role="tabpanel"
          id={`panel-${tab}`}
          aria-labelledby={`tab-${tab}`}
          className="grid gap-8"
        >
          {tab === 'people' && <PeopleTab />}
          {tab === 'teams' && <TeamsTab />}
          {tab === 'changes' && <ChangesTab onSettings={() => show('settings')} />}
          {tab === 'settings' && <SettingsTab consentBase={consentBase} />}
        </div>
      </div>
    </PageFrame>
  );
}
