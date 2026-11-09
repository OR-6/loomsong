/**
 * Pure interaction controller: turns per-hand loom-local input samples into
 * lever / shuttle motion and LoomModel changes. No Three.js, so unit tests
 * can drive it with synthetic joint streams.
 */
import { LEVER, LEVERS, PINCH, POKE, SHUTTLE, leverX, warpX, WARPS } from '../config.js';
import type { PinchEdge } from '../input/pinch.js';
import { Slider } from '../input/slider.js';
import { isLifted } from '../puzzle/tieup.js';
import type { LoomModel } from './loom-model.js';

export type Side = 'left' | 'right';

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

/** One hand's input for one frame, in loom-local metres. */
export interface HandInput {
  tracked: boolean;
  pinching: boolean;
  edge: PinchEdge;
  pinch: Vec3Like;
  index: Vec3Like;
  indexVel: Vec3Like;
}

export type Target = { kind: 'lever'; k: number } | { kind: 'shuttle' } | null;

export interface ControllerHooks {
  pluck?(warp: number, speed: number): void;
  leverClick?(k: number, latched: boolean): void;
  grab?(target: Exclude<Target, null>): void;
  pass?(row: number): void;
}

/** Lever settle speed in t/s, shuttle return speed in m/s. */
const LEVER_SETTLE = 6;
const SHUTTLE_RETURN = 0.5;

export class LoomController {
  readonly levers: Slider[] = [];
  readonly shuttle = new Slider({
    a0: SHUTTLE.minX,
    a1: SHUTTLE.maxX,
    release: { kind: 'throw', completeAt: SHUTTLE.completeAt },
  });
  holding: Record<Side, Target> = { left: null, right: null };
  hover: Record<Side, Target> = { left: null, right: null };
  /** +1 bank on the right of the loom, -1 on the left. */
  bankSide: 1 | -1 = 1;
  radiusMul = 1;
  /** Auto-throw in progress (poke mode). */
  autoThrow = false;
  enabled = true;
  private pokeArmed: Record<Side, boolean> = { left: true, right: true };
  private prevShuttleX: number = SHUTTLE.minX;

  constructor(public model: LoomModel, public hooks: ControllerHooks = {}) {
    for (let k = 0; k < LEVERS; k++) {
      this.levers.push(
        new Slider({
          a0: LEVER.restZ,
          a1: LEVER.restZ - LEVER.travel,
          release: { kind: 'detents', magnet: LEVER.magnet },
        }),
      );
    }
    this.syncFromModel();
  }

  /** Snap sliders to model state (after load/undo/level change). */
  syncFromModel(): void {
    for (let k = 0; k < LEVERS; k++) this.levers[k].setImmediate(this.model.latched[k] ? 1 : 0);
    this.shuttle.setImmediate(this.model.shuttleSide);
    this.prevShuttleX = this.shuttle.axisAt(this.shuttle.t);
    this.autoThrow = false;
  }

  leverPos(k: number, out: Vec3Like): Vec3Like {
    out.x = leverX(k, this.bankSide);
    out.y = LEVER.knobY;
    out.z = this.levers[k].axisAt(this.levers[k].t);
    return out;
  }

  shuttleX(): number {
    return this.shuttle.axisAt(this.shuttle.t);
  }

  update(input: Record<Side, HandInput>, dt: number): void {
    for (const side of ['right', 'left'] as const) this.updateHand(side, input[side]);

    // Settling (levers to detents; shuttle throw/return).
    for (const l of this.levers) l.settle(dt, LEVER_SETTLE);
    if (!this.shuttle.held && this.shuttle.t !== this.shuttle.target) {
      const range = SHUTTLE.maxX - SHUTTLE.minX;
      const toFar = this.shuttle.target !== this.model.shuttleSide;
      const speed = (toFar ? SHUTTLE.autoThrowSpeed : SHUTTLE_RETURN) / range;
      if (this.shuttle.settle(dt, speed)) {
        this.autoThrow = false;
        this.checkPassComplete();
      }
    }
    this.strum(dt);
  }

  private updateHand(side: Side, h: HandInput): void {
    const held = this.holding[side];
    if (!h.tracked && held === null) {
      this.hover[side] = null;
      return;
    }
    this.hover[side] = held ?? this.nearest(h.pinch, PINCH.hoverRadiusM * this.radiusMul);

    if (h.edge === 'start' && held === null && this.enabled) {
      const t = this.nearest(h.pinch, PINCH.grabRadiusM * this.radiusMul);
      if (t && !this.isHeld(t) && !(t.kind === 'shuttle' && this.autoThrow)) {
        this.holding[side] = t;
        this.sliderOf(t).grab(this.axisOf(t, h.pinch));
        this.hooks.grab?.(t);
      }
    } else if (held && h.pinching) {
      const s = this.sliderOf(held);
      s.drag(this.axisOf(held, h.pinch));
      if (held.kind === 'shuttle') this.checkPassWhileHeld();
    }
    if (held && (h.edge === 'end' || !h.pinching)) {
      const s = this.sliderOf(held);
      s.release();
      if (held.kind === 'lever') this.setLatched(held.k, s.target === 1);
      this.holding[side] = null;
    }

    // Poke: index tip descending onto a lever knob or the shuttle.
    if (h.tracked && !h.pinching && this.holding[side] === null && this.enabled) {
      this.updatePoke(side, h);
    }
  }

  private updatePoke(side: Side, h: HandInput): void {
    const r = POKE.radiusM * this.radiusMul;
    const t = this.nearest(h.index, r);
    if (!t) {
      if (this.nearest(h.index, POKE.rearmM * this.radiusMul) === null) this.pokeArmed[side] = true;
      return;
    }
    if (!this.pokeArmed[side] || h.indexVel.y > -POKE.minDownSpeed) return;
    this.pokeArmed[side] = false;
    if (t.kind === 'lever') {
      const l = this.levers[t.k];
      if (l.held) return;
      const next = !this.model.latched[t.k];
      l.target = next ? 1 : 0;
      this.setLatched(t.k, next);
    } else if (!this.shuttle.held && !this.autoThrow) {
      this.throwShuttle();
    }
  }

  /** Auto-throw the shuttle across (poke mode / accessibility). */
  throwShuttle(): void {
    if (this.shuttle.held) return;
    this.autoThrow = true;
    this.shuttle.target = this.model.shuttleSide === 0 ? 1 : 0;
  }

  /** Toggle a lever programmatically (poke, tests). */
  toggleLever(k: number): void {
    const next = !this.model.latched[k];
    this.levers[k].target = next ? 1 : 0;
    this.setLatched(k, next);
  }

  private setLatched(k: number, v: boolean): void {
    if (this.model.latched[k] === v) return;
    this.model.setLatched(k, v);
    this.hooks.leverClick?.(k, v);
  }

  private checkPassWhileHeld(): void {
    const far = this.model.shuttleSide === 0 ? 1 : 0;
    if (this.shuttle.t === far) {
      this.commit();
      // Continuing to hold now starts a new pass from this side.
      this.shuttle.startT = far;
    }
  }

  private checkPassComplete(): void {
    if (this.shuttle.t !== this.model.shuttleSide) this.commit();
  }

  private commit(): void {
    const before = this.model.rows.length;
    this.model.commitRow();
    this.shuttle.target = this.model.shuttleSide;
    this.hooks.pass?.(before);
  }

  private strum(dt: number): void {
    const x = this.shuttleX();
    const px = this.prevShuttleX;
    if (x !== px) {
      const lo = Math.min(x, px);
      const hi = Math.max(x, px);
      const speed = dt > 0 ? Math.abs(x - px) / dt : 0;
      const shed = this.model.shed;
      // Ordered in the direction of travel so a strum sounds as a sweep.
      if (x > px) {
        for (let i = 0; i < WARPS; i++) {
          const wx = warpX(i);
          if (wx > lo && wx <= hi && isLifted(shed, i)) this.hooks.pluck?.(i, speed);
        }
      } else {
        for (let i = WARPS - 1; i >= 0; i--) {
          const wx = warpX(i);
          if (wx >= lo && wx < hi && isLifted(shed, i)) this.hooks.pluck?.(i, speed);
        }
      }
    }
    this.prevShuttleX = x;
  }

  private isHeld(t: Exclude<Target, null>): boolean {
    for (const s of ['left', 'right'] as const) {
      const h = this.holding[s];
      if (h && h.kind === t.kind && (h.kind === 'shuttle' || (t.kind === 'lever' && h.k === t.k))) {
        return true;
      }
    }
    return false;
  }

  private sliderOf(t: Exclude<Target, null>): Slider {
    return t.kind === 'shuttle' ? this.shuttle : this.levers[t.k];
  }

  private axisOf(t: Exclude<Target, null>, p: Vec3Like): number {
    return t.kind === 'shuttle' ? p.x : p.z;
  }

  private tmp: Vec3Like = { x: 0, y: 0, z: 0 };

  /** Nearest interactable within radius r of point p. */
  nearest(p: Vec3Like, r: number): Target {
    let best: Target = null;
    let bestD = r;
    for (let k = 0; k < LEVERS; k++) {
      const c = this.leverPos(k, this.tmp);
      const d = Math.hypot(p.x - c.x, p.y - c.y, p.z - c.z);
      if (d < bestD) {
        bestD = d;
        best = { kind: 'lever', k };
      }
    }
    // Shuttle: distance to its centre segment (half length ≈ 2.6 cm).
    const sx = this.shuttleX();
    const half = 0.026;
    const cx = Math.min(sx + half, Math.max(sx - half, p.x));
    const d = Math.hypot(p.x - cx, p.y - SHUTTLE.y, p.z - SHUTTLE.z);
    if (d < bestD) best = { kind: 'shuttle' };
    return best;
  }
}
