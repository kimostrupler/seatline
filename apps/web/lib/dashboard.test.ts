import type { Widget } from '@seatline/shared';
import { describe, expect, it } from 'vitest';
import { addWidget, canSee, moveWidget, removeWidget, resizeWidget } from './dashboard';

const list: Widget[] = [
  { id: 'a', type: 'summary', size: 'wide' },
  { id: 'b', type: 'trend', size: 'wide' },
  { id: 'c', type: 'mySeat', size: 'small' },
];
const ids = (l: Widget[]) => l.map((w) => w.id).join('');

describe('dashboard layout', () => {
  it('moves widgets forwards and backwards, clamped to the list', () => {
    expect(ids(moveWidget(list, 0, 2))).toBe('bca');
    expect(ids(moveWidget(list, 2, 0))).toBe('cab');
    expect(ids(moveWidget(list, 1, 99))).toBe('acb');
    expect(moveWidget(list, 1, 1)).toBe(list);
  });

  it('adds at the top with the widget’s normal size; resizes and removes', () => {
    const added = addWidget(list, 'departments', () => 'n');
    expect(added[0]).toEqual({ id: 'n', type: 'departments', size: 'full' });
    expect(resizeWidget(list, 'c', 'full')[2]!.size).toBe('full');
    expect(ids(removeWidget(list, 'b'))).toBe('ac');
  });

  it('only shows widgets the role may see', () => {
    expect(canSee('activity', 'viewer')).toBe(false);
    expect(canSee('activity', 'editor')).toBe(true);
    expect(canSee('sync', 'editor')).toBe(false);
    expect(canSee('summary', 'viewer')).toBe(true);
  });
});
