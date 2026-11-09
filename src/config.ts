/**
 * Single source of truth for loom geometry and interaction tuning.
 * Units: metres. Loom-local axes: +X to the user's right, +Y up from the
 * desk surface, +Z toward the user. Origin = centre of the cloth area on the
 * desk.
 */

export const WARPS = 8;
export const WARP_PITCH = 0.024; // 8 × 2.4 cm ≈ 19 cm cloth
export const LEVERS = 4;

export const LOOM = {
  /** z of the back beam (far from the user). */
  backBeamZ: -0.085,
  /** z of the heddle line where the shed opens. */
  heddleZ: -0.05,
  /** z of the fell (where new rows are laid). */
  fellZ: -0.012,
  /** z of the front (cloth) beam, nearest the user. */
  frontBeamZ: 0.088,
  beamY: 0.022,
  frameHalfWidth: 0.115,
  liftedY: 0.03,
  loweredY: 0.004,
  shedY: 0.017,
  rowPitch: 0.0075,
  visibleRows: 12,
} as const;

/** Shuttle slides along X on the shed line. */
export const SHUTTLE = {
  z: -0.031,
  y: 0.017,
  /** Travel endpoints in loom-local x. */
  minX: -0.135,
  maxX: 0.135,
  /** Release past this fraction of travel completes the pass. */
  completeAt: 0.6,
  autoThrowSpeed: 0.35, // m/s
} as const;

/** Lever bank beside the loom (mirrored for left-handed play). */
export const LEVER = {
  /** x of the first lever, measured outward from the loom centre. */
  firstX: 0.142,
  spacing: 0.028,
  /** Rest (unlatched) z — nearest the user. Latched = rest - travel. */
  restZ: 0.075,
  travel: 0.05,
  knobY: 0.024,
  /** ≥ 22 mm diameter touch target (Meta hands guidance). */
  knobRadius: 0.011,
  /** Final fraction of travel that magnetically pulls to an end. */
  magnet: 0.3,
} as const;

/** Undo bobbin at the front corner opposite the lever bank. */
export const BOBBIN = {
  x: 0.128,
  y: 0.014,
  z: 0.072,
  pull: 0.03,
  radius: 0.008,
} as const;

/** Style token: on the front beam's lever-side end. */
export const TOKEN = {
  x: 0.1,
  y: 0.012,
  z: 0.112,
  radius: 0.011,
} as const;

/** Target card: stands at the back corner opposite the lever bank. */
export const CARD = {
  x: 0.165,
  z: -0.07,
  width: 0.075,
  /** Cell pitch on the card (≥ 7 mm). */
  cell: 0.0075,
  tiltDeg: 14,
} as const;

/** Pinch / grab tuning (scaled by calibration multiplier). */
export const PINCH = {
  engageM: 0.02,
  releaseM: 0.035,
  grabRadiusM: 0.025,
  hoverRadiusM: 0.035,
  trackingLossS: 0.15,
  oneEuro: { minCutoff: 1.0, beta: 0.02, dCutoff: 1.0 },
} as const;

/** Poke tuning. */
export const POKE = {
  radiusM: 0.014,
  /** Index tip must descend into the knob at least this fast (m/s). */
  minDownSpeed: 0.05,
  rearmM: 0.03,
} as const;

/** Placement ("set the table"). */
export const PLACE = {
  /** Horizontal distance from head to loom origin. */
  forward: 0.33,
  /** Shift the loom away from the lever side so the bank+loom are centred. */
  sideShift: 0.05,
  defaultDrop: 0.45,
  stillSeconds: 1.0,
  stillSpeedM: 0.03, // m/s palm speed considered still
  flatDot: 0.75, // wrist +Y · world up
  planeSnapM: 0.05,
  minDrop: 0.25,
  maxDrop: 0.85,
  nudgeStepM: 0.01,
} as const;

/** Seated reach limit for R2. */
export const MAX_REACH_M = 0.6;

export function warpX(i: number): number {
  return (i - (WARPS - 1) / 2) * WARP_PITCH;
}

/** Token x: lever side, inboard of the bank. */
export function tokenX(side: 1 | -1): number {
  return side * TOKEN.x;
}

/** Bobbin x: opposite side from the lever bank. */
export function bobbinX(side: 1 | -1): number {
  return -side * BOBBIN.x;
}

/** Lever x in loom-local space; `side` = +1 bank on the right, -1 on the left. */
export function leverX(k: number, side: 1 | -1): number {
  return side * (LEVER.firstX + k * LEVER.spacing);
}
