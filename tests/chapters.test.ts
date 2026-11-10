import { describe, expect, it } from 'vitest';
import { CHAPTERS, LEVELS, chapterStates } from '../src/puzzle/catalog';

describe('chapters', () => {
  it('Garden is open, later chapters locked on a fresh save', () => {
    expect(chapterStates({ best: {} }, 'garden')).toEqual(['current', 'locked', 'locked', 'locked']);
  });
  it('a chapter opens once all but one picture of the previous one is woven', () => {
    const g = CHAPTERS[0].levels;
    const best = Object.fromEntries(g.slice(0, g.length - 2).map((id) => [id, 3]));
    expect(chapterStates({ best }, 'garden')[1]).toBe('locked');
    best[g[g.length - 2]] = 1;
    expect(chapterStates({ best }, 'garden')[1]).toBe('open');
  });
  it('combination chapters really need levers combined on most rows', () => {
    for (const ch of CHAPTERS.slice(1)) {
      const combos = ch.levels.map((id) => {
        const l = LEVELS.find((x) => x.id === id)!;
        return new Set(l.target.filter((r) => !l.tieUp.includes(r))).size;
      });
      // at least three pictures per chapter with two or more combined rows
      expect(combos.filter((n) => n >= 2).length, ch.id).toBeGreaterThanOrEqual(3);
    }
  });
});
