'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Building2, Check, FileSpreadsheet, Map as MapIcon, UserPlus, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import {
  FLOOR_TEMPLATES,
  templateChanges,
  templateDesks,
  type FloorTemplate,
} from '@/lib/editor/templates';
import { templatePath } from '@/lib/help/template';
import type { Language } from '@/lib/locales';
import { seatSize } from '@/lib/map-geometry';
import { useBuildings, useTenant } from '@/lib/queries';
import type { Building, Floor, FloorMap } from '@/lib/types';
import { cn } from '@/lib/utils';

type Size = FloorTemplate | 'empty';
const SIZES: Size[] = [...FLOOR_TEMPLATES, 'empty'];

/**
 * Right after sign-up: two short steps instead of an empty app. 1) building, floor and an example
 * office (built with the same templates as the editor, as one undoable batch); 2) how people get
 * in. Workspaces that already have a building go straight to the map.
 */
export function SetupWizard() {
  const t = useTranslations('setup');
  const tt = useTranslations('editor.templates');
  const language = useLocale().slice(0, 2) as Language;
  const router = useRouter();
  const qc = useQueryClient();
  const tenant = useTenant().data;
  const buildings = useBuildings();
  const [step, setStep] = useState<1 | 2>(1);
  const [building, setBuilding] = useState('');
  const [floorName, setFloorName] = useState(t('floorDefault'));
  const [size, setSize] = useState<Size>('medium');
  const [busy, setBusy] = useState(false);
  const [floorId, setFloorId] = useState<string | null>(null);

  // a workspace that is already set up has nothing to do here (not the building made just now)
  const alreadySetUp = step === 1 && !busy && !floorId && !!buildings.data?.length;
  useEffect(() => {
    if (alreadySetUp) router.replace('/map');
  }, [alreadySetUp, router]);
  useEffect(() => {
    if (tenant && !building) setBuilding(tenant.name);
  }, [tenant, building]);

  const create = async () => {
    setBusy(true);
    try {
      const b = await api<Building>('/buildings', {
        method: 'POST',
        body: { name: building.trim() },
      });
      const f = await api<Floor>('/floors', {
        method: 'POST',
        body: { buildingId: b.id, name: floorName.trim(), level: 0 },
      });
      if (size !== 'empty') {
        const map = await api<FloorMap>(`/floors/${f.id}/map`);
        const changes = templateChanges(size, {
          doc: { rooms: [], seats: [], markers: [] },
          level: map.floor.level,
          numbering: map.floor.seatNumbering,
          size: seatSize(map.floor),
          names: {
            openSpace: (n) => tt('openSpace', { letter: String.fromCharCode(64 + n) }),
            meeting: (n) => tt('meeting', { n }),
            office: (n) => tt('office', { n }),
            common: tt('common'),
          },
        });
        await api(`/floors/${f.id}/layout`, { method: 'PATCH', body: changes });
      }
      setFloorId(f.id);
      setStep(2);
      await qc.invalidateQueries();
    } catch (error) {
      toast.error(t('failed', { message: error instanceof Error ? error.message : String(error) }));
    } finally {
      setBusy(false);
    }
  };

  if (buildings.isPending || alreadySetUp) return null;
  const mapHref = floorId ? `/map?floor=${floorId}` : '/map';
  const microsoft = !!tenant?.entraTenantId;

  return (
    <div className="grid gap-5" data-testid="setup-wizard">
      <ol
        className="flex items-center gap-2 text-xs text-muted-foreground"
        aria-label={t('progress')}
      >
        {([1, 2] as const).map((n) => (
          <li
            key={n}
            aria-current={n === step ? 'step' : undefined}
            className={cn(
              'flex items-center gap-1.5 rounded-full border px-2.5 py-1',
              n === step && 'border-primary text-foreground',
            )}
          >
            {n < step ? <Check className="size-3.5 text-primary" aria-hidden /> : n}
            <span>{t(`step${n}`)}</span>
          </li>
        ))}
      </ol>

      {step === 1 ? (
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
        >
          <div className="grid gap-1">
            <h1 className="text-xl font-semibold">{t('officeTitle')}</h1>
            <p className="text-sm text-muted-foreground">{t('officeBody')}</p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="setup-building">{t('building')}</Label>
            <Input
              id="setup-building"
              value={building}
              onChange={(e) => setBuilding(e.target.value)}
              maxLength={200}
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="setup-floor">{t('floor')}</Label>
            <Input
              id="setup-floor"
              value={floorName}
              onChange={(e) => setFloorName(e.target.value)}
              maxLength={200}
              required
            />
          </div>
          <fieldset className="grid gap-2">
            <legend className="mb-1.5 text-sm font-medium">{t('size')}</legend>
            <div className="grid grid-cols-2 gap-2">
              {SIZES.map((s) => (
                <label
                  key={s}
                  className={cn(
                    'grid cursor-pointer gap-0.5 rounded-lg border p-3 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
                    size === s && 'border-primary bg-primary/5',
                  )}
                >
                  <input
                    type="radio"
                    name="size"
                    value={s}
                    checked={size === s}
                    onChange={() => setSize(s)}
                    className="sr-only"
                  />
                  <span className="font-medium">{s === 'empty' ? t('empty') : tt(s)}</span>
                  <span className="text-xs text-muted-foreground">
                    {s === 'empty' ? t('emptyHint') : tt('desks', { count: templateDesks(s) })}
                  </span>
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{t('sizeHint')}</p>
          </fieldset>
          <Button
            type="submit"
            disabled={busy || building.trim().length < 1 || floorName.trim().length < 1}
          >
            <Building2 aria-hidden /> {busy ? t('creating') : t('create')}
          </Button>
        </form>
      ) : (
        <div className="grid gap-4">
          <div className="grid gap-1">
            <h1 className="text-xl font-semibold">{t('peopleTitle')}</h1>
            <p className="text-sm text-muted-foreground">
              {microsoft ? t('peopleBodyMicrosoft') : t('peopleBody')}
            </p>
          </div>
          <div className="grid gap-2">
            {microsoft ? (
              <Choice
                href="/people?tab=settings"
                icon={Users}
                title={t('microsoft')}
                hint={t('microsoftHint')}
              />
            ) : (
              <>
                <Choice
                  href="/people?import=1"
                  icon={FileSpreadsheet}
                  title={t('import')}
                  hint={t('importHint')}
                />
                <Choice href="/people" icon={UserPlus} title={t('byHand')} hint={t('byHandHint')} />
              </>
            )}
          </div>
          {!microsoft && (
            <p className="text-xs text-muted-foreground">
              {t.rich('template', {
                link: (chunks) => (
                  <a
                    href={templatePath(language)}
                    target="_blank"
                    rel="noopener"
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    {chunks}
                  </a>
                ),
              })}
            </p>
          )}
          <Button asChild variant="outline">
            <Link href={mapHref}>
              <MapIcon aria-hidden /> {t('later')}
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}

function Choice({
  href,
  icon: Icon,
  title,
  hint,
}: {
  href: string;
  icon: typeof Users;
  title: string;
  hint: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:border-primary/50 hover:bg-primary/5"
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="grid gap-0.5 text-sm">
        <span className="font-medium">{title}</span>
        <span className="text-muted-foreground">{hint}</span>
      </span>
    </Link>
  );
}
