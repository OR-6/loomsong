/**
 * Toy juice particles (loom-local, pooled, no per-frame allocation):
 * - puff(): little balls of yarn fluff that pop out and fade (a row is beaten in);
 * - confetti(): felt confetti (hearts, stars and buttons) that bursts up, flutters and falls;
 * - ring(): a soft ring of dust that spreads where something lands;
 * - note(): a musical note that floats up off the cloth as it plays.
 */
import {
  CanvasTexture,
  Color,
  DoubleSide,
  Euler,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  RingGeometry,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
} from '@iwsdk/core';

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
const RINGS = 6;
const NOTES = 16;

/** A felt heart about 1.2 cm across. */
function heartGeo(): ShapeGeometry {
  const s = new Shape();
  const k = 0.0062;
  s.moveTo(0, -k);
  s.bezierCurveTo(-k * 1.6, -k * 0.1, -k * 1.1, k * 1.25, 0, k * 0.55);
  s.bezierCurveTo(k * 1.1, k * 1.25, k * 1.6, -k * 0.1, 0, -k);
  return new ShapeGeometry(s, 6);
}

/** A five-point felt star. */
function starGeo(): ShapeGeometry {
  const s = new Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? 0.0072 : 0.0031;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  return new ShapeGeometry(s);
}

/** A round felt button with two holes. */
function buttonGeo(): ShapeGeometry {
  const s = new Shape();
  s.absarc(0, 0, 0.0052, 0, Math.PI * 2, false);
  for (const x of [-0.0016, 0.0016]) {
    const h = new Shape();
    h.absarc(x, 0, 0.0008, 0, Math.PI * 2, true);
    s.holes.push(h);
  }
  return new ShapeGeometry(s, 12);
}

/** A white ♪ (tinted per note by the material colour). */
function noteTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.strokeStyle = 'rgba(60,40,20,0.55)';
  g.lineWidth = 3;
  g.font = '52px serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.strokeText('♪', 32, 34);
  g.fillText('♪', 32, 34);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

export class Fx {
  readonly root = new Group();
  private puffs: InstancedMesh;
  /** Felt confetti: three shapes, a third of the pool each (bit i lives in shape i % 3, slot i / 3). */
  private bitMeshes: InstancedMesh[] = [];
  private rings: Mesh[] = [];
  private ringT = new Float32Array(RINGS);
  private nextRing = 0;
  private notes: Mesh[] = [];
  private noteT = new Float32Array(NOTES);
  private noteX = new Float32Array(NOTES);
  private nextNote = 0;
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
    const felt = new MeshStandardMaterial({ side: DoubleSide, roughness: 0.95 });
    for (const geo of [heartGeo(), starGeo(), buttonGeo()]) this.bitMeshes.push(new InstancedMesh(geo, felt, Math.ceil(BITS / 3)));
    for (const m of [this.puffs, ...this.bitMeshes]) {
      m.frustumCulled = false;
      this.root.add(m);
    }
    for (let i = 0; i < PUFFS; i++) this.hide(this.puffs, i);
    for (let i = 0; i < BITS; i++) this.hide(this.bitMeshes[i % 3], Math.floor(i / 3));
    const ringGeo = new RingGeometry(0.8, 1, 32);
    ringGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < RINGS; i++) {
      const r = new Mesh(ringGeo, new MeshBasicMaterial({ color: 0xfff1d6, transparent: true, opacity: 0, depthWrite: false }));
      r.visible = false;
      r.renderOrder = 2;
      this.root.add(r);
      this.rings.push(r);
    }
    const noteGeo = new PlaneGeometry(0.024, 0.024);
    const noteTex = noteTexture();
    for (let i = 0; i < NOTES; i++) {
      const n = new Mesh(noteGeo, new MeshBasicMaterial({ map: noteTex, transparent: true, opacity: 0, depthWrite: false }));
      n.visible = false;
      n.renderOrder = 6;
      this.root.add(n);
      this.notes.push(n);
    }
  }

  /** A soft ring of dust spreading where something lands (a plush on the desk or the shelf). */
  ring(x: number, y: number, z: number, color = 0xfff1d6, size = 0.05): void {
    const i = this.nextRing;
    this.nextRing = (i + 1) % RINGS;
    const r = this.rings[i];
    r.position.set(x, y + 0.001, z);
    (r.material as MeshBasicMaterial).color.setHex(color);
    r.userData.size = size;
    r.visible = true;
    this.ringT[i] = 0.55;
    this.live = true;
  }

  /** A musical note floating up off the cloth (the cloth sings its rows). */
  note(x: number, y: number, z: number, color: number): void {
    const i = this.nextNote;
    this.nextNote = (i + 1) % NOTES;
    const n = this.notes[i];
    n.position.set(x, y, z);
    this.noteX[i] = x;
    (n.material as MeshBasicMaterial).color.setHex(color).offsetHSL(0, 0, 0.08);
    n.visible = true;
    this.noteT[i] = 1.4;
    this.live = true;
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
      this.bitMeshes[i % 3].setColorAt(Math.floor(i / 3), _c.setHex(gold ? GOLD[j % GOLD.length] : CONFETTI[(i * 7) % CONFETTI.length]));
    }
    for (const m of this.bitMeshes) if (m.instanceColor) m.instanceColor.needsUpdate = true;
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
      this.bitMeshes[i % 3].setMatrixAt(Math.floor(i / 3), _m);
    }
    for (let i = 0; i < RINGS; i++) {
      if (this.ringT[i] <= 0) continue;
      any = true;
      this.ringT[i] -= dt;
      const r = this.rings[i];
      const k = 1 - Math.max(0, this.ringT[i]) / 0.55; // 0 → 1
      const e = 1 - Math.pow(1 - k, 3);
      r.scale.setScalar(Math.max(0.001, (0.25 + 0.75 * e) * (r.userData.size as number)));
      (r.material as MeshBasicMaterial).opacity = 0.55 * (1 - k);
      if (this.ringT[i] <= 0) r.visible = false;
    }
    for (let i = 0; i < NOTES; i++) {
      if (this.noteT[i] <= 0) continue;
      any = true;
      this.noteT[i] -= dt;
      const n = this.notes[i];
      const k = 1 - Math.max(0, this.noteT[i]) / 1.4;
      n.position.y += 0.045 * dt;
      n.position.x = this.noteX[i] + Math.sin(k * 7 + i) * 0.006;
      n.rotation.z = Math.sin(k * 5 + i) * 0.25;
      n.scale.setScalar(k < 0.15 ? k / 0.15 : 1);
      (n.material as MeshBasicMaterial).opacity = k < 0.15 ? k / 0.15 : Math.max(0, 1 - (k - 0.5) / 0.5);
      if (this.noteT[i] <= 0) n.visible = false;
    }
    this.puffs.instanceMatrix.needsUpdate = true;
    for (const m of this.bitMeshes) m.instanceMatrix.needsUpdate = true;
    this.live = any;
  }
}
