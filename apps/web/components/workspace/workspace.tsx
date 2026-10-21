'use client';

import { Menu } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { useBuildings, useFloorMap, useFloors, useMe, usePerson } from '@/lib/queries';
import { useMediaQuery } from '@/lib/use-media-query';
import { DevLogin } from './dev-login';
import { PeopleList } from './people-list';
import { PersonPanel } from './person-panel';
import { PlacePicker } from './place-picker';
import { SeatPanel } from './seat-panel';
import { useSeatActions } from './use-seat-actions';
import { useWorkspaceParams } from './use-workspace-params';

// Konva needs the browser's canvas — never render it on the server.
const FloorMap = dynamic(() => import('@/components/map/floor-map').then((m) => m.FloorMap), {
  ssr: false,
  loading: () => <MapMessage text="" />,
});

export function Workspace() {
  const t = useTranslations();
  const [params, update] = useWorkspaceParams();
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  const me = useMe();
  const canEdit = me.data?.role === 'admin' || me.data?.role === 'editor';
  const buildings = useBuildings();
  const buildingId = params.building ?? buildings.data?.[0]?.id;
  const floors = useFloors(buildingId);
  const floorId =
    params.floor && floors.data?.some((f) => f.id === params.floor)
      ? params.floor
      : floors.data?.[0]?.id;
  const map = useFloorMap(floorId);
  const person = usePerson(params.person ?? undefined);

  // Open the first building/floor by default (replace, so Back doesn't land on an empty page).
  useEffect(() => {
    if (floorId && (params.building !== buildingId || params.floor !== floorId))
      update({ building: buildingId, floor: floorId }, 'replace');
  }, [buildingId, floorId, params.building, params.floor, update]);

  const seats = useMemo(() => map.data?.seats ?? [], [map.data]);
  const selectedSeat = seats.find((s) => s.id === params.seat);
  const personSeat = person.data?.assignments[0]?.seat;
  const actions = useSeatActions(seats);

  const sidebar = (
    <div className="flex h-full min-h-0 flex-col gap-4 p-3">
      <DevLogin />
      <PlacePicker
        buildings={buildings.data ?? []}
        floors={floors.data ?? []}
        buildingId={buildingId}
        floorId={floorId}
        onBuilding={(id) => update({ building: id, floor: null, seat: null })}
        onFloor={(id) => update({ floor: id, seat: null })}
      />
      <PeopleList
        floorId={floorId}
        selectedPersonId={params.person}
        canEdit={canEdit}
        onSelect={(id) => update({ person: id, seat: null })}
      />
    </div>
  );

  const details = selectedSeat ? (
    <SeatPanel
      key={selectedSeat.id}
      seat={selectedSeat}
      room={map.data?.rooms.find((r) => r.id === selectedSeat.roomId)}
      canEdit={canEdit}
      actions={actions}
      onClose={() => update({ seat: null })}
      onSelectPerson={(id) => update({ person: id, seat: null })}
    />
  ) : params.person ? (
    <PersonPanel
      personId={params.person}
      onClose={() => update({ person: null })}
      onShowSeat={(seat) =>
        update({ building: seat.buildingId, floor: seat.floorId, seat: seat.id })
      }
    />
  ) : (
    <EmptyDetails />
  );

  return (
    <div className="grid h-dvh grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)_340px]">
      <aside className="hidden min-h-0 border-r lg:block">{sidebar}</aside>

      <main className="flex min-h-0 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 lg:hidden"
                aria-label={t('map.openSidebar')}
              >
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 p-0">
              <SheetTitle className="sr-only">{t('map.openSidebar')}</SheetTitle>
              {sidebar}
            </SheetContent>
          </Sheet>
          <h1 className="min-w-0 truncate text-sm">
            <span className="text-muted-foreground">
              {map.data?.floor.building.name ?? t('app.name')}
            </span>
            {map.data && <span className="font-medium"> › {map.data.floor.name}</span>}
          </h1>
          {me.data?.role === 'viewer' && (
            <Badge variant="secondary">{t('devLogin.role.viewer')}</Badge>
          )}
        </header>
        <div className="relative min-h-0 flex-1">
          {map.isError ? (
            <MapMessage
              text={t('map.error')}
              action={{ label: t('map.retry'), onClick: () => map.refetch() }}
            />
          ) : !map.data ? (
            <MapMessage
              text={buildings.data?.length === 0 ? t('place.noBuildings') : t('map.loading')}
            />
          ) : map.data.seats.length === 0 ? (
            <MapMessage text={t('map.empty')} />
          ) : (
            <FloorMap
              map={map.data}
              selectedSeatId={params.seat}
              highlightSeatId={personSeat?.floorId === floorId ? (personSeat?.id ?? null) : null}
              canEdit={canEdit}
              onSelectSeat={(id) => update({ seat: id })}
              onDropPerson={(seatId, dropped) => actions.assign(seatId, dropped)}
              onMoveSeat={(fromId, toId) => {
                const moving = seats.find((s) => s.id === fromId)?.currentAssignment?.person;
                if (moving) void actions.assign(toId, moving);
              }}
            />
          )}
        </div>
      </main>

      <aside
        className="hidden min-h-0 overflow-y-auto border-l p-4 lg:block"
        aria-label={t('details.emptyTitle')}
      >
        {details}
      </aside>
      {!isDesktop && (
        <Sheet
          open={!!(selectedSeat || params.person)}
          onOpenChange={(open) => !open && update({ seat: null, person: null })}
        >
          <SheetContent side="bottom" className="max-h-[75dvh] overflow-y-auto p-4">
            <SheetTitle className="sr-only">{t('details.emptyTitle')}</SheetTitle>
            {details}
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}

function EmptyDetails() {
  const t = useTranslations('details');
  return (
    <div className="grid gap-1 pt-8 text-center">
      <p className="font-medium">{t('emptyTitle')}</p>
      <p className="text-sm text-balance text-muted-foreground">{t('emptyBody')}</p>
    </div>
  );
}

function MapMessage({
  text,
  action,
}: {
  text: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-canvas p-6 text-center">
      {text ? (
        <p className="text-sm text-muted-foreground">{text}</p>
      ) : (
        <Skeleton className="h-40 w-64" />
      )}
      {action && (
        <Button variant="outline" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
