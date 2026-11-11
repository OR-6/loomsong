/**
 * Co-op protocol (pure, transport-agnostic). Two players, two desks, one
 * loom: the host is the Warden (levers) and authoritative; the guest is the
 * Shuttler. Host → guest: state snapshots (20 Hz). Guest → host: shuttle
 * hand position (30 Hz while moving) and requests (throw, undo).
 * Messages are small JSON objects; everything received is validated.
 */
import type { LevelFlow } from '../app/level-flow.js';
import type { LoomController } from '../loom/loom-controller.js';
import type { LoomModel } from '../loom/loom-model.js';
import { LEVERS } from '../config.js';

export interface Transport {
  send(msg: unknown): void;
  onMessage(cb: (msg: unknown) => void): void;
}

export interface Snapshot {
  k: 's';
  l: number; // level index
  lat: number; // latched bitmask
  r: number[]; // rows
  sd: 0 | 1; // shuttle side
  t: number; // shuttle t
  ph: string; // flow phase
  st: number; // stars of the last win
}
export type GuestMsg =
  | { k: 'sh'; t: number; h: boolean }
  | { k: 'req'; what: 'throw' | 'undo' }
  /** A phone caller says hello; it holds the picture, and talks the weaver through it. */
  | { k: 'hi'; who: 'caller' }
  /** (older callers) work a lever by index: ignored now, the phone only describes. */
  | { k: 'lev'; i: number; v: boolean }
  /** The caller pins a thread (0..7) on the headset's loom, or takes the pin out. */
  | { k: 'pin'; i: number; on: boolean }
  /** The caller rings Pip: it waves at the weaver. */
  | { k: 'ring' };

export interface Side {
  model: LoomModel;
  controller: LoomController;
  flow: LevelFlow;
}

const SNAP_HZ = 20;
const HAND_HZ = 30;

const isNum = (v: unknown, lo: number, hi: number): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;

export function validSnapshot(m: unknown): m is Snapshot {
  const s = m as Snapshot;
  return (
    !!s &&
    s.k === 's' &&
    isNum(s.l, 0, 9999) &&
    isNum(s.lat, 0, 15) &&
    Array.isArray(s.r) &&
    s.r.length <= 64 &&
    s.r.every((x) => isNum(x, 0, 511)) && // 8 warp bits + Sea's weft bit
    (s.sd === 0 || s.sd === 1) &&
    isNum(s.t, 0, 1) &&
    typeof s.ph === 'string' &&
    isNum(s.st, 0, 3)
  );
}

export function validGuestMsg(m: unknown): m is GuestMsg {
  const g = m as GuestMsg;
  if (!g || typeof g !== 'object') return false;
  if (g.k === 'sh') return isNum(g.t, 0, 1) && typeof g.h === 'boolean';
  if (g.k === 'req') return g.what === 'throw' || g.what === 'undo';
  if (g.k === 'hi') return g.who === 'caller';
  if (g.k === 'lev') return Number.isInteger(g.i) && isNum(g.i, 0, LEVERS - 1) && typeof g.v === 'boolean';
  if (g.k === 'pin') return Number.isInteger(g.i) && isNum(g.i, 0, 7) && typeof g.on === 'boolean';
  if (g.k === 'ring') return true;
  return false;
}

/** Host (Warden): levers locally; shuttle is driven by the guest. */
export class CoopHost {
  /** Partner gone: release a shuttle their hand was still holding. */
  dispose(): void {
    const s = this.side.controller.shuttle;
    if (s.held) s.release();
  }

  private acc = 0;
  constructor(
    private side: Side,
    private link: Transport,
  ) {
    side.controller.allow = { levers: true, shuttle: false };
    // A shared-cloth challenge can't be mirrored by level index: play normally.
    if (side.flow.challenge) side.flow.start();
    link.onMessage((m) => this.receive(m));
  }

  /** A phone caller joined: the headset keeps levers and Pip; the phone has the picture. */
  caller = false;
  onCaller: (() => void) | null = null;
  /** The caller pinned (or unpinned) a thread. */
  onPin: ((i: number, on: boolean) => void) | null = null;
  /** The caller rang Pip. */
  onRing: (() => void) | null = null;

  receive(m: unknown): void {
    if (!validGuestMsg(m)) return;
    const c = this.side.controller;
    if (m.k === 'hi') {
      this.caller = true;
      c.allow = { levers: true, shuttle: true };
      this.onCaller?.();
      return;
    }
    if (m.k === 'ring') {
      if (this.caller) this.onRing?.();
      return;
    }
    if (!c.enabled || this.side.flow.phase !== 'play') return; // ignore during wins
    if (m.k === 'pin') {
      if (this.caller) this.onPin?.(m.i, m.on);
    } else if (m.k === 'lev') return; // the phone describes; the hands in the headset do the weaving
    else if (this.caller) return; // a phone never drives the shuttle
    else if (m.k === 'sh') c.remoteShuttle(m.t, m.h);
    else if (m.what === 'throw') c.throwShuttle();
    else c.doUndo();
  }

  snapshot(): Snapshot {
    const { model, controller, flow } = this.side;
    let lat = 0;
    for (let k = 0; k < LEVERS; k++) if (model.latched[k]) lat |= 1 << k;
    return {
      k: 's',
      l: flow.index,
      lat,
      r: [...model.rows],
      sd: model.shuttleSide,
      t: Math.round(controller.shuttle.t * 1000) / 1000,
      ph: flow.phase,
      st: flow.lastStars,
    };
  }

  tick(dt: number): void {
    this.acc += dt;
    if (this.acc < 1 / SNAP_HZ) return;
    this.acc = 0;
    this.link.send(this.snapshot());
  }
}

/** Guest (Shuttler): shuttle locally (preview); mirrors the host's state. */
export class CoopGuest {
  private acc = 0;
  private latest: Snapshot | null = null;
  private lastSent = { t: -1, h: false };
  /** Snapshots applied (diagnostics). */
  applied = 0;

  constructor(
    private side: Side,
    private link: Transport,
  ) {
    side.controller.allow = { levers: false, shuttle: true };
    side.controller.mirror = true;
    side.flow.mirror = true;
    side.controller.hooks.request = (what) => link.send({ k: 'req', what } satisfies GuestMsg);
    link.onMessage((m) => {
      if (validSnapshot(m)) this.latest = m;
    });
  }

  /** Apply the newest snapshot, then stream our shuttle hand. */
  tick(dt: number): void {
    const { model, controller, flow } = this.side;
    const s = this.latest;
    if (s) {
      this.latest = null;
      this.applied++;
      // New level, or the host restarted it after a win while we wait.
      if (!flow.level || s.l !== flow.index || (s.ph === 'play' && flow.phase === 'between')) {
        flow.mirrorStart(s.l);
        controller.syncFromModel();
      }
      for (let k = 0; k < LEVERS; k++) controller.applyLatched(k, ((s.lat >> k) & 1) === 1);
      model.syncRows(s.r, s.sd);
      if (!controller.shuttle.held) {
        controller.shuttle.t = s.t; // mirror controllers don't settle locally
        controller.autoThrow = false;
      }
      if ((s.ph === 'won' || s.ph === 'playback') && flow.phase === 'play') flow.mirrorWin(s.st);
    }
    this.acc += dt;
    const sh = controller.shuttle;
    const changed = sh.held !== this.lastSent.h || (sh.held && Math.abs(sh.t - this.lastSent.t) > 0.002);
    if (changed && this.acc >= 1 / HAND_HZ) {
      this.acc = 0;
      this.lastSent = { t: sh.t, h: sh.held };
      this.link.send({ k: 'sh', t: Math.round(sh.t * 1000) / 1000, h: sh.held } satisfies GuestMsg);
    }
  }
}
