/**
 * GameSystem: "set the table" placement, then per-frame loom interaction.
 * Reads hand state from HandTrackerSystem, converts it to loom-local space,
 * drives LoomController, and syncs LoomView.
 */
import {
  createSystem,
  Matrix4,
  Vector3,
  VisibilityState,
  XRPlane,
} from '@iwsdk/core';
import { LEVER, LEVERS, PLACE, SHUTTLE } from '../config.js';
import { hands, calibration, type Side } from '../input/hands.js';
import { LoomController, type HandInput } from '../loom/loom-controller.js';
import { LoomModel } from '../loom/loom-model.js';
import { LoomView } from '../loom/loom-view.js';
import { Placement, loomPose } from './placement.js';
import { Label } from '../ui/label.js';
import { audio } from '../audio/synth.js';

const params = new URLSearchParams(location.search);
const FIXED_DESK = params.get('desk');

/** M0 tie-up: four straight-ish lifts covering all warps. */
const M0_TIEUP = [0b00010001, 0b00100010, 0b01000100, 0b10001000];

export interface GameDebug {
  phase: string;
  deskY: number | null;
  deskSource: string | null;
  loomOrigin: number[] | null;
  latched: boolean[];
  shed: number;
  rows: number[];
  shuttleT: number;
  holding: Record<Side, unknown>;
  hover: Record<Side, unknown>;
  plucks: number;
  paused: boolean;
}

export class GameSystem extends createSystem({
  planes: { required: [XRPlane] },
}) {
  model!: LoomModel;
  controller!: LoomController;
  view!: LoomView;
  placement!: Placement;
  private hint!: Label;
  private inv = new Matrix4();
  private planeInv = new Matrix4();
  private head = new Vector3();
  private fwd = new Vector3();
  private tmp = new Vector3();
  private planeYs: number[] = [];
  private bloom = 0;
  private sessionTime = 0;
  private paused = false;
  private debug!: GameDebug;
  private handInputs: Record<Side, HandInput> = {
    left: mkInput(),
    right: mkInput(),
  };
  private firstHand: Side | null = null;

  init() {
    this.model = new LoomModel([...M0_TIEUP]);
    this.view = new LoomView();
    this.controller = new LoomController(this.model, {
      pluck: (i, speed) => {
        audio.pluck(i, speed);
        this.view.pulseWarp();
        this.debug.plucks++;
      },
      leverClick: (_k, latched) => audio.click(latched),
      grab: () => audio.resume(),
      pass: () => audio.thud(),
    });
    this.placement = new Placement();

    const loomEntity = this.world.createTransformEntity(this.view.root);
    loomEntity.object3D!.visible = false;
    this.world.createTransformEntity(this.view.glows.left);
    this.world.createTransformEntity(this.view.glows.right);

    this.hint = new Label(0.22, 0.034);
    this.hint.set('Rest your hand here');
    this.world.createTransformEntity(this.hint.mesh);
    this.hint.mesh.visible = false;

    this.model.on((e) => {
      if (e.type === 'lever') this.view.setShed(e.shed);
      if (e.type === 'row' || e.type === 'undo') this.view.setRows(this.model.rows);
    });

    this.debug = {
      phase: 'waiting',
      deskY: null,
      deskSource: null,
      loomOrigin: null,
      latched: this.model.latched,
      shed: 0,
      rows: this.model.rows,
      shuttleT: 0,
      holding: this.controller.holding,
      hover: this.controller.hover,
      plucks: 0,
      paused: false,
    };
    (window as unknown as { __loom: unknown }).__loom = {
      debug: this.debug,
      game: this,
      hands,
      /** World positions of interactables, for E2E scripts. */
      targets: () => this.targets(),
    };

    this.cleanupFuncs.push(
      this.visibilityState.subscribe((s) => {
        this.setPaused(s === VisibilityState.VisibleBlurred || s === VisibilityState.Hidden);
        if (s === VisibilityState.Visible) {
          const sess = this.world.session;
          if (sess?.updateTargetFrameRate && sess.supportedFrameRates?.includes(72)) {
            sess.updateTargetFrameRate(72).catch(() => {});
          }
        }
        if (s === VisibilityState.NonImmersive) this.sessionTime = 0;
      }),
    );
    const onVis = () => this.setPaused(document.visibilityState === 'hidden');
    document.addEventListener('visibilitychange', onVis);
    this.cleanupFuncs.push(() => document.removeEventListener('visibilitychange', onVis));
  }

  setPaused(p: boolean): void {
    this.paused = p;
    this.debug.paused = p;
    audio.setPaused(p);
  }

  update(delta: number) {
    const dt = Math.min(delta, 0.05);
    if (this.paused) return;
    const immersive = this.visibilityState.peek() !== VisibilityState.NonImmersive;
    this.player.head.getWorldPosition(this.head);

    if (this.placement.phase !== 'placed') {
      if (!immersive) return;
      this.sessionTime += dt;
      this.updatePlacement(dt);
      return;
    }

    // Bloom-in animation.
    if (this.bloom < 1) {
      this.bloom = Math.min(1, this.bloom + dt / 0.6);
      const e = 1 - Math.pow(1 - this.bloom, 3);
      this.view.root.scale.setScalar(0.05 + 0.95 * e);
      this.view.root.updateMatrixWorld();
    }

    this.inv.copy(this.view.root.matrixWorld).invert();
    for (const side of ['left', 'right'] as const) this.fillInput(side);
    this.controller.radiusMul = calibration.radiusMul;
    this.controller.update(this.handInputs, dt);
    this.syncView(dt);
  }

  /** World-space positions of every interactable (E2E + check:reach). */
  targets(): Record<string, number[]> {
    const out: Record<string, number[]> = {};
    if (this.placement.phase !== 'placed') return out;
    const v = new Vector3();
    const p = { x: 0, y: 0, z: 0 };
    for (let k = 0; k < LEVERS; k++) {
      this.controller.leverPos(k, p);
      v.set(p.x, p.y, p.z).applyMatrix4(this.view.root.matrixWorld);
      out[`lever${k}`] = v.toArray();
    }
    for (const [name, x] of [
      ['shuttle', this.controller.shuttleX()],
      ['shuttleMin', SHUTTLE.minX],
      ['shuttleMax', SHUTTLE.maxX],
    ] as const) {
      v.set(x, SHUTTLE.y, SHUTTLE.z).applyMatrix4(this.view.root.matrixWorld);
      out[name] = v.toArray();
    }
    v.set(0, 0, LEVER.restZ - LEVER.travel).applyMatrix4(this.view.root.matrixWorld);
    out.leverLatchedZRef = v.toArray();
    out.head = this.head.toArray();
    return out;
  }

  private updatePlacement(dt: number) {
    if (FIXED_DESK !== null && Number.isFinite(Number(FIXED_DESK))) {
      this.placement.place(Number(FIXED_DESK), 'fixed');
      this.placeLoom(this.firstHand ?? 'right');
      return;
    }
    // Hint sits where the loom will appear, facing the user.
    this.forwardFlat(this.fwd);
    this.hint.mesh.visible = true;
    this.hint.mesh.position
      .copy(this.head)
      .addScaledVector(this.fwd, PLACE.forward + 0.05);
    this.hint.mesh.position.y = this.head.y - 0.28;
    this.hint.mesh.lookAt(this.head);

    let placed = false;
    for (const side of ['right', 'left'] as const) {
      const h = hands[side];
      if (!h.tracked) continue;
      const sample = {
        x: h.palm.x,
        y: h.palm.y,
        z: h.palm.z,
        radius: h.palmRadius,
        upDot: h.upDot,
      };
      this.planesUnder(h.palm);
      if (this.placement.update(sample, this.planeYs, dt, this.head.y)) {
        this.firstHand = side;
        placed = true;
        break;
      }
      if (this.placement.phase === 'steadying') break; // only one hand at a time
    }
    if (!placed && !hands.left.tracked && !hands.right.tracked) {
      this.placement.update(null, [], dt);
      if (this.sessionTime > 8) {
        this.placement.placeDefault(this.head.y);
        placed = true;
      }
    }
    this.debug.phase = this.placement.phase;
    if (placed) this.placeLoom(this.firstHand ?? 'right');
  }

  /**
   * Heights of horizontal detected planes whose polygon lies under `p`
   * (5 cm margin). Floors/ceilings are ignored. Result in this.planeYs.
   */
  private planesUnder(p: Vector3) {
    this.planeYs.length = 0;
    for (const e of this.queries.planes.entities) {
      const pl = e.getValue(XRPlane, '_plane') as
        | (XRPlane & { semanticLabel?: string })
        | undefined;
      const obj = e.object3D;
      if (!pl || !obj || pl.orientation !== 'horizontal') continue;
      if (pl.semanticLabel === 'floor' || pl.semanticLabel === 'ceiling') continue;
      obj.updateMatrixWorld();
      this.planeInv.copy(obj.matrixWorld).invert();
      this.tmp.copy(p).applyMatrix4(this.planeInv);
      if (!insidePolygon(pl.polygon, this.tmp.x, this.tmp.z, 0.05)) continue;
      obj.getWorldPosition(this.tmp);
      this.planeYs.push(this.tmp.y);
    }
  }

  /** Place the loom ~PLACE.forward ahead, centred with the lever bank. */
  private placeLoom(hand: Side) {
    const side: 1 | -1 = hand === 'left' ? -1 : 1;
    this.controller.bankSide = side;
    this.view.setSide(side);
    this.forwardFlat(this.fwd);
    const root = this.view.root;
    const pose = loomPose(this.head, this.fwd, side, this.placement.deskY!);
    root.position.set(pose.x, pose.y, pose.z);
    root.rotation.set(0, pose.yaw, 0);
    root.visible = true;
    root.scale.setScalar(0.05);
    root.updateMatrixWorld(true);
    this.hint.mesh.visible = false;
    this.bloom = 0;
    this.debug.phase = 'placed';
    this.debug.deskY = this.placement.deskY;
    this.debug.deskSource = this.placement.source;
    this.debug.loomOrigin = root.position.toArray().map((n) => Math.round(n * 1e4) / 1e4);
    audio.bloom();
  }

  private forwardFlat(out: Vector3) {
    this.player.head.getWorldDirection(out);
    // Object3D.getWorldDirection returns +Z; the view looks down -Z.
    out.negate();
    out.y = 0;
    if (out.lengthSq() < 1e-6) out.set(0, 0, -1);
    out.normalize();
    return out;
  }

  private fillInput(side: Side) {
    const h = hands[side];
    const inp = this.handInputs[side];
    inp.tracked = h.tracked;
    inp.pinching = h.pinch.pinching;
    inp.edge = h.edge;
    this.tmp.copy(h.pinchPoint).applyMatrix4(this.inv);
    copy(inp.pinch, this.tmp);
    this.tmp.copy(h.indexTip).applyMatrix4(this.inv);
    copy(inp.index, this.tmp);
    // Velocity: rotate only (loom has yaw + uniform scale ~1).
    this.tmp.copy(h.indexVel).applyAxisAngle(UPV, -this.view.root.rotation.y);
    copy(inp.indexVel, this.tmp);

    const glow = this.view.glows[side];
    glow.visible = h.tracked;
    glow.position.copy(h.pinchPoint);
    const m = glow.material as { opacity: number };
    m.opacity = h.pinch.pinching ? 0.9 : 0.35;
  }

  private syncView(dt: number) {
    const c = this.controller;
    for (let k = 0; k < LEVERS; k++) {
      this.view.setLeverT(k, c.levers[k].t);
      const hov = isTarget(c.hover.left, k) || isTarget(c.hover.right, k);
      const held = isTarget(c.holding.left, k) || isTarget(c.holding.right, k);
      this.view.setLeverHighlight(k, held ? 2 : hov ? 1 : 0, this.model.latched[k]);
    }
    this.view.setShuttleT(c.shuttle.t);
    const sh = (t: unknown) => (t as { kind?: string } | null)?.kind === 'shuttle';
    this.view.setShuttleHighlight(
      sh(c.holding.left) || sh(c.holding.right) ? 2 : sh(c.hover.left) || sh(c.hover.right) ? 1 : 0,
    );
    this.view.update(dt);
    this.debug.shed = this.model.shed;
    this.debug.shuttleT = Math.round(c.shuttle.t * 1000) / 1000;
  }
}

const UPV = new Vector3(0, 1, 0);

function mkInput(): HandInput {
  return {
    tracked: false,
    pinching: false,
    edge: 'none',
    pinch: { x: 0, y: 0, z: 0 },
    index: { x: 0, y: 0, z: 0 },
    indexVel: { x: 0, y: 0, z: 0 },
  };
}

function copy(o: { x: number; y: number; z: number }, v: Vector3) {
  o.x = v.x;
  o.y = v.y;
  o.z = v.z;
}

/** Point-in-polygon on the plane's XZ, accepting points within `margin`. */
export function insidePolygon(
  poly: ReadonlyArray<{ x: number; z: number }> | undefined,
  x: number,
  z: number,
  margin: number,
): boolean {
  if (!poly || poly.length < 3) return false;
  let inside = false;
  let minD = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
    // distance to edge
    const ex = b.x - a.x;
    const ez = b.z - a.z;
    const l2 = ex * ex + ez * ez || 1e-9;
    const t = Math.max(0, Math.min(1, ((x - a.x) * ex + (z - a.z) * ez) / l2));
    minD = Math.min(minD, Math.hypot(x - (a.x + t * ex), z - (a.z + t * ez)));
  }
  return inside || minD <= margin;
}

function isTarget(t: unknown, k: number): boolean {
  const x = t as { kind?: string; k?: number } | null;
  return !!x && x.kind === 'lever' && x.k === k;
}
