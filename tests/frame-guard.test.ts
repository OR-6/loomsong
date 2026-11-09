import { describe, expect, it } from 'vitest';
import { FrameGuard } from '../src/app/frame-guard';

const run = (g: FrameGuard, interval: number, seconds: number, hz = 72) => {
  const changes: number[] = [];
  for (let t = 0; t < seconds; t += interval) {
    const c = g.sample(interval, hz);
    if (c !== null) changes.push(c);
  }
  return changes;
};

describe('frame guard', () => {
  it('holds level 0 at a steady 72 Hz', () => {
    const g = new FrameGuard();
    expect(run(g, 1 / 72, 30)).toEqual([]);
  });
  it('degrades after ~2 s of missed frames, one level at a time, max 2', () => {
    const g = new FrameGuard();
    expect(run(g, 1 / 50, 1.5)).toEqual([]);
    expect(run(g, 1 / 50, 1)).toEqual([1]);
    expect(run(g, 1 / 50, 10)).toEqual([2]);
  });
  it('recovers only after 10 s of headroom', () => {
    const g = new FrameGuard();
    run(g, 1 / 45, 6);
    expect(g.level).toBe(2);
    expect(run(g, 1 / 72, 9)).toEqual([]);
    expect(run(g, 1 / 72, 2)).toEqual([1]);
  });
  it('ignores pauses and nonsense deltas', () => {
    const g = new FrameGuard();
    expect(g.sample(2, 72)).toBeNull();
    expect(g.sample(0, 72)).toBeNull();
    expect(g.level).toBe(0);
  });
});
