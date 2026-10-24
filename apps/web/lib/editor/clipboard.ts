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
    memory = raw ? asClip(JSON.parse(raw)) : null;
  } catch {
    memory = null;
  }
  return memory;
}

/** Only a clip of the shape we write (older builds, hand edits: ignored). */
export function asClip(v: unknown): Clip | null {
  if (!v || typeof v !== 'object') return null;
  const c = v as Record<string, unknown>;
  return typeof c.level === 'number' && Array.isArray(c.rooms) && Array.isArray(c.seats)
    ? (v as Clip)
    : null;
}
