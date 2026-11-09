/**
 * Level session (pure): compares the woven rows with the target, decides
 * the win, and scores stars from lever flips against par.
 */
import type { Level } from './levels.js';
import type { Mask8 } from './tieup.js';

export type RowStatus = 'match' | 'miss' | 'todo';

export function rowStatuses(level: Pick<Level, 'target'>, rows: readonly Mask8[]): RowStatus[] {
  const n = Math.max(level.target.length, rows.length);
  const out: RowStatus[] = [];
  for (let r = 0; r < n; r++) {
    if (r >= rows.length) out.push('todo');
    else out.push(r < level.target.length && rows[r] === level.target[r] ? 'match' : 'miss');
  }
  return out;
}

export function isWon(level: Pick<Level, 'target'>, rows: readonly Mask8[]): boolean {
  return (
    rows.length === level.target.length && rows.every((r, i) => r === level.target[i])
  );
}

/** 3 stars at par, 2 within par+2, else 1. Undo never costs stars by itself. */
export function stars(par: number, flips: number): 1 | 2 | 3 {
  if (flips <= par) return 3;
  if (flips <= par + 2) return 2;
  return 1;
}
