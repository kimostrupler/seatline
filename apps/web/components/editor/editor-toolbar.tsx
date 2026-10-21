'use client';

import {
  Armchair,
  Loader2,
  MousePointer2,
  PenTool,
  Redo2,
  Ruler,
  Square,
  Undo2,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { MapButton } from '@/components/map/viewport';
import { platformKeys } from '@/lib/platform-keys';
import type { Tool } from './layout-editor';

const TOOLS: Array<{
  tool: Tool;
  icon: typeof Square;
  label: 'select' | 'addSeat' | 'drawRoom' | 'drawRect' | 'measure';
}> = [
  { tool: 'select', icon: MousePointer2, label: 'select' },
  { tool: 'seat', icon: Armchair, label: 'addSeat' },
  { tool: 'room', icon: PenTool, label: 'drawRoom' },
  { tool: 'rect', icon: Square, label: 'drawRect' },
  { tool: 'measure', icon: Ruler, label: 'measure' },
];

const HINTS = {
  select: 'hintSelect',
  seat: 'hintSeat',
  room: 'hintRoom',
  rect: 'hintRect',
  measure: 'hintMeasure',
} as const;

export function EditorToolbar({
  tool,
  setTool,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  saving,
}: {
  tool: Tool;
  setTool: (tool: Tool) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  saving: boolean;
}) {
  const t = useTranslations('editor');
  return (
    <>
      <div
        role="toolbar"
        aria-label={t('tools')}
        className="absolute top-3 left-3 flex flex-col gap-1 rounded-lg border bg-background/95 p-1 shadow-sm"
      >
        {TOOLS.map(({ tool: id, icon: Icon, label }) => (
          <MapButton
            key={id}
            label={t(label)}
            side="right"
            pressed={tool === id}
            onClick={() => setTool(id)}
          >
            <Icon />
          </MapButton>
        ))}
        <div className="my-0.5 border-t" />
        <MapButton
          label={platformKeys(t('undo'))}
          side="right"
          onClick={onUndo}
          disabled={!canUndo}
        >
          <Undo2 />
        </MapButton>
        <MapButton
          label={platformKeys(t('redo'))}
          side="right"
          onClick={onRedo}
          disabled={!canRedo}
        >
          <Redo2 />
        </MapButton>
      </div>
      <p
        className="pointer-events-none absolute right-14 bottom-3 left-3 flex items-center gap-2 truncate text-xs text-muted-foreground"
        aria-live="polite"
      >
        <span className="truncate rounded-md border bg-background/95 px-2 py-1 shadow-sm">
          {t(HINTS[tool])}
        </span>
        <span
          className="flex shrink-0 items-center gap-1 rounded-md border bg-background/95 px-2 py-1 shadow-sm"
          data-testid="save-state"
        >
          {saving && <Loader2 className="size-3 animate-spin" />}
          {saving ? t('saving') : t('saved')}
        </span>
      </p>
    </>
  );
}
