'use client';

import { useTranslations } from 'next-intl';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { platformKeys } from '@/lib/platform-keys';

const SHORTCUTS = [
  ['V', 'select'],
  ['S', 'seat'],
  ['P', 'room'],
  ['B', 'rect'],
  ['M', 'measure'],
  ['⌘C', 'copy'],
  ['⌘X', 'cut'],
  ['⌘V', 'paste'],
  ['⌘D', 'duplicate'],
  ['⌘A', 'selectAll'],
  ['⌘Z', 'undo'],
  ['⇧⌘Z', 'redo'],
  ['⌫', 'delete'],
  ['← ↑ → ↓', 'nudge'],
  ['R', 'rotate'],
  ['Esc', 'escape'],
  ['Space', 'pan'],
  ['Alt', 'noSnap'],
  ['Shift', 'addToSelection'],
  ['2×', 'corners'],
  ['?', 'help'],
] as const;

/** Every editor shortcut in one list (opens with "?"). */
export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations('shortcuts');
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-md">
        <DialogTitle>{t('title')}</DialogTitle>
        <DialogDescription>{t('body')}</DialogDescription>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          {SHORTCUTS.map(([keys, id]) => (
            <div key={id} className="contents">
              <dt>
                <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs whitespace-nowrap">
                  {platformKeys(keys)}
                </kbd>
              </dt>
              <dd className="text-muted-foreground">{t(id)}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
