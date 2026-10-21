'use client';

import type Konva from 'konva';
import { Maximize, Minus, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { fitView, zoomAt, type Bounds, type View } from '@/lib/map-geometry';
import { useSize } from '@/lib/use-size';

/** Zoom/pan state shared by the map and the editor. Fits `bounds` when `fitKey` changes. */
export function useViewport(bounds: Bounds | null, fitKey: string) {
  const [containerRef, size] = useSize<HTMLDivElement>();
  const stageRef = useRef<Konva.Stage>(null);
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 });

  const fit = useCallback(() => {
    if (bounds && size.width > 0) setView(fitView(bounds, size.width, size.height));
  }, [bounds, size.width, size.height]);

  // Frame the floor when it opens (or first gets a size) — not on every data refresh.
  const fittedFor = useRef<string | null>(null);
  useEffect(() => {
    if (size.width === 0 || fittedFor.current === fitKey) return;
    fittedFor.current = fitKey;
    fit();
  }, [fitKey, size.width, fit]);

  // Two fingers: pinch to zoom and move around (phones and tablets).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let last: { dist: number; center: { x: number; y: number } } | null = null;
    const read = (e: TouchEvent) => {
      const box = el.getBoundingClientRect();
      const [a, b] = [e.touches[0]!, e.touches[1]!];
      return {
        dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
        center: {
          x: (a.clientX + b.clientX) / 2 - box.left,
          y: (a.clientY + b.clientY) / 2 - box.top,
        },
      };
    };
    const onMove = (e: TouchEvent) => {
      if (e.touches.length !== 2) {
        last = null;
        return;
      }
      e.preventDefault();
      stageRef.current?.stopDrag();
      const now = read(e);
      const prev = last;
      if (prev && prev.dist > 0)
        setView((v) => {
          const z = zoomAt(v, now.dist / prev.dist, now.center);
          return {
            ...z,
            x: z.x + now.center.x - prev.center.x,
            y: z.y + now.center.y - prev.center.y,
          };
        });
      last = now;
    };
    const onEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) last = null;
    };
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [containerRef]);

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

  return {
    containerRef,
    stageRef,
    size,
    view,
    setView,
    fit,
    zoomBy,
    onWheel,
    /** keeps text readable when zoomed out (screen size never below the base size) */
    textScale: 1 / Math.min(view.scale, 1),
  };
}

export function ZoomControls({ zoomBy, fit }: { zoomBy: (f: number) => void; fit: () => void }) {
  const t = useTranslations('map');
  return (
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
  );
}

export function MapButton({
  label,
  onClick,
  children,
  side = 'left',
  pressed,
  disabled,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  side?: 'left' | 'right' | 'top' | 'bottom';
  pressed?: boolean;
  disabled?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={pressed ? 'secondary' : 'ghost'}
          size="icon"
          className="size-8"
          aria-label={label}
          aria-pressed={pressed}
          disabled={disabled}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  );
}
