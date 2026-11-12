/**
 * Level shape shared by authored picture levels, the daily cloth, shared
 * cloths and bonus patterns.
 */
import type { Mask8 } from './tieup.js';

export interface Level {
  id: string;
  /** Lever → warp mask; 1–4 levers. */
  tieUp: Mask8[];
  /** Target rows in weaving order (row 0 nearest the user). */
  target: Mask8[];
  /** MIDI root for the pentatonic warp scale. */
  rootMidi: number;
  /** Minimal lever flips (computed; see par.ts). */
  par: number;
  /** Short ≤ 3-word name ("Heart"). */
  name: string;
  /** Picture pixel colour (lifted warps); default theme yarn if absent. */
  color?: number;
  chapter?: string;
  /** Levers' threads hidden until first tried. */
  mystery?: boolean;
  /** With `mystery`: levers below this one stay shown (Night eases in: the Moon hides two, the Ghost three). */
  hideFrom?: number;
  /** Second weft colour (Sea): rows with the weft bit are woven in it. */
  weft?: number;
  /** A friend picture: the threads a plush on the cushion must lift (its bottom row); not a lever. */
  friend?: number;
  /** Mend the cloth: it arrives already woven this far, one row of it wrong; unpick back to it and weave on. */
  mend?: Mask8[];
  /** The tide: the card shows only the next two rows (the Sea's rule; also a twist for the day or a replay). */
  tide?: boolean;
}
