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
  liftedY: 0.056,
  /** Lowered threads at the heddle: a straight, taut line from the back beam to the cloth. */
  loweredY: 0.024,
  shedY: 0.017,
  /** Woven row depth (taller rows → pictures aren't squashed). */
  rowPitch: 0.012,
  visibleRows: 12,
  /** Cloth starts here (front, by the front beam) and builds back toward the heddle. */
  clothFrontZ: 0.074,
  /** Rows that fit before the cloth reaches the shuttle line. */
  maxRows: 8,
} as const;

/** Shuttle slides along X on the shed line. */
export const SHUTTLE = {
  z: -0.024,
  /** Pip's height in the shed: the boat (20 mm below Pip) slides between the threads. */
  y: 0.044,
  /** Travel endpoints in loom-local x: Pip's perches on top of the side rails. */
  minX: -0.123,
  maxX: 0.123,
  /** Perch height on the rail top, and where the hop down into the shed starts. */
  perchY: 0.06,
  shedHalf: 0.088,
  /** Release past this fraction of travel completes the pass. */
  completeAt: 0.6,
  autoThrowSpeed: 0.35, // m/s
} as const;

/** Lever bank beside the loom (mirrored for left-handed play). */
export const LEVER = {
  /** x of the first lever, measured outward from the loom centre. */
  firstX: 0.16,
  spacing: 0.032,
  /** Rest (unlatched) z — nearest the user. Latched = rest - travel. */
  restZ: 0.075,
  travel: 0.05,
  knobY: 0.046,
  /** ≥ 22 mm diameter touch target (Meta hands guidance). */
  knobRadius: 0.0118,
  /** Final fraction of travel that magnetically pulls to an end. */
  magnet: 0.3,
} as const;

/** Undo bobbin at the front corner opposite the lever bank. */
export const BOBBIN = {
  x: 0.16,
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

/** Desk-height nudge arrows (default placement only): card side, front. */
export const NUDGE = {
  x: 0.172,
  y: 0.016,
  upZ: 0.028,
  downZ: 0.06,
  radius: 0.011,
  step: 0.01,
} as const;

export function nudgeX(side: 1 | -1): number {
  return -side * NUDGE.x;
}

/** Target card: stands at the back corner opposite the lever bank. */
export const CARD = {
  /** Centred behind the heddle on a music-stand easel (like sheet music). */
  x: 0,
  z: -0.118,
  /** Height of the easel ledge the card stands on. */
  baseY: 0.104,
  width: 0.075,
  /** Cell pitch on the card (≥ 7 mm). */
  cell: 0.0147,
  tiltDeg: 24,
} as const;

/** Pinch / grab tuning (scaled by calibration multiplier). */
export const PINCH = {
  engageM: 0.02,
  releaseM: 0.035,
  grabRadiusM: 0.025,
  hoverRadiusM: 0.035,
  trackingLossS: 0.15,
  /**
   * One-Euro smoothing (positions in metres): ~1.5 Hz at rest kills jitter,
   * beta 4 opens the filter on fast drags (≈ 1.5 cm lag at 0.5 m/s).
   */
  oneEuro: { minCutoff: 1.5, beta: 4, dCutoff: 1.0 },
} as const;

/** Poke tuning. */
export const POKE = {
  radiusM: 0.014,
  /** Smoothed index tip must descend into the knob at least this fast (m/s). */
  minDownSpeed: 0.12,
  /** Only a pointing hand pokes: thumb–index gap above this (m). */
  minAperture: 0.045,
  rearmM: 0.03,
} as const;

/** Placement ("set the table"). */
export const PLACE = {
  /** Horizontal distance from head to loom origin. */
  forward: 0.32,
  /** Shift the loom away from the lever side so the bank+loom are centred. */
  sideShift: 0.05,
  defaultDrop: 0.45,
  stillSeconds: 0.8,
  /** "Still" = the smoothed palm stays inside this radius (robust to jitter). */
  stillRadiusM: 0.012,
  /** Loom origin relative to the resting palm, clamped to reach. */
  palmAhead: 0.05,
  minForward: 0.24,
  maxLateral: 0.025,
  flatDot: 0.75, // wrist +Y · world up
  planeSnapM: 0.05,
  minDrop: 0.25,
  /** Below this a palm is probably on a lap, unless a table plane agrees. */
  maxDrop: 0.62,
  maxDropWithPlane: 0.85,
  nudgeStepM: 0.01,
  /** Hands seen but no flat palm: fall back after this long. */
  palmTimeoutS: 15,
  /** No hands at all: fall back after this long. */
  noHandTimeoutS: 8,
} as const;

/** Seated reach limit for R2. */
export const MAX_REACH_M = 0.6;

/** Shuttle (Pip) height at loom-local x: perched on a rail at the ends, in the shed between. */
export function shuttleY(x: number): number {
  const a = Math.min(1, Math.max(0, (Math.abs(x) - SHUTTLE.shedHalf) / (SHUTTLE.maxX - SHUTTLE.shedHalf)));
  const s = a * a * (3 - 2 * a);
  return SHUTTLE.y + (SHUTTLE.perchY - SHUTTLE.y) * s;
}

/** Yarn basket (chapter picker) on the mat, on the side away from the lever bank. */
export const BASKET = {
  x: 0.24,
  z: 0.15,
  /** Yarn ball centre height and radius (resting in the bowl, peeking over the rim). */
  y: 0.026,
  ballR: 0.0135,
  balls: 4,
} as const;

/** Chapter yarn ball i in loom-local space. */
export function skeinPos(i: number, side: 1 | -1, out: { x: number; y: number; z: number }) {
  // chapters read left to right whichever side the basket is on
  out.x = -side * BASKET.x + (i - (BASKET.balls - 1) / 2) * 0.027;
  out.y = BASKET.y + (i % 2 ? 0.002 : 0);
  out.z = BASKET.z + (i % 2 ? -0.007 : 0.006);
  return out;
}

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
