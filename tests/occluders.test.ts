import { describe, expect, it } from 'vitest';
import { BONES } from '../src/input/occluders';

describe('hand occluder skeleton', () => {
  it('covers wrist→fingertip chains for all five fingers (24 bones)', () => {
    expect(BONES.length).toBe(24);
    for (const f of ['thumb', 'index-finger', 'middle-finger', 'ring-finger', 'pinky-finger']) {
      expect(BONES.some(([a, b]) => a === 'wrist' && b === `${f}-metacarpal`)).toBe(true);
      expect(BONES.some(([, b]) => b === `${f}-tip`)).toBe(true);
    }
    expect(BONES.some(([a, b]) => a.startsWith('thumb') && b === 'thumb-phalanx-intermediate')).toBe(false);
  });
});
