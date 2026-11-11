import { describe, expect, it } from 'vitest';
import { loadProgress, saveProgress } from '../src/persistence/progress';
import { LoomController, type HandInput } from '../src/loom/loom-controller';
import { LoomModel } from '../src/loom/loom-model';

const away: HandInput = { tracked: false, pinching: false, edge: 'none', pinch: { x: 0, y: 1, z: 0 }, index: { x: 0, y: 1, z: 0 }, indexVel: { x: 0, y: 0, z: 0 } };
const hand = (x: number, y: number, z: number, pinching: boolean, edge: HandInput['edge'] = 'none'): HandInput => ({
  tracked: true, pinching, edge, pinch: { x, y, z }, index: { x, y: y + 0.05, z }, indexVel: { x: 0, y: 0, z: 0 }, aperture: pinching ? 0.01 : 0.06,
});
const SPOT = { x: -0.4, y: 0.06, z: 0.03 };

function rig() {
  const c = new LoomController(new LoomModel([0x0f, 0xf0]));
  c.plushSpots[0] = SPOT;
  const log: string[] = [];
  c.hooks.plush = (i) => log.push(`sing ${i}`);
  c.hooks.carry = (i) => log.push(`carry ${i}`);
  c.hooks.drop = (i, p) => log.push(p ? `drop ${i} ${p.x.toFixed(2)}` : `back ${i}`);
  return { c, log };
}

describe('carrying a plush', () => {
  it('a pinch and let-go without moving makes it sing', () => {
    const { c, log } = rig();
    c.update({ right: hand(SPOT.x, SPOT.y, SPOT.z, true, 'start'), left: away }, 1 / 72);
    c.update({ right: hand(SPOT.x + 0.01, SPOT.y, SPOT.z, true), left: away }, 1 / 72);
    c.update({ right: hand(SPOT.x + 0.01, SPOT.y, SPOT.z, false, 'end'), left: away }, 1 / 72);
    expect(log).toEqual(['sing 0']);
  });
  it('a pinch that moves carries it, and letting go sets it down there', () => {
    const { c, log } = rig();
    c.update({ right: hand(SPOT.x, SPOT.y, SPOT.z, true, 'start'), left: away }, 1 / 72);
    for (let f = 1; f <= 10; f++) c.update({ right: hand(SPOT.x + f * 0.02, SPOT.y, SPOT.z + f * 0.01, true), left: away }, 1 / 72);
    c.update({ right: hand(SPOT.x + 0.2, SPOT.y, SPOT.z + 0.1, false, 'end'), left: away }, 1 / 72);
    expect(log.filter((l) => l.startsWith('carry')).length).toBeGreaterThan(5);
    expect(log.at(-1)).toBe('drop 0 -0.20');
    expect(log).not.toContain('sing 0');
  });
  it('a carry cut short (the level is won mid-carry) sends it back', () => {
    const { c, log } = rig();
    c.update({ right: hand(SPOT.x, SPOT.y, SPOT.z, true, 'start'), left: away }, 1 / 72);
    for (let f = 1; f <= 5; f++) c.update({ right: hand(SPOT.x + f * 0.02, SPOT.y, SPOT.z, true), left: away }, 1 / 72);
    c.releaseAll();
    expect(log.at(-1)).toBe('back 0');
  });
});

describe('the desk is remembered', () => {
  it('keeps placed plushes and the loom pose, and drops anything malformed', () => {
    const p = loadProgress();
    p.placed = { sprout: [0.3, 0.19], bad: [Number.NaN, 1] as [number, number], far: [5, 0] };
    p.loom = { uuid: 'abc', x: 0.1, y: 0.8, z: -0.3, yaw: 0.2, side: -1, source: 'plane' };
    saveProgress(p);
    const q = loadProgress();
    expect(q.placed).toEqual({ sprout: [0.3, 0.19] });
    expect(q.loom).toEqual(p.loom);
    saveProgress({ ...q, loom: { ...q.loom!, uuid: '' } });
    expect(loadProgress().loom).toBeUndefined();
  });
});
