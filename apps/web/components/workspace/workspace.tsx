'use client';

import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useBuildings, useFloorMap, useFloors, useMe, usePerson } from '@/lib/queries';
import { useMediaQuery } from '@/lib/use-media-query';
import { usePlanOpacity } from '@/lib/use-plan-opacity';
import { AccountMenu } from './account-menu';
import { ModeToggle } from './mode-toggle';
import { PeopleList } from './people-list';
import { PersonPanel } from './person-panel';
import { CreateBuildingDialog, CreateFloorDialog } from './place-dialogs';
import { PlacePicker } from './place-picker';
import { SeatPanel } from './seat-panel';
import { MapMessage, Shell } from './shell';
import { useSeatActions } from './use-seat-actions';
import { useWorkspaceParams } from './use-workspace-params';

// Konva needs the browser's canvas — never render it on the server.
const FloorMap = dynamic(() => import('@/components/map/floor-map').then((m) => m.FloorMap), {
  ssr: false,
  loading: () => <MapMessage text="" />,
});
const EditMode = dynamic(() => import('@/components/editor/edit-mode').then((m) => m.EditMode), {
  ssr: false,
  loading: () => <MapMessage text="" />,
});

export function Workspace() {
  const t = useTranslations();
  const [params, update] = useWorkspaceParams();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [planOpacity] = usePlanOpacity();
  const [dialog, setDialog] = useState<'building' | 'floor' | null>(null);

  const me = useMe();
  const canEdit = me.data?.role === 'admin' || me.data?.role === 'editor';
  // The layout editor needs a mouse or trackpad and room to work: desktop only.
  const editing = canEdit && isDesktop && params.mode === 'edit';
  const buildings = useBuildings();
  const buildingId =
    params.building && buildings.data?.some((b) => b.id === params.building)
      ? params.building
      : buildings.data?.[0]?.id;
  const building = buildings.data?.find((b) => b.id === buildingId);
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
      <AccountMenu />
      <PlacePicker
        buildings={buildings.data ?? []}
        floors={floors.data ?? []}
        buildingId={buildingId}
        floorId={floorId}
        onBuilding={(id) => update({ building: id, floor: null, seat: null })}
        onFloor={(id) => update({ floor: id, seat: null })}
        onNewBuilding={canEdit ? () => setDialog('building') : undefined}
        onNewFloor={canEdit ? () => setDialog('floor') : undefined}
      />
      <PeopleList
        floorId={floorId}
        selectedPersonId={params.person}
        canEdit={canEdit && !editing}
        onSelect={(id) => update({ person: id, seat: null, mode: null })}
      />
      <CreateBuildingDialog
        open={dialog === 'building'}
        onOpenChange={(open) => setDialog(open ? 'building' : null)}
        onCreated={(b) => update({ building: b.id, floor: null, seat: null })}
      />
      {buildingId && (
        <CreateFloorDialog
          open={dialog === 'floor'}
          onOpenChange={(open) => setDialog(open ? 'floor' : null)}
          buildingId={buildingId}
          floors={floors.data ?? []}
          onCreated={(f) => update({ floor: f.id, seat: null, mode: isDesktop ? 'edit' : null })}
        />
      )}
    </div>
  );

  const title = (
    <>
      <span className="text-muted-foreground">
        {map.data?.floor.building.name ?? t('app.name')}
      </span>
      {map.data && <span className="font-medium"> › {map.data.floor.name}</span>}
    </>
  );
  const headerEnd = (
    <>
      {me.data?.role === 'viewer' && <Badge variant="secondary">{t('devLogin.role.viewer')}</Badge>}
      {canEdit && isDesktop && map.data && (
        <ModeToggle
          editing={editing}
          onChange={(edit) => update({ mode: edit ? 'edit' : null, seat: null, person: null })}
        />
      )}
    </>
  );

  if (editing && map.data)
    return (
      <EditMode
        map={map.data}
        building={building}
        sidebar={sidebar}
        title={title}
        headerEnd={headerEnd}
        onFloorDeleted={() => update({ floor: null, seat: null })}
        onBuildingDeleted={() => update({ building: null, floor: null, seat: null, mode: null })}
      />
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

  const editLayout =
    canEdit && isDesktop
      ? { label: t('mode.edit'), onClick: () => update({ mode: 'edit' }) }
      : undefined;

  return (
    <Shell
      sidebar={sidebar}
      title={title}
      headerEnd={headerEnd}
      detailsLabel={t('details.emptyTitle')}
      details={details}
      main={
        map.isError ? (
          <MapMessage
            text={t('map.error')}
            action={{ label: t('map.retry'), onClick: () => map.refetch() }}
          />
        ) : buildings.data?.length === 0 ? (
          <MapMessage
            text={t('place.noBuildings')}
            action={
              canEdit
                ? { label: t('place.createFirstBuilding'), onClick: () => setDialog('building') }
                : undefined
            }
          />
        ) : floors.data?.length === 0 ? (
          <MapMessage
            text={t('place.noFloors')}
            action={
              canEdit
                ? { label: t('place.createFirstFloor'), onClick: () => setDialog('floor') }
                : undefined
            }
          />
        ) : !map.data ? (
          <MapMessage text={t('map.loading')} />
        ) : map.data.seats.length === 0 && !map.data.floor.planFileKey ? (
          <MapMessage text={t('map.empty')} action={editLayout} />
        ) : (
          <FloorMap
            map={map.data}
            selectedSeatId={params.seat}
            highlightSeatId={personSeat?.floorId === floorId ? (personSeat?.id ?? null) : null}
            canEdit={canEdit}
            planOpacity={planOpacity}
            onSelectSeat={(id) => update({ seat: id })}
            onDropPerson={(seatId, dropped) => actions.assign(seatId, dropped)}
            onMoveSeat={(fromId, toId) => {
              const moving = seats.find((s) => s.id === fromId)?.currentAssignment?.person;
              if (moving) void actions.assign(toId, moving);
            }}
          />
        )
      }
      mobileDetails={
        !isDesktop && (
          <Sheet
            open={!!(selectedSeat || params.person)}
            onOpenChange={(open) => !open && update({ seat: null, person: null })}
          >
            <SheetContent side="bottom" className="max-h-[75dvh] overflow-y-auto p-4">
              <SheetTitle className="sr-only">{t('details.emptyTitle')}</SheetTitle>
              {details}
            </SheetContent>
          </Sheet>
        )
      }
    />
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
