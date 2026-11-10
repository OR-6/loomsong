import { describe, expect, it } from 'vitest';
import { BOBBIN, LEVER, LOOM, PINCH, SHUTTLE, leverX, warpX, shuttleY } from '../src/config';
import { LoomController, type HandInput } from '../src/loom/loom-controller';
import { LoomModel } from '../src/loom/loom-model';
import { PinchDetector } from '../src/input/pinch';

const DT = 1 / 72;
const TIE = [0b00010001, 0b00100010, 0b01000100, 0b10001000];

function idle(): HandInput {
  return {
    tracked: false, pinching: false, edge: 'none',
    pinch: { x: 0, y: 0.2, z: 0 }, index: { x: 0, y: 0.2, z: 0 }, indexVel: { x: 0, y: 0, z: 0 },
  };
}

/**
 * Synthetic joint stream: a hand that pinches at `from`, slides to `to`
 * over `seconds`, then opens. Pinch state comes from a real PinchDetector
 * fed thumb–index distances, optionally with jitter.
 */
function* slide(
  from: { x: number; y: number; z: number },
  to: { x: number; y: number; z: number },
  seconds: number,
  opts: { jitter?: number; openEarlyAt?: number } = {},
): Generator<HandInput> {
  const det = new PinchDetector(PINCH);
  const n = Math.round(seconds / DT);
  const j = () => (opts.jitter ? (Math.random() * 2 - 1) * opts.jitter : 0);
  const frame = (p: { x: number; y: number; z: number }, dist: number): HandInput => {
    const edge = det.update(dist, DT);
    return {
      tracked: true, pinching: det.pinching, edge,
      pinch: { x: p.x + j(), y: p.y + j(), z: p.z + j() },
      index: { x: p.x, y: p.y + 0.01, z: p.z }, indexVel: { x: 0, y: 0, z: 0 },
    };
  };
  for (let i = 0; i < 4; i++) yield frame(from, 0.06 - i * 0.012); // closing
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    if (opts.openEarlyAt !== undefined && t > opts.openEarlyAt) break;
    yield frame(
      { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t, z: from.z + (to.z - from.z) * t },
      0.008,
    );
  }
  yield frame(to, 0.05); // open
}

function run(c: LoomController, side: 'left' | 'right', stream: Iterable<HandInput>, settle = 1) {
  const other = idle();
  for (const h of stream) c.update(side === 'right' ? { right: h, left: other } : { left: h, right: other }, DT);
  for (let i = 0; i < settle * 72; i++) c.update({ left: idle(), right: idle() }, DT);
}

const knob = (k: number, z: number = LEVER.restZ) => ({ x: leverX(k, 1), y: LEVER.knobY, z });

describe('lever slide constraint', () => {
  it('latches when slid away past half travel and stays constrained to Z', () => {
    const m = new LoomModel([...TIE]);
    const c = new LoomController(m);
    // slide lever 1 away, drifting sideways and up: projection keeps it on its track
    run(c, 'right', slide(knob(1), { x: leverX(1, 1) + 0.02, y: 0.05, z: LEVER.restZ - 0.045 }, 0.5));
    expect(m.latched).toEqual([false, true, false, false]);
    expect(c.levers[1].t).toBe(1);
    expect(m.shed).toBe(TIE[1]);
  });

  it('snaps back to rest when released before half travel', () => {
    const m = new LoomModel([...TIE]);
    const c = new LoomController(m);
    run(c, 'right', slide(knob(2), knob(2, LEVER.restZ - 0.015), 0.3));
    expect(m.latched[2]).toBe(false);
    expect(c.levers[2].t).toBe(0);
  });

  it('clamps beyond the end of travel', () => {
    const m = new LoomModel([...TIE]);
    const c = new LoomController(m);
    const stream = [...slide(knob(0), knob(0, LEVER.restZ - 0.2), 0.4)];
    const other = idle();
    for (const h of stream.slice(0, -1)) c.update({ right: h, left: other }, DT);
    expect(c.levers[0].t).toBeLessThanOrEqual(1);
    expect(c.levers[0].t).toBeGreaterThan(0.95);
  });

  it('ignores pinches outside the grab radius', () => {
    const m = new LoomModel([...TIE]);
    const c = new LoomController(m);
    const far = { ...knob(0), y: LEVER.knobY + PINCH.grabRadiusM + 0.01 };
    run(c, 'right', slide(far, { ...far, z: far.z - 0.05 }, 0.3));
    expect(m.latched[0]).toBe(false);
  });

  it('works under 3 mm jitter', () => {
    const m = new LoomModel([...TIE]);
    const c = new LoomController(m);
    run(c, 'left', slide(knob(3), knob(3, LEVER.restZ - 0.05), 0.5, { jitter: 0.003 }));
    expect(m.latched[3]).toBe(true);
  });
});

describe('shuttle pass', () => {
  const sh = (x: number) => ({ x, y: shuttleY(x), z: SHUTTLE.z });

  it('a full slide commits one row equal to the shed and strums lifted warps in order', () => {
    const m = new LoomModel([...TIE]);
    const plucks: number[] = [];
    const c = new LoomController(m, { pluck: (i) => plucks.push(i) });
    c.toggleLever(0); // lifts warps 0 and 4
    run(c, 'right', slide(sh(SHUTTLE.minX), sh(SHUTTLE.maxX + 0.02), 0.6));
    expect(m.rows).toEqual([TIE[0]]);
    expect(m.shuttleSide).toBe(1);
    expect(plucks).toEqual([0, 4]);
  });

  it('released past 60% completes the pass automatically', () => {
    const m = new LoomModel([...TIE]);
    const c = new LoomController(m);
    const x = SHUTTLE.minX + (SHUTTLE.maxX - SHUTTLE.minX) * 0.7;
    run(c, 'right', slide(sh(SHUTTLE.minX), sh(x), 0.4), 2);
    expect(m.rows.length).toBe(1);
    expect(c.shuttle.t).toBe(1);
  });

  it('released before 60% returns without a row', () => {
    const m = new LoomModel([...TIE]);
    const c = new LoomController(m);
    const x = SHUTTLE.minX + (SHUTTLE.maxX - SHUTTLE.minX) * 0.4;
    run(c, 'right', slide(sh(SHUTTLE.minX), sh(x), 0.3), 2);
    expect(m.rows.length).toBe(0);
    expect(c.shuttle.t).toBe(0);
  });

  it('alternates direction: the second pass goes right-to-left', () => {
    const m = new LoomModel([...TIE]);
    const c = new LoomController(m);
    run(c, 'right', slide(sh(SHUTTLE.minX), sh(SHUTTLE.maxX), 0.5));
    c.toggleLever(1);
    run(c, 'right', slide(sh(SHUTTLE.maxX), sh(SHUTTLE.minX), 0.5));
    expect(m.rows).toEqual([0, TIE[1]]);
    expect(m.shuttleSide).toBe(0);
  });
});

describe('poke alternative', () => {
  it('a downward poke toggles a lever; a poke on the shuttle auto-throws', () => {
    const m = new LoomModel([...TIE]);
    const c = new LoomController(m);
    const k = knob(2);
    const poke = (p: { x: number; y: number; z: number }): HandInput[] => [
      { ...idle(), tracked: true, index: { ...p, y: p.y + 0.05 }, indexVel: { x: 0, y: -0.3, z: 0 } },
      { ...idle(), tracked: true, index: { ...p, y: p.y + 0.004 }, indexVel: { x: 0, y: -0.3, z: 0 } },
      { ...idle(), tracked: true, index: { ...p, y: p.y + 0.06 }, indexVel: { x: 0, y: 0.3, z: 0 } },
    ];
    run(c, 'right', poke(k), 0.5);
    expect(m.latched[2]).toBe(true);
    run(c, 'right', poke({ x: SHUTTLE.minX, y: shuttleY(SHUTTLE.minX), z: SHUTTLE.z }), 2);
    expect(m.rows).toEqual([TIE[2]]);
  });
});

describe('geometry sanity', () => {
  it('warps sit inside the frame and outside the lever bank', () => {
    expect(Math.abs(warpX(0))).toBeLessThan(LOOM.frameHalfWidth);
    expect(leverX(0, 1)).toBeGreaterThan(LOOM.frameHalfWidth);
  });
});

describe('undo bobbin', () => {
  const bob = (dz = 0) => ({ x: -BOBBIN.x, y: BOBBIN.y, z: BOBBIN.z + dz });
  it('pinch-and-pull unpicks the last row and returns', () => {
    const m = new LoomModel([...TIE]);
    const c = new LoomController(m);
    c.toggleLever(0);
    c.throwShuttle();
    for (let i = 0; i < 144; i++) c.update({ left: idle(), right: idle() }, DT);
    expect(m.rows.length).toBe(1);
    expect(m.shuttleSide).toBe(1);
    run(c, 'right', slide(bob(), bob(0.035), 0.4));
    expect(m.rows.length).toBe(0);
    expect(m.shuttleSide).toBe(0);
    expect(c.bobbin.t).toBe(0);
    expect(c.shuttle.t).toBe(0);
  });
  it('a short pull does nothing; a poke undoes', () => {
    const m = new LoomModel([...TIE]);
    const c = new LoomController(m);
    m.commitRow();
    run(c, 'right', slide(bob(), bob(0.01), 0.3));
    expect(m.rows.length).toBe(1);
    const p = bob();
    run(c, 'right', [
      { ...idle(), tracked: true, index: { ...p, y: p.y + 0.05 }, indexVel: { x: 0, y: -0.3, z: 0 } },
      { ...idle(), tracked: true, index: { ...p, y: p.y + 0.004 }, indexVel: { x: 0, y: -0.3, z: 0 } },
    ]);
    expect(m.rows.length).toBe(0);
  });
  it('inactive levers cannot be grabbed (2-lever level)', () => {
    const m = new LoomModel([0b1111, 0b11110000]);
    const c = new LoomController(m);
    run(c, 'right', slide(knob(3), knob(3, LEVER.restZ - 0.05), 0.4));
    expect(m.latched[3]).toBeFalsy();
  });
});
