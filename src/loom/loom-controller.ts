/**
 * Pure interaction controller: turns per-hand loom-local input samples into
 * lever / shuttle motion and LoomModel changes. No Three.js, so unit tests
 * can drive it with synthetic joint streams.
 */
import { BOBBIN, LEVER, LEVERS, LOOM, NUDGE, PINCH, POKE, SHUTTLE, TOKEN, bobbinX, leverX, nudgeX, tokenX, warpX, WARPS, shuttleY, BASKET, skeinPos } from '../config.js';
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
  /** Thumb–index distance (m); pokes need an open, pointing hand. */
  aperture?: number;
}

export type Target =
  | { kind: 'lever'; k: number }
  | { kind: 'shuttle' }
  | { kind: 'bobbin' }
  | { kind: 'token' }
  | { kind: 'skein'; i: number }
  | { kind: 'plush'; i: number }
  | { kind: 'windKey' }
  | { kind: 'daily' }
  | { kind: 'phone' }
  | { kind: 'plate' }
  | { kind: 'setting'; i: number }
  | { kind: 'cardRow'; i: number }
  | { kind: 'swap' }
  | { kind: 'nudge'; dir: 1 | -1 }
  | null;

export interface ControllerHooks {
  pluck?(warp: number, speed: number): void;
  /** A fingertip strummed a thread (free play: a note, never a row). */
  strum?(warp: number, speed: number): void;
  leverClick?(k: number, latched: boolean): void;
  grab?(target: Exclude<Target, null>): void;
  pass?(row: number): void;
  undo?(): void;
  /** A wrong last row is waiting to come undone: carrying Pip back over it unweaves it instead of weaving another. */
  missPending?(): boolean;
  /** Co-op guest: ask the host to act. */
  request?(what: 'throw' | 'undo'): void;
  /** Style token pressed (poke or pinch). */
  token?(): void;
  /** Chapter yarn ball pressed (poke or pinch). */
  skein?(i: number): void;
  /** Desk-height nudge pressed. */
  nudge?(dir: 1 | -1): void;
  /** A finished plush was poked or pinched (and let go without moving): it sings its picture. */
  plush?(i: number): void;
  /** A pinched plush is being carried: follow the pinch point (loom space). */
  carry?(i: number, p: Vec3Like): void;
  /** A carried plush was let go here (null: the carry was cut short; it goes back). */
  drop?(i: number, p: Vec3Like | null): void;
  /** The shelf's wind-up key: the whole shelf plays its songs in turn. */
  windKey?(): void;
  /** The picture-of-the-day ball was poked or pinched. */
  daily?(): void;
  /** The toy telephone was poked: call a friend, or hang up. */
  phone?(): void;
  /** The name plate was poked (move the loom). */
  plate?(): void;
  /** In-headset settings: 0 the Settings tag, 1.. a toggle. */
  setting?(i: number): void;
  /** A row of the picture card was poked: it plays its tune. */
  cardRow?(i: number): void;
  /** Sea: a swap spool by a perch was touched: Pip changes yarn. */
  swap?(): void;
}

const KEY_TARGET = { kind: 'windKey' } as const;
const DAILY_TARGET = { kind: 'daily' } as const;
const PHONE_TARGET = { kind: 'phone' } as const;
/** A number per target (resting on the same one keeps counting). */
function targetKey(t: Target): number {
  const x = t as { kind: string; k?: number; i?: number; dir?: number };
  return x.kind.length * 1000 + x.kind.charCodeAt(0) * 10 + (x.k ?? x.i ?? x.dir ?? 0);
}
const PLATE_TARGET = { kind: 'plate' } as const;
/** One target object per settings tag (no allocation in the per-frame search). */
const SETTING_TARGETS: Target[] = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => ({ kind: 'setting', i }) as Target);
/** The two nudge arrows (direction, z): allocated once, not per hand per frame. */
const NUDGE_SPOTS = [[1, NUDGE.upZ], [-1, NUDGE.downZ]] as const;
const SWAP_TARGET = { kind: 'swap' } as const;

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
  /** Rest to press (an accessibility switch): off, a fingertip resting while you think presses nothing. */
  restPress = false;
  /** Auto-throw in progress (poke mode). */
  autoThrow = false;
  enabled = true;
  /** Style token present (unlocked)? */
  tokenEnabled = false;
  /** Chapter yarn balls in the basket (0 = no basket). */
  skeins = 0;
  /** Centres of the finished plushes on the shelf, by slot (null = no plush there). */
  plushSpots: ({ x: number; y: number; z: number } | null)[] = [];
  /** The wind-up key on the shelf end (null: no shelf). */
  keySpot: { x: number; y: number; z: number } | null = null;
  /** The picture-of-the-day ball (null: not offered). */
  dailySpot: { x: number; y: number; z: number } | null = null;
  /** The toy telephone's handset (null: not on the desk). */
  phoneSpot: { x: number; y: number; z: number } | null = null;
  /** The loom's name plate (loom space): poke it to move the loom. */
  plateSpot: { x: number; y: number; z: number } | null = null;
  /** In-headset settings tags (loom space; index 0 the Settings tag), null when hidden. */
  settingSpots: ({ x: number; y: number; z: number } | null)[] = [];
  /** The picture card's rows (loom space; null: not pokeable now). */
  cardRows: ({ x: number; y: number; z: number } | null)[] = [];
  /** Sea's swap spools by each perch (null: this level has one weft). */
  swapSpot: { x: number; y: number; z: number } | null = null;
  /** Nudge arrows present (default placement)? */
  nudgeEnabled = false;
  /** Co-op role gating: which controls this player may touch. */
  allow = { levers: true, shuttle: true };
  /**
   * Co-op guest: the host is authoritative. Local shuttle drags are a
   * preview only (no commits); undo/throw become requests to the host.
   */
  mirror = false;
  private pokeArmed: Record<Side, boolean> = { left: true, right: true };
  private carryFrom: Record<Side, Vec3Like> = { left: { x: 0, y: 0, z: 0 }, right: { x: 0, y: 0, z: 0 } };
  private carrying: Record<Side, boolean> = { left: false, right: false };
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
    for (const side of ['right', 'left'] as const) {
      this.frameDt = dt;
      this.updateHand(side, input[side]);
      this.fingerStrum(side, input[side], dt);
    }

    // Settling (levers to detents; shuttle throw/return).
    for (const l of this.levers) l.settle(dt, LEVER_SETTLE);
    this.bobbin.settle(dt, LEVER_SETTLE);
    if (!this.mirror && !this.shuttle.held && this.shuttle.t !== this.shuttle.target) {
      const range = SHUTTLE.maxX - SHUTTLE.minX;
      const toFar = this.shuttle.target !== this.model.shuttleSide;
      const speed = (toFar ? SHUTTLE.autoThrowSpeed : SHUTTLE_RETURN) / range;
      if (this.shuttle.settle(dt, speed)) {
        this.autoThrow = false;
        this.checkPassComplete();
        this.unlockShed();
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
      } else if (t?.kind === 'skein') {
        this.hooks.skein?.(t.i);
      } else if (t?.kind === 'plush') {
        // a plush can be carried: decide on release (moved → set it down; still → it sings)
        this.holding[side] = t;
        this.carryFrom[side].x = h.pinch.x;
        this.carryFrom[side].y = h.pinch.y;
        this.carryFrom[side].z = h.pinch.z;
        this.carrying[side] = false;
      } else if (t?.kind === 'windKey') {
        this.hooks.windKey?.();
      } else if (t?.kind === 'daily') {
        this.hooks.daily?.();
      } else if (t?.kind === 'phone') {
        this.hooks.phone?.();
      } else if (t?.kind === 'plate') {
        this.hooks.plate?.();
      } else if (t?.kind === 'setting') {
        this.hooks.setting?.(t.i);
      } else if (t?.kind === 'cardRow') {
        this.hooks.cardRow?.(t.i);
      } else if (t?.kind === 'swap') {
        if (!this.shuttle.held) this.hooks.swap?.();
      } else if (t?.kind === 'nudge') {
        this.hooks.nudge?.(t.dir);
      } else if (t && !this.isHeld(t) && !(t.kind === 'shuttle' && this.autoThrow)) {
        this.holding[side] = t;
        this.sliderOf(t).grab(this.axisOf(t, h.pinch));
        this.hooks.grab?.(t);
      }
    } else if (held && held.kind === 'plush' && h.pinching) {
      const f = this.carryFrom[side];
      if (!this.carrying[side] && Math.hypot(h.pinch.x - f.x, h.pinch.y - f.y, h.pinch.z - f.z) > 0.03) this.carrying[side] = true;
      if (this.carrying[side]) this.hooks.carry?.(held.i, h.pinch);
    } else if (held && h.pinching) {
      const s = this.sliderOf(held);
      s.drag(this.axisOf(held, h.pinch));
      if (held.kind === 'shuttle') this.checkPassWhileHeld();
    }
    if (held && held.kind === 'plush' && (h.edge === 'end' || !h.pinching)) {
      if (this.carrying[side]) this.hooks.drop?.(held.i, h.pinch);
      else this.hooks.plush?.(held.i);
      this.carrying[side] = false;
      this.holding[side] = null;
    } else if (held && (h.edge === 'end' || !h.pinching)) {
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

  private frameDt = 0;
  /** Press by resting: seconds a still fingertip has rested inside the same control (slow or unsteady hands). */
  private restT: Record<Side, number> = { left: 0, right: 0 };
  private restOn: Record<Side, number> = { left: -1, right: -1 };
  private updatePoke(side: Side, h: HandInput): void {
    const r = POKE.radiusM * this.radiusMul;
    const t = this.nearest(h.index, r);
    if (!t) {
      if (this.nearest(h.index, POKE.rearmM * this.radiusMul) === null) this.pokeArmed[side] = true;
      this.restT[side] = 0;
      return;
    }
    // a press: down onto things on the desk, or forward into the upright picture card
    const quick = h.indexVel.y < -POKE.minDownSpeed || (t.kind === 'cardRow' && h.indexVel.z < -POKE.minDownSpeed);
    // or a fingertip resting still inside the control for a moment (no speed or pointing needed)
    const code = targetKey(t);
    const still = Math.hypot(h.indexVel.x, h.indexVel.y, h.indexVel.z) < POKE.restStillSpeed;
    if (!this.restPress || code !== this.restOn[side] || !still) {
      this.restOn[side] = code;
      this.restT[side] = 0;
    } else this.restT[side] += this.frameDt;
    const rested = this.restT[side] >= POKE.restSeconds;
    if (!this.pokeArmed[side] || !(quick || rested)) return;
    if (!rested && h.aperture !== undefined && h.aperture < POKE.minAperture) return; // reaching to pinch
    this.restT[side] = 0;
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
    } else if (t.kind === 'skein') {
      this.hooks.skein?.(t.i);
    } else if (t.kind === 'plush') {
      this.hooks.plush?.(t.i);
    } else if (t.kind === 'windKey') {
      this.hooks.windKey?.();
    } else if (t.kind === 'daily') {
      this.hooks.daily?.();
    } else if (t.kind === 'phone') {
      this.hooks.phone?.();
    } else if (t.kind === 'plate') {
      this.hooks.plate?.();
    } else if (t.kind === 'setting') {
      this.hooks.setting?.(t.i);
    } else if (t.kind === 'cardRow') {
      this.hooks.cardRow?.(t.i);
    } else if (t.kind === 'swap') {
      if (!this.shuttle.held) this.hooks.swap?.();
    } else if (t.kind === 'nudge') {
      this.hooks.nudge?.(t.dir);
    } else if (!this.shuttle.held && !this.autoThrow) {
      this.throwShuttle();
    }
  }

  /** Drop anything held (win, pause, partner left): sliders settle. */
  releaseAll(): void {
    for (const side of ['left', 'right'] as const) {
      const held = this.holding[side];
      if (!held) continue;
      if (held.kind === 'plush') {
        if (this.carrying[side]) this.hooks.drop?.(held.i, null);
        this.carrying[side] = false;
        this.holding[side] = null;
        continue;
      }
      const s = this.sliderOf(held);
      s.release();
      if (held.kind === 'lever') this.setLatched(held.k, s.target === 1);
      if (held.kind === 'bobbin') s.target = 0;
      this.holding[side] = null;
    }
  }

  /** Auto-throw the shuttle across (poke mode / accessibility). */
  throwShuttle(): void {
    if (this.shuttle.held || !this.enabled) return;
    if (this.mirror) this.hooks.request?.('throw');
    this.autoThrow = true;
    this.shuttle.target = this.model.shuttleSide === 0 ? 1 : 0;
  }

  /** Toggle a lever programmatically (poke, tests). */
  toggleLever(k: number): void {
    const next = !this.model.latched[k];
    this.levers[k].target = next ? 1 : 0;
    this.setLatched(k, next);
  }

  /** Until this time (performance.now ms) a manual undo is ignored. */
  undoQuietUntil = 0;

  /** Unpick the last row (always available, never penalised). */
  doUndo(): void {
    if (!this.enabled) return;
    if (performance.now() < this.undoQuietUntil) return; // the loom just unpicked a wrong row by itself: don't take a right one too
    if (this.mirror) {
      this.hooks.request?.('undo');
      return;
    }
    if (this.shuttle.held || this.autoThrow) return;
    if (this.model.undo() === undefined) return;
    this.shuttle.setImmediate(this.model.shuttleSide);
    this.prevShuttleX = this.shuttleX();
    this.hooks.undo?.();
  }

  /** Pip has landed: apply any lever changes made during his flight. */
  unlockShed(): void {
    if (!this.shedLock) return;
    this.shedLock = false;
    for (let k = 0; k < this.pendingLatch.length; k++) {
      const v = this.pendingLatch[k];
      this.pendingLatch[k] = undefined;
      if (v !== undefined) this.setLatched(k, v);
    }
  }

  /** Co-op: apply a lever state decided elsewhere (slider springs there). */
  applyLatched(k: number, v: boolean): void {
    if (this.model.latched[k] === v) return;
    this.levers[k].target = v ? 1 : 0;
    this.setLatched(k, v);
  }

  /**
   * Co-op host: the guest's hand drives the shuttle. `t` is the guest's
   * slider position; `held` whether their pinch is closed.
   */
  remoteShuttle(t: number, held: boolean): void {
    const s = this.shuttle;
    if (held) {
      if (!s.held) {
        s.held = true;
        s.startT = s.t;
      }
      s.t = Math.min(1, Math.max(0, t));
      this.checkPassWhileHeld();
    } else if (s.held) {
      s.t = Math.min(1, Math.max(0, t));
      s.release();
    }
  }

  /** While Pip flies a row by himself (a repeat), lever changes wait until he lands: that row is already decided. */
  shedLock = false;
  private pendingLatch: (boolean | undefined)[] = [];

  private setLatched(k: number, v: boolean): void {
    if (this.shedLock) {
      this.pendingLatch[k] = v;
      return;
    }
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
    if (this.mirror) return; // the host commits; we follow its snapshots
    if (!this.enabled) return; // no rows during a win's playback
    const before = this.model.rows.length;
    if (this.hooks.missPending?.() && this.model.undo() !== undefined) {
      // Pip went back the way he came: that row unweaves (he lands where it began)
      this.shuttle.target = this.model.shuttleSide;
      this.prevShuttleX = this.shuttleX();
      this.undoQuietUntil = performance.now() + 900; // a spool poke right after takes nothing more
      this.hooks.undo?.();
      return;
    }
    this.model.commitRow();
    this.shuttle.target = this.model.shuttleSide;
    this.hooks.pass?.(before);
  }

  /**
   * The threads are strings: a fingertip sweeping across them (between the
   * heddle and the cloth, just above the bed) plucks each one it crosses,
   * louder the faster you strum. Play any time; it never weaves.
   */
  private fingerStrum(side: Side, h: HandInput, dt: number): void {
    const prev = this.prevTip[side];
    const p = h.index;
    const ok =
      h.tracked && !h.pinching && this.holding[side] === null && this.enabled &&
      p.z > LOOM.heddleZ - 0.005 && p.z < LOOM.clothFrontZ - 0.005 && p.y > 0.004 && p.y < LOOM.liftedY + 0.02;
    if (ok && prev.ok) {
      const lo = Math.min(prev.x, p.x);
      const hi = Math.max(prev.x, p.x);
      const speed = dt > 0 ? Math.abs(p.x - prev.x) / dt : 0;
      for (let n = 0; n < WARPS; n++) {
        const i = p.x > prev.x ? n : WARPS - 1 - n; // a sweep sounds in the direction of travel
        const wx = warpX(i);
        if (wx > lo && wx <= hi && this.clock - this.lastStrum[i] > 0.09) {
          this.lastStrum[i] = this.clock;
          this.hooks.strum?.(i, speed);
        }
      }
    }
    prev.x = p.x;
    prev.ok = ok;
    this.clock += side === 'right' ? dt : 0;
  }
  private prevTip: Record<Side, { x: number; ok: boolean }> = { left: { x: 0, ok: false }, right: { x: 0, ok: false } };
  private lastStrum = new Float32Array(WARPS).fill(-1);
  private clock = 0;

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
    if (t.kind === 'token' || t.kind === 'nudge' || t.kind === 'skein' || t.kind === 'plush' || t.kind === 'windKey' || t.kind === 'daily' || t.kind === 'phone' || t.kind === 'plate' || t.kind === 'setting' || t.kind === 'cardRow' || t.kind === 'swap') return this.bobbin; // never held
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
    for (let k = 0; k < (this.allow.levers ? this.activeLevers : 0); k++) {
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
    const d = this.allow.shuttle ? Math.hypot(p.x - cx, p.y - shuttleY(cx), p.z - SHUTTLE.z) : Infinity;
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
    for (let i = 0; i < this.skeins; i++) {
      const c = skeinPos(i, this.bankSide, this.tmp);
      const ds = Math.hypot(p.x - c.x, p.y - c.y, p.z - c.z) - BASKET.ballR * 0.5;
      if (ds < bestD) {
        bestD = ds;
        best = { kind: 'skein', i };
      }
    }
    for (let i = 0; i < this.plushSpots.length; i++) {
      const c = this.plushSpots[i];
      if (!c) continue;
      const dp = Math.hypot(p.x - c.x, p.y - c.y, p.z - c.z) - 0.012; // a soft plush ~2.4 cm across
      if (dp < bestD) {
        bestD = dp;
        best = { kind: 'plush', i };
      }
    }
    if (this.swapSpot) {
      const c = this.swapSpot;
      const ds = Math.hypot(p.x - c.x, p.y - c.y, p.z - c.z) - 0.016;
      if (ds < bestD) {
        bestD = ds;
        best = SWAP_TARGET;
      }
    }
    if (this.keySpot) {
      const c = this.keySpot;
      const dk = Math.hypot(p.x - c.x, p.y - c.y, p.z - c.z) - 0.01;
      if (dk < bestD) {
        bestD = dk;
        best = KEY_TARGET;
      }
    }
    for (let i = 0; i < this.cardRows.length; i++) {
      const c = this.cardRows[i];
      if (!c) continue;
      const dr = Math.hypot(p.x - c.x, (p.y - c.y) * 1.6, p.z - c.z) - 0.008; // rows are close: the vertical counts more
      if (dr < bestD) {
        bestD = dr;
        best = { kind: 'cardRow', i };
      }
    }
    if (this.dailySpot) {
      const c = this.dailySpot;
      const dd = Math.hypot(p.x - c.x, p.y - c.y, p.z - c.z) - 0.014;
      if (dd < bestD) {
        bestD = dd;
        best = DAILY_TARGET;
      }
    }
    if (this.phoneSpot) {
      const c = this.phoneSpot;
      const dd = Math.hypot(p.x - c.x, p.y - c.y, p.z - c.z) - 0.016;
      if (dd < bestD) {
        bestD = dd;
        best = PHONE_TARGET;
      }
    }
    for (let i = 0; i < this.settingSpots.length; i++) {
      const c = this.settingSpots[i];
      if (!c) continue;
      const dd = Math.hypot(Math.max(0, Math.abs(p.x - c.x) - 0.03), p.y - c.y, p.z - c.z) - 0.01;
      if (dd < bestD) {
        bestD = dd;
        best = SETTING_TARGETS[i];
      }
    }
    if (this.plateSpot) {
      // a wide, low slat: measure across it more loosely than along
      const c = this.plateSpot;
      const dd = Math.hypot(Math.max(0, Math.abs(p.x - c.x) - 0.035), p.y - c.y, p.z - c.z) - 0.012;
      if (dd < bestD) {
        bestD = dd;
        best = PLATE_TARGET;
      }
    }
    if (this.nudgeEnabled) {
      const nx = nudgeX(this.bankSide);
      for (const [dir, z] of NUDGE_SPOTS) {
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
