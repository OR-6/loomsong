/**
 * "Set the table" placement state machine (pure).
 *
 * Feed it palm samples each frame. When a palm is flat (wrist +Y close to
 * world up) and still for `stillSeconds`, it proposes a desk height from the
 * palm height minus the palm-to-surface offset, snapped to a detected
 * horizontal plane within ±planeSnapM.
 */
import { PLACE } from '../config.js';

export interface PalmSample {
  /** Palm centre (middle-finger metacarpal), world metres. */
  x: number;
  y: number;
  z: number;
  /** Joint radius ≈ palm half-thickness, metres. */
  radius: number;
  /** wrist +Y · world up (1 = back of hand straight up = palm down). */
  upDot: number;
}

export type PlacementPhase = 'waiting' | 'steadying' | 'placed';

export class Placement {
  phase: PlacementPhase = 'waiting';
  /** 0..1 progress of the stillness hold, for the hint ring. */
  progress = 0;
  deskY: number | null = null;
  source: 'palm' | 'plane' | 'default' | 'fixed' | null = null;
  private stillFor = 0;
  private lx = 0;
  private ly = 0;
  private lz = 0;
  private has = false;

  constructor(private cfg = PLACE) {}

  /**
   * @param palm  palm sample, or null when no hand is tracked.
   * @param planeYs  heights of detected horizontal planes (table/desk).
   */
  update(
    palm: PalmSample | null,
    planeYs: readonly number[],
    dt: number,
    headY: number = Number.NaN,
  ): boolean {
    if (this.phase === 'placed') return false;
    // A desk is 25–85 cm below the eyes when seated; rejects palm-down hands
    // resting in mid-air in front of the face.
    const drop = headY - (palm?.y ?? 0);
    const plausible =
      Number.isNaN(headY) || (drop >= this.cfg.minDrop && drop <= this.cfg.maxDrop);
    if (!palm || palm.upDot < this.cfg.flatDot || !plausible) {
      this.reset();
      return false;
    }
    if (this.has && dt > 0) {
      const speed =
        Math.hypot(palm.x - this.lx, palm.y - this.ly, palm.z - this.lz) / dt;
      if (speed > this.cfg.stillSpeedM) {
        this.stillFor = 0;
      } else {
        this.stillFor += dt;
      }
    }
    this.lx = palm.x;
    this.ly = palm.y;
    this.lz = palm.z;
    this.has = true;
    this.phase = 'steadying';
    this.progress = Math.min(1, this.stillFor / this.cfg.stillSeconds);
    if (this.stillFor >= this.cfg.stillSeconds) {
      const fromPalm = palm.y - palm.radius;
      const snap = nearest(planeYs, fromPalm);
      if (snap !== null && Math.abs(snap - fromPalm) <= this.cfg.planeSnapM) {
        this.place(snap, 'plane');
      } else {
        this.place(fromPalm, 'palm');
      }
      return true;
    }
    return false;
  }

  place(y: number, source: NonNullable<Placement['source']>): void {
    this.deskY = y;
    this.source = source;
    this.phase = 'placed';
    this.progress = 1;
  }

  /** Fallback: no hand → default desk height below the head. */
  placeDefault(headY: number): void {
    this.place(headY - this.cfg.defaultDrop, 'default');
  }

  private reset(): void {
    this.phase = 'waiting';
    this.stillFor = 0;
    this.progress = 0;
    this.has = false;
  }
}

function nearest(values: readonly number[], v: number): number | null {
  let best: number | null = null;
  for (const x of values) if (best === null || Math.abs(x - v) < Math.abs(best - v)) best = x;
  return best;
}

/**
 * Loom pose from the head position, the flat forward direction and the
 * lever-bank side. Pure: shared by GameSystem and check:reach.
 */
export function loomPose(
  head: { x: number; z: number },
  fwd: { x: number; z: number },
  side: 1 | -1,
  deskY: number,
  cfg = PLACE,
): { x: number; y: number; z: number; yaw: number } {
  // right = fwd × up = (-fwd.z, 0, fwd.x)
  const rx = -fwd.z;
  const rz = fwd.x;
  return {
    x: head.x + fwd.x * cfg.forward - rx * side * cfg.sideShift,
    y: deskY,
    z: head.z + fwd.z * cfg.forward - rz * side * cfg.sideShift,
    yaw: Math.atan2(-fwd.x, -fwd.z),
  };
}
