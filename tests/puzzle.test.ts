import { describe, expect, it } from 'vitest';
import { AUTHORED } from '../src/puzzle/levels';
import { LEVELS } from '../src/puzzle/catalog';
import { computePar, rowReachable } from '../src/puzzle/par';
import { isWon, rowStatuses, stars } from '../src/puzzle/session';
import { LEVERS, WARPS } from '../src/config';

describe('par DP', () => {
  it('counts minimal flips from all-unlatched', () => {
    const tie = [0b0011, 0b1100];
    expect(computePar(tie, [0b0011])).toBe(1);
    expect(computePar(tie, [0b0011, 0b0011])).toBe(1);
    expect(computePar(tie, [0b0011, 0b1111, 0b1100])).toBe(3);
    expect(computePar(tie, [0])).toBe(0);
  });
  it('returns Infinity for unreachable rows', () => {
    expect(computePar([0b0011, 0b1100], [0b0110])).toBe(Infinity);
    expect(rowReachable([0b0011, 0b1100], 0b0110)).toBe(false);
  });
  it('prefers the cheaper of two lever states that weave the same row', () => {
    // row 0b0111 = A|B (2 flips) or C (1 flip)
    expect(computePar([0b0011, 0b0110, 0b0111], [0b0111])).toBe(1);
  });
});

describe('authored levels', () => {
  for (const l of AUTHORED) {
    it(`${l.id} is valid and solvable`, () => {
      expect(l.tieUp.length).toBeGreaterThanOrEqual(2);
      expect(l.tieUp.length).toBeLessThanOrEqual(LEVERS);
      expect(l.target.length).toBeGreaterThanOrEqual(4);
      expect(l.target.length).toBeLessThanOrEqual(12);
      for (const m of [...l.tieUp, ...l.target]) expect(m >>> WARPS).toBe(0);
      expect(l.name.split(' ').length).toBeLessThanOrEqual(5);
      expect(Number.isFinite(computePar(l.tieUp, l.target))).toBe(true);
    });
  }
  it('level 1 par is small (first tune fast)', () => {
    expect(LEVELS[0].par).toBe(3);
  });
});

describe('session', () => {
  const lv = { target: [1, 2, 3] };
  it('marks rows', () => {
    expect(rowStatuses(lv, [1, 5])).toEqual(['match', 'miss', 'todo']);
    expect(rowStatuses(lv, [1, 2, 3, 4])).toEqual(['match', 'match', 'match', 'miss']);
  });
  it('wins only on an exact match', () => {
    expect(isWon(lv, [1, 2, 3])).toBe(true);
    expect(isWon(lv, [1, 2])).toBe(false);
    expect(isWon(lv, [1, 2, 3, 4])).toBe(false);
  });
  it('scores stars against par', () => {
    expect(stars(3, 3)).toBe(3);
    expect(stars(3, 5)).toBe(2);
    expect(stars(3, 6)).toBe(1);
  });
});
