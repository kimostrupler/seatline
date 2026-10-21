'use client';

import type Konva from 'konva';
import { Maximize, Minus, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Group, Layer, Line, Rect, Stage, Text } from 'react-konva';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  contentBounds,
  fitView,
  initials,
  roomLabelPoint,
  SEAT_H,
  SEAT_W,
  seatAt,
  toPlan,
  zoomAt,
  type View,
} from '@/lib/map-geometry';
import type { FloorMap as FloorMapData, Seat } from '@/lib/types';
import { useCssVars } from '@/lib/use-css-vars';
import { useSize } from '@/lib/use-size';
import { MapLegend } from './map-legend';

/** MIME type used when a person is dragged from the people list. */
export const PERSON_DRAG_TYPE = 'application/x-seatline-person';

const FONT = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

const COLOR_VARS = [
  'canvas',
  'primary',
  'room-fill',
  'room-stroke',
  'room-meeting-fill',
  'room-label',
  'seat-free-fill',
  'seat-free-stroke',
  'seat-free-text',
  'seat-taken-fill',
  'seat-taken-stroke',
  'seat-taken-text',
  'seat-reserved-fill',
  'seat-reserved-stroke',
  'seat-reserved-text',
  'seat-blocked-fill',
  'seat-blocked-stroke',
  'seat-blocked-text',
] as const;

type Colors = Record<(typeof COLOR_VARS)[number], string>;

export interface FloorMapProps {
  map: FloorMapData;
  selectedSeatId: string | null;
  /** e.g. the seat of the person selected in the list */
  highlightSeatId: string | null;
  canEdit: boolean;
  onSelectSeat: (seatId: string | null) => void;
  onDropPerson: (seatId: string, person: { id: string; displayName: string }) => void;
  onMoveSeat: (fromSeatId: string, toSeatId: string) => void;
}

export function FloorMap({
  map,
  selectedSeatId,
  highlightSeatId,
  canEdit,
  onSelectSeat,
  onDropPerson,
  onMoveSeat,
}: FloorMapProps) {
  const t = useTranslations('map');
  const ts = useTranslations('status');
  const colors = useCssVars(COLOR_VARS);
  const [containerRef, size] = useSize<HTMLDivElement>();
  const stageRef = useRef<Konva.Stage>(null);
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 });
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [draggingSeatId, setDraggingSeatId] = useState<string | null>(null);
  const [focusedSeatId, setFocusedSeatId] = useState<string | null>(null);

  const textScale = 1 / Math.min(view.scale, 1);
  // far zoomed out (e.g. a phone showing the whole floor) seat numbers would overlap
  const showLabels = view.scale >= 0.45;

  const bounds = useMemo(() => contentBounds(map.rooms, map.seats), [map.rooms, map.seats]);

  const fit = useCallback(() => {
    if (bounds && size.width > 0) setView(fitView(bounds, size.width, size.height));
  }, [bounds, size.width, size.height]);

  // Frame the floor when it opens (or the map first gets a size) — not on every refresh.
  const fittedFor = useRef<string | null>(null);
  useEffect(() => {
    if (size.width === 0 || fittedFor.current === map.floor.id) return;
    fittedFor.current = map.floor.id;
    fit();
  }, [map.floor.id, size.width, fit]);

  const zoomBy = (factor: number) =>
    setView((v) => zoomAt(v, factor, { x: size.width / 2, y: size.height / 2 }));

  const onWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const pointer = stageRef.current?.getPointerPosition();
    if (!pointer) return;
    // smooth for trackpads (small deltas) and mouse wheels alike
    const factor = Math.exp(-e.evt.deltaY * (e.evt.ctrlKey ? 0.01 : 0.0015));
    setView((v) => zoomAt(v, factor, pointer));
  };

  // ---- drop a person from the people list (HTML drag and drop) --------------
  const seatUnderClient = (clientX: number, clientY: number): Seat | undefined => {
    const rect = containerRef.current?.getBoundingClientRect();
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
    const pointer = stageRef.current?.getPointerPosition();
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
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-canvas"
      onDragOver={onDragOver}
      onDragLeave={() => setDropTargetId(null)}
      onDrop={onDrop}
      data-testid="floor-map"
      data-view={JSON.stringify(view)}
    >
      {colors && size.width > 0 && (
        <Stage
          ref={stageRef}
          width={size.width}
          height={size.height}
          x={view.x}
          y={view.y}
          scaleX={view.scale}
          scaleY={view.scale}
          draggable
          onWheel={onWheel}
          onDragEnd={(e) => {
            if (e.target === e.target.getStage())
              setView((v) => ({ ...v, x: e.target.x(), y: e.target.y() }));
          }}
          onClick={(e) => {
            if (e.target === e.target.getStage()) onSelectSeat(null);
          }}
          onTap={(e) => {
            if (e.target === e.target.getStage()) onSelectSeat(null);
          }}
        >
          <Layer>
            {map.rooms.map((room) => {
              const label = roomLabelPoint(room.polygon);
              return (
                <Group key={room.id} listening={false}>
                  <Line
                    points={room.polygon.flatMap((p) => [p.x, p.y])}
                    closed
                    fill={
                      room.type === 'meeting' ? colors['room-meeting-fill'] : colors['room-fill']
                    }
                    stroke={colors['room-stroke']}
                    strokeWidth={1.5}
                    strokeScaleEnabled={false}
                    lineJoin="round"
                  />
                  <Text
                    x={label.x}
                    y={label.y}
                    text={room.name}
                    fontFamily={FONT}
                    fontSize={13 * textScale}
                    fill={colors['room-label']}
                  />
                </Group>
              );
            })}
          </Layer>
          <Layer>
            {map.seats.map((seat) => (
              <SeatShape
                key={seat.id}
                seat={seat}
                colors={colors}
                textScale={textScale}
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

      <div className="absolute right-3 bottom-3 flex flex-col gap-1 rounded-lg border bg-background/95 p-1 shadow-sm">
        <MapButton label={t('zoomIn')} onClick={() => zoomBy(1.25)}>
          <Plus />
        </MapButton>
        <MapButton label={t('zoomOut')} onClick={() => zoomBy(0.8)}>
          <Minus />
        </MapButton>
        <MapButton label={t('fit')} onClick={fit}>
          <Maximize />
        </MapButton>
      </div>
      <MapLegend seats={map.seats} className="absolute right-14 bottom-3 left-3 lg:right-auto" />
    </div>
  );
}

function MapButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8" aria-label={label} onClick={onClick}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left">{label}</TooltipContent>
    </Tooltip>
  );
}

interface SeatShapeProps {
  seat: Seat;
  colors: Colors;
  /** keeps text readable when zoomed out (screen size never below the base size) */
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
}

/**
 * One desk: a rounded rectangle with a chair on the side the person faces.
 * Status is shown by colour AND content (initials, "R", a cross), never colour alone.
 */
function SeatShape({
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
}: SeatShapeProps) {
  const state = seat.occupancy;
  const fill = colors[`seat-${state}-fill`];
  const stroke = colors[`seat-${state}-stroke`];
  const text = colors[`seat-${state}-text`];
  const person = seat.currentAssignment?.person;
  const content =
    state === 'taken' && person ? initials(person.displayName) : state === 'reserved' ? 'R' : '';
  const setCursor = (e: Konva.KonvaEventObject<MouseEvent>, cursor: string) => {
    const container = e.target.getStage()?.container();
    if (container) container.style.cursor = cursor;
  };

  return (
    <>
      <Group
        x={seat.x}
        y={seat.y}
        rotation={seat.rotation}
        onClick={onSelect}
        onTap={onSelect}
        onMouseEnter={(e) => setCursor(e, 'pointer')}
        onMouseLeave={(e) => setCursor(e, '')}
      >
        {(selected || highlighted || dropTarget) && (
          <Rect
            x={-SEAT_W / 2 - 6}
            y={-SEAT_H / 2 - 6}
            width={SEAT_W + 12}
            height={SEAT_H + 12}
            cornerRadius={12}
            stroke={colors.primary}
            strokeWidth={selected ? 3 : 2}
            dash={dropTarget || (highlighted && !selected) ? [6, 4] : undefined}
            strokeScaleEnabled={false}
          />
        )}
        {/* chair */}
        <Rect
          x={-14}
          y={SEAT_H / 2 + 3}
          width={28}
          height={9}
          cornerRadius={4}
          fill={stroke}
          opacity={0.55}
        />
        <Rect
          x={-SEAT_W / 2}
          y={-SEAT_H / 2}
          width={SEAT_W}
          height={SEAT_H}
          cornerRadius={8}
          fill={fill}
          stroke={stroke}
          strokeWidth={1.5}
          dash={state === 'blocked' ? [5, 4] : undefined}
          strokeScaleEnabled={false}
        />
        {state === 'blocked' && (
          <Line
            points={[-10, -10, 10, 10, 0, 0, 10, -10, -10, 10]}
            stroke={stroke}
            strokeWidth={1.5}
            strokeScaleEnabled={false}
            listening={false}
          />
        )}
      </Group>
      {/* upright overlay: text stays readable whatever way the desk faces */}
      {showLabel && (
        <Text
          x={seat.x - SEAT_W}
          y={seat.y + SEAT_H / 2 + 16}
          width={SEAT_W * 2}
          align="center"
          text={seat.label}
          fontFamily={FONT}
          fontSize={11 * textScale}
          fill={colors['room-label']}
          listening={false}
        />
      )}
      {content && (
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
          <Text
            x={-SEAT_W / 2}
            y={-SEAT_H / 2}
            width={SEAT_W}
            height={SEAT_H}
            align="center"
            verticalAlign="middle"
            text={content}
            fontFamily={FONT}
            fontSize={Math.min(15 * textScale, 22)}
            fontStyle="600"
            fill={dragging ? '#ffffff' : text}
          />
        </Group>
      )}
    </>
  );
}
