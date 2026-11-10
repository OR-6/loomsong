/** Tie-up helpers. A Mask8 is an 8-bit warp mask: bit i = warp i lifted. */
export type Mask8 = number;

/** Shed mask = OR of the masks of all latched levers. */
export function shedMask(tieUp: readonly Mask8[], latched: readonly boolean[]): Mask8 {
  let m = 0;
  for (let k = 0; k < tieUp.length; k++) if (latched[k]) m |= tieUp[k];
  return m & 0xff;
}

/**
 * A woven or target row may carry a 9th bit: woven with the second weft yarn
 * (Sea's blue water) instead of the cream one. Warp bits are unaffected.
 */
export const WEFT_B = 256;
/** The row's lifted warps only (drops the weft bit). */
export const warpsOf = (row: number): Mask8 => row & 0xff;
/** 1 if the row is woven with the second weft yarn. */
export const weftOf = (row: number): 0 | 1 => ((row & WEFT_B) !== 0 ? 1 : 0);

export function isLifted(mask: Mask8, warp: number): boolean {
  return ((mask >> warp) & 1) === 1;
}
