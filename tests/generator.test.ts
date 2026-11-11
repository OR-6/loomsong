import { describe, expect, it } from 'vitest';
import { difficultyFor, generateLevel, rng } from '../src/puzzle/generator';
import { LEVELS, levelAt } from '../src/puzzle/catalog';
import { computePar, rowReachable } from '../src/puzzle/par';
import { LEVERS, WARPS } from '../src/config';

describe('generator', () => {
  it('is deterministic per seed', () => {
    expect(generateLevel(7, { levers: 3, rows: 6 })).toEqual(generateLevel(7, { levers: 3, rows: 6 }));
    const a = rng(1);
    const b = rng(1);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('500 seeds: valid, solvable by construction, par from DP', () => {
    for (let s = 1; s <= 500; s++) {
      const d = difficultyFor(3 + (s % 12));
      const l = generateLevel(s, d);
      expect(l.tieUp.length).toBe(d.levers);
      expect(l.tieUp.length).toBeLessThanOrEqual(LEVERS);
      expect(l.target.length).toBe(d.rows);
      expect(l.target.length).toBeLessThanOrEqual(12);
      expect(new Set(l.tieUp).size).toBe(l.tieUp.length);
      expect(l.tieUp.reduce((a, b) => a | b, 0)).toBe((1 << WARPS) - 1);
      for (const row of l.target) {
        expect(row).not.toBe(0);
        expect(rowReachable(l.tieUp, row)).toBe(true);
      }
      expect(l.par).toBe(computePar(l.tieUp, l.target));
      expect(Number.isFinite(l.par)).toBe(true);
      expect(l.name.split(' ').length).toBeLessThanOrEqual(5);
    }
  });

  it('bonus patterns follow the picture levels, with stable ids', () => {
    expect(levelAt(LEVELS.length).id).toBe('bonus1');
    expect(levelAt(20)).toBe(levelAt(20)); // cached
    for (let i = LEVELS.length; i < 40; i++) expect(levelAt(i).target.length).toBe(difficultyFor(i).rows);
  });

  it('levels 4–6 stay in the 30–90 s band (rows × par heuristic)', () => {
    for (let i = 3; i < 6; i++) {
      const l = levelAt(i);
      // ~4 s per pass + ~2 s per flip, untimed: a sanity envelope, not a promise
      const est = l.target.length * 4 + l.par * 2;
      expect(est).toBeGreaterThanOrEqual(30);
      expect(est).toBeLessThanOrEqual(90);
    }
  });
});
