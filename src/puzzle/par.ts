/**
 * Par = minimal number of lever flips to weave `target` in order, starting
 * with all levers unlatched. DP over lever states (≤ 2^4) per row.
 */
import { shedMask, type Mask8 } from './tieup.js';

function popcount(n: number): number {
  let c = 0;
  while (n) {
    n &= n - 1;
    c++;
  }
  return c;
}

function stateShed(tieUp: readonly Mask8[], state: number): Mask8 {
  let m = 0;
  for (let k = 0; k < tieUp.length; k++) if ((state >> k) & 1) m |= tieUp[k];
  return m & 0xff;
}

/** Returns Infinity when some target row cannot be woven with this tie-up. */
export function computePar(tieUp: readonly Mask8[], target: readonly Mask8[]): number {
  const S = 1 << tieUp.length;
  let cost = new Array<number>(S).fill(Infinity);
  cost[0] = 0;
  for (const row of target) {
    const next = new Array<number>(S).fill(Infinity);
    for (let s = 0; s < S; s++) {
      if (stateShed(tieUp, s) !== row) continue;
      for (let p = 0; p < S; p++) {
        if (cost[p] === Infinity) continue;
        const c = cost[p] + popcount(p ^ s);
        if (c < next[s]) next[s] = c;
      }
    }
    cost = next;
  }
  return Math.min(...cost);
}

/** Every row reachable as an OR of some lever subset? */
export function rowReachable(tieUp: readonly Mask8[], row: Mask8): boolean {
  for (let s = 0; s < 1 << tieUp.length; s++) if (stateShed(tieUp, s) === row) return true;
  return false;
}

export { shedMask };
