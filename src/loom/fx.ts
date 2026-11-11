/**
 * Toy juice particles (loom-local, pooled, no per-frame allocation):
 * - puff(): little balls of yarn fluff that pop out and fade (a row is beaten in);
 * - confetti(): paper confetti that bursts up, flutters and falls (a picture is done).
 */
import { Color, DoubleSide, Euler, Group, InstancedMesh, Matrix4, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, Quaternion, SphereGeometry, Vector3 } from '@iwsdk/core';

const PUFFS = 48;
const BITS = 170;
const _m = new Matrix4();
const _q = new Quaternion();
const _p = new Vector3();
const _s = new Vector3();
const _eu = new Euler();
const _c = new Color();
const CONFETTI = [0xe8553e, 0xf7be3b, 0x1fb3a0, 0x7b5bb8, 0xe8679e, 0xfff2dc];
const GOLD = [0xf7c948, 0xffe08a, 0xfff6d8];

export class Fx {
  readonly root = new Group();
  private puffs: InstancedMesh;
  private bits: InstancedMesh;
  private pp = new Float32Array(PUFFS * 3);
  private pv = new Float32Array(PUFFS * 3);
  private pt = new Float32Array(PUFFS); // remaining life (s)
  private bp = new Float32Array(BITS * 3);
  private bv = new Float32Array(BITS * 3);
  private br = new Float32Array(BITS * 3); // rotation (euler) and spin below
  private bs = new Float32Array(BITS * 3);
  private bt = new Float32Array(BITS);
  private nextPuff = 0;
  private nextBit = 0;
  private live = false;

  constructor() {
    this.root.name = 'Fx';
    this.puffs = new InstancedMesh(new SphereGeometry(1, 10, 8), new MeshBasicMaterial({ transparent: true, opacity: 0.9, depthWrite: false }), PUFFS);
    this.bits = new InstancedMesh(new PlaneGeometry(0.009, 0.014), new MeshStandardMaterial({ side: DoubleSide, roughness: 0.6 }), BITS);
    for (const m of [this.puffs, this.bits]) {
      m.frustumCulled = false;
      m.count = 0;
      this.root.add(m);
    }
    this.puffs.count = PUFFS;
    this.bits.count = BITS;
    for (let i = 0; i < PUFFS; i++) this.hide(this.puffs, i);
    for (let i = 0; i < BITS; i++) this.hide(this.bits, i);
  }

  private hide(m: InstancedMesh, i: number): void {
    _m.makeScale(0, 0, 0);
    m.setMatrixAt(i, _m);
    m.instanceMatrix.needsUpdate = true;
  }

  /** A little burst of fluff at a point, in a colour. */
  puff(x: number, y: number, z: number, color: number, n = 3): void {
    for (let j = 0; j < n; j++) {
      const i = this.nextPuff;
      this.nextPuff = (i + 1) % PUFFS;
      const o = i * 3;
      this.pp[o] = x + (Math.random() - 0.5) * 0.008;
      this.pp[o + 1] = y;
      this.pp[o + 2] = z + (Math.random() - 0.5) * 0.006;
      this.pv[o] = (Math.random() - 0.5) * 0.12;
      this.pv[o + 1] = 0.08 + Math.random() * 0.1;
      this.pv[o + 2] = (Math.random() - 0.5) * 0.08;
      this.pt[i] = 0.45 + Math.random() * 0.2;
      this.puffs.setColorAt(i, _c.setHex(color).offsetHSL(0, -0.1, 0.12));
    }
    if (this.puffs.instanceColor) this.puffs.instanceColor.needsUpdate = true;
    this.live = true;
  }

  /** Confetti burst rising from a point. `gold`: a small golden sparkle (an on-beat row). */
  confetti(x: number, y: number, z: number, count = BITS, power = 1, gold = false): void {
    for (let j = 0; j < count; j++) {
      const i = this.nextBit;
      this.nextBit = (i + 1) % BITS;
      const a = Math.random() * Math.PI * 2;
      const sp = (0.12 + Math.random() * 0.22) * power;
      const o = i * 3;
      this.bp[o] = x + (Math.random() - 0.5) * 0.06 * power;
      this.bp[o + 1] = y;
      this.bp[o + 2] = z + (Math.random() - 0.5) * 0.05 * power;
      this.bv[o] = Math.cos(a) * sp * 0.6;
      this.bv[o + 1] = (0.45 + Math.random() * 0.35) * power;
      this.bv[o + 2] = Math.sin(a) * sp * 0.6;
      for (let k = 0; k < 3; k++) {
        this.br[o + k] = Math.random() * 6;
        this.bs[o + k] = (Math.random() - 0.5) * 18;
      }
      this.bt[i] = (1.6 + Math.random() * 0.8) * (gold ? 0.55 : 1);
      this.bits.setColorAt(i, _c.setHex(gold ? GOLD[j % GOLD.length] : CONFETTI[i % CONFETTI.length]));
    }
    if (this.bits.instanceColor) this.bits.instanceColor.needsUpdate = true;
    this.live = true;
  }

  update(dt: number): void {
    if (!this.live) return;
    let any = false;
    for (let i = 0; i < PUFFS; i++) {
      if (this.pt[i] <= 0) continue;
      any = true;
      this.pt[i] -= dt;
      const o = i * 3;
      this.pv[o + 1] -= 0.25 * dt; // light: floats, then sinks a little
      for (let a = 0; a < 3; a++) {
        this.pv[o + a] *= 1 - 3 * dt;
        this.pp[o + a] += this.pv[o + a] * dt;
      }
      const life = Math.max(0, this.pt[i]);
      const r = life > 0 ? 0.0032 * Math.min(1, life * 4) * (1.4 - life) : 0;
      _p.fromArray(this.pp, o);
      _m.compose(_p, _q.identity(), _s.setScalar(r));
      this.puffs.setMatrixAt(i, _m);
    }
    for (let i = 0; i < BITS; i++) {
      if (this.bt[i] <= 0) continue;
      any = true;
      this.bt[i] -= dt;
      const o = i * 3;
      // gravity, with flutter drag that keeps paper floating
      this.bv[o + 1] -= 0.9 * dt;
      for (let a = 0; a < 3; a++) {
        this.bv[o + a] *= 1 - (a === 1 && this.bv[o + 1] < 0 ? 2.6 : 1.2) * dt;
        this.bp[o + a] += this.bv[o + a] * dt;
        this.br[o + a] += this.bs[o + a] * dt;
      }
      if (this.bp[o + 1] < 0.002) {
        this.bp[o + 1] = 0.002; // settle on the desk
        this.bv[o] = this.bv[o + 1] = this.bv[o + 2] = 0;
        this.bs[o] = this.bs[o + 2] = 0;
      }
      const sc = this.bt[i] > 0 ? Math.min(1, this.bt[i] * 2) : 0;
      _p.fromArray(this.bp, o);
      _eu.set(this.br[o], this.br[o + 1], this.br[o + 2]);
      _q.setFromEuler(_eu);
      _m.compose(_p, _q, _s.setScalar(sc));
      this.bits.setMatrixAt(i, _m);
    }
    this.puffs.instanceMatrix.needsUpdate = true;
    this.bits.instanceMatrix.needsUpdate = true;
    this.live = any;
  }
}
