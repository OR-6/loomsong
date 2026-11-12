import { describe, expect, it } from 'vitest';
import { LevelFlow, TIMING, firstLeverForRow0, nextStep, type FlowHooks } from '../src/app/level-flow';
import { LoomModel } from '../src/loom/loom-model';
import { LEVELS, levelAt } from '../src/puzzle/catalog';
import type { Progress } from '../src/persistence/progress';
import type { Level } from '../src/puzzle/levels';

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
    // Sprout: the stem twice on lever 0, then stem + leaves (lever 1 joins) → 2 flips = par
    weave(model, [[1, 0], [1, 0], [1, 1]]);
    expect(log).toContain('hint shuttle 0');
    expect(log).toContain('win 3');
    expect(flow.phase).toBe('won');
    for (let t = 0; t < 10 && flow.phase !== 'play'; t += 0.05) flow.update(0.05);
    // melody: every lifted warp of every row plucked
    expect(plucks.length).toBe(2 + 2 + 4);
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
    weave(model, [[1, 0], [1, 0], [1, 1]]);
    expect(log.some((l) => l.startsWith('win'))).toBe(true);
    expect(flow.lastStars).toBe(2); // 4 flips vs par 2
  });

  it('timing: playback starts after the win pause', () => {
    const { model, flow, plucks } = setup({ level: 0, best: {}, tutorialDone: true, theme: 'toy' });
    flow.start();
    weave(model, [[1, 0], [1, 0], [1, 1]]);
    flow.update(TIMING.winPause - 0.1);
    expect(plucks.length).toBe(0);
    flow.update(0.2);
    expect(plucks.length).toBe(2);
  });

  it('after the last picture the sequence continues into bonus patterns', () => {
    const { flow } = setup({ level: LEVELS.length, best: {}, tutorialDone: true, theme: 'toy' });
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

  it('level 1 tutorial guides every row: goal once, undo a wrong row, then the two-lever aha', () => {
    const { model, flow, log } = setup();
    flow.start();
    expect(flow.tutorial).toBe(true);
    // Sprout row 0 = the stem, lever 0
    model.setLatched(0, true);
    expect(log.at(-1)).toBe('hint shuttle 0');
    model.commitRow();
    expect(log.at(-1)).toBe('hint card 0'); // the goal, said once
    for (let t = 0; t < TIMING.cardHint + 0.1; t += 0.05) flow.update(0.05);
    expect(log.at(-1)).toBe('hint knots 0'); // then what the knots mean, once
    for (let t = 0; t < TIMING.cardHint + 0.1; t += 0.05) flow.update(0.05);
    expect(log.at(-1)).toBe('hint shuttle 0'); // row 1 is the stem again: lever 0 is still up
    // a wrong row (lever 1 joins too early) → undo
    model.setLatched(1, true);
    expect(log.at(-1)).toBe('hint unlatch 1');
    model.commitRow();
    expect(log.at(-1)).toBe('hint undo 0');
    model.undo();
    expect(log.at(-1)).toBe('hint unlatch 1');
    model.setLatched(1, false);
    model.commitRow();
    // the top row: stem AND leaves, so lever 1 joins lever 0: first the player gets to find it
    expect(log.at(-1)).toBe('hint more 1');
    for (let t = 0; t < TIMING.moreWait + 0.1; t += 0.05) flow.update(0.05);
    expect(log.at(-1)).toBe('hint lever 1'); // still stuck: now the lever is shown
    model.setLatched(1, true);
    expect(log.at(-1)).toBe('hint combo 0'); // the aha, celebrated once
    for (let t = 0; t < TIMING.comboHint + 0.1; t += 0.05) flow.update(0.05);
    expect(log.at(-1)).toBe('hint shuttle 0');
    model.commitRow();
    expect(flow.phase).toBe('won');
    expect(flow.progress.tutorialDone).toBe(true);
  });

  it('the tutorial aha: a player who finds the second lever alone gets the celebration straight away', () => {
    const { model, flow, log } = setup();
    flow.start();
    model.setLatched(0, true);
    model.commitRow();
    for (let t = 0; t < 2 * TIMING.cardHint + 0.2; t += 0.05) flow.update(0.05);
    model.commitRow();
    expect(log.at(-1)).toBe('hint more 1'); // no pointing
    flow.update(1);
    model.setLatched(1, true); // found it
    expect(log.at(-1)).toBe('hint combo 0');
  });

  it('after the tutorial, idling shows a gentle hint that clears on the next touch', () => {
    const { model, flow, log } = setup({ level: 0, best: {}, tutorialDone: true, theme: 'toy' });
    flow.start();
    expect(flow.tutorial).toBe(false);
    for (let t = 0; t < TIMING.idleHint + 0.2; t += 0.1) flow.update(0.1);
    expect(log.at(-1)).toBe('hint lever 0'); // Garden: the exact lever
    model.setLatched(0, true);
    expect(log.at(-1)).toBe('hint none 0');
  });

  it('nextStep: undo a wrong row, else the fewest lever moves, else throw', () => {
    const lv = LEVELS[0];
    expect(nextStep(lv, [], [false, false]).step).toBe('lever');
    expect(nextStep(lv, [], [true, false]).step).toBe('shuttle');
    expect(nextStep(lv, [lv.target[0] ^ 1], [true, false]).step).toBe('undo');
    const s = nextStep(lv, [], [true, true]);
    expect(s).toEqual({ step: 'unlatch', lever: 1 });
  });

  it("Sea: a water row needs Pip's yarn swapped; the weft bit is woven in and costs no knot", () => {
    const boat = LEVELS.find((l) => l.id === 'boat')!;
    const water = boat.target[0];
    expect(water & 256).toBe(256);
    // with the right levers up, the next step is the yarn swap, then the throw
    const levers = [false, false, false, false];
    for (let s = 0; s < 1 << boat.tieUp.length; s++) {
      let m = 0;
      for (let k = 0; k < boat.tieUp.length; k++) if ((s >> k) & 1) m |= boat.tieUp[k];
      if (m === (water & 255)) { for (let k = 0; k < boat.tieUp.length; k++) levers[k] = !!((s >> k) & 1); break; }
    }
    expect(nextStep(boat, [], levers, 0).step).toBe('weft');
    expect(nextStep(boat, [], levers, 1).step).toBe('shuttle');
    const model = new LoomModel([...boat.tieUp]);
    levers.forEach((v, k) => model.setLatched(k, v));
    const flips = model.leverFlips;
    model.setWeft(1);
    expect(model.leverFlips).toBe(flips);
    expect(model.commitRow()).toBe(water);
  });

  it('two-colour levels hint the yarn swap as soon as the levers are right', () => {
    const idx = LEVELS.findIndex((l) => l.id === 'boat');
    const { model, flow, log } = setup({ level: idx, best: {}, tutorialDone: true, theme: 'toy' });
    flow.start(idx);
    const boat = flow.level;
    for (let s = 0; s < 1 << boat.tieUp.length; s++) {
      let m = 0;
      for (let k = 0; k < boat.tieUp.length; k++) if ((s >> k) & 1) m |= boat.tieUp[k];
      if (m === (boat.target[0] & 255)) { for (let k = 0; k < boat.tieUp.length; k++) if ((s >> k) & 1) model.setLatched(k, true); break; }
    }
    expect(log.at(-1)).toMatch(/^hint weft/);
    model.setWeft(1);
    expect(log.at(-1)).toMatch(/^hint none/);
  });
});

describe('friend pictures', () => {
  const table: Level = {
    id: 'table', name: 'Table', rootMidi: 60, par: 6, friend: 0b00011000,
    tieUp: [0b00100100, 0b00000011, 0b11000000],
    target: [0b00100100, 0b00100100, 0b11111111, 0b00111100, 0b00011000],
  };
  it('the legs need the friend off, the tabletop needs it on, the wrong feet are named', () => {
    expect(nextStep(table, [], [false, false, false], 0, 0)).toEqual({ step: 'lever', lever: 0 });
    expect(nextStep(table, [], [false, false, false], 0, 0b00011000).step).toBe('friendOff');
    const legs = [0b00100100, 0b00100100];
    expect(nextStep(table, legs, [true, false, false], 0, 0).step).toBe('friendOn');
    expect(nextStep(table, legs, [true, false, false], 0, 0b00111000)).toEqual({ step: 'lever', lever: 1 }); // wider feet that still fit the tabletop help too
    const vase = [...legs, 0b11111111];
    expect(nextStep(table, vase, [true, true, true], 0, 0b11000000).step).toBe('friendSwap'); // feet off to the side: not for the vase
    expect(nextStep(table, legs, [true, false, false], 0, 0b00011000)).toEqual({ step: 'lever', lever: 1 });
    expect(nextStep(table, legs, [true, true, true], 0, 0b00011000).step).toBe('shuttle');
  });
});
