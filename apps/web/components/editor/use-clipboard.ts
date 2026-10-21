'use client';

import { useTranslations } from 'next-intl';
import { readClip, writeClip } from '@/lib/editor/clipboard';
import { clipSelection, pasteClip, pasteOffset } from '@/lib/editor/ops';
import type { LayoutEditorState } from '@/lib/editor/use-layout-editor';
import { SEAT_W } from '@/lib/map-geometry';
import type { Floor } from '@/lib/types';

/** Copy the selection / paste it on this floor (works across floors and reloads). */
export function useClipboard(editor: LayoutEditorState, floor: Pick<Floor, 'level'>) {
  const t = useTranslations('editor');
  const { doc, selection, commit, setSelection } = editor;

  const copy = () => {
    if (!selection.seats.length && !selection.rooms.length) return false;
    writeClip(clipSelection(doc, selection, floor.level));
    return true;
  };

  const paste = () => {
    const clip = readClip();
    if (!clip || (!clip.rooms.length && !clip.seats.length)) return false;
    const offset = pasteOffset(doc, clip, SEAT_W + 16);
    const { changes: c, selection: next } = pasteClip(
      doc,
      clip,
      floor.level,
      offset.x,
      offset.y,
      () => crypto.randomUUID(),
      (name) => t('copy', { name }),
    );
    commit(c);
    setSelection(next);
    return true;
  };

  return { copy, paste };
}

export type ClipboardActions = ReturnType<typeof useClipboard>;
