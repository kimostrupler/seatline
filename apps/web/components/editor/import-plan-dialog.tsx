'use client';

import { FileUp, Loader2, TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { ApiError, apiBlob } from '@/lib/api';
import { importChanges, pickAll, type ImportPick } from '@/lib/editor/plan-import';
import type { LayoutEditorState } from '@/lib/editor/use-layout-editor';
import { SEAT_H, SEAT_W } from '@/lib/map-geometry';
import { discardPlanImport, useAnalyzePlan, useApplyPlanImport } from '@/lib/queries';
import type { FloorMap, PlanImport } from '@/lib/types';
import { cn } from '@/lib/utils';

const ACCEPT = '.dxf,.pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp';
const ERRORS = [
  'plan_dwg',
  'plan_unsupported',
  'plan_unreadable',
  'plan_empty',
  'plan_too_complex',
  'plan_too_large',
  'plan_timeout',
  'plan_engine_off',
  'plan_engine_unreachable',
] as const;
// "no_scale" is shown with the scale line
const WARNINGS = [
  'units_guessed',
  'no_rooms',
  'no_seats',
  'scan',
  'ai_names',
  'ai_failed',
  'first_page_only',
] as const;

/**
 * Architect plan → background image + suggested rooms and desks. Tap a suggestion to leave it
 * out; the kept ones are added as one editor action (one undo removes them).
 */
export function ImportPlanDialog({
  open,
  onOpenChange,
  map,
  editor,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  map: FloorMap;
  editor: LayoutEditorState;
}) {
  const t = useTranslations('planImport');
  const floor = map.floor;
  const analyze = useAnalyzePlan();
  const apply = useApplyPlanImport();
  const fileInput = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<PlanImport | null>(null);
  const [pick, setPick] = useState<ImportPick>({ rooms: new Set(), seats: new Set() });
  const [error, setError] = useState<string | null>(null);
  const image = useObjectUrl(draft && `/floors/${floor.id}/imports/${draft.importId}/image`);

  const reset = () => {
    setDraft(null);
    setError(null);
    analyze.reset();
  };
  const close = (keep = false) => {
    if (draft && !keep) void discardPlanImport(floor.id, draft.importId);
    reset();
    onOpenChange(false);
  };

  const read = (file: File) => {
    setError(null);
    analyze.mutate(
      { floorId: floor.id, file },
      {
        onSuccess: (result) => {
          setDraft(result);
          setPick(pickAll(result));
        },
        onError: (e) => {
          const code = e instanceof ApiError ? e.code : undefined;
          const known = ERRORS.find((k) => k === code);
          setError(known ? t(`errors.${known}`) : t('errors.failed'));
        },
      },
    );
  };

  const toggle = (kind: 'rooms' | 'seats', i: number) =>
    setPick((p) => {
      const next = new Set(p[kind]);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return { ...p, [kind]: next };
    });
  const setAll = (kind: 'rooms' | 'seats', on: boolean) =>
    setPick((p) => ({
      ...p,
      [kind]: new Set(on && draft ? draft[kind].map((_, i) => i) : []),
    }));

  const confirm = async () => {
    if (!draft) return;
    try {
      await apply.mutateAsync({ floorId: floor.id, importId: draft.importId, scale: draft.scale });
      editor.commit(
        importChanges(draft, pick, editor.doc, floor.level, (n) => t('roomName', { n })),
      );
      toast.success(t('done', { rooms: pick.rooms.size, seats: pick.seats.size }));
      close(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const existing = editor.doc.rooms.length + editor.doc.seats.length > 0;
  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent
        className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl"
        data-testid="import-dialog"
      >
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{draft ? t('reviewHint') : t('intro')}</DialogDescription>
        </DialogHeader>

        {!draft && (
          <div className="grid gap-4">
            <ul className="grid gap-1 text-sm text-muted-foreground">
              <li>• {t('kindDxf')}</li>
              <li>• {t('kindPdf')}</li>
              <li>• {t('kindImage')}</li>
            </ul>
            {(existing || floor.planFileKey) && (
              <p className="rounded-md border bg-muted/50 px-3 py-2 text-sm">
                {existing
                  ? t('existing', {
                      rooms: editor.doc.rooms.length,
                      seats: editor.doc.seats.length,
                    })
                  : ''}{' '}
                {floor.planFileKey ? t('replacesPlan') : ''}
              </p>
            )}
            <input
              ref={fileInput}
              type="file"
              accept={ACCEPT}
              className="sr-only"
              data-testid="import-file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) read(file);
              }}
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={() => fileInput.current?.click()} disabled={analyze.isPending}>
                {analyze.isPending ? <Loader2 className="animate-spin" /> : <FileUp />}
                {analyze.isPending ? t('reading') : t('choose')}
              </Button>
              {analyze.isPending && (
                <span className="text-sm text-muted-foreground">{t('readingHint')}</span>
              )}
            </div>
            {error && (
              <p
                role="alert"
                className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm"
              >
                {error}
              </p>
            )}
          </div>
        )}

        {draft && (
          <div className="grid gap-4">
            <div
              className="relative w-full overflow-hidden rounded-md border bg-white"
              style={{ aspectRatio: `${draft.width} / ${draft.height}`, maxHeight: '55dvh' }}
            >
              {image && (
                // eslint-disable-next-line @next/next/no-img-element -- a private blob URL
                <img src={image} alt="" className="absolute inset-0 size-full object-contain" />
              )}
              <svg
                viewBox={`0 0 ${draft.width} ${draft.height}`}
                preserveAspectRatio="xMidYMid meet"
                className="absolute inset-0 size-full"
                data-testid="import-preview"
              >
                {draft.rooms.map((r, i) => {
                  const on = pick.rooms.has(i);
                  return (
                    <polygon
                      key={`r${i}`}
                      points={r.polygon.map((p) => `${p.x},${p.y}`).join(' ')}
                      className="cursor-pointer"
                      fill={on ? 'var(--primary)' : 'transparent'}
                      fillOpacity={on ? 0.08 : 0}
                      stroke={on ? 'var(--primary)' : 'var(--muted-foreground)'}
                      strokeOpacity={on ? 0.9 : 0.5}
                      strokeDasharray={on ? undefined : '8 6'}
                      strokeWidth={Math.max(2, draft.width / 500)}
                      onClick={() => toggle('rooms', i)}
                    >
                      <title>{r.name || t('unnamed')}</title>
                    </polygon>
                  );
                })}
                {draft.seats.map((s, i) => {
                  const on = pick.seats.has(i);
                  return (
                    <rect
                      key={`s${i}`}
                      x={s.x - SEAT_W / 2}
                      y={s.y - SEAT_H / 2}
                      width={SEAT_W}
                      height={SEAT_H}
                      rx={8}
                      transform={`rotate(${s.rotation} ${s.x} ${s.y})`}
                      className="cursor-pointer"
                      fill={on ? 'var(--seat-free-fill)' : 'transparent'}
                      stroke={on ? 'var(--seat-free-stroke)' : 'var(--muted-foreground)'}
                      strokeDasharray={on ? undefined : '6 4'}
                      strokeWidth={2}
                      onClick={() => toggle('seats', i)}
                    />
                  );
                })}
              </svg>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Count
                label={t('rooms', { picked: pick.rooms.size, total: draft.rooms.length })}
                checked={pick.rooms.size > 0}
                disabled={!draft.rooms.length}
                onChange={(on) => setAll('rooms', on)}
              />
              <Count
                label={t('seats', { picked: pick.seats.size, total: draft.seats.length })}
                checked={pick.seats.size > 0}
                disabled={!draft.seats.length}
                onChange={(on) => setAll('seats', on)}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              {draft.scale ? t('scaleFound', { px: Math.round(draft.scale) }) : t('scaleMissing')}
            </p>
            {WARNINGS.some((w) => draft.warnings.includes(w)) && (
              <ul className="grid gap-1 rounded-md border bg-muted/50 px-3 py-2 text-sm">
                {WARNINGS.filter((w) => draft.warnings.includes(w)).map((w) => (
                  <li key={w} className="flex gap-2">
                    <TriangleAlert
                      className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                    {t(`warnings.${w}`)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => close()}>
            {t('cancel')}
          </Button>
          {draft && (
            <>
              <Button
                variant="ghost"
                onClick={() => {
                  void discardPlanImport(floor.id, draft.importId);
                  reset();
                }}
              >
                {t('other')}
              </Button>
              <Button
                onClick={() => void confirm()}
                disabled={apply.isPending}
                data-testid="import-confirm"
              >
                {apply.isPending && <Loader2 className="animate-spin" />}
                {t('confirm', { rooms: pick.rooms.size, seats: pick.seats.size })}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Count({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <label
      className={cn(
        'flex items-center gap-3 rounded-md border px-3 py-2 text-sm',
        disabled && 'opacity-60',
      )}
    >
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
      {label}
    </label>
  );
}

/** A private image from the API as an object URL (freed when it changes). */
function useObjectUrl(path: string | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!path) return setUrl(null);
    let alive = true;
    let created: string | null = null;
    apiBlob(path).then(
      (blob) => {
        if (!alive) return;
        created = URL.createObjectURL(blob);
        setUrl(created);
      },
      () => alive && setUrl(null),
    );
    return () => {
      alive = false;
      if (created) URL.revokeObjectURL(created);
    };
  }, [path]);
  return url;
}
