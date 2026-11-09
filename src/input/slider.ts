/**
 * 1-D constraint slider driven by a pinch point. Position is expressed as a
 * normalised parameter t ∈ [0, 1] along a line segment in loom-local space.
 * The caller projects the pinch point to the line's coordinate (metres along
 * the axis) — this module only handles grab/hold/release semantics.
 */
export type ReleaseRule =
  | { kind: 'detents'; magnet: number } // lever: snap to 0 or 1
  | { kind: 'throw'; completeAt: number }; // shuttle: complete or return

export interface SliderSpec {
  /** Axis coordinate (metres) at t = 0 and t = 1. */
  a0: number;
  a1: number;
  release: ReleaseRule;
}

export type SliderEvent =
  | { type: 'grab' }
  | { type: 'release'; target: 0 | 1 }
  | { type: 'none' };

export class Slider {
  t = 0;
  held = false;
  /** Where the slider will settle after release. */
  target: 0 | 1 = 0;
  /** t at grab time (for throw rules). */
  startT = 0;
  private grabOffset = 0;

  constructor(public spec: SliderSpec) {}

  /** Axis coordinate → t (unclamped). */
  toT(a: number): number {
    const { a0, a1 } = this.spec;
    return (a - a0) / (a1 - a0);
  }

  axisAt(t: number): number {
    const { a0, a1 } = this.spec;
    return a0 + (a1 - a0) * t;
  }

  grab(axisCoord: number): SliderEvent {
    this.held = true;
    this.startT = this.t;
    this.grabOffset = this.t - this.toT(axisCoord);
    return { type: 'grab' };
  }

  /** While held: follow the projected pinch point, clamped to [0, 1]. */
  drag(axisCoord: number): void {
    if (!this.held) return;
    let t = this.toT(axisCoord) + this.grabOffset;
    t = Math.min(1, Math.max(0, t));
    const r = this.spec.release;
    if (r.kind === 'detents' && r.magnet > 0) {
      // Magnetic zone: within the last `magnet` fraction, ease toward the end.
      if (t > 1 - r.magnet) t = t + (1 - t) * 0.5;
      else if (t < r.magnet) t = t * 0.5;
    }
    this.t = t;
  }

  release(): SliderEvent {
    if (!this.held) return { type: 'none' };
    this.held = false;
    const r = this.spec.release;
    if (r.kind === 'detents') {
      this.target = this.t >= 0.5 ? 1 : 0;
    } else {
      // Throw: measured as progress away from where the pass started.
      const from: 0 | 1 = this.startT < 0.5 ? 0 : 1;
      const progress = from === 0 ? this.t : 1 - this.t;
      this.target = progress >= r.completeAt ? (from === 0 ? 1 : 0) : from;
    }
    return { type: 'release', target: this.target };
  }

  /** Animate toward target when not held. Returns true on arrival this step. */
  settle(dt: number, speedPerS: number): boolean {
    if (this.held || this.t === this.target) return false;
    const step = speedPerS * dt;
    const d = this.target - this.t;
    if (Math.abs(d) <= step) {
      this.t = this.target;
      return true;
    }
    this.t += Math.sign(d) * step;
    return false;
  }

  setImmediate(t: 0 | 1): void {
    this.t = t;
    this.target = t;
    this.held = false;
  }
}
