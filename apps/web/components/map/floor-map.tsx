'use client';

import type Konva from 'konva';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { Group, Layer, Rect, Stage } from 'react-konva';
import { contentBounds, seatAt, seatSize, toPlan } from '@/lib/map-geometry';
import type { SeatFeature } from '@seatline/shared';
import type { FloorMap as FloorMapData, Room, Seat } from '@/lib/types';
import { DeskFinder } from './desk-finder';
import { MarkerOverlay } from './markers';
import { withAlpha } from '@/lib/team-colors';
import type { ColorBy } from '@/lib/use-map-colors-mode';
import { MapLegend, teamsOnFloor } from './map-legend';
import {
  PlanBackground,
  RoomShape,
  SeatDesk,
  SeatLabel,
  SeatText,
  seatContent,
  setCursor,
  useMapColors,
  usePlanImage,
  type Colors,
  type SeatLook,
} from './shapes';
import { useViewport, ZoomControls } from './viewport';
import { SeatSizeContext } from './seat-size';

const NO_TEAMS = new Map<string, number>();

/** MIME type used when a person is dragged from the people list. */
export const PERSON_DRAG_TYPE = 'application/x-seatline-person';

export interface FloorMapProps {
  map: FloorMapData;
  selectedSeatId: string | null;
  /** e.g. the seat of the person selected in the list */
  highlightSeatId: string | null;
  /** seats to point out, e.g. the ones a move plan changes */
  markedSeatIds?: ReadonlySet<string>;
  canEdit: boolean;
  planOpacity: number;
  onSelectSeat: (seatId: string | null) => void;
  onDropPerson: (seatId: string, person: { id: string; displayName: string }) => void;
  onMoveSeat: (fromSeatId: string, toSeatId: string) => void;
  /** colour seats by status (default) or by the sitting person's department */
  colorBy?: ColorBy;
  onColorBy?: (c: ColorBy) => void;
  /** department → team colour slot (1–4) */
  teamSlots?: Map<string, number>;
}

export function FloorMap({
  map,
  selectedSeatId,
  highlightSeatId,
  markedSeatIds,
  canEdit,
  planOpacity,
  onSelectSeat,
  onDropPerson,
  onMoveSeat,
  colorBy = 'status',
  onColorBy = () => {},
  teamSlots = NO_TEAMS,
}: FloorMapProps) {
  const t = useTranslations('map');
  const ts = useTranslations('status');
  const colors = useMapColors();
  const plan = usePlanImage(map.floor);
  const size = useMemo(() => seatSize(map.floor), [map.floor]);
  const bounds = useMemo(
    () =>
      contentBounds(
        map.rooms,
        map.seats,
        map.floor.planFileKey && map.floor.planWidth && map.floor.planHeight
          ? { width: map.floor.planWidth, height: map.floor.planHeight }
          : null,
        size,
      ),
    [map.rooms, map.seats, map.floor, size],
  );
  const vp = useViewport(bounds, map.floor.id);
  const { view } = vp;
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [draggingSeatId, setDraggingSeatId] = useState<string | null>(null);
  const [focusedSeatId, setFocusedSeatId] = useState<string | null>(null);
  const [focusTeam, setFocusTeam] = useState<string | null>(null);
  const teams = useMemo(() => teamsOnFloor(map.seats, teamSlots), [map.seats, teamSlots]);
  const byTeam = colorBy === 'team';
  // the department of whoever sits here ('' = none), null for free/reserved/blocked seats
  const teamOf = (seat: Seat) =>
    seat.occupancy === 'taken' ? (seat.currentAssignment?.person?.department ?? '') : null;
  const lookOf = (seat: Seat, c: Colors): SeatLook | undefined => {
    if (!byTeam) return undefined;
    const team = teamOf(seat);
    if (team === null)
      return {
        fill: c['seat-blocked-fill'],
        stroke: c['room-stroke'],
        text: c['seat-blocked-text'],
      };
    const slot = teamSlots.get(team);
    if (!slot)
      return {
        fill: c['seat-taken-fill'],
        stroke: c['seat-taken-stroke'],
        text: c['seat-taken-text'],
      };
    const color = c[`team-${slot}` as `team-${1 | 2 | 3 | 4}`];
    return { fill: withAlpha(color, 0.22), stroke: color, text: c['seat-taken-text'] };
  };
  const dimmed = (seat: Seat) => byTeam && focusTeam !== null && teamOf(seat) !== focusTeam;
  const tm = useTranslations('inspector');
  // "find a free desk with…": free, active desks that have every wanted feature
  const [wanted, setWanted] = useState<SeatFeature[]>([]);
  const found = useMemo(
    () =>
      wanted.length
        ? new Set(
            map.seats
              .filter(
                (s) =>
                  s.occupancy === 'free' && wanted.every((f) => (s.features ?? []).includes(f)),
              )
              .map((s) => s.id),
          )
        : null,
    [map.seats, wanted],
  );
  const zoneColor = (room: Room, c: Colors) => {
    const slot = room.team ? teamSlots.get(room.team) : undefined;
    return room.team ? (slot ? c[`team-${slot}` as keyof Colors] : c['room-stroke']) : undefined;
  };
  const roomCaption = (room: Room) =>
    room.type === 'meeting' && room.capacity
      ? t('capacity', { count: room.capacity })
      : room.team
        ? t('zone', { team: room.team })
        : undefined;

  // far zoomed out (e.g. a phone showing the whole floor) seat numbers would overlap
  const showLabels = view.scale >= 0.45;

  // ---- drop a person from the people list (HTML drag and drop) --------------
  const seatUnderClient = (clientX: number, clientY: number): Seat | undefined => {
    const rect = vp.containerRef.current?.getBoundingClientRect();
    if (!rect) return undefined;
    return seatAt(map.seats, toPlan(view, { x: clientX - rect.left, y: clientY - rect.top }), size);
  };
  const accepts = (seat: Seat | undefined) =>
    !!seat && seat.status === 'active' && seat.occupancy !== 'taken';

  const onDragOver = (e: React.DragEvent) => {
    if (!canEdit || !e.dataTransfer.types.includes(PERSON_DRAG_TYPE)) return;
    const seat = seatUnderClient(e.clientX, e.clientY);
    if (accepts(seat)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    }
    setDropTargetId(accepts(seat) ? seat!.id : null);
  };
  const onDrop = (e: React.DragEvent) => {
    const personId = e.dataTransfer.getData(PERSON_DRAG_TYPE);
    const seat = seatUnderClient(e.clientX, e.clientY);
    setDropTargetId(null);
    if (personId && accepts(seat)) {
      e.preventDefault();
      onDropPerson(seat!.id, { id: personId, displayName: e.dataTransfer.getData('text/plain') });
    }
  };

  // ---- drag someone from one seat to another (inside the canvas) ------------
  const pointerSeat = (): Seat | undefined => {
    const pointer = vp.stageRef.current?.getPointerPosition();
    return pointer ? seatAt(map.seats, toPlan(view, pointer), size) : undefined;
  };
  const onTokenDragMove = (from: Seat) => {
    const target = pointerSeat();
    setDropTargetId(target && target.id !== from.id && accepts(target) ? target.id : null);
  };
  const onTokenDragEnd = (from: Seat, node: Konva.Node) => {
    node.position({ x: from.x, y: from.y }); // the person snaps back; the data decides
    const target = pointerSeat();
    setDraggingSeatId(null);
    setDropTargetId(null);
    if (target && target.id !== from.id && accepts(target)) onMoveSeat(from.id, target.id);
  };

  const seatName = (seat: Seat) => {
    const a = seat.currentAssignment;
    if (seat.occupancy === 'taken' && a?.person)
      return byTeam
        ? t('seatButtonTeam', {
            label: seat.label,
            person: a.person.displayName,
            team: a.person.department || t('noDepartment'),
          })
        : t('seatButtonPerson', { label: seat.label, person: a.person.displayName });
    if (seat.occupancy === 'reserved' && a?.reservedFor)
      return t('seatButtonReserved', { label: seat.label, reservedFor: a.reservedFor });
    return t('seatButton', { label: seat.label, status: ts(seat.occupancy) });
  };

  return (
    <div
      ref={vp.containerRef}
      className="relative h-full w-full touch-none overflow-hidden bg-canvas"
      onDragOver={onDragOver}
      onDragLeave={() => setDropTargetId(null)}
      onDrop={onDrop}
      data-testid="floor-map"
      data-view={JSON.stringify(view)}
    >
      {colors && vp.size.width > 0 && (
        <SeatSizeContext.Provider value={size}>
          <Stage
            ref={vp.stageRef}
            width={vp.size.width}
            height={vp.size.height}
            x={view.x}
            y={view.y}
            scaleX={view.scale}
            scaleY={view.scale}
            draggable
            onWheel={vp.onWheel}
            // follow the drag live, so the markers (an HTML layer) move with the floor
            onDragMove={(e) => {
              if (e.target === e.target.getStage())
                vp.setView((v) => ({ ...v, x: e.target.x(), y: e.target.y() }));
            }}
            onDragEnd={(e) => {
              if (e.target === e.target.getStage())
                vp.setView((v) => ({ ...v, x: e.target.x(), y: e.target.y() }));
            }}
            onClick={(e) => {
              if (e.target === e.target.getStage()) onSelectSeat(null);
            }}
            onTap={(e) => {
              if (e.target === e.target.getStage()) onSelectSeat(null);
            }}
          >
            <Layer listening={false}>
              <PlanBackground image={plan} floor={map.floor} opacity={planOpacity} />
              {map.rooms.map((room) => (
                <RoomShape
                  key={room.id}
                  room={room}
                  colors={colors}
                  textScale={vp.textScale}
                  translucent={!!plan}
                  zoneColor={zoneColor(room, colors)}
                  caption={roomCaption(room)}
                />
              ))}
            </Layer>
            <Layer>
              {map.seats.map((seat) => (
                <ViewSeat
                  key={seat.id}
                  seat={seat}
                  colors={colors}
                  textScale={vp.textScale}
                  showLabel={showLabels}
                  look={lookOf(seat, colors)}
                  dimmed={dimmed(seat)}
                  selected={seat.id === selectedSeatId}
                  highlighted={
                    seat.id === highlightSeatId ||
                    seat.id === focusedSeatId ||
                    !!markedSeatIds?.has(seat.id) ||
                    !!found?.has(seat.id)
                  }
                  dropTarget={seat.id === dropTargetId}
                  dragging={seat.id === draggingSeatId}
                  canDrag={canEdit && seat.occupancy === 'taken'}
                  onSelect={() => onSelectSeat(seat.id)}
                  onDragStart={() => setDraggingSeatId(seat.id)}
                  onDragMove={() => onTokenDragMove(seat)}
                  onDragEnd={(node) => onTokenDragEnd(seat, node)}
                />
              ))}
            </Layer>
          </Stage>
        </SeatSizeContext.Provider>
      )}

      <MarkerOverlay markers={map.markers ?? []} view={view} />

      {/* The canvas is invisible to keyboards and screen readers: this list is the accessible map. */}
      <ul className="sr-only" aria-label={t('seatsList')}>
        {map.seats.map((seat) => (
          <li key={seat.id}>
            <button
              type="button"
              aria-pressed={seat.id === selectedSeatId}
              onFocus={() => setFocusedSeatId(seat.id)}
              onBlur={() => setFocusedSeatId(null)}
              onClick={() => onSelectSeat(seat.id)}
            >
              {seatName(seat)}
            </button>
          </li>
        ))}
        {(map.markers ?? []).map((m) => (
          <li key={m.id}>{[tm(`marker.${m.kind}`), m.label].filter(Boolean).join(': ')}</li>
        ))}
      </ul>

      <div className="absolute top-3 left-3" data-print="hide">
        <DeskFinder seats={map.seats} wanted={wanted} onChange={setWanted} found={found} />
      </div>

      <div data-print="hide">
        <ZoomControls zoomBy={vp.zoomBy} fit={vp.fit} />
      </div>
      <MapLegend
        seats={map.seats}
        colorBy={colorBy}
        onColorBy={(c) => {
          setFocusTeam(null);
          onColorBy(c);
        }}
        teams={teams}
        focusTeam={byTeam ? focusTeam : null}
        onFocusTeam={setFocusTeam}
        className="absolute right-14 bottom-3 left-3 lg:right-auto lg:max-w-[calc(100%-5rem)]"
      />
    </div>
  );
}

/** A seat in view mode: click to select; a taken seat's person can be dragged to another seat. */
function ViewSeat({
  seat,
  colors,
  look,
  dimmed,
  textScale,
  showLabel,
  selected,
  highlighted,
  dropTarget,
  dragging,
  canDrag,
  onSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
}: {
  seat: Seat;
  colors: Colors;
  look?: SeatLook;
  /** another team is highlighted */
  dimmed: boolean;
  textScale: number;
  showLabel: boolean;
  selected: boolean;
  highlighted: boolean;
  dropTarget: boolean;
  dragging: boolean;
  canDrag: boolean;
  onSelect: () => void;
  onDragStart: () => void;
  onDragMove: () => void;
  onDragEnd: (node: Konva.Node) => void;
}) {
  return (
    <>
      <SeatDesk
        seat={seat}
        colors={colors}
        look={look}
        opacity={dimmed ? 0.25 : 1}
        ring={selected ? 'selected' : dropTarget ? 'drop' : highlighted ? 'highlight' : null}
        onClick={onSelect}
        onTap={onSelect}
        onMouseEnter={(e: Konva.KonvaEventObject<MouseEvent>) => setCursor(e, 'pointer')}
        onMouseLeave={(e: Konva.KonvaEventObject<MouseEvent>) => setCursor(e, '')}
      />
      {showLabel && <SeatLabel seat={seat} colors={colors} textScale={textScale} />}
      {seatContent(seat) && (
        <Group
          x={seat.x}
          y={seat.y}
          draggable={canDrag}
          opacity={dimmed ? 0.3 : 1}
          onClick={onSelect}
          onTap={onSelect}
          onDragStart={onDragStart}
          onDragMove={onDragMove}
          onDragEnd={(e) => onDragEnd(e.target)}
          onMouseEnter={(e) => setCursor(e, canDrag ? 'grab' : 'pointer')}
          onMouseLeave={(e) => setCursor(e, '')}
        >
          {dragging && (
            <Rect
              x={-20}
              y={-20}
              width={40}
              height={40}
              cornerRadius={20}
              fill={colors.primary}
              shadowBlur={8}
              shadowOpacity={0.25}
            />
          )}
          <SeatText
            seat={seat}
            colors={colors}
            textScale={textScale}
            color={dragging ? '#ffffff' : look?.text}
          />
        </Group>
      )}
    </>
  );
}
