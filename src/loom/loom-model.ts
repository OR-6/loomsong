/**
 * Pure loom state: latched levers, committed rows, shuttle side.
 * Rendering and input live elsewhere; this is what tests assert on.
 */
import { LEVERS } from '../config.js';
import { shedMask, type Mask8 } from '../puzzle/tieup.js';

export class LoomModel {
  latched: boolean[] = new Array(LEVERS).fill(false);
  rows: Mask8[] = [];
  /** Which side the shuttle rests on: 0 = left (t=0), 1 = right (t=1). */
  shuttleSide: 0 | 1 = 0;
  leverFlips = 0;
  readonly listeners = new Set<(e: LoomEvent) => void>();

  constructor(public tieUp: Mask8[]) {}

  /** Start a new level in place (arrays are shared with debug views). */
  reset(tieUp: Mask8[]): void {
    this.tieUp = tieUp;
    this.latched.fill(false);
    this.rows.length = 0;
    this.shuttleSide = 0;
    this.leverFlips = 0;
  }

  get shed(): Mask8 {
    return shedMask(this.tieUp, this.latched);
  }

  setLatched(k: number, v: boolean): void {
    if (this.latched[k] === v) return;
    this.latched[k] = v;
    this.leverFlips++;
    this.emit({ type: 'lever', lever: k, latched: v, shed: this.shed });
  }

  /** Called when the shuttle completes a full pass. */
  commitRow(): Mask8 {
    const row = this.shed;
    this.rows.push(row);
    this.shuttleSide = this.shuttleSide === 0 ? 1 : 0;
    this.emit({ type: 'row', row, index: this.rows.length - 1 });
    return row;
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
  | { type: 'undo'; row: Mask8; index: number };
