'use client';

import { LayoutTemplate } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { FLOOR_TEMPLATES, templateChanges, templateDesks } from '@/lib/editor/templates';
import type { LayoutEditorState } from '@/lib/editor/use-layout-editor';
import { seatSize } from '@/lib/map-geometry';
import type { FloorMap } from '@/lib/types';

/**
 * On an empty floor: start from an example office (one editor action, so Undo removes it) or
 * draw everything by hand.
 */
export function TemplatePicker({
  map,
  editor,
  onDismiss,
}: {
  map: FloorMap;
  editor: LayoutEditorState;
  onDismiss: () => void;
}) {
  const t = useTranslations('editor.templates');
  const floor = map.floor;
  const names = {
    openSpace: (n: number) => t('openSpace', { letter: String.fromCharCode(64 + n) }),
    meeting: (n: number) => t('meeting', { n }),
    office: (n: number) => t('office', { n }),
    common: t('common'),
  };
  return (
    <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center p-4">
      <section
        className="pointer-events-auto grid w-full max-w-md gap-4 rounded-xl border bg-card p-5 shadow-lg"
        aria-labelledby="template-title"
        data-testid="template-picker"
      >
        <div className="grid gap-1">
          <h2 id="template-title" className="flex items-center gap-2 font-semibold">
            <LayoutTemplate className="size-4 text-muted-foreground" aria-hidden />
            {t('title')}
          </h2>
          <p className="text-sm text-muted-foreground">{t('hint')}</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {FLOOR_TEMPLATES.map((id) => (
            <Button
              key={id}
              variant="outline"
              className="h-auto flex-col gap-0.5 py-3"
              onClick={() => {
                editor.commit(
                  templateChanges(id, {
                    doc: editor.doc,
                    level: floor.level,
                    numbering: floor.seatNumbering,
                    size: seatSize(floor),
                    names,
                  }),
                );
                toast.success(t('added'));
              }}
            >
              <span className="font-medium">{t(id)}</span>
              <span className="text-xs text-muted-foreground">
                {t('desks', { count: templateDesks(id) })}
              </span>
            </Button>
          ))}
        </div>
        <Button variant="ghost" className="justify-self-center" onClick={onDismiss}>
          {t('dismiss')}
        </Button>
      </section>
    </div>
  );
}
