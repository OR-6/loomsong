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
  MeshBasicMaterial,
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
  CanvasTexture,
  SRGBColorSpace,
} from '@iwsdk/core';
import { Label } from '../ui/label.js';
import { LOOM, WARPS } from '../config.js';
import { isLifted, type Mask8 } from '../puzzle/tieup.js';
import { knitTexture, weaveTexture } from './textures.js';
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
  shelfScale: 0.42,
  slots: 5,
  slotGap: 0.047,
  /** Plush base height on the shelf: the bench top (36 mm). */
  shelfTopY: 0.036,
  /** Shelf centre, on the side away from the lever bank (x is multiplied by -side). */
  shelfX: 0.335,
  shelfZ: 0.03,
  /** The plush dances in the air right above the loom it was woven on (seen face-on from the seat). */
  stageX: 0,
  stageZ: 0.19,
  /** Hero size while it pops and dances (shelf size is shelfScale). */
  hero: 0.95,
  /** Hover height while it dances (it faces the seated player). */
  danceY: 0.135,
  /** Width of the cream halo behind the dancing plush (m). */
  haloSize: 0.17,
  /** Radius of the felt stage disc under the dancing plush (m). */
  stageR: 0.052,
} as const;

/** Seconds per row when a shelf plush sings its picture. */
export const ROW_BEAT = 0.3;

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
  // matte felt (no sheen/gloss: it read as glassy), the loom's knitted stitch
  const mat = new MeshStandardMaterial({ color: new Color(color), roughness: 0.95, metalness: 0, map: knitTexture() });
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
  // the face goes on one solid run of cells (the longest contiguous stretch in a
  // row near the top two-thirds), so it's never split across separate lobes
  let bestA = 0;
  let bestB = WARPS - 1;
  for (let r = 0; r < rows.length; r++) {
    for (let i = 0; i < WARPS; ) {
      if (!isLifted(rows[r], i)) { i++; continue; }
      let j = i;
      while (j + 1 < WARPS && isLifted(rows[r], j + 1)) j++;
      if (j - i >= 1) {
        const score = -Math.abs(r - want) * 2 + (j - i) * 1.5;
        if (score > bestScore) {
          bestScore = score;
          best = r;
          bestA = i;
          bestB = j;
        }
      }
      i = j + 1;
    }
  }
  if (best < 0) best = rows.length - 1;
  const a = bestA;
  const b = bestB;
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
    eye.scale.set(0.0048, 0.0058, 0.0024);
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
    c.scale.set(0.0036, 0.0022, 0.001);
    c.position.set(xs[i] + (i === 0 ? -1 : 1) * Math.min(cell * 0.35, gap * 0.25), y - cell * 0.62, z - 0.0002);
    g.add(c);
  }
  // a little stitched smile between the eyes
  smileGeo ??= new TorusGeometry(Math.max(0.0034, gap * 0.22), 0.001, 6, 16, Math.PI);
  smileGeo.userData.sharedGeometry = true;
  const smile = new Mesh(smileGeo, eyeMat);
  smile.rotation.z = Math.PI;
  smile.position.set((xs[0] + xs[1]) / 2, y - cell * 0.45, z);
  g.add(smile);
}

/**
 * Silhouette for a picture not woven yet: one smooth, rounded felt cut-out of
 * its pixels (soft blobs merged) with a darker stitched edge, upright on a peg.
 * Origin at the bottom centre; about 1.5x a shelf plush.
 */
function cutout(rows: readonly Mask8[]): Group {
  const PX = 32;
  const n = rows.length;
  const c = document.createElement('canvas');
  c.width = (WARPS + 1) * PX;
  c.height = (n + 1) * PX;
  const g = c.getContext('2d')!;
  const blob = (grow: number) => {
    for (let r = 0; r < n; r++)
      for (let i = 0; i < WARPS; i++) {
        if (!isLifted(rows[r], i)) continue;
        const x = (i + 0.5) * PX - grow;
        const y = (n - r - 0.5) * PX - grow;
        // crisp, slightly overlapping squares merge into one pixel-picture slab
        g.fillRect(x - 0.5, y - 0.5, PX + grow * 2 + 1, PX + grow * 2 + 1);
      }
  };
  g.fillStyle = '#a8957a';
  blob(4); // a stitched brown edge around the whole shape
  g.fillStyle = '#d8cbb6'; // a pale felt cut-out, not a grey placeholder
  blob(0);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  // sized to fit its own slot (≤ slot width), so the cut-outs never merge
  const cell = PLUSH.slotGap / (WARPS + 1.4);
  const w = (WARPS + 1) * cell;
  const h = (n + 1) * cell;
  const mesh = new Mesh(new PlaneGeometry(w, h), new MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.4, roughness: 0.95, side: 2 }));
  mesh.position.y = h / 2 + 0.0035;
  mesh.castShadow = true;
  (mesh.material as MeshStandardMaterial).userData.own = true;
  // each silhouette stands on its own little walnut base: one spot per picture
  const peg = new Mesh(new CylinderGeometry(0.019, 0.02, 0.004, 24), new MeshStandardMaterial({ color: 0x6b4430, roughness: 0.6 }));
  peg.position.y = 0.002;
  (peg.material as MeshStandardMaterial).userData.own = true;
  const grp = new Group();
  // a darker backing gives the felt real thickness (~6 mm) and a shadow edge
  const back = new Mesh(mesh.geometry, new MeshStandardMaterial({ map: tex, color: 0x777270, transparent: true, alphaTest: 0.4, roughness: 1, side: 2 }));
  (back.material as MeshStandardMaterial).userData.own = true;
  back.position.z = -0.003;
  mesh.add(back);
  grp.add(mesh, peg);
  mesh.rotation.x = -0.45; // leaning back toward the seated player
  return grp;
}

/** Dispose a plush's per-instance resources (shared geometry is kept). */
export function disposePlush(g: Object3D): void {
  g.traverse((o) => {
    const m = o as InstancedMesh;
    if (m.isInstancedMesh) {
      (m.material as MeshStandardMaterial).dispose();
      m.dispose();
    } else if ((m as unknown as Mesh).isMesh && (m.material as MeshStandardMaterial).userData?.own) {
      const mat = m.material as MeshStandardMaterial;
      mat.map?.dispose();
      mat.dispose();
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
  /** A soft cream halo behind the hero plush: its own clean stage over the busy loom and card. */
  private halo: Mesh;
  /** A floating cream felt disc with a stitched ring: the stage the plush dances on. */
  private stage: Group;
  private haloA = 0;
  /** Per shelf slot: seconds left of its song (poked plushes sing and bounce). */
  private singLeft: number[] = new Array(PLUSH.slots).fill(0);
  private singT: number[] = new Array(PLUSH.slots).fill(0);
  /** Seconds each slot waits before its song starts (a medley staggers them). */
  private singWait: number[] = new Array(PLUSH.slots).fill(0);
  /** The brass wind-up key on the shelf's outer end: poke it and the whole shelf plays. */
  readonly windKey = new Group();
  private keyTurnLeft = 0;
  private keyHover = 0;
  /** Hovered shelf slot (-1: none): it leans in a little, inviting a poke. */
  private hoverSlot = -1;
  /** Called when the plush lands on the shelf (sound). */
  onLand: (() => void) | null = null;
  onHop: (() => void) | null = null;

  constructor() {
    this.root.name = 'Plushes';
    this.halo = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: haloTexture(), transparent: true, opacity: 0, depthWrite: false }));
    this.halo.name = 'PlushHalo';
    this.halo.scale.setScalar(PLUSH.haloSize);
    this.halo.visible = false;
    this.halo.renderOrder = 5;
    this.root.add(this.halo);
    this.stage = new Group();
    this.stage.name = 'PlushStage';
    // a navy felt disc (like the loom's bed) with a dashed cream running stitch and thin gold piping
    const felt = new Mesh(new CylinderGeometry(PLUSH.stageR, PLUSH.stageR * 0.96, 0.006, 40), new MeshStandardMaterial({ color: 0x2f4a7a, roughness: 0.95 }));
    felt.castShadow = true;
    this.stage.add(felt);
    const stitchMat = new MeshStandardMaterial({ color: 0xfff1d6, roughness: 0.9 });
    const dashes = 22;
    const dash = new TorusGeometry(PLUSH.stageR - 0.008, 0.0011, 4, 4, ((Math.PI * 2) / dashes) * 0.55);
    for (let i = 0; i < dashes; i++) {
      const d = new Mesh(dash, stitchMat);
      d.rotation.set(Math.PI / 2, 0, (i / dashes) * Math.PI * 2);
      d.position.y = 0.0032;
      this.stage.add(d);
    }
    const rim = new Mesh(new TorusGeometry(PLUSH.stageR, 0.0014, 6, 64), new MeshStandardMaterial({ color: 0xe8b04a, roughness: 0.6 }));
    rim.rotation.x = Math.PI / 2;
    this.stage.add(rim);
    this.stage.visible = false;
    this.root.add(this.stage);
    // a butterfly wind-up key: brass shaft out of the shelf end, two loops for fingers
    {
      const brass = new MeshStandardMaterial({ color: 0xd9a441, metalness: 0.55, roughness: 0.35 });
      const shaft = new Mesh(new CylinderGeometry(0.0036, 0.0036, 0.016, 12), brass);
      shaft.rotation.z = Math.PI / 2;
      shaft.position.x = 0.008;
      const hub = new Mesh(new SphereGeometry(0.0062, 12, 8), brass);
      hub.position.x = 0.017;
      const bow = new Group();
      bow.name = 'WindKeyBow';
      for (const sy of [-1, 1]) {
        const loop = new Mesh(new TorusGeometry(0.011, 0.0042, 10, 28), brass);
        loop.rotation.y = Math.PI / 2; // loops in the shelf-end plane
        loop.position.set(0, sy * 0.0135, 0);
        bow.add(loop);
      }
      bow.position.x = 0.019;
      this.windKey.name = 'WindKey';
      this.windKey.add(shaft, hub, bow);
      this.root.add(this.windKey);
    }
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
    const cushionMat = new MeshPhysicalMaterial({ color: 0xf3e6cc, roughness: 0.95, sheen: 1, sheenRoughness: 0.6, sheenColor: new Color(0xffffff), map: weaveTexture() });
    eyeGeo ??= new SphereGeometry(1, 14, 10);
    for (let i = 0; i < PLUSH.slots; i++) {
      const c = new Mesh(eyeGeo, cushionMat);
      c.name = `Cushion${i}`;
      c.scale.set(0.017, 0.003, 0.016);
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
    // key on the shelf's outer end, pointing away from the loom
    this.windKey.position.set(-side * (PLUSH.shelfX + 0.1225), 0.03, PLUSH.shelfZ);
    this.windKey.scale.set(-side, 1, 1);
    this.shelf.position.set(-side * PLUSH.shelfX, 0, PLUSH.shelfZ);
    this.bunting.position.set(-side * PLUSH.shelfX, 0, PLUSH.shelfZ);
    for (let i = 0; i < this.cushions.length; i++) {
      this.slotPos(i, this.cushions[i].position);
      this.cushions[i].position.y = 0.0365;
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
    for (let i = 0; i < this.cushions.length; i++) this.cushions[i].visible = !!(items[i] && items[i].done);
    for (let i = 0; i < PLUSH.slots; i++) {
      const it = items[i];
      const want = it && !it.done ? it.id : null;
      if (want === this.ghostIds[i]) continue;
      const old = this.ghosts[i];
      if (old) disposePlush(old);
      this.ghosts[i] = null;
      this.ghostIds[i] = want;
      if (!it || !want) continue;
      // a smooth felt cut-out of the picture with a stitched edge, standing on a peg
      const g = cutout(it.rows);
      g.scale.setScalar(0.9); // a little narrower than a slot: neighbours never touch
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

  /** Centre of the finished plush in a shelf slot, or null when the slot holds none. */
  plushCentre(i: number, out: Vector3): Vector3 | null {
    if (!this.slotItems[i] || (this.hero && this.heroSlot === i)) return null;
    return this.slotPos(i, out).setY(PLUSH.shelfTopY + 0.022);
  }

  /** A poked plush sings: it bounces and sways on the shelf for `seconds`. */
  sing(i: number, seconds: number, delay = 0): void {
    if (!this.slotItems[i]) return;
    this.singLeft[i] = seconds;
    this.singT[i] = 0;
    this.singWait[i] = delay;
  }

  /** The key turns for `seconds` (the medley is playing). */
  turnKey(seconds: number): void {
    this.keyTurnLeft = seconds;
  }

  /** Where to touch the key (loom space). */
  keyCentre(out: Vector3): Vector3 {
    return out.set(-this.side * (PLUSH.shelfX + 0.1225 + 0.019), 0.03, PLUSH.shelfZ);
  }

  hoverKey(on: boolean): void {
    this.keyHover = on ? 1 : 0;
  }

  /** A plush is still out (popping, dancing or hopping to the shelf). */
  get busy(): boolean {
    return !!this.hero;
  }

  /** The hero plush is out on its stage (pop, dance). */
  get staged(): boolean {
    return !!this.hero && (this.phase === 'pop' || this.phase === 'hopOut' || this.phase === 'dance');
  }

  get hasPlush(): boolean {
    return this.slotItems.some((p) => !!p);
  }

  hover(i: number): void {
    this.hoverSlot = i;
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
    for (let i = 0; i < PLUSH.slots; i++) {
      const p = this.slotItems[i];
      if (!p || p === this.hero) continue;
      const base = PLUSH.shelfScale;
      if (this.singLeft[i] > 0 && this.singWait[i] > 0) {
        this.singWait[i] -= dt; // waiting its turn in the medley
      } else if (this.singLeft[i] > 0) {
        this.singLeft[i] -= dt;
        this.singT[i] += dt;
        const b = Math.abs(Math.sin((this.singT[i] / ROW_BEAT) * Math.PI)); // a hop per row of its song
        this.slotPos(i, p.position);
        p.position.y += 0.012 * b;
        p.rotation.z = 0.16 * Math.sin((this.singT[i] / ROW_BEAT) * Math.PI * 0.5);
        p.scale.set(base * (1 + 0.06 * (1 - b)), base * (1 - 0.08 * (1 - b) + 0.06 * b), base);
        if (this.singLeft[i] <= 0) {
          this.slotPos(i, p.position);
          p.rotation.set(0, 0, 0);
          p.scale.setScalar(base);
        }
      } else {
        // hovered: lean toward the hand and swell a touch
        const want = i === this.hoverSlot ? 1 : 0;
        const k = Math.min(1, dt * 12);
        p.rotation.x += (-0.18 * want - p.rotation.x) * k;
        p.scale.setScalar(p.scale.x + (base * (1 + 0.1 * want) - p.scale.x) * k);
      }
    }
    // the wind-up key turns while the shelf plays; it swells a touch under a fingertip
    const bow = this.windKey.children[2];
    if (this.keyTurnLeft > 0) {
      this.keyTurnLeft -= dt;
      bow.rotation.x += dt * 5;
    } else {
      bow.rotation.x += (Math.round(bow.rotation.x / Math.PI) * Math.PI - bow.rotation.x) * Math.min(1, dt * 6);
    }
    const ks = 1 + 0.15 * this.keyHover;
    this.windKey.scale.y += (ks - this.windKey.scale.y) * Math.min(1, dt * 12);
    this.windKey.scale.z = this.windKey.scale.y;
    const h = this.hero;
    // the halo glows in while the plush pops and dances, and fades as it hops away
    const staged = !!h && (this.phase === 'pop' || this.phase === 'hopOut' || this.phase === 'dance');
    this.haloA += ((staged ? 1 : 0) - this.haloA) * Math.min(1, dt * (staged ? 6 : 9));
    const hm = this.halo.material as MeshBasicMaterial;
    hm.opacity = this.haloA * 0.32;
    this.halo.visible = this.haloA > 0.02 && !!h;
    this.stage.visible = this.halo.visible && (this.phase === 'hopOut' || this.phase === 'dance' || this.phase === 'hopShelf');
    if (h && this.stage.visible) {
      // the stage sits under the plush's feet and tilts with its lean toward the player
      this.stage.position.set(h.position.x, h.position.y - 0.004, h.position.z);
      this.stage.rotation.x = h.rotation.x;
      this.stage.scale.setScalar(Math.max(0.001, this.haloA));
    }
    if (h && this.halo.visible) {
      this.halo.position.set(h.position.x, h.position.y + 0.012, h.position.z - 0.03);
      this.halo.rotation.x = -0.3;
      this.halo.scale.setScalar(PLUSH.haloSize * (0.6 + 0.4 * this.haloA));
    }
    if (!h) return;
    this.t += dt;
    if (this.phase === 'pop') {
      const k = Math.min(1, this.t / 0.35);
      h.scale.setScalar(Math.max(0.001, back(k) * PLUSH.hero));
      h.position.y = 0.004 + 0.045 * ease(k); // pops up out of the cloth (low: the card stays clear)
      if (k >= 1) {
        this.phase = 'hopOut';
        this.t = 0;
        this.from.copy(h.position);
        this.to.set(-this.side * PLUSH.stageX, PLUSH.danceY, PLUSH.stageZ);
        this.onHop?.();
      }
    } else if (this.phase === 'hopOut') {
      const k = Math.min(1, this.t / 0.6);
      this.arc(h, k, 0.045); // a low hop: stays inside a seated view
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
      h.position.y = PLUSH.danceY + 0.02 * b; // hovering, bouncing to the song
      h.rotation.x += (-0.3 - h.rotation.x) * Math.min(1, dt * 8); // leaning a little toward you
      const land = this.bounce > 0.85 ? (this.bounce - 0.85) / 0.15 : 0;
      h.scale.set(PLUSH.hero * (1 + 0.08 * land), PLUSH.hero * (1 - 0.12 * land + 0.05 * b), PLUSH.hero);
      h.rotation.z += (this.tilt * 0.14 - h.rotation.z) * Math.min(1, dt * 10);
    } else if (this.phase === 'hopShelf' || this.phase === 'fade') {
      const k = Math.min(1, this.t / 0.7);
      this.arc(h, k, 0.07);
      h.rotation.z *= 0.8;
      h.rotation.x *= 0.85;
      const target = this.phase === 'fade' ? 0.001 : PLUSH.shelfScale;
      h.scale.setScalar(PLUSH.hero + (target - PLUSH.hero) * ease(k));
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

let haloTex: CanvasTexture | null = null;
/** A soft cream disc fading to clear at the edge, with a faint stitched ring. */
function haloTexture(): CanvasTexture {
  if (haloTex) return haloTex;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(128, 128, 10, 128, 128, 126);
  grad.addColorStop(0, 'rgba(255,246,222,1)');
  grad.addColorStop(0.62, 'rgba(255,243,214,0.95)');
  grad.addColorStop(0.8, 'rgba(255,240,205,0.55)');
  grad.addColorStop(1, 'rgba(255,240,205,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  g.setLineDash([9, 7]);
  g.lineWidth = 3;
  g.strokeStyle = 'rgba(214,170,110,0.7)';
  g.beginPath();
  g.arc(128, 128, 92, 0, Math.PI * 2);
  g.stroke();
  haloTex = new CanvasTexture(c);
  haloTex.colorSpace = SRGBColorSpace;
  return haloTex;
}
