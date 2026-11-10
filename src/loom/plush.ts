/**
 * "It comes alive": a finished picture becomes a little quilted felt plush.
 * Each lifted pixel is a puffy pillow (one instanced mesh per plush), with two
 * button eyes. On a win the plush pops out of the cloth, hops onto the mat,
 * bounces to its song, then hops up onto its slot on the chapter shelf.
 * Everything here is loom-local (children of the loom root).
 */
import {
  BoxGeometry,
  BufferGeometry,
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  CylinderGeometry,
  TubeGeometry,
  CatmullRomCurve3,
  PlaneGeometry,
} from '@iwsdk/core';
import { Label } from '../ui/label.js';
import { LOOM, WARPS } from '../config.js';
import { isLifted, type Mask8 } from '../puzzle/tieup.js';
import { weaveTexture } from './textures.js';
import { cloneModel, loomModels } from './models.js';

/** A soft felt pennant: a subdivided triangle, top edge at y = 0, gently cupped. */
function pennantGeometry(): BufferGeometry {
  const W = 0.032;
  const H = 0.034;
  const g = new PlaneGeometry(W, H, 6, 8);
  g.translate(0, -H / 2, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = -p.getY(i) / H; // 0 top → 1 tip
    const x = p.getX(i) * (1 - t * 0.98);
    const half = (W / 2) * (1 - t * 0.98) + 1e-6;
    const cup = 0.0026 * (1 - (x / half) ** 2) * (0.3 + t * 0.7);
    // a soft forward billow lower down, like cloth with a little weight
    p.setXYZ(i, x, p.getY(i), cup + 0.0015 * Math.sin(t * Math.PI));
  }
  g.computeVertexNormals();
  return g;
}

/** Shelf bunting: posts at the shelf ends, a sagging string, pennants per slot. */
const BUNT = { halfW: 0.112, postH: 0.122, sag: 0.014 } as const;

export const PLUSH = {
  cell: 0.014,
  /** Depth of the plush, in cells. */
  depth: 1.6,
  shelfScale: 0.41,
  slots: 5,
  slotGap: 0.047,
  /** Plush base height on the shelf: the bench top (36 mm). */
  shelfTopY: 0.036,
  /** Shelf centre, on the side away from the lever bank (x is multiplied by -side). */
  shelfX: 0.275,
  shelfZ: -0.02,
  /** Where the plush dances: on the mat in front of the shelf. */
  stageX: 0.225,
  stageZ: 0.075,
} as const;

let puff: BufferGeometry | null = null;
/** A unit cube pulled toward a sphere: a soft quilted pillow. */
export function puffGeometry(): BufferGeometry {
  if (puff) return puff;
  const g = new BoxGeometry(1, 1, 1, 4, 4, 4);
  const p = g.attributes.position;
  const v = new Vector3();
  const s = new Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    s.copy(v).normalize().multiplyScalar(0.62);
    v.multiplyScalar(0.45).addScaledVector(s, 0.55);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  g.userData.sharedGeometry = true;
  puff = g;
  return g;
}

let eyeGeo: SphereGeometry | null = null;
let eyeMat: MeshStandardMaterial | null = null;
let shineMat: MeshStandardMaterial | null = null;

const _m = new Matrix4();
const _q = new Quaternion();
const _p = new Vector3();
const _s = new Vector3();

/** Build a plush from picture rows (row 0 = bottom) in `color`. Origin: bottom centre. */
export function buildPlush(rows: readonly Mask8[], color: number): Group {
  const cell = PLUSH.cell;
  const g = new Group();
  g.name = 'Plush';
  let n = 0;
  for (const r of rows) for (let i = 0; i < WARPS; i++) if (isLifted(r, i)) n++;
  const mat = new MeshPhysicalMaterial({
    color: new Color(color),
    roughness: 0.88,
    sheen: 1,
    sheenRoughness: 0.55,
    sheenColor: new Color(0xffffff),
    map: weaveTexture(),
  });
  const body = new InstancedMesh(puffGeometry(), mat, Math.max(1, n));
  body.name = 'PlushBody';
  body.frustumCulled = false;
  body.castShadow = true;
  let k = 0;
  for (let r = 0; r < rows.length; r++) {
    for (let i = 0; i < WARPS; i++) {
      if (!isLifted(rows[r], i)) continue;
      _p.set((i - (WARPS - 1) / 2) * cell, LIFT + cell / 2 + r * cell, 0);
      _m.compose(_p, _q.identity(), _s.set(cell * 1.16, cell * 1.14, cell * PLUSH.depth));
      body.setMatrixAt(k++, _m);
    }
  }
  body.count = k;
  g.add(body);
  addFace(g, rows, color);
  addFeetAndTag(g, rows, color);
  g.userData.height = rows.length * cell;
  return g;
}

/** Feet lift the body a little off the ground. */
const LIFT = 0.003;
let blushMat: MeshStandardMaterial | null = null;
let smileGeo: TorusGeometry | null = null;
let tagMat: MeshStandardMaterial | null = null;
let tagStripeMat: MeshStandardMaterial | null = null;
let tagGeo: BoxGeometry | null = null;

/** Stubby felt feet under the bottom row, and a little sewn-in toy tag on one side. */
function addFeetAndTag(g: Group, rows: readonly Mask8[], color: number): void {
  const cell = PLUSH.cell;
  const r0 = rows[0] ?? 0;
  let a = -1;
  let b = -1;
  for (let i = 0; i < WARPS; i++) if (isLifted(r0, i)) (a < 0 && (a = i), (b = i));
  if (a < 0) return;
  const xa = (a - (WARPS - 1) / 2) * cell;
  const xb = (b - (WARPS - 1) / 2) * cell;
  const feet = a === b ? [xa - cell * 0.28, xa + cell * 0.28] : [xa, xb];
  eyeGeo ??= new SphereGeometry(1, 14, 10);
  const footMat = new MeshStandardMaterial({ color: new Color(color).multiplyScalar(0.72), roughness: 0.9 });
  footMat.userData.own = true;
  for (const x of feet) {
    const f = new Mesh(eyeGeo, footMat);
    f.scale.set(cell * 0.32, cell * 0.24, cell * 0.42);
    f.position.set(x, cell * 0.2, cell * 0.25);
    f.castShadow = true;
    g.add(f);
  }
  tagGeo ??= new BoxGeometry(1, 1, 1);
  tagGeo.userData.sharedGeometry = true;
  tagMat ??= new MeshStandardMaterial({ color: 0xfff3e0, roughness: 0.9 });
  tagStripeMat ??= new MeshStandardMaterial({ color: 0xe2563b, roughness: 0.8 });
  const tag = new Mesh(tagGeo, tagMat);
  tag.scale.set(0.0008, cell * 0.85, cell * 0.6);
  tag.position.set(xb + cell * 0.6, LIFT + cell * 0.55, cell * 0.2);
  tag.rotation.z = -0.12;
  const stripe = new Mesh(tagGeo, tagStripeMat);
  stripe.scale.set(1.3, 0.18, 1.02);
  stripe.position.y = 0.25;
  tag.add(stripe);
  g.add(tag);
}

/** Button eyes on the widest upper row, blush cheeks and a stitched smile. */
function addFace(g: Group, rows: readonly Mask8[], color: number): void {
  void color;
  if (!rows.length) return;
  const cell = PLUSH.cell;
  const want = Math.floor(rows.length * 0.66);
  let best = -1;
  let bestScore = -Infinity;
  for (let r = 0; r < rows.length; r++) {
    let a = -1;
    let b = -1;
    for (let i = 0; i < WARPS; i++) if (isLifted(rows[r], i)) (a < 0 && (a = i), (b = i));
    if (a < 0 || b - a < 2) continue;
    const score = -Math.abs(r - want) * 2 + (b - a);
    if (score > bestScore) {
      bestScore = score;
      best = r;
    }
  }
  if (best < 0) best = rows.length - 1;
  let a = 0;
  let b = WARPS - 1;
  for (let i = 0; i < WARPS; i++) if (isLifted(rows[best], i)) { a = i; break; }
  for (let i = WARPS - 1; i >= 0; i--) if (isLifted(rows[best], i)) { b = i; break; }
  eyeGeo ??= new SphereGeometry(1, 14, 10);
  eyeGeo.userData.sharedGeometry = true;
  eyeMat ??= new MeshStandardMaterial({ color: 0x1a1412, roughness: 0.15 });
  shineMat ??= new MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, emissive: 0x666666 });
  const span = b - a;
  const y = LIFT + cell / 2 + best * cell + cell * 0.2;
  const z = (cell * PLUSH.depth) / 2 + 0.0006;
  const xs: number[] = [];
  for (const f of span >= 3 ? [0.3, 0.7] : [0, 1]) {
    const x = (a + span * f - (WARPS - 1) / 2) * cell;
    xs.push(x);
    const eye = new Mesh(eyeGeo, eyeMat);
    eye.scale.set(0.0028, 0.0034, 0.0016);
    eye.position.set(x, y, z);
    const shine = new Mesh(eyeGeo, shineMat);
    shine.scale.set(0.3, 0.3, 0.3);
    shine.position.set(0.35, 0.4, 0.8);
    eye.add(shine);
    g.add(eye);
  }
  // blush under and outside each eye
  blushMat ??= new MeshStandardMaterial({ color: 0xff8f87, roughness: 0.9, transparent: true, opacity: 0.85 });
  const gap = Math.abs(xs[1] - xs[0]);
  for (let i = 0; i < 2; i++) {
    const c = new Mesh(eyeGeo, blushMat);
    c.scale.set(0.0026, 0.0016, 0.0008);
    c.position.set(xs[i] + (i === 0 ? -1 : 1) * Math.min(cell * 0.35, gap * 0.25), y - cell * 0.62, z - 0.0002);
    g.add(c);
  }
  // a little stitched smile between the eyes
  smileGeo ??= new TorusGeometry(Math.max(0.0022, gap * 0.16), 0.00055, 5, 14, Math.PI);
  smileGeo.userData.sharedGeometry = true;
  const smile = new Mesh(smileGeo, eyeMat);
  smile.rotation.z = Math.PI;
  smile.position.set((xs[0] + xs[1]) / 2, y - cell * 0.45, z);
  g.add(smile);
}

/** Dispose a plush's per-instance resources (shared geometry is kept). */
export function disposePlush(g: Object3D): void {
  g.traverse((o) => {
    const m = o as InstancedMesh;
    if (m.isInstancedMesh) {
      (m.material as MeshPhysicalMaterial).dispose();
      m.dispose();
    } else if ((m as unknown as Mesh).isMesh && (m.material as MeshStandardMaterial).userData?.own) {
      (m.material as MeshStandardMaterial).dispose();
    }
  });
  g.removeFromParent();
}

export interface ShelfItem {
  id: string;
  rows: readonly Mask8[];
  color: number;
  done: boolean;
}

type ShowPhase = 'none' | 'pop' | 'hopOut' | 'dance' | 'hopShelf' | 'fade';

const ease = (t: number) => 1 - Math.pow(1 - t, 3);
const back = (t: number) => {
  const b = t - 1;
  return 1 + 2.4 * b * b * b + 1.4 * b * b;
};

/** The chapter shelf and the win-time plush show. */
export class Plushes {
  readonly root = new Group();
  private shelf: Object3D;
  private slotItems: (Group | null)[] = new Array(PLUSH.slots).fill(null);
  private slotIds: (string | null)[] = new Array(PLUSH.slots).fill(null);
  private side: 1 | -1 = 1;
  private hero: Group | null = null;
  private heroSlot = -1;
  private heroId = '';
  private heroColor = 0;
  private phase: ShowPhase = 'none';
  private t = 0;
  private from = new Vector3();
  private to = new Vector3();
  private bounce = 1;
  private tilt = 1;
  /** Called when the plush lands on the shelf (sound). */
  onLand: (() => void) | null = null;
  onHop: (() => void) | null = null;

  constructor() {
    this.root.name = 'Plushes';
    const m = loomModels();
    if (m?.shelf) this.shelf = cloneModel(m.shelf);
    else {
      const top = new Mesh(new BoxGeometry(0.245, 0.012, 0.05), new MeshStandardMaterial({ color: 0xd9b58a, roughness: 0.6 }));
      top.position.y = 0.03;
      this.shelf = new Group();
      this.shelf.add(top);
    }
    this.shelf.traverse((o) => {
      if ((o as Mesh).isMesh) o.castShadow = o.receiveShadow = true;
    });
    this.root.add(this.shelf);
    // A felt cushion per slot, and a paper tag naming the chapter.
    const cushionMat = new MeshPhysicalMaterial({ color: 0xf3e6cf, roughness: 0.95, sheen: 1, sheenRoughness: 0.6, sheenColor: new Color(0xffffff), map: weaveTexture() });
    eyeGeo ??= new SphereGeometry(1, 14, 10);
    for (let i = 0; i < PLUSH.slots; i++) {
      const c = new Mesh(eyeGeo, cushionMat);
      c.name = `Cushion${i}`;
      c.scale.set(0.02, 0.0048, 0.019);
      c.receiveShadow = true;
      this.cushions.push(c);
      this.root.add(c);
    }
    this.tag.mesh.name = 'ChapterTag';
    this.root.add(this.tag.mesh);
    // (bunting removed in the polish pass: the shelf tag shows progress)
    this.setSide(1);
  }

  /**
   * Bunting over the shelf: a pennant per picture on a yarn string between two
   * dowel posts. A pennant takes the picture's colour once it's been woven.
   */
  private buildBunting(): void {
    const g = this.bunting;
    g.name = 'Bunting';
    const wood = new MeshStandardMaterial({ color: 0xe8c79a, roughness: 0.6 });
    const post = new CylinderGeometry(0.0028, 0.0032, BUNT.postH, 10);
    const knob = new SphereGeometry(0.0055, 12, 8);
    const knobMat = new MeshStandardMaterial({ color: 0xe2563b, roughness: 0.4 });
    for (const sx of [-1, 1]) {
      const p = new Mesh(post, wood);
      p.position.set(sx * BUNT.halfW, PLUSH.shelfTopY - 0.004 + BUNT.postH / 2, -0.018);
      const k = new Mesh(knob, knobMat);
      k.position.set(sx * BUNT.halfW, PLUSH.shelfTopY - 0.004 + BUNT.postH + 0.003, -0.018);
      p.castShadow = k.castShadow = true;
      g.add(p, k);
    }
    // the string: a gentle catenary between the post tops
    const top = PLUSH.shelfTopY - 0.004 + BUNT.postH - 0.004;
    const pts: Vector3[] = [];
    for (let i = 0; i <= 16; i++) {
      const u = i / 16;
      const x = -BUNT.halfW + 2 * BUNT.halfW * u;
      pts.push(new Vector3(x, top - BUNT.sag * 4 * u * (1 - u), -0.018));
    }
    const str = new Mesh(new TubeGeometry(new CatmullRomCurve3(pts), 32, 0.0007, 4), new MeshStandardMaterial({ color: 0xf3e6cf, roughness: 0.9 }));
    g.add(str);
    // Pennants: soft felt triangles folded over the string, cupped a little,
    // each hanging along the string's slope.
    const pg = pennantGeometry();
    const hem = new CylinderGeometry(0.0013, 0.0013, 0.0325, 8);
    hem.rotateZ(Math.PI / 2);
    for (let i = 0; i < PLUSH.slots; i++) {
      const x = (i - (PLUSH.slots - 1) / 2) * PLUSH.slotGap;
      const u = (x + BUNT.halfW) / (2 * BUNT.halfW);
      const slope = (-BUNT.sag * 4 * (1 - 2 * u)) / (2 * BUNT.halfW);
      const mat = new MeshStandardMaterial({ color: 0xf3e6cf, roughness: 0.95, side: 2, map: weaveTexture() });
      const pivot = new Group();
      pivot.position.set(x, top - BUNT.sag * 4 * u * (1 - u), -0.018);
      pivot.rotation.z = Math.atan(slope);
      const pen = new Mesh(pg, mat);
      pen.castShadow = true;
      const fold = new Mesh(hem, mat);
      pen.add(fold);
      pivot.add(pen);
      this.pennants.push(pen);
      g.add(pivot);
    }
    this.root.add(g);
  }

  private bunting = new Group();
  private pennants: Mesh[] = [];
  private sway = 0;

  private cushions: Mesh[] = [];
  /** Grey silhouettes of the chapter's pictures not woven yet. */
  private ghosts: (Group | null)[] = new Array(PLUSH.slots).fill(null);
  private ghostIds: (string | null)[] = new Array(PLUSH.slots).fill(null);
  private tag = new Label(0.2, 0.036);

  setSide(side: 1 | -1): void {
    this.side = side;
    this.shelf.position.set(-side * PLUSH.shelfX, 0, PLUSH.shelfZ);
    this.bunting.position.set(-side * PLUSH.shelfX, 0, PLUSH.shelfZ);
    for (let i = 0; i < this.cushions.length; i++) {
      this.slotPos(i, this.cushions[i].position);
      this.cushions[i].position.y = 0.0362;
    }
    // paper tag hung on the shelf's front edge
    this.tag.mesh.position.set(-side * PLUSH.shelfX, 0.022, PLUSH.shelfZ + 0.0315);
    this.tag.mesh.rotation.set(-0.25, 0, 0);
    for (let i = 0; i < PLUSH.slots; i++) {
      const p = this.slotItems[i];
      if (p) this.slotPos(i, p.position);
      const g = this.ghosts[i];
      if (g) this.slotPos(i, g.position);
    }
  }

  slotPos(i: number, out: Vector3): Vector3 {
    return out.set(-this.side * PLUSH.shelfX + (i - (PLUSH.slots - 1) / 2) * PLUSH.slotGap, PLUSH.shelfTopY, PLUSH.shelfZ);
  }

  /** Show the current chapter's finished pictures (rebuilds only changed slots). */
  setShelf(items: readonly ShelfItem[], chapter = ''): void {
    this.settle();
    const done = items.filter((it) => it.done).length;
    this.tag.set(chapter ? `${chapter} ${done}/${items.length}` : '');
    // no felt "plates": empty slots show a soft grey silhouette of the plush to come
    for (let i = 0; i < this.cushions.length; i++) this.cushions[i].visible = false;
    for (let i = 0; i < PLUSH.slots; i++) {
      const it = items[i];
      const want = it && !it.done ? it.id : null;
      if (want === this.ghostIds[i]) continue;
      const old = this.ghosts[i];
      if (old) disposePlush(old);
      this.ghosts[i] = null;
      this.ghostIds[i] = want;
      if (!it || !want) continue;
      const g = buildPlush(it.rows, 0x9aa0a6);
      g.traverse((o) => {
        const m = o as InstancedMesh;
        if (m.isInstancedMesh) {
          const mat = m.material as MeshPhysicalMaterial;
          mat.sheen = 0;
          mat.roughness = 0.95;
          m.castShadow = false;
        } else if ((o as Mesh).isMesh) o.visible = false; // no face: it's not woven yet
      });
      // a flat picture-shaped cut-out, not a lumpy grey plush
      g.scale.set(PLUSH.shelfScale, PLUSH.shelfScale, PLUSH.shelfScale * 0.55);
      this.slotPos(i, g.position);
      this.root.add(g);
      this.ghosts[i] = g;
    }
    for (let i = 0; i < this.pennants.length; i++) {
      const it = items[i];
      this.pennants[i].visible = !!it;
      (this.pennants[i].material as MeshStandardMaterial).color.set(it?.done ? it.color : 0xf3e6cf);
    }
    for (let i = 0; i < PLUSH.slots; i++) {
      const it = items[i];
      const id = it && it.done ? it.id : null;
      if (id === this.slotIds[i]) continue;
      const old = this.slotItems[i];
      if (old) disposePlush(old);
      this.slotItems[i] = null;
      this.slotIds[i] = id;
      if (!it || !id) continue;
      const p = buildPlush(it.rows, it.color);
      p.scale.setScalar(PLUSH.shelfScale);
      this.slotPos(i, p.position);
      this.root.add(p);
      this.slotItems[i] = p;
    }
  }

  /** Win: the picture pops out of the cloth. `slot` -1 = not a shelf picture. */
  celebrate(id: string, rows: readonly Mask8[], color: number, slot: number): void {
    this.settle();
    this.hero = buildPlush(rows, color);
    this.heroSlot = slot;
    this.heroId = id;
    this.heroColor = color;
    this.hero.position.set(0, 0.004, LOOM.fellZ + 0.035);
    this.hero.scale.setScalar(0.001);
    this.root.add(this.hero);
    this.phase = 'pop';
    this.t = 0;
  }

  /** One row of the song: a bounce and a sway. */
  beat(): void {
    if (this.phase !== 'dance') return;
    this.bounce = 0;
    this.tilt = -this.tilt;
  }

  /** Song over: hop up to the shelf (or off, if it has no slot). */
  finish(): void {
    if (!this.hero || (this.phase !== 'dance' && this.phase !== 'hopOut')) return;
    this.from.copy(this.hero.position);
    if (this.heroSlot >= 0) {
      this.slotPos(this.heroSlot, this.to);
      this.phase = 'hopShelf';
    } else {
      this.to.copy(this.from).add(_p.set(0, 0.08, -0.06)); // off and away
      this.phase = 'fade';
    }
    this.t = 0;
    this.onHop?.();
  }

  /** Jump any running show to its end state. */
  settle(): void {
    if (!this.hero) return;
    const h = this.hero;
    this.hero = null;
    this.phase = 'none';
    if (this.heroSlot < 0) {
      disposePlush(h);
      return;
    }
    const old = this.slotItems[this.heroSlot];
    if (old && old !== h) disposePlush(old);
    h.scale.setScalar(PLUSH.shelfScale);
    h.rotation.set(0, 0, 0);
    this.slotPos(this.heroSlot, h.position);
    this.slotItems[this.heroSlot] = h;
    this.slotIds[this.heroSlot] = this.heroId;
    const ghost = this.ghosts[this.heroSlot];
    if (ghost) {
      disposePlush(ghost);
      this.ghosts[this.heroSlot] = null;
      this.ghostIds[this.heroSlot] = null;
    }
    // its pennant on the bunting takes the picture's colour
    const pen = this.pennants[this.heroSlot];
    if (pen) (pen.material as MeshStandardMaterial).color.set(this.heroColor);
  }

  update(dt: number): void {
    // pennants sway a little, each out of step
    this.sway += dt;
    // slow, lazy sway about the string, each pennant out of step
    for (let i = 0; i < this.pennants.length; i++) {
      const ph = this.sway * 2.1 + i * 0.95;
      this.pennants[i].rotation.x = Math.sin(ph) * 0.1 + Math.sin(ph * 0.43 + i) * 0.05;
      this.pennants[i].rotation.y = Math.sin(ph * 0.7 + 1.3) * 0.06;
    }
    const h = this.hero;
    if (!h) return;
    this.t += dt;
    if (this.phase === 'pop') {
      const k = Math.min(1, this.t / 0.35);
      h.scale.setScalar(Math.max(0.001, back(k)));
      h.position.y = 0.004 + 0.03 * ease(k);
      if (k >= 1) {
        this.phase = 'hopOut';
        this.t = 0;
        this.from.copy(h.position);
        this.to.set(-this.side * PLUSH.stageX, 0.0015, PLUSH.stageZ);
        this.onHop?.();
      }
    } else if (this.phase === 'hopOut') {
      const k = Math.min(1, this.t / 0.6);
      this.arc(h, k, 0.09);
      h.rotation.y = Math.PI * 2 * ease(k); // a twirl on the way
      if (k >= 1) {
        this.phase = 'dance';
        this.t = 0;
        this.bounce = 0;
        this.onLand?.();
      }
    } else if (this.phase === 'dance') {
      this.bounce = Math.min(1, this.bounce + dt / 0.32);
      const b = Math.sin(this.bounce * Math.PI);
      h.position.y = 0.0015 + 0.022 * b;
      const land = this.bounce > 0.85 ? (this.bounce - 0.85) / 0.15 : 0;
      h.scale.set(1 + 0.08 * land, 1 - 0.12 * land + 0.05 * b, 1);
      h.rotation.z += (this.tilt * 0.14 - h.rotation.z) * Math.min(1, dt * 10);
    } else if (this.phase === 'hopShelf' || this.phase === 'fade') {
      const k = Math.min(1, this.t / 0.7);
      this.arc(h, k, 0.07);
      h.rotation.z *= 0.8;
      const target = this.phase === 'fade' ? 0.001 : PLUSH.shelfScale;
      h.scale.setScalar(1 + (target - 1) * ease(k));
      if (k >= 1) {
        if (this.phase === 'hopShelf') this.onLand?.();
        this.settle();
      }
    }
  }

  private arc(h: Object3D, k: number, height: number): void {
    const e = ease(k);
    h.position.lerpVectors(this.from, this.to, e);
    h.position.y += height * 4 * k * (1 - k);
  }
}
