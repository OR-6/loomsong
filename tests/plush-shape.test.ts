import { describe, expect, it } from 'vitest';
import { area, chaikin, dropCollinear, traceCells } from '../src/loom/plush-shape';

const grid = (rows: string[]) => {
  const H = rows.length;
  // rows top-first, like the picture lists; r = 0 is the bottom row
  return { H, on: (r: number, i: number) => r >= 0 && r < H && i >= 0 && i < 8 && rows[H - 1 - r][i] === '#' };
};

describe('plush outline', () => {
  it('a solid block is one counter-clockwise square', () => {
    const { H, on } = grid(['..##....', '..##....']);
    const loops = traceCells(on, H, 8);
    expect(loops.length).toBe(1);
    expect(loops[0].length).toBe(8); // unit edges
    expect(area(loops[0])).toBe(4);
  });
  it('an eye hole is a clockwise loop inside', () => {
    const { H, on } = grid(['###.....', '#.#.....', '###.....']);
    const loops = traceCells(on, H, 8);
    expect(loops.length).toBe(2);
    expect(loops.map(area).sort((a, b) => a - b)).toEqual([-1, 9]);
  });
  it('the heart traces to one outline whose area is its cell count', () => {
    const rows = ['.##..##.', '########', '########', '.######.', '..####..', '...##...'];
    const { H, on } = grid(rows);
    const loops = traceCells(on, H, 8);
    const cells = rows.join('').split('').filter((c) => c === '#').length;
    expect(loops.reduce((s, l) => s + area(l), 0)).toBe(cells);
  });
  it('rounding keeps the outline closed and close to its area', () => {
    const { H, on } = grid(['####....', '####....', '####....', '####....']);
    const [sq] = traceCells(on, H, 8);
    const round = dropCollinear(chaikin(sq, 2));
    expect(round.length).toBe(4 * 4); // only the corners are rounded; the straight runs stay straight
    expect(area(round)).toBeGreaterThan(15.5);
    expect(area(round)).toBeLessThan(16);
  });
});
