'use client';

import type Konva from 'konva';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { Group, Layer, Rect, Stage } from 'react-konva';
import { contentBounds, seatAt, toPlan } from '@/lib/map-geometry';
import type { FloorMap as FloorMapData, Seat } from '@/lib/types';
import { MapLegend } from './map-legend';
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
} from './shapes';
import { useViewport, ZoomControls } from './viewport';

/** MIME type used when a person is dragged from the people list. */
export const PERSON_DRAG_TYPE = 'application/x-seatline-person';

export interface FloorMapProps {
  map: FloorMapData;
  selectedSeatId: string | null;
  /** e.g. the seat of the person selected in the list */
  highlightSeatId: string | null;
  canEdit: boolean;
  planOpacity: number;
  onSelectSeat: (seatId: string | null) => void;
  onDropPerson: (seatId: string, person: { id: string; displayName: string }) => void;
  onMoveSeat: (fromSeatId: string, toSeatId: string) => void;
}

export function FloorMap({
  map,
  selectedSeatId,
  highlightSeatId,
  canEdit,
  planOpacity,
  onSelectSeat,
  onDropPerson,
  onMoveSeat,
}: FloorMapProps) {
  const t = useTranslations('map');
  const ts = useTranslations('status');
  const colors = useMapColors();
  const plan = usePlanImage(map.floor);
  const bounds = useMemo(
    () =>
      contentBounds(
        map.rooms,
        map.seats,
        map.floor.planFileKey && map.floor.planWidth && map.floor.planHeight
          ? { width: map.floor.planWidth, height: map.floor.planHeight }
          : null,
      ),
    [map.rooms, map.seats, map.floor],
  );
  const vp = useViewport(bounds, map.floor.id);
  const { view } = vp;
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [draggingSeatId, setDraggingSeatId] = useState<string | null>(null);
  const [focusedSeatId, setFocusedSeatId] = useState<string | null>(null);
  // far zoomed out (e.g. a phone showing the whole floor) seat numbers would overlap
  const showLabels = view.scale >= 0.45;

  // ---- drop a person from the people list (HTML drag and drop) --------------
  const seatUnderClient = (clientX: number, clientY: number): Seat | undefined => {
    const rect = vp.containerRef.current?.getBoundingClientRect();
    if (!rect) return undefined;
    return seatAt(map.seats, toPlan(view, { x: clientX - rect.left, y: clientY - rect.top }));
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
    return pointer ? seatAt(map.seats, toPlan(view, pointer)) : undefined;
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
      return t('seatButtonPerson', { label: seat.label, person: a.person.displayName });
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
                selected={seat.id === selectedSeatId}
                highlighted={seat.id === highlightSeatId || seat.id === focusedSeatId}
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
      )}

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
      </ul>

      <ZoomControls zoomBy={vp.zoomBy} fit={vp.fit} />
      <MapLegend seats={map.seats} className="absolute right-14 bottom-3 left-3 lg:right-auto" />
    </div>
  );
}

/** A seat in view mode: click to select; a taken seat's person can be dragged to another seat. */
function ViewSeat({
  seat,
  colors,
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
            color={dragging ? '#ffffff' : undefined}
          />
        </Group>
      )}
    </>
  );
}
