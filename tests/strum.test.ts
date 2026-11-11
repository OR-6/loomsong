import { describe, expect, it } from 'vitest';
import { LoomController, type HandInput } from '../src/loom/loom-controller';
import { LoomModel } from '../src/loom/loom-model';
import { warpX } from '../src/config';

const away: HandInput = { tracked: false, pinching: false, edge: 'none', pinch: { x: 0, y: 1, z: 0 }, index: { x: 0, y: 1, z: 0 }, indexVel: { x: 0, y: 0, z: 0 } };
const tip = (x: number, pinching = false): HandInput => ({
  tracked: true, pinching, edge: 'none', pinch: { x, y: 0.2, z: 0.02 }, index: { x, y: 0.03, z: 0.02 }, indexVel: { x: 0, y: 0, z: 0 }, aperture: 0.06,
});

describe('finger strum', () => {
  it('a fingertip sweeping across the threads plucks each one once, in order', () => {
    const c = new LoomController(new LoomModel([0x0f, 0xf0]));
    const notes: number[] = [];
    c.hooks.strum = (i) => notes.push(i);
    for (let f = 0; f <= 20; f++) c.update({ right: tip(warpX(0) - 0.02 + (f / 20) * (warpX(7) - warpX(0) + 0.04)), left: away }, 1 / 72);
    expect(notes).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });
  it('a pinching hand (dragging something) never strums', () => {
    const c = new LoomController(new LoomModel([0x0f, 0xf0]));
    let n = 0;
    c.hooks.strum = () => n++;
    for (let f = 0; f <= 20; f++) c.update({ right: tip(-0.1 + f * 0.01, true), left: away }, 1 / 72);
    expect(n).toBe(0);
  });
});
