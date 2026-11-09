import { describe, expect, it } from 'vitest';
import { LevelFlow, TIMING, firstLeverForRow0, type FlowHooks } from '../src/app/level-flow';
import { LoomModel } from '../src/loom/loom-model';
import { LEVELS } from '../src/puzzle/catalog';
import type { Progress } from '../src/persistence/progress';

function setup(progress: Progress = { level: 0, best: {}, tutorialDone: false }) {
  const log: string[] = [];
  const plucks: number[] = [];
  const hooks: FlowHooks = {
    load: (l, i) => log.push(`load ${l.id} ${i}`),
    status: () => {},
    win: (s) => log.push(`win ${s}`),
    pluck: (w) => plucks.push(w),
    glowRow: () => {},
    hint: (h, k) => log.push(`hint ${h} ${k}`),
    save: () => log.push('save'),
  };
  const model = new LoomModel([]);
  const flow = new LevelFlow(model, LEVELS, progress, hooks);
  return { model, flow, log, plucks };
}

function weave(model: LoomModel, states: number[][]) {
  for (const s of states) {
    s.forEach((v, k) => model.setLatched(k, v === 1));
    model.commitRow();
  }
}

describe('level flow', () => {
  it('level 1: hints, par win = 3 stars, playback melody, then level 2', () => {
    const { model, flow, log, plucks } = setup();
    flow.start();
    expect(log).toContain('hint lever 0');
    // a1 target: [L0, L0, L0+L1, L1] → flips 1,0,1,1 = 3 = par
    weave(model, [[1, 0], [1, 0], [1, 1], [0, 1]]);
    expect(log).toContain('hint shuttle 0');
    expect(log).toContain('win 3');
    expect(flow.phase).toBe('won');
    for (let t = 0; t < 10 && flow.phase !== 'play'; t += 0.05) flow.update(0.05);
    // melody: every lifted warp of every row plucked
    expect(plucks.length).toBe(4 + 4 + 8 + 4);
    expect(flow.index).toBe(1);
    expect(log.at(-2)).toBe('load a2 1');
    expect(flow.progress.best.a1).toBe(3);
    expect(flow.progress.level).toBe(1);
  });

  it('wrong rows never win; undo fixes them; extra flips cost stars', () => {
    const { model, flow, log } = setup({ level: 0, best: {}, tutorialDone: true });
    flow.start();
    weave(model, [[0, 1]]); // wrong first row
    expect(flow.phase).toBe('play');
    model.undo();
    model.setLatched(1, false);
    weave(model, [[1, 0], [1, 0], [1, 1], [0, 1]]);
    expect(log.some((l) => l.startsWith('win'))).toBe(true);
    expect(flow.lastStars).toBe(2); // 5 flips vs par 3
  });

  it('timing: playback starts after the win pause', () => {
    const { model, flow, plucks } = setup({ level: 0, best: {}, tutorialDone: true });
    flow.start();
    weave(model, [[1, 0], [1, 0], [1, 1], [0, 1]]);
    flow.update(TIMING.winPause - 0.1);
    expect(plucks.length).toBe(0);
    flow.update(0.2);
    expect(plucks.length).toBe(4);
  });

  it('first lever hint picks a lever that weaves row 0', () => {
    for (const l of LEVELS) {
      const k = firstLeverForRow0(l);
      expect(l.tieUp[k] & ~l.target[0]).toBe(0);
    }
  });
});
