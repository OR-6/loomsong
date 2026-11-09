/**
 * Pure interaction controller: turns per-hand loom-local input samples into
 * lever / shuttle motion and LoomModel changes. No Three.js, so unit tests
 * can drive it with synthetic joint streams.
 */
import { BOBBIN, LEVER, LEVERS, NUDGE, PINCH, POKE, SHUTTLE, TOKEN, bobbinX, leverX, nudgeX, tokenX, warpX, WARPS } from '../config.js';
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

export type Target =
  | { kind: 'lever'; k: number }
  | { kind: 'shuttle' }
  | { kind: 'bobbin' }
  | { kind: 'token' }
  | { kind: 'nudge'; dir: 1 | -1 }
  | null;

export interface ControllerHooks {
  pluck?(warp: number, speed: number): void;
  leverClick?(k: number, latched: boolean): void;
  grab?(target: Exclude<Target, null>): void;
  pass?(row: number): void;
  undo?(): void;
  /** Style token pressed (poke or pinch). */
  token?(): void;
  /** Desk-height nudge pressed. */
  nudge?(dir: 1 | -1): void;
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
  /** Undo bobbin: pinch and pull toward the user (t 0 → 1). */
  readonly bobbin = new Slider({
    a0: BOBBIN.z,
    a1: BOBBIN.z + BOBBIN.pull,
    release: { kind: 'detents', magnet: 0 },
  });
  holding: Record<Side, Target> = { left: null, right: null };
  hover: Record<Side, Target> = { left: null, right: null };
  /** +1 bank on the right of the loom, -1 on the left. */
  bankSide: 1 | -1 = 1;
  radiusMul = 1;
  /** Auto-throw in progress (poke mode). */
  autoThrow = false;
  enabled = true;
  /** Style token present (unlocked)? */
  tokenEnabled = false;
  /** Nudge arrows present (default placement)? */
  nudgeEnabled = false;
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
  /** Number of levers this level uses (2–4); others are hidden and inert. */
  get activeLevers(): number {
    return this.model.tieUp.length;
  }

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
    this.bobbin.settle(dt, LEVER_SETTLE);
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
      if (t?.kind === 'token') {
        // A button, not a slider: pinch on it presses it.
        this.hooks.token?.();
      } else if (t?.kind === 'nudge') {
        this.hooks.nudge?.(t.dir);
      } else if (t && !this.isHeld(t) && !(t.kind === 'shuttle' && this.autoThrow)) {
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
      if (held.kind === 'bobbin') {
        if (s.target === 1) this.doUndo();
        s.target = 0;
      }
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
    } else if (t.kind === 'bobbin') {
      this.doUndo();
    } else if (t.kind === 'token') {
      this.hooks.token?.();
    } else if (t.kind === 'nudge') {
      this.hooks.nudge?.(t.dir);
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

  /** Unpick the last row (always available, never penalised). */
  doUndo(): void {
    if (this.shuttle.held || this.autoThrow) return;
    if (this.model.undo() === undefined) return;
    this.shuttle.setImmediate(this.model.shuttleSide);
    this.prevShuttleX = this.shuttleX();
    this.hooks.undo?.();
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
      if (h && h.kind === t.kind && (h.kind !== 'lever' || (t.kind === 'lever' && h.k === t.k))) {
        return true;
      }
    }
    return false;
  }

  private sliderOf(t: Exclude<Target, null>): Slider {
    if (t.kind === 'token' || t.kind === 'nudge') return this.bobbin; // never held
    if (t.kind === 'shuttle') return this.shuttle;
    if (t.kind === 'bobbin') return this.bobbin;
    return this.levers[t.k];
  }

  private axisOf(t: Exclude<Target, null>, p: Vec3Like): number {
    return t.kind === 'shuttle' ? p.x : p.z;
  }

  bobbinPos(out: Vec3Like): Vec3Like {
    out.x = bobbinX(this.bankSide);
    out.y = BOBBIN.y;
    out.z = this.bobbin.axisAt(this.bobbin.t);
    return out;
  }

  private tmp: Vec3Like = { x: 0, y: 0, z: 0 };

  /** Nearest interactable within radius r of point p. */
  nearest(p: Vec3Like, r: number): Target {
    let best: Target = null;
    let bestD = r;
    for (let k = 0; k < this.activeLevers; k++) {
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
    if (d < bestD) {
      bestD = d;
      best = { kind: 'shuttle' };
    }
    const b = this.bobbinPos(this.tmp);
    const db = Math.hypot(p.x - b.x, p.y - b.y, p.z - b.z);
    if (db < bestD) {
      bestD = db;
      best = { kind: 'bobbin' };
    }
    if (this.tokenEnabled) {
      const dt = Math.hypot(p.x - tokenX(this.bankSide), p.y - TOKEN.y, p.z - TOKEN.z);
      if (dt < bestD) {
        bestD = dt;
        best = { kind: 'token' };
      }
    }
    if (this.nudgeEnabled) {
      const nx = nudgeX(this.bankSide);
      for (const [dir, z] of [[1, NUDGE.upZ], [-1, NUDGE.downZ]] as const) {
        const dn = Math.hypot(p.x - nx, p.y - NUDGE.y, p.z - z);
        if (dn < bestD) {
          bestD = dn;
          best = { kind: 'nudge', dir };
        }
      }
    }
    return best;
  }
}
