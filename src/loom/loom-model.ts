/**
 * Pure loom state: latched levers, committed rows, shuttle side.
 * Rendering and input live elsewhere; this is what tests assert on.
 */
import { LEVERS } from '../config.js';
import { WEFT_B, shedMask, type Mask8 } from '../puzzle/tieup.js';

export class LoomModel {
  latched: boolean[] = new Array(LEVERS).fill(false);
  rows: Mask8[] = [];
  /** Which side the shuttle rests on: 0 = left (t=0), 1 = right (t=1). */
  shuttleSide: 0 | 1 = 0;
  leverFlips = 0;
  /** Weft yarn in Pip's boat: 0 = cream, 1 = the level's second colour (Sea). */
  weft: 0 | 1 = 0;
  /** Threads lifted by a plush seated on the cushion (its bottom row): part of the shed, not a lever. */
  helper: Mask8 = 0;
  readonly listeners = new Set<(e: LoomEvent) => void>();

  constructor(public tieUp: Mask8[]) {}

  /** Start a new level in place (arrays are shared with debug views). */
  reset(tieUp: Mask8[]): void {
    this.tieUp = tieUp;
    this.latched.fill(false);
    this.rows.length = 0;
    this.shuttleSide = 0;
    this.leverFlips = 0;
    this.weft = 0;
    this.helper = 0;
  }

  get shed(): Mask8 {
    return shedMask(this.tieUp, this.latched) | this.helper;
  }

  /** A plush sat down on the cushion (its feet's threads), or got up (0). Not a lever move: no knot. */
  setHelper(mask: Mask8): void {
    if (this.helper === mask) return;
    this.helper = mask;
    this.emit({ type: 'friend', mask, shed: this.shed });
  }

  setLatched(k: number, v: boolean): void {
    if (this.latched[k] === v) return;
    this.latched[k] = v;
    this.leverFlips++;
    this.emit({ type: 'lever', lever: k, latched: v, shed: this.shed });
  }

  /** Swap Pip's yarn (not a lever move: costs no knot). */
  setWeft(w: 0 | 1): void {
    if (this.weft === w) return;
    this.weft = w;
    this.emit({ type: 'weft', weft: w });
  }

  /** Called when the shuttle completes a full pass. */
  commitRow(): Mask8 {
    const row = this.shed | (this.weft ? WEFT_B : 0);
    this.rows.push(row);
    this.shuttleSide = this.shuttleSide === 0 ? 1 : 0;
    this.emit({ type: 'row', row, index: this.rows.length - 1 });
    return row;
  }

  /** Co-op: replace rows and shuttle side from the host's snapshot. */
  syncRows(rows: readonly Mask8[], side: 0 | 1): void {
    const same = rows.length === this.rows.length && rows.every((r, i) => r === this.rows[i]);
    this.shuttleSide = side;
    if (same) return;
    this.rows.length = 0;
    this.rows.push(...rows);
    this.emit({ type: 'sync' });
  }

  undo(): Mask8 | undefined {
    const row = this.rows.pop();
    if (row !== undefined) {
      this.shuttleSide = this.shuttleSide === 0 ? 1 : 0;
      this.emit({ type: 'undo', row, index: this.rows.length });
    }
    return row;
  }

  on(fn: (e: LoomEvent) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(e: LoomEvent): void {
    for (const fn of this.listeners) fn(e);
  }
}

export type LoomEvent =
  | { type: 'lever'; lever: number; latched: boolean; shed: Mask8 }
  | { type: 'row'; row: Mask8; index: number }
  | { type: 'undo'; row: Mask8; index: number }
  | { type: 'weft'; weft: 0 | 1 }
  | { type: 'friend'; mask: Mask8; shed: Mask8 }
  | { type: 'sync' };
