import { describe, expect, it } from 'vitest';
import { Calibrator, deriveCalibration } from '../src/input/calibration';

const DT = 1 / 72;
function gauss() {
  const u = 1 - Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random());
}

function simulate(closed: number, jitter: number) {
  const c = new Calibrator();
  const mid = () => ({ x: 0.1 + gauss() * jitter, y: 0.8 + gauss() * jitter, z: -0.3 + gauss() * jitter });
  for (let p = 0; p < 3; p++) {
    for (let i = 0; i < 20; i++) c.update(0.08 - (0.08 - closed) * (i / 19), mid(), DT); // close
    for (let i = 0; i < 20; i++) c.update(closed + (0.08 - closed) * (i / 19), mid(), DT); // open
  }
  expect(c.step).toBe('hold');
  for (let i = 0; i < 72 * 2.2 && c.step !== 'done'; i++) c.update(closed, mid(), DT);
  return c;
}

describe('calibration', () => {
  it('typical hand → near-default tuning', () => {
    const c = simulate(0.006, 0.001);
    expect(c.step).toBe('done');
    expect(c.pinches).toBe(3);
    expect(c.result!.pinchScale).toBeGreaterThanOrEqual(0.75);
    expect(c.result!.pinchScale).toBeLessThanOrEqual(1.0);
    expect(c.result!.radiusMul).toBe(1);
  });
  it('limited pinch + tremor → larger thresholds, bigger targets, more smoothing', () => {
    const c = simulate(0.022, 0.005);
    expect(c.result!.pinchScale).toBeGreaterThan(1.5);
    expect(c.result!.radiusMul).toBeGreaterThan(1.6);
    expect(c.result!.minCutoff).toBeLessThan(1.0);
  });
  it('clamps to the spec ranges', () => {
    const r = deriveCalibration(0.05, 0.1, 0.02);
    expect(r.radiusMul).toBe(1.8);
    expect(r.pinchScale).toBeCloseTo(1.8, 6);
    expect(r.minCutoff).toBe(0.5);
  });
  it('a broken hold restarts the 2 s timer, but a brief tremor does not', () => {
    const c = simulate(0.006, 0.001);
    expect(c.step).toBe('done');
    const d = new Calibrator();
    for (let p = 0; p < 3; p++) {
      d.update(0.01, { x: 0, y: 0, z: 0 }, DT);
      d.update(0.07, { x: 0, y: 0, z: 0 }, DT);
    }
    for (let i = 0; i < 72; i++) d.update(0.01, { x: 0, y: 0, z: 0 }, DT);
    d.update(0.07, { x: 0, y: 0, z: 0 }, DT); // a one-frame tremor: the hold goes on
    expect(d.holdProgress).toBeGreaterThan(0);
    for (let i = 0; i < 30; i++) d.update(0.07, { x: 0, y: 0, z: 0 }, DT); // really let go
    expect(d.holdProgress).toBe(0);
    expect(d.step).toBe('hold');
  });
});
