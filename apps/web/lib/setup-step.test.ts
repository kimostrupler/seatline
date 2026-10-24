import { describe, expect, it } from 'vitest';
import { setupStep } from './setup-step';

describe('setup step of a workspace (owner page)', () => {
  it('names the first step not done yet', () => {
    expect(setupStep({ seats: 0, people: 1, seated: 0 })).toBe('desks');
    expect(setupStep({ seats: 33, people: 1, seated: 0 })).toBe('people');
    expect(setupStep({ seats: 33, people: 20, seated: 0 })).toBe('seated');
    expect(setupStep({ seats: 33, people: 20, seated: 4 })).toBe('done');
  });
});
