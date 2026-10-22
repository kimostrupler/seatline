'use client';

import type Konva from 'konva';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Circle, Group, Layer, Line, Rect, Stage, Text } from 'react-konva';
import { toast } from 'sonner';
import {
  PlanBackground,
  RoomShape,
  SeatDesk,
  SeatLabel,
  SeatText,
  seatContent,
  useMapColors,
  usePlanImage,
  FONT,
} from '@/components/map/shapes';
import { useViewport, ZoomControls } from '@/components/map/viewport';
import { SeatSizeContext } from '@/components/map/seat-size';
import {
  applyChanges,
  changes,
  deleteSelection,
  duplicateSelection,
  gridStep,
  insertVertex,
  moveEdge,
  moveSelection,
  moveVertex,
  seatLabelAt,
  removeVertex,
  rotateSeats,
  snap,
  type LayoutDoc,
} from '@/lib/editor/ops';
import {
  NO_SELECTION,
  type LayoutEditorState,
  type Selection,
} from '@/lib/editor/use-layout-editor';
import { contentBounds, seatSize, toPlan } from '@/lib/map-geometry';
import type { FloorMap, Point } from '@/lib/types';
import type { ClipboardActions } from './use-clipboard';
import { useMediaQuery } from '@/lib/use-media-query';

export type Tool = 'select' | 'seat' | 'room' | 'rect' | 'measure';

type Drag =
  | { kind: 'move'; start: Point; delta: Point }
  | { kind: 'marquee'; start: Point; end: Point; additive: boolean }
  | { kind: 'vertex'; roomId: string; index: number; point: Point }
  | { kind: 'edge'; roomId: string; index: number; point: Point }
  | { kind: 'pan'; start: Point; origin: Point }
  | { kind: 'rect'; start: Point; end: Point }
  | { kind: 'measure'; start: Point; end: Point };

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
    !!target.closest('[role="dialog"],[role="alertdialog"],[role="menu"],[role="listbox"]'));

export function LayoutEditor({
  map,
  editor,
  tool,
  setTool,
  planOpacity,
  onMeasured,
  onShowShortcuts,
  clipboard,
}: {
  map: FloorMap;
  editor: LayoutEditorState;
  tool: Tool;
  setTool: (tool: Tool) => void;
  planOpacity: number;
  /** a line of this many plan units was drawn with the ruler */
  onMeasured: (units: number) => void;
  onShowShortcuts: () => void;
  clipboard: ClipboardActions;
}) {
  const t = useTranslations('editor');
  const colors = useMapColors();
  const plan = usePlanImage(map.floor);
  const { doc, selection, setSelection, commit } = editor;
  const floor = map.floor;
  const grid = gridStep(floor.scale);
  const size = useMemo(() => seatSize(floor), [floor]);

  const bounds = useMemo(
    () =>
      contentBounds(
        map.rooms,
        map.seats,
        floor.planFileKey && floor.planWidth && floor.planHeight
          ? { width: floor.planWidth, height: floor.planHeight }
          : { width: 1200, height: 800 }, // an empty floor still gets a sensible canvas
        size,
      ),
    // fit once per floor; later edits shouldn't re-frame
    [floor.id, floor.planFileKey], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const vp = useViewport(bounds, `edit:${floor.id}`);
  const { view } = vp;

  const [drag, setDrag] = useState<Drag | null>(null);
  const [pointer, setPointer] = useState<Point | null>(null);
  const [roomPoints, setRoomPoints] = useState<Point[]>([]);
  const [spaceDown, setSpaceDown] = useState(false);
  const lastRotation = useRef(0);
  const [hover, setHover] = useState<'vertex' | 'edge' | null>(null);
  const coarse = useMediaQuery('(pointer: coarse)');

  const snapPoint = (p: Point, free: boolean): Point =>
    free ? p : { x: snap(p.x, grid), y: snap(p.y, grid) };
  const planPointer = (): Point | null => {
    const pos = vp.stageRef.current?.getPointerPosition();
    return pos ? toPlan(view, pos) : null;
  };

  /** The room change a corner/side drag makes (null if nothing changes). */
  const reshape = (d: Extract<Drag, { kind: 'vertex' | 'edge' }>) => {
    const room = doc.rooms.find((r) => r.id === d.roomId);
    if (!room) return null;
    const polygon =
      d.kind === 'vertex'
        ? moveVertex(room.polygon, d.index, d.point)
        : moveEdge(room.polygon, d.index, d.point);
    if (JSON.stringify(polygon) === JSON.stringify(room.polygon)) return null;
    return changes({ rooms: { update: [{ id: room.id, polygon }] } });
  };
  const setPolygon = (roomId: string, polygon: Point[]) =>
    commit(changes({ rooms: { update: [{ id: roomId, polygon }] } }));

  // What's on screen: the document plus the drag in progress.
  const shown: LayoutDoc = useMemo(() => {
    if (drag?.kind === 'move')
      return applyChanges(doc, moveSelection(doc, selection, drag.delta.x, drag.delta.y), floor.id);
    if (drag?.kind === 'vertex' || drag?.kind === 'edge') {
      const reshaped = reshape(drag);
      return reshaped ? applyChanges(doc, reshaped, floor.id) : doc;
    }
    return doc;
  }, [doc, drag, selection, floor.id]);

  const selectedSeats = new Set(selection.seats);
  const selectedRooms = new Set(selection.rooms);
  const singleRoom =
    selection.rooms.length === 1 && selection.seats.length === 0
      ? shown.rooms.find((r) => r.id === selection.rooms[0])
      : undefined;

  // ---- actions ---------------------------------------------------------------
  const addSeat = (p: Point) => {
    const seat = {
      id: crypto.randomUUID(),
      label: seatLabelAt(doc, floor.level, floor.seatNumbering, p),
      x: p.x,
      y: p.y,
      rotation: lastRotation.current,
      type: 'desk' as const,
      status: 'active' as const,
    };
    commit(changes({ seats: { create: [seat] } }));
    setSelection({ seats: [seat.id], rooms: [] });
  };

  const addRoom = (polygon: Point[]) => {
    const room = {
      id: crypto.randomUUID(),
      name: t('newRoom', { n: doc.rooms.length + 1 }),
      type: 'office' as const,
      polygon,
    };
    commit(changes({ rooms: { create: [room] } }));
    setSelection({ seats: [], rooms: [room.id] });
    setTool('select');
  };

  const finishRoom = (points: Point[]) => {
    setRoomPoints([]);
    if (points.length >= 3) addRoom(points);
  };

  const removeSelection = () => {
    const occupied = doc.seats.filter((s) => selection.seats.includes(s.id) && s.currentAssignment);
    if (occupied.length) {
      toast.error(t('freeFirst', { labels: occupied.map((s) => s.label).join(', ') }));
      return;
    }
    commit(deleteSelection(selection));
    setSelection(NO_SELECTION);
  };

  const duplicate = () => {
    const { changes: c, selection: next } = duplicateSelection(
      doc,
      selection,
      floor.level,
      size.w + 16,
      0,
      () => crypto.randomUUID(),
      (name) => t('copy', { name }),
    );
    commit(c);
    setSelection(next);
  };

  // ---- keyboard --------------------------------------------------------------
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      if (e.key === ' ') {
        e.preventDefault();
        setSpaceDown(true);
        return;
      }
      if (mod && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) editor.redo();
        else editor.undo();
      } else if (mod && key === 'y') {
        e.preventDefault();
        editor.redo();
      } else if (mod && key === 'd') {
        e.preventDefault();
        duplicate();
      } else if (mod && key === 'c') {
        if (clipboard.copy()) e.preventDefault();
      } else if (mod && key === 'x') {
        if (clipboard.copy()) {
          e.preventDefault();
          removeSelection();
        }
      } else if (mod && key === 'v') {
        e.preventDefault();
        if (clipboard.paste()) setTool('select');
      } else if (mod && key === 'a') {
        e.preventDefault();
        setSelection({ seats: doc.seats.map((s) => s.id), rooms: doc.rooms.map((r) => r.id) });
      } else if (mod) {
        return;
      } else if (e.key === '?') {
        onShowShortcuts();
      } else if (e.key === 'Escape') {
        if (roomPoints.length) setRoomPoints([]);
        else if (tool !== 'select') setTool('select');
        else setSelection(NO_SELECTION);
      } else if (e.key === 'Enter' && tool === 'room') {
        finishRoom(roomPoints);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        removeSelection();
      } else if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        const step = e.shiftKey ? grid * 10 : grid;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        commit(moveSelection(doc, selection, dx, dy));
      } else if (key === 'r') {
        commit(rotateSeats(doc, selection.seats, e.shiftKey ? 15 : 90));
      } else if (key === 'v') setTool('select');
      else if (key === 's') setTool('seat');
      else if (key === 'p') setTool('room');
      else if (key === 'b') setTool('rect');
      else if (key === 'm') setTool('measure');
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') setSpaceDown(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  });

  // Leaving a drawing tool drops the half-drawn room.
  useEffect(() => {
    if (tool !== 'room') setRoomPoints([]);
  }, [tool]);

  // ---- mouse -----------------------------------------------------------------
  const hit = (
    target: Konva.Node,
  ): { kind: 'seat' | 'room' | 'vertex' | 'edge'; id: string; index?: number } | null => {
    for (let n: Konva.Node | null = target; n; n = n.getParent()) {
      const [kind, id, index] = n.name().split(':');
      if ((kind === 'seat' || kind === 'room' || kind === 'vertex' || kind === 'edge') && id)
        return { kind, id, index: index === undefined ? undefined : Number(index) };
    }
    return null;
  };

  const onPointerDown = (e: Konva.KonvaEventObject<PointerEvent>) => {
    // a second finger means pinch-zoom: drop whatever the first one started
    if (!e.evt.isPrimary) return setDrag(null);
    if (spaceDown || e.evt.button !== 0) return;
    const touch = e.evt.pointerType === 'touch';
    const raw = planPointer();
    if (!raw) return;
    const free = e.evt.altKey;
    const p = snapPoint(raw, free);

    if (tool === 'seat') return addSeat(p);
    if (tool === 'room') {
      const first = roomPoints[0];
      if (
        first &&
        roomPoints.length >= 3 &&
        Math.hypot(raw.x - first.x, raw.y - first.y) < 12 / view.scale
      )
        return finishRoom(roomPoints);
      const last = roomPoints.at(-1);
      if (!last || last.x !== p.x || last.y !== p.y) setRoomPoints([...roomPoints, p]);
      return;
    }
    if (tool === 'rect') return setDrag({ kind: 'rect', start: p, end: p });
    if (tool === 'measure') return setDrag({ kind: 'measure', start: raw, end: raw });

    // select tool
    const target = hit(e.target);
    if (target?.kind === 'vertex' || target?.kind === 'edge') {
      return setDrag({ kind: target.kind, roomId: target.id, index: target.index!, point: p });
    }
    if (target) {
      const key = target.kind === 'seat' ? 'seats' : 'rooms';
      const already = selection[key].includes(target.id);
      if (e.evt.shiftKey) {
        setSelection({
          ...selection,
          [key]: already
            ? selection[key].filter((id) => id !== target.id)
            : [...selection[key], target.id],
        });
        return;
      }
      if (!already) setSelection({ ...NO_SELECTION, [key]: [target.id] } as Selection);
      setDrag({ kind: 'move', start: raw, delta: { x: 0, y: 0 } });
      return;
    }
    // Shift + drag draws a selection box (adding to the selection); otherwise dragging the
    // empty floor moves around, like on the map (a click without moving deselects)
    if (e.evt.shiftKey && !touch) {
      setDrag({ kind: 'marquee', start: raw, end: raw, additive: true });
      return;
    }
    setSelection(NO_SELECTION);
    const screen = vp.stageRef.current?.getPointerPosition();
    if (screen) setDrag({ kind: 'pan', start: screen, origin: { x: view.x, y: view.y } });
  };

  const onPointerMove = (e: Konva.KonvaEventObject<PointerEvent>) => {
    if (!e.evt.isPrimary) return;
    if (drag?.kind === 'pan') {
      const screen = vp.stageRef.current?.getPointerPosition();
      if (screen)
        vp.setView((v) => ({
          ...v,
          x: drag.origin.x + screen.x - drag.start.x,
          y: drag.origin.y + screen.y - drag.start.y,
        }));
      return;
    }
    const raw = planPointer();
    if (!raw) return;
    const free = e.evt.altKey;
    setPointer(snapPoint(raw, free));
    if (!drag) {
      const over = tool === 'select' ? hit(e.target) : null;
      setHover(over?.kind === 'vertex' || over?.kind === 'edge' ? over.kind : null);
      return;
    }
    if (drag.kind === 'move') {
      const d = { x: raw.x - drag.start.x, y: raw.y - drag.start.y };
      setDrag({ ...drag, delta: free ? d : { x: snap(d.x, grid), y: snap(d.y, grid) } });
    } else if (drag.kind === 'vertex' || drag.kind === 'edge')
      setDrag({ ...drag, point: snapPoint(raw, free) });
    else if (drag.kind === 'rect') setDrag({ ...drag, end: snapPoint(raw, free) });
    else setDrag({ ...drag, end: raw });
  };

  const onPointerUp = (e: Konva.KonvaEventObject<PointerEvent>) => {
    if (!drag || !e.evt.isPrimary) return;
    setDrag(null);
    if (drag.kind === 'move') {
      commit(moveSelection(doc, selection, drag.delta.x, drag.delta.y));
    } else if (drag.kind === 'vertex' || drag.kind === 'edge') {
      const reshaped = reshape(drag);
      if (reshaped) commit(reshaped);
    } else if (drag.kind === 'marquee') {
      const [x1, x2] = [Math.min(drag.start.x, drag.end.x), Math.max(drag.start.x, drag.end.x)];
      const [y1, y2] = [Math.min(drag.start.y, drag.end.y), Math.max(drag.start.y, drag.end.y)];
      const inside = (p: Point) => p.x >= x1 && p.x <= x2 && p.y >= y1 && p.y <= y2;
      if (x2 - x1 < 2 && y2 - y1 < 2) return;
      const seats = doc.seats.filter(inside).map((s) => s.id);
      const rooms = doc.rooms.filter((r) => r.polygon.every(inside)).map((r) => r.id);
      setSelection(
        drag.additive
          ? {
              seats: [...new Set([...selection.seats, ...seats])],
              rooms: [...new Set([...selection.rooms, ...rooms])],
            }
          : { seats, rooms },
      );
    } else if (drag.kind === 'rect') {
      const { start: a, end: b } = drag;
      if (Math.abs(b.x - a.x) >= grid && Math.abs(b.y - a.y) >= grid)
        addRoom([
          { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y) },
          { x: Math.max(a.x, b.x), y: Math.min(a.y, b.y) },
          { x: Math.max(a.x, b.x), y: Math.max(a.y, b.y) },
          { x: Math.min(a.x, b.x), y: Math.max(a.y, b.y) },
        ]);
    } else if (drag.kind === 'measure') {
      const units = Math.hypot(drag.end.x - drag.start.x, drag.end.y - drag.start.y);
      if (units > 5) onMeasured(units);
    }
  };

  // Remember the rotation people use so new seats face the same way.
  const lastSelected = doc.seats.find((s) => s.id === selection.seats.at(-1));
  if (lastSelected) lastRotation.current = lastSelected.rotation;

  // Double-click a side's handle to add a corner there, a corner to remove it.
  const onDoubleClick = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (tool === 'room') return finishRoom(roomPoints);
    const target = hit(e.target);
    const room = target && doc.rooms.find((r) => r.id === target.id);
    if (!room || target.index === undefined) return;
    if (target.kind === 'edge') setPolygon(room.id, insertVertex(room.polygon, target.index));
    if (target.kind === 'vertex' && room.polygon.length > 3)
      setPolygon(room.id, removeVertex(room.polygon, target.index));
  };

  const cursor =
    spaceDown || drag?.kind === 'pan'
      ? 'grab'
      : tool !== 'select'
        ? 'crosshair'
        : hover || drag?.kind === 'vertex' || drag?.kind === 'edge'
          ? 'move'
          : 'grab'; // empty floor: drag to move around
  // bigger handles for fingers
  const handle = (coarse ? 10 : 6) / view.scale;

  return (
    <div
      ref={vp.containerRef}
      className="relative h-full w-full touch-none overflow-hidden bg-canvas"
      style={{ cursor }}
      data-testid="layout-editor"
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
            draggable={spaceDown}
            onDragEnd={(e) => {
              if (e.target === e.target.getStage())
                vp.setView((v) => ({ ...v, x: e.target.x(), y: e.target.y() }));
            }}
            onWheel={vp.onWheel}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => setDrag(null)}
            onMouseLeave={() => {
              setPointer(null);
              setHover(null);
            }}
            onDblClick={onDoubleClick}
            onDblTap={onDoubleClick}
          >
            <Layer listening={false}>
              <PlanBackground image={plan} floor={floor} opacity={planOpacity} />
              {!plan && (
                <GridDots
                  width={floor.planWidth ?? 1200}
                  height={floor.planHeight ?? 800}
                  grid={grid * 10}
                  color={colors['room-stroke']}
                />
              )}
            </Layer>
            <Layer listening={tool === 'select'}>
              {shown.rooms.map((room) => (
                <RoomShape
                  key={room.id}
                  name={`room:${room.id}`}
                  room={room}
                  colors={colors}
                  textScale={vp.textScale}
                  selected={selectedRooms.has(room.id)}
                  translucent={!!plan}
                />
              ))}
            </Layer>
            <Layer listening={tool === 'select'}>
              {shown.seats.map((seat) => (
                <Group key={seat.id}>
                  <SeatDesk
                    name={`seat:${seat.id}`}
                    seat={seat}
                    colors={colors}
                    ring={selectedSeats.has(seat.id) ? 'selected' : null}
                  />
                  <SeatLabel seat={seat} colors={colors} textScale={vp.textScale} />
                  {seatContent(seat) && (
                    <Group x={seat.x} y={seat.y} listening={false}>
                      <SeatText seat={seat} colors={colors} textScale={vp.textScale} />
                    </Group>
                  )}
                </Group>
              ))}
              {/* side handles (drag to push a wall, double-click to add a corner) */}
              {singleRoom?.polygon.map((p, i) => {
                const q = singleRoom.polygon[(i + 1) % singleRoom.polygon.length]!;
                return (
                  <Rect
                    key={`e${i}`}
                    name={`edge:${singleRoom.id}:${i}`}
                    x={(p.x + q.x) / 2}
                    y={(p.y + q.y) / 2}
                    width={handle * 1.6}
                    height={handle * 1.6}
                    offsetX={handle * 0.8}
                    offsetY={handle * 0.8}
                    rotation={(Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI}
                    cornerRadius={handle * 0.3}
                    fill={colors.primary}
                    stroke="#ffffff"
                    strokeWidth={1.5}
                    strokeScaleEnabled={false}
                    hitStrokeWidth={12}
                  />
                );
              })}
              {/* corner handles (drag to reshape, double-click to remove) */}
              {singleRoom?.polygon.map((p, i) => (
                <Circle
                  key={`v${i}`}
                  name={`vertex:${singleRoom.id}:${i}`}
                  x={p.x}
                  y={p.y}
                  radius={handle}
                  fill="#ffffff"
                  stroke={colors.primary}
                  strokeWidth={2}
                  strokeScaleEnabled={false}
                  hitStrokeWidth={12}
                />
              ))}
            </Layer>
            <Layer listening={false}>
              {drag?.kind === 'marquee' && (
                <Rect
                  x={Math.min(drag.start.x, drag.end.x)}
                  y={Math.min(drag.start.y, drag.end.y)}
                  width={Math.abs(drag.end.x - drag.start.x)}
                  height={Math.abs(drag.end.y - drag.start.y)}
                  stroke={colors.primary}
                  strokeWidth={1}
                  dash={[4, 4]}
                  fill={colors.primary}
                  opacity={0.12}
                  strokeScaleEnabled={false}
                />
              )}
              {drag?.kind === 'rect' && (
                <Rect
                  x={Math.min(drag.start.x, drag.end.x)}
                  y={Math.min(drag.start.y, drag.end.y)}
                  width={Math.abs(drag.end.x - drag.start.x)}
                  height={Math.abs(drag.end.y - drag.start.y)}
                  stroke={colors.primary}
                  strokeWidth={2}
                  dash={[6, 4]}
                  strokeScaleEnabled={false}
                />
              )}
              {tool === 'room' && roomPoints.length > 0 && (
                <>
                  <Line
                    points={[...roomPoints, ...(pointer ? [pointer] : [])].flatMap((p) => [
                      p.x,
                      p.y,
                    ])}
                    stroke={colors.primary}
                    strokeWidth={2}
                    dash={[6, 4]}
                    strokeScaleEnabled={false}
                  />
                  {roomPoints.map((p, i) => (
                    <Circle
                      key={i}
                      x={p.x}
                      y={p.y}
                      radius={handle}
                      fill={i === 0 ? colors.primary : '#ffffff'}
                      stroke={colors.primary}
                      strokeWidth={2}
                      strokeScaleEnabled={false}
                    />
                  ))}
                </>
              )}
              {drag?.kind === 'measure' && (
                <>
                  <Line
                    points={[drag.start.x, drag.start.y, drag.end.x, drag.end.y]}
                    stroke={colors.primary}
                    strokeWidth={2}
                    strokeScaleEnabled={false}
                  />
                  <Text
                    x={drag.end.x + 8 / view.scale}
                    y={drag.end.y + 8 / view.scale}
                    text={
                      floor.scale
                        ? `${(Math.hypot(drag.end.x - drag.start.x, drag.end.y - drag.start.y) / floor.scale).toFixed(2)} m`
                        : `${Math.round(Math.hypot(drag.end.x - drag.start.x, drag.end.y - drag.start.y))}`
                    }
                    fontFamily={FONT}
                    fontSize={12 * vp.textScale}
                    fill={colors.primary}
                  />
                </>
              )}
              {tool === 'seat' && pointer && (
                <Group opacity={0.5}>
                  <SeatDesk
                    seat={{
                      id: 'ghost',
                      floorId: floor.id,
                      roomId: null,
                      label: '',
                      x: pointer.x,
                      y: pointer.y,
                      rotation: lastRotation.current,
                      type: 'desk',
                      status: 'active',
                      occupancy: 'free',
                      currentAssignment: null,
                    }}
                    colors={colors}
                    ring={null}
                  />
                </Group>
              )}
            </Layer>
          </Stage>
        </SeatSizeContext.Provider>
      )}

      {/* keyboard / screen reader access: select items, then use the inspector or shortcuts */}
      <ul className="sr-only" aria-label={t('accessibleList')}>
        {doc.rooms.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              aria-pressed={selectedRooms.has(r.id)}
              onClick={() => setSelection({ seats: [], rooms: [r.id] })}
            >
              {r.name}
            </button>
          </li>
        ))}
        {doc.seats.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              aria-pressed={selectedSeats.has(s.id)}
              onClick={() => setSelection({ seats: [s.id], rooms: [] })}
            >
              {s.label}
            </button>
          </li>
        ))}
      </ul>

      <ZoomControls zoomBy={vp.zoomBy} fit={vp.fit} />
    </div>
  );
}

/** Light dot grid on floors without a plan image, so placement has a reference. */
function GridDots({
  width,
  height,
  grid,
  color,
}: {
  width: number;
  height: number;
  grid: number;
  color: string;
}) {
  const dots = [];
  for (let x = 0; x <= width; x += grid)
    for (let y = 0; y <= height; y += grid) dots.push([x, y] as const);
  if (dots.length > 4000) return null;
  return (
    <>
      {dots.map(([x, y]) => (
        <Rect key={`${x}:${y}`} x={x - 1} y={y - 1} width={2} height={2} fill={color} />
      ))}
    </>
  );
}
