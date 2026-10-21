import type { Clip } from './ops';

const KEY = 'seatline.layoutClipboard';
let memory: Clip | null = null;

/** Keep copied rooms/seats so they can be pasted on any floor (also after a reload). */
export function writeClip(clip: Clip) {
  memory = clip;
  try {
    localStorage.setItem(KEY, JSON.stringify(clip));
  } catch {
    // private mode / storage full: the in-memory copy still works
  }
}

export function readClip(): Clip | null {
  if (memory) return memory;
  try {
    const raw = localStorage.getItem(KEY);
    memory = raw ? (JSON.parse(raw) as Clip) : null;
  } catch {
    memory = null;
  }
  return memory;
}
