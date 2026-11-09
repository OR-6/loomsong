import { describe, expect, it } from 'vitest';
import { LevelFlow, TIMING, firstLeverForRow0, type FlowHooks } from '../src/app/level-flow';
import { LoomModel } from '../src/loom/loom-model';
import { LEVELS, levelAt } from '../src/puzzle/catalog';
import type { Progress } from '../src/persistence/progress';

function setup(progress: Progress = { level: 0, best: {}, tutorialDone: false, theme: 'toy' }) {
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
  const flow = new LevelFlow(model, levelAt, progress, hooks);
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
    // Sprout: stem rows on lever 0 ×3, then the two leaves on lever 1 → 3 flips = par
    weave(model, [[1, 0], [1, 0], [1, 0], [0, 1]]);
    expect(log).toContain('hint shuttle 0');
    expect(log).toContain('win 3');
    expect(flow.phase).toBe('won');
    for (let t = 0; t < 10 && flow.phase !== 'play'; t += 0.05) flow.update(0.05);
    // melody: every lifted warp of every row plucked
    expect(plucks.length).toBe(2 + 2 + 2 + 2);
    expect(flow.index).toBe(1);
    expect(log.at(-2)).toBe('load tulip 1');
    expect(flow.progress.best.sprout).toBe(3);
    expect(flow.progress.level).toBe(1);
  });

  it('wrong rows never win; undo fixes them; extra flips cost stars', () => {
    const { model, flow, log } = setup({ level: 0, best: {}, tutorialDone: true, theme: 'toy' });
    flow.start();
    weave(model, [[0, 1]]); // wrong first row
    expect(flow.phase).toBe('play');
    model.undo();
    model.setLatched(1, false);
    weave(model, [[1, 0], [1, 0], [1, 0], [0, 1]]);
    expect(log.some((l) => l.startsWith('win'))).toBe(true);
    expect(flow.lastStars).toBe(2); // 5 flips vs par 3
  });

  it('timing: playback starts after the win pause', () => {
    const { model, flow, plucks } = setup({ level: 0, best: {}, tutorialDone: true, theme: 'toy' });
    flow.start();
    weave(model, [[1, 0], [1, 0], [1, 0], [0, 1]]);
    flow.update(TIMING.winPause - 0.1);
    expect(plucks.length).toBe(0);
    flow.update(0.2);
    expect(plucks.length).toBe(2);
  });

  it('after the last picture the sequence continues into bonus patterns', () => {
    const { flow } = setup({ level: 18, best: {}, tutorialDone: true, theme: 'toy' });
    flow.start();
    expect(flow.level.id).toBe('bonus1');
  });

  it('challenge: weaving a shared cloth does not advance progress, then resumes', () => {
    const { model, flow } = setup({ level: 4, best: { sprout: 3 }, tutorialDone: true, theme: 'toy' });
    flow.startChallenge({ id: 'shared', name: 'Shared cloth', tieUp: [0x0f, 0xf0], target: [0x0f, 0xff], rootMidi: 60, par: 2 });
    expect(flow.challenge).toBe(true);
    weave(model, [[1, 0], [1, 1]]);
    expect(flow.lastStars).toBe(3);
    expect(flow.progress.level).toBe(4);
    expect(flow.progress.best.shared).toBeUndefined();
    expect(flow.progress.lastCloth?.rows).toEqual([0x0f, 0xff]);
    for (let t = 0; t < 10 && flow.phase !== 'play'; t += 0.05) flow.update(0.05);
    expect(flow.challenge).toBe(false);
    expect(flow.index).toBe(4);
  });

  it('first lever hint picks a lever that weaves row 0', () => {
    for (const l of LEVELS) {
      const k = firstLeverForRow0(l);
      expect(l.tieUp[k] & ~l.target[0]).toBe(0);
    }
  });
});
