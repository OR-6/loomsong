import { describe, expect, it } from 'vitest';
import { Placement } from '../src/app/placement';

const DT = 1 / 72;
const flat = (y: number) => ({ x: 0, y, z: -0.35, radius: 0.02, upDot: 0.95 });

describe('set-the-table placement', () => {
  it('places after ~1 s of a flat, still palm', () => {
    const p = new Placement();
    let placed = false;
    let frames = 0;
    while (!placed && frames < 200) {
      placed = p.update(flat(0.77), [], DT);
      frames++;
    }
    expect(placed).toBe(true);
    expect(frames).toBeGreaterThanOrEqual(57); // 0.8 s hold
    expect(frames).toBeLessThan(64);
    expect(p.deskY).toBeCloseTo(0.75, 5);
    expect(p.source).toBe('palm');
  });

  it('snaps to a horizontal plane within ±5 cm', () => {
    const p = new Placement();
    for (let i = 0; i < 100 && p.phase !== 'placed'; i++) p.update(flat(0.77), [0.455, 0.72], DT);
    expect(p.deskY).toBe(0.72);
    expect(p.source).toBe('plane');
  });

  it('ignores tracking jitter (±3 mm) while the palm rests', () => {
    const p = new Placement();
    let i = 0;
    for (; i < 200 && p.phase !== 'placed'; i++) {
      p.update({ ...flat(0.77), x: (Math.random() - 0.5) * 0.006, z: -0.35 + (Math.random() - 0.5) * 0.006 }, [], DT);
    }
    expect(p.phase).toBe('placed');
    expect(i).toBeLessThan(80);
  });

  it('rejects a lap (65 cm below the eyes) unless a table plane agrees', () => {
    const p = new Placement();
    for (let i = 0; i < 150; i++) p.update(flat(0.95), [], DT, 1.6);
    expect(p.phase).toBe('waiting');
    for (let i = 0; i < 150 && p.phase !== 'placed'; i++) p.update(flat(0.95), [0.93], DT, 1.6);
    expect(p.phase).toBe('placed');
    expect(p.source).toBe('plane');
  });

  it('rejects a flat palm held at face height (not a desk)', () => {
    const p = new Placement();
    for (let i = 0; i < 150; i++) p.update(flat(1.5), [], DT, 1.6);
    expect(p.phase).toBe('waiting');
    for (let i = 0; i < 100 && p.phase !== 'placed'; i++) p.update(flat(1.0), [], DT, 1.6);
    expect(p.phase).toBe('placed');
  });

  it('does not place while the hand moves or is not flat', () => {
    const p = new Placement();
    for (let i = 0; i < 150; i++) p.update({ ...flat(0.77), x: i * 0.002 }, [], DT); // 14 cm/s drift
    expect(p.phase).not.toBe('placed');
    for (let i = 0; i < 150; i++) p.update({ ...flat(0.77), upDot: 0.3 }, [], DT);
    expect(p.phase).toBe('waiting');
  });
});
