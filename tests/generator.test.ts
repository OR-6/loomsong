import { describe, expect, it } from 'vitest';
import { difficultyFor, generateLevel, rng } from '../src/puzzle/generator';
import { levelAt } from '../src/puzzle/catalog';
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

  it('level sequence: authored 1–3, generated 4+, stable ids', () => {
    expect(levelAt(0).id).toBe('a1');
    expect(levelAt(2).id).toBe('a3');
    expect(levelAt(3).id).toBe('g4');
    expect(levelAt(5).id).toBe('g6');
    expect(levelAt(20).id).toBe('g21');
    expect(levelAt(4)).toBe(levelAt(4)); // cached
    for (let i = 3; i < 30; i++) expect(levelAt(i).target.length).toBe(difficultyFor(i).rows);
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
