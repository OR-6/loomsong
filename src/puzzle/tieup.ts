/** Tie-up helpers. A Mask8 is an 8-bit warp mask: bit i = warp i lifted. */
export type Mask8 = number;

/** Shed mask = OR of the masks of all latched levers. */
export function shedMask(tieUp: readonly Mask8[], latched: readonly boolean[]): Mask8 {
  let m = 0;
  for (let k = 0; k < tieUp.length; k++) if (latched[k]) m |= tieUp[k];
  return m & 0xff;
}

export function isLifted(mask: Mask8, warp: number): boolean {
  return ((mask >> warp) & 1) === 1;
}
