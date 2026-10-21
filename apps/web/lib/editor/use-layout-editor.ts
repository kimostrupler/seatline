'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useCallback, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { api } from '../api';
import { keys } from '../queries';
import type { FloorMap } from '../types';
import { applyChanges, inverse, isEmpty, type Changes, type LayoutDoc } from './ops';

interface HistoryEntry {
  forward: Changes;
  backward: Changes;
}

export interface Selection {
  seats: string[];
  rooms: string[];
}

export const NO_SELECTION: Selection = { seats: [], rooms: [] };

/**
 * Layout editing with instant save: a change shows immediately, is sent to the API
 * (one request at a time, in order), and the server's answer becomes the new truth.
 * Undo/redo replay the opposite changes — the server keeps both in the audit log.
 */
export function useLayoutEditor(map: FloorMap) {
  const t = useTranslations('editor');
  const qc = useQueryClient();
  const floorId = map.floor.id;
  const [pending, setPending] = useState<Changes[]>([]);
  const [selection, setSelection] = useState<Selection>(NO_SELECTION);
  const [stacks, setStacks] = useState<{ undo: HistoryEntry[]; redo: HistoryEntry[] }>({
    undo: [],
    redo: [],
  });
  const queue = useRef<Promise<void>>(Promise.resolve());

  const doc: LayoutDoc = useMemo(
    () =>
      pending.reduce((d, c) => applyChanges(d, c, floorId), { rooms: map.rooms, seats: map.seats }),
    [map.rooms, map.seats, pending, floorId],
  );
  const docRef = useRef(doc);
  docRef.current = doc;

  const send = useCallback(
    (c: Changes, onError?: () => void) => {
      setPending((p) => [...p, c]);
      queue.current = queue.current.then(async () => {
        try {
          const next = await api<FloorMap>(`/floors/${floorId}/layout`, {
            method: 'PATCH',
            body: c,
          });
          qc.setQueryData(keys.floorMap(floorId), next);
        } catch (error) {
          onError?.();
          toast.error(
            t('saveFailed', { message: error instanceof Error ? error.message : String(error) }),
          );
          await qc.invalidateQueries({ queryKey: keys.floorMap(floorId) });
        } finally {
          setPending((p) => p.filter((x) => x !== c));
        }
      });
    },
    [floorId, qc, t],
  );

  /** Apply and save one user action (undoable). */
  const commit = useCallback(
    (c: Changes) => {
      if (isEmpty(c)) return;
      const entry = { forward: c, backward: inverse(docRef.current, c) };
      setStacks((s) => ({ undo: [...s.undo, entry], redo: [] }));
      send(c, () => setStacks((s) => ({ ...s, undo: s.undo.filter((e) => e !== entry) })));
      // keep only selected things that still exist
      setSelection((sel) => ({
        seats: sel.seats.filter((id) => !c.seats.delete.includes(id)),
        rooms: sel.rooms.filter((id) => !c.rooms.delete.includes(id)),
      }));
    },
    [send],
  );

  const undo = useCallback(() => {
    const entry = stacks.undo.at(-1);
    if (!entry) return toast(t('nothingToUndo'));
    setStacks((s) => ({ undo: s.undo.slice(0, -1), redo: [...s.redo, entry] }));
    send(entry.backward);
    setSelection(NO_SELECTION);
  }, [stacks.undo, send, t]);

  const redo = useCallback(() => {
    const entry = stacks.redo.at(-1);
    if (!entry) return;
    setStacks((s) => ({ undo: [...s.undo, entry], redo: s.redo.slice(0, -1) }));
    send(entry.forward);
  }, [stacks.redo, send]);

  return {
    doc,
    selection,
    setSelection,
    commit,
    undo,
    redo,
    canUndo: stacks.undo.length > 0,
    canRedo: stacks.redo.length > 0,
    saving: pending.length > 0,
  };
}

export type LayoutEditorState = ReturnType<typeof useLayoutEditor>;
