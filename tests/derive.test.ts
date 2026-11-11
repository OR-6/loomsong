import { describe, expect, it } from 'vitest';
import { deriveLevel, deriveTieUp } from '../src/puzzle/derive';
import { rowReachable } from '../src/puzzle/par';
import { PICTURES } from '../src/puzzle/pictures.gen';

const bits = (s: string) => [...s].reduce((m, c, i) => (c === '#' ? m | (1 << i) : m), 0);

describe('runtime level builder (draw your own)', () => {
  it('every authored picture gets a weavable lever set of at most 4', () => {
    for (const p of PICTURES) {
      const t0 = performance.now();
      const tie = deriveTieUp(p.target);
      expect(tie, p.id).not.toBeNull();
      expect(tie!.length, p.id).toBeLessThanOrEqual(4);
      for (const r of p.target) expect(rowReachable(tie!, r & 255), p.id).toBe(true);
      expect(performance.now() - t0, `${p.id} is fast enough for a headset`).toBeLessThan(400);
    }
  });
  it('a drawn heart becomes a level with a true par', () => {
    const rows = ['.##..##.', '########', '########', '.######.', '..####..', '...##...'].map(bits).reverse();
    const lv = deriveLevel(rows)!;
    expect(lv.target).toEqual(rows);
    expect(lv.par).toBeGreaterThan(0);
    expect(Number.isFinite(lv.par)).toBe(true);
  });
  it('rejects a drawing with too few rows', () => {
    expect(deriveLevel([bits('..##....')])).toBeNull();
  });
  it('a scattered picture still gets levers, or a clear no', () => {
    const rows = ['#.#.#.#.', '.#.#.#.#', '##..##..', '..##..##', '#..##..#', '.##..##.'].map(bits);
    const lv = deriveLevel(rows);
    if (lv) for (const r of lv.target) expect(rowReachable(lv.tieUp, r)).toBe(true);
  });
});
