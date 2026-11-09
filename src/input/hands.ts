/**
 * HandTrackerSystem: reads raw WebXR hand joints every frame (see
 * docs/IWSDK-NOTES.md §a) and publishes filtered, allocation-free per-hand
 * state for the game systems. Runs before every gameplay system.
 *
 * `?noise=1` injects σ≈3 mm jitter and 2% dropouts ≥150 ms (spec §6).
 */
import { createSystem, Quaternion, Vector3 } from '@iwsdk/core';
import { PINCH } from '../config.js';
import { OneEuro3 } from './one-euro.js';
import { PinchDetector, type PinchEdge } from './pinch.js';

export type Side = 'left' | 'right';

export class HandState {
  tracked = false;
  /** Thumb–index distance (m), or null when untracked. */
  pinchDist: number | null = null;
  readonly pinch = new PinchDetector(PINCH);
  edge: PinchEdge = 'none';
  /** Filtered pinch point (thumb/index midpoint), world space. */
  readonly pinchPoint = new Vector3();
  /** Unfiltered thumb/index midpoint, world space. */
  readonly rawPinch = new Vector3();
  readonly indexTip = new Vector3();
  readonly indexVel = new Vector3();
  readonly palm = new Vector3();
  palmRadius = 0.02;
  /** wrist +Y · world up. */
  upDot = 0;
  readonly filter = new OneEuro3(PINCH.oneEuro);
  /** Seconds this hand has been tracked continuously. */
  trackedFor = 0;
}

export const hands: Record<Side, HandState> = {
  left: new HandState(),
  right: new HandState(),
};

/** Calibration multiplier (1.0–1.8); scales pinch thresholds and radii. */
export const calibration = { scale: 1, radiusMul: 1 };

const NOISE = new URLSearchParams(location.search).get('noise') === '1';

function gauss(): number {
  // Box–Muller
  const u = 1 - Math.random();
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export class HandTrackerSystem extends createSystem({}) {
  private tmpThumb = new Vector3();
  private tmpIndex = new Vector3();
  private prevIndex = new Vector3();
  private q = new Quaternion();
  private up = new Vector3();
  private seen: Record<Side, boolean> = { left: false, right: false };
  private dropout: Record<Side, number> = { left: 0, right: 0 };

  update(delta: number) {
    const frame = this.xrFrame;
    const session = frame?.session;
    const ref = this.renderer.xr.getReferenceSpace();
    this.seen.left = this.seen.right = false;

    if (frame && session && ref && frame.getJointPose) {
      for (const src of session.inputSources) {
        if (!src.hand || (src.handedness !== 'left' && src.handedness !== 'right')) {
          continue;
        }
        const side = src.handedness;
        if (NOISE) {
          if (this.dropout[side] > 0) {
            this.dropout[side] -= delta;
            continue;
          }
          if (Math.random() < 0.02 * delta * 72) {
            this.dropout[side] = 0.15 + Math.random() * 0.1;
            continue;
          }
        }
        const thumb = src.hand.get('thumb-tip');
        const index = src.hand.get('index-finger-tip');
        const wrist = src.hand.get('wrist');
        const meta = src.hand.get('middle-finger-metacarpal');
        const tp = thumb && frame.getJointPose(thumb, ref);
        const ip = index && frame.getJointPose(index, ref);
        const wp = wrist && frame.getJointPose(wrist, ref);
        const mp = meta && frame.getJointPose(meta, ref);
        if (!tp || !ip || !wp || !mp) continue;
        this.seen[side] = true;
        const h = hands[side];
        this.tmpThumb.set(
          tp.transform.position.x,
          tp.transform.position.y,
          tp.transform.position.z,
        );
        this.tmpIndex.set(
          ip.transform.position.x,
          ip.transform.position.y,
          ip.transform.position.z,
        );
        if (NOISE) {
          const s = 0.003;
          this.tmpThumb.x += gauss() * s;
          this.tmpThumb.y += gauss() * s;
          this.tmpThumb.z += gauss() * s;
          this.tmpIndex.x += gauss() * s;
          this.tmpIndex.y += gauss() * s;
          this.tmpIndex.z += gauss() * s;
        }
        h.pinchDist = this.tmpThumb.distanceTo(this.tmpIndex);
        h.rawPinch.set(
          (this.tmpThumb.x + this.tmpIndex.x) / 2,
          (this.tmpThumb.y + this.tmpIndex.y) / 2,
          (this.tmpThumb.z + this.tmpIndex.z) / 2,
        );
        this.prevIndex.copy(h.indexTip);
        h.indexTip.copy(this.tmpIndex);
        if (h.tracked && delta > 0) {
          h.indexVel.subVectors(h.indexTip, this.prevIndex).divideScalar(delta);
        } else {
          h.indexVel.set(0, 0, 0);
        }
        h.palm.set(
          mp.transform.position.x,
          mp.transform.position.y,
          mp.transform.position.z,
        );
        h.palmRadius = mp.radius ?? 0.02;
        const o = wp.transform.orientation;
        this.q.set(o.x, o.y, o.z, o.w);
        this.up.set(0, 1, 0).applyQuaternion(this.q);
        h.upDot = this.up.y;
      }
    }

    for (const side of ['left', 'right'] as const) {
      const h = hands[side];
      h.pinch.scale = calibration.scale;
      if (this.seen[side]) {
        const wasTracked = h.tracked;
        h.trackedFor = h.tracked ? h.trackedFor + delta : 0;
        h.tracked = true;
        h.edge = h.pinch.update(h.pinchDist, delta);
        // On pinch start (or re-acquire) snap the filter to the raw point so
        // grab hit-testing never uses a lagged open-hand position.
        if (h.edge === 'start' || !wasTracked) h.filter.reset();
        const f = h.filter.filter(h.rawPinch.x, h.rawPinch.y, h.rawPinch.z, Math.max(delta, 1e-4));
        h.pinchPoint.set(f[0], f[1], f[2]);
      } else {
        h.tracked = false;
        h.trackedFor = 0;
        h.pinchDist = null;
        h.indexVel.set(0, 0, 0);
        h.edge = h.pinch.update(null, delta);
      }
    }
  }
}
