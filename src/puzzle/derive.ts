/**
 * Runtime level builder (the same idea as tools/derive-tieups.mjs, for pictures
 * the player draws): find at most 4 lever masks whose ORs make every row,
 * preferring readable "parts" (a solid run of threads, or a run and its mirror)
 * chosen so rows need levers combined. Falls back to any sub-masks of the rows.
 */
import { computePar } from './par.js';
import type { Mask8 } from './tieup.js';

const pc = (n: number) => {
  let c = 0;
  while (n) {
    n &= n - 1;
    c++;
  }
  return c;
};
const mirror = (m: number) => {
  let o = 0;
  for (let i = 0; i < 8; i++) if ((m >> i) & 1) o |= 1 << (7 - i);
  return o;
};
const runs = (m: number) => {
  let r = 0;
  let prev = 0;
  for (let i = 0; i < 8; i++) {
    const b = (m >> i) & 1;
    if (b && !prev) r++;
    prev = b;
  }
  return r;
};

/** Can every row be made as the OR of the levers that fit inside it? */
function canMake(rows: readonly number[], masks: readonly number[]): boolean {
  return rows.every((r) => {
    let u = 0;
    for (const m of masks) if ((m & ~r) === 0) u |= m;
    return u === r;
  });
}

/** Rows that need two or more levers together. */
const combosOf = (rows: readonly number[], tie: readonly number[]) => rows.filter((r) => !tie.includes(r)).length;

function search(D: readonly number[], C: readonly number[], score: (t: number[]) => number, budget: number, firstOnly = false): number[] | null {
  let found: number[] | null = null;
  let foundScore = -Infinity;
  for (let L = 1; L <= 4; L++) {
    let tries = 0; // a fresh budget for each lever count
    const pick: number[] = [];
    let best: number[] | null = null;
    let bestScore = -Infinity;
    const rec = (s: number) => {
      if (tries > budget || (firstOnly && best)) return;
      if (pick.length === L) {
        tries++;
        if (!canMake(D, pick)) return;
        const sc = score(pick);
        if (sc > bestScore) {
          bestScore = sc;
          best = [...pick];
        }
        return;
      }
      for (let i = s; i < C.length; i++) {
        pick.push(C[i]);
        rec(i + 1);
        pick.pop();
      }
    };
    rec(0);
    if (firstOnly && best) return best; // the fewest levers that work
    if (best && bestScore - (best as number[]).length * 2 > foundScore) {
      found = best;
      foundScore = bestScore - (best as number[]).length * 2;
    }
  }
  return found;
}

/** Levers for these rows (8-bit masks, any order), or null if more than 4 would be needed. */
export function deriveTieUp(rows: readonly Mask8[]): Mask8[] | null {
  const D = [...new Set(rows.map((r) => r & 0xff))].filter((r) => r > 0);
  if (!D.length) return null;
  // readable parts first
  const parts = new Set<number>();
  for (let a = 0; a < 8; a++) {
    for (let b = a; b < 8; b++) {
      const run = ((1 << (b - a + 1)) - 1) << a;
      for (const m of [run, run | mirror(run)]) if (D.some((r) => (m & ~r) === 0)) parts.add(m);
    }
  }
  const tie =
    search(D, [...parts], (t) => combosOf(D, t) * 10 - t.reduce((n, m) => n + runs(m), 0), 400000) ??
    // any sub-masks: whole rows first (easiest to read)
    search(
      D,
      [...[...D].sort((a, b) => pc(a) - pc(b)), ...Array.from({ length: 255 }, (_, i) => i + 1).filter((m) => !D.includes(m) && D.some((r) => (m & ~r) === 0))],
      (t) => t.filter((m) => D.includes(m)).length,
      300000,
      true,
    );
  if (!tie) return null;
  return tie.sort((a, b) => pc(b) - pc(a));
}

/** A whole level from drawn rows (row 0 = bottom, woven first): levers, target and par. */
export function deriveLevel(rows: readonly Mask8[]): { tieUp: Mask8[]; target: Mask8[]; par: number } | null {
  const target = rows.map((r) => r & 0xff).filter((r) => r > 0);
  if (target.length < 2) return null;
  const tieUp = deriveTieUp(target);
  if (!tieUp) return null;
  return { tieUp, target, par: computePar(tieUp, target) };
}
