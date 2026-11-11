import { describe, expect, it } from 'vitest';
import { CHAPTERS, LEVELS, chapterStates } from '../src/puzzle/catalog';

describe('chapters', () => {
  it('Garden is open, later chapters locked on a fresh save', () => {
    expect(chapterStates({ best: {} }, 'garden')).toEqual(['current', 'locked', 'locked', 'locked']);
  });
  it('every chapter opens once the first picture is woven (a short visit reaches Night and Sea)', () => {
    expect(chapterStates({ best: { [CHAPTERS[0].levels[0]]: 1 } }, 'garden')).toEqual(['current', 'open', 'open', 'open']);
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
