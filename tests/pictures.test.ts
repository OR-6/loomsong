import { describe, expect, it } from 'vitest';
import { CHAPTERS, PICTURES } from '../src/puzzle/pictures.gen';
import { LEVELS, dailyLevel, dayKey, levelAt } from '../src/puzzle/catalog';
import { computePar, rowReachable } from '../src/puzzle/par';
import { WARPS } from '../src/config';

const bits = (s: string) => [...s].reduce((m, c, i) => (c === '#' ? m | (1 << i) : m), 0) | (s.includes('~') ? 256 : 0);

describe('picture levels', () => {
  it('every picture is weavable with its tie-up and its par is the true minimum', () => {
    for (const p of PICTURES) {
      expect(p.tieUp.length, p.id).toBeGreaterThanOrEqual(1);
      expect(p.tieUp.length, p.id).toBeLessThanOrEqual(4);
      expect(p.picture.every((r) => r.length === WARPS), p.id).toBe(true);
      expect(p.target, p.id).toEqual(p.picture.map(bits).reverse());
      for (const row of p.target) expect(rowReachable(p.tieUp, row), `${p.id} row`).toBe(true);
      expect(p.par, p.id).toBe(computePar(p.tieUp, p.target));
      expect(p.name.split(' ').length).toBeLessThanOrEqual(3);
    }
  });
  it('chapters cover every picture once, in order', () => {
    const ids = CHAPTERS.flatMap((c) => c.levels);
    expect(ids).toEqual(PICTURES.map((p) => p.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('difficulty rises: chapter 1 needs no combinations; the Sea chapter needs the most', () => {
    const combos = (id: string) => {
      const p = PICTURES.find((x) => x.id === id)!;
      return p.target.filter((r) => !p.tieUp.includes(r & 255)).length;
    };
    const avg = (ch: string) => {
      const ls = CHAPTERS.find((c) => c.id === ch)!.levels;
      return ls.reduce((a, id) => a + combos(id), 0) / ls.length;
    };
    expect(avg('garden')).toBeLessThan(avg('sea'));
    expect(combos('sprout')).toBe(0);
  });
  it('level sequence: pictures first, then bonus patterns', () => {
    expect(levelAt(0).id).toBe('sprout');
    expect(levelAt(LEVELS.length - 1).id).toBe(PICTURES.at(-1)!.id);
    expect(levelAt(LEVELS.length).id).toBe('bonus1');
  });
  it('daily cloth is stable for a day and changes across days', () => {
    expect(dailyLevel('2026-11-10')).toEqual(dailyLevel('2026-11-10'));
    const week = ['10', '11', '12', '13', '14', '15', '16'].map((d) => dailyLevel(`2026-11-${d}`).id);
    expect(new Set(week).size).toBe(7);
    expect(dayKey(new Date(2026, 10, 9))).toBe('2026-11-09');
  });
  it("Sea's two-colour pictures: '~' rows carry the weft bit, a row never mixes cream and water", () => {
    const sea = PICTURES.filter((p) => p.weft);
    expect(sea.length).toBeGreaterThanOrEqual(2);
    for (const p of sea) {
      for (const row of p.picture) expect(row.includes('~') && row.includes('.'), `${p.id} ${row}`).toBe(false);
      expect(p.target.some((r) => r & 256), p.id).toBe(true);
    }
    // a picture that mixes both yarns makes the swap a real step
    expect(sea.some((p) => p.target.some((r) => r & 256) && p.target.some((r) => !(r & 256)))).toBe(true);
  });
});
