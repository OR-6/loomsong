/**
 * Yarn basket: the diegetic chapter picker. One ball of yarn per chapter, all
 * the same size, in the chapter's colour, with wound strands, a loose tail over
 * the rim and a felt badge showing the chapter's icon (leaf, house, moon,
 * fish). Locked chapters are undyed wool with a "?" badge. A gingham lining
 * and two knitting needles make it a basket you'd want on your desk.
 * Hovering a ball lifts and wobbles it and shows the chapter's name.
 */
import {
  CanvasTexture,
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  Group,
  InstancedMesh,
  LatheGeometry,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  RepeatWrapping,
  SRGBColorSpace,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from '@iwsdk/core';
import { BASKET, skeinPos } from '../config.js';
import { Label } from '../ui/label.js';
import { yarnTexture } from './textures.js';
import { cloneModel, loomModels } from './models.js';

export type SkeinState = 'locked' | 'open' | 'current';
const UNDYED = 0xe6dccb;
const WRAPS = 7;
const ICONS = ['leaf', 'house', 'moon', 'fish'] as const;
const _p = { x: 0, y: 0, z: 0 };
const _m = new Matrix4();
const _q = new Quaternion();
const _v = new Vector3();
const _s = new Vector3();
const _c = new Color();

export class Basket {
  readonly root = new Group();
  private bowl: Object3D | null = null;
  private balls: Group[] = [];
  private cores: Mesh[] = [];
  private mats: MeshStandardMaterial[] = [];
  private tails: Mesh[] = [];
  private badges: Mesh[] = [];
  private badgeTex: CanvasTexture[] = [];
  private wraps: InstancedMesh;
  private lift = new Float32Array(BASKET.balls);
  private wob = new Float32Array(BASKET.balls);
  private states: SkeinState[] = [];
  private colors: number[] = [];
  private names: string[] = [];
  private hovered = -1;
  private side: 1 | -1 = 1;
  private label = new Label(0.14, 0.024);
  private lining: Mesh;
  private needles = new Group();
  private clock = 0;

  constructor() {
    this.root.name = 'Basket';
    const m = loomModels();
    if (m?.basket) {
      this.bowl = cloneModel(m.basket);
      this.bowl.traverse((o) => {
        if (!(o as Mesh).isMesh) return;
        o.castShadow = o.receiveShadow = true;
        // a woven wicker bowl (warm tan), not a glazed teal dish: it sat too close to the gift and the knobs
        const m = (o as Mesh).material as MeshStandardMaterial;
        if (m?.color) {
          m.color.setHex(m.color.getHSL({ h: 0, s: 0, l: 0 }).l > 0.7 ? 0xf1e2c4 : 0xc89b62);
          m.roughness = 0.92;
        }
      });
      this.root.add(this.bowl);
    }
    // Gingham cloth lining, folded over the rim.
    const prof = [
      [0.03, 0.012],
      [0.0365, 0.024],
      [0.0398, 0.0322],
      [0.0432, 0.0345],
      [0.0462, 0.0318],
      [0.0468, 0.0262],
    ].map(([r, y]) => new Vector2(r, y));
    const lg = new LatheGeometry(prof, 40);
    this.lining = new Mesh(lg, new MeshStandardMaterial({ map: ginghamTexture(), roughness: 0.95, side: 2 }));
    this.lining.name = 'BasketLining';
    this.lining.scale.set(1.45, 1, 1);
    this.lining.receiveShadow = true;
    this.lining.visible = false; // polish pass: plain bowl, no lining
    this.root.add(this.lining);

    const R = BASKET.ballR;
    const core = new SphereGeometry(R * 0.93, 20, 14);
    const wrapGeo = new TorusGeometry(R * 0.95, R * 0.05, 5, 32);
    this.wraps = new InstancedMesh(wrapGeo, new MeshStandardMaterial({ roughness: 0.95, map: yarnTexture() }), BASKET.balls * WRAPS);
    this.wraps.name = 'YarnWraps';
    this.wraps.castShadow = true;
    this.wraps.frustumCulled = false;
    const badgeGeo = new CylinderGeometry(R * 0.68, R * 0.68, 0.0012, 24);
    badgeGeo.rotateX(Math.PI / 2);
    for (let i = 0; i < BASKET.balls; i++) {
      const g = new Group();
      g.name = `Skein${i}`;
      const tex = yarnTexture().clone();
      tex.repeat.set(4, 4);
      tex.needsUpdate = true;
      const mat = new MeshStandardMaterial({ color: UNDYED, roughness: 0.95, map: tex });
      const c = new Mesh(core, mat);
      c.castShadow = true;
      g.add(c);
      // felt badge facing the player, a little up
      const bt = new CanvasTexture(document.createElement('canvas'));
      bt.colorSpace = SRGBColorSpace;
      const badge = new Mesh(badgeGeo, new MeshStandardMaterial({ map: bt, roughness: 0.9 }));
      badge.position.set(0, R * 0.38, R * 0.86);
      badge.rotation.x = -0.42;
      g.add(badge);
      this.root.add(g);
      this.balls.push(g);
      this.cores.push(c);
      this.mats.push(mat);
      this.badges.push(badge);
      this.badgeTex.push(bt);
      const tail = new Mesh(new TubeGeometry(new CatmullRomCurve3([new Vector3(), new Vector3(0, 0, 0.001)]), 2, 0.001, 4), mat);
      tail.name = `YarnTail${i}`;
      tail.castShadow = true;
      this.tails.push(tail);
      this.root.add(tail);
    }
    this.root.add(this.wraps);
    // (needles removed in the polish pass: decoration without a job)
    this.label.mesh.name = 'BasketTag';
    this.root.add(this.label.mesh);
    this.setSide(1);
  }

  /** Two beech knitting needles with painted ends, lying crossed on the mat beside the basket. */
  private buildNeedles(): void {
    const wood = new MeshStandardMaterial({ color: 0xe8c79a, roughness: 0.6 });
    const g = new CylinderGeometry(0.0019, 0.0016, 0.07, 8);
    const ball = new SphereGeometry(0.0042, 12, 8);
    const paints = [0xf2b632, 0x2a9d8f];
    for (let n = 0; n < 2; n++) {
      const stick = new Group();
      const shaft = new Mesh(g, wood);
      shaft.position.y = 0.035;
      const end = new Mesh(ball, new MeshStandardMaterial({ color: paints[n], roughness: 0.4 }));
      end.position.y = 0.071;
      stick.add(shaft, end);
      // lying on the mat, shaft pointing toward the player; the second crosses over the first
      stick.rotation.order = 'YXZ';
      stick.rotation.set(Math.PI / 2, n ? 0.38 : -0.22, 0);
      stick.position.set(n ? -0.088 : -0.072, 0.0019 + n * 0.0034, -0.035);
      stick.traverse((o) => ((o as Mesh).isMesh ? (o.castShadow = true) : null));
      this.needles.add(stick);
    }
    this.root.add(this.needles);
  }

  setSide(side: 1 | -1): void {
    this.side = side;
    const x = -side * BASKET.x;
    this.bowl?.position.set(x, 0, BASKET.z);
    this.lining.position.set(x, 0, BASKET.z);
    this.needles.position.set(x, 0, BASKET.z);
    // on the outer side of the basket, away from the loom
    this.needles.scale.x = side;
    this.place();
    this.layTails();
    this.label.mesh.position.set(x, 0.088, BASKET.z);
  }

  /** Chapter names, colours and states (locked / open / current). */
  set(names: readonly string[], colors: readonly number[], states: readonly SkeinState[]): void {
    this.names = [...names];
    this.states = [...states];
    this.colors = [...colors];
    for (let i = 0; i < this.balls.length; i++) {
      const on = i < names.length;
      this.balls[i].visible = on;
      // only the ball in use has a loose end, draped naturally
      this.tails[i].visible = false; // polish pass: no loose tails
      if (!on) continue;
      const locked = states[i] === 'locked';
      // locked chapters: a muted version of their own colour (with a "?" badge)
      this.mats[i].color.set(colors[i]);
      if (locked) this.mats[i].color.lerp(new Color(UNDYED), 0.62);
      drawBadge(this.badgeTex[i], locked ? 'locked' : ICONS[i % ICONS.length], locked ? 0x9b8b74 : colors[i]);
      this.badges[i].visible = !locked; // locked: plain undyed wool, no "?" (that sign belongs to Night's mystery levers)
    }
    this.place();
    this.showLabel();
  }

  /** Hovered ball (-1 for none). */
  hover(i: number): void {
    if (i === this.hovered) return;
    if (i >= 0) this.wob[i] = 1;
    this.hovered = i;
    this.showLabel();
  }

  private showLabel(): void {
    const i = this.hovered;
    if (i < 0 || i >= this.names.length) {
      this.label.set('');
      return;
    }
    const st = this.states[i];
    this.label.set(st === 'locked' ? `${this.names[i]} (locked)` : st === 'current' ? `${this.names[i]} (here)` : this.names[i]);
  }

  /** Ball positions plus their wound strands (one instanced mesh for all). */
  private place(): void {
    for (let i = 0; i < this.balls.length; i++) {
      skeinPos(i, this.side, _p);
      const b = this.balls[i];
      b.position.set(_p.x, _p.y + this.lift[i], _p.z);
      const w = this.wob[i];
      b.rotation.set(Math.sin(this.clock * 18) * 0.25 * w, (i - 1.5) * 0.12, Math.cos(this.clock * 15) * 0.22 * w);
      b.updateMatrix();
      const col = this.colors[i] ?? UNDYED;
      for (let k = 0; k < WRAPS; k++) {
        // deterministic "random" wrap orientations, different per ball
        const a = (k * 2.399 + i * 1.1) % (Math.PI * 2);
        const tilt = 0.4 + ((k * 0.73 + i * 0.37) % 1.2);
        _q.setFromAxisAngle(_v.set(Math.cos(a), 0, Math.sin(a)).normalize(), tilt);
        _m.compose(_s.set(0, 0, 0), _q, _s.set(1, 1, 1));
        _m.premultiply(b.matrix);
        this.wraps.setMatrixAt(i * WRAPS + k, _m);
        _c.set(col).multiplyScalar(0.86 + (k % 3) * 0.06);
        this.wraps.setColorAt(i * WRAPS + k, _c);
      }
    }
    this.wraps.instanceMatrix.needsUpdate = true;
    if (this.wraps.instanceColor) this.wraps.instanceColor.needsUpdate = true;
  }

  /**
   * A loose end of yarn from the ball: out of the front of the ball, over the
   * lining's rim, straight down the outside of the basket (gravity), then a
   * relaxed curl lying flat on the mat.
   */
  private layTails(): void {
    const cx = -this.side * BASKET.x;
    for (let i = 0; i < this.tails.length; i++) {
      skeinPos(i, this.side, _p);
      // radial direction from the basket centre (oval) through the ball, biased forward
      let dx = (_p.x - cx) / 1.45;
      let dz = 0.035;
      const n = Math.hypot(dx, dz);
      dx /= n;
      dz /= n;
      const at = (r: number) => [cx + dx * r * 1.45, BASKET.z + dz * r] as const;
      const [x1, z1] = at(0.0445);
      const [x2, z2] = at(0.0475);
      const [x3, z3] = at(0.052);
      const [x4, z4] = at(0.062);
      const side = i % 2 ? 1 : -1;
      const pts = [
        new Vector3(_p.x + dx * 0.006, _p.y + 0.002, _p.z + BASKET.ballR * 0.85),
        new Vector3(x1, 0.0352, z1),
        new Vector3(x2, 0.031, z2),
        new Vector3(x2 + dx * 0.0005, 0.016, z2 + dz * 0.0005),
        new Vector3(x3, 0.0035, z3),
        new Vector3(x4 + side * 0.006, 0.0021, z4),
        new Vector3(x4 + side * 0.016, 0.0021, z4 + 0.009),
        new Vector3(x4 + side * 0.011, 0.0021, z4 + 0.019),
      ];
      this.tails[i].geometry.dispose();
      this.tails[i].geometry = new TubeGeometry(new CatmullRomCurve3(pts, false, 'centripetal'), 48, 0.00155, 6);
    }
  }

  update(dt: number): void {
    this.clock += dt;
    let moved = false;
    for (let i = 0; i < this.balls.length; i++) {
      // current chapter sits a little proud; the hovered one lifts more
      const want = i === this.hovered ? 0.012 : this.states[i] === 'current' ? 0.005 : 0;
      const d = want - this.lift[i];
      if (Math.abs(d) > 1e-5) {
        this.lift[i] += d * Math.min(1, dt * 12);
        moved = true;
      }
      if (this.wob[i] > 0) {
        this.wob[i] = Math.max(0, this.wob[i] - dt * 2.5);
        moved = true;
      }
      if (this.states[i] === 'current') this.mats[i].emissive.copy(this.mats[i].color).multiplyScalar(0.1);
      else this.mats[i].emissive.setScalar(0);
    }
    if (moved) this.place();
  }
}

/** Red-and-cream gingham for the basket lining. */
function ginghamTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff3e0';
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = 'rgba(226,86,59,0.32)';
  g.fillRect(0, 0, 32, 64);
  g.fillRect(0, 0, 64, 32);
  g.fillStyle = 'rgba(200,60,40,0.2)';
  g.fillRect(0, 0, 32, 32);
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(14, 2);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** Felt badge: cream disc, stitched edge, a simple chapter icon. */
function drawBadge(t: CanvasTexture, icon: (typeof ICONS)[number] | 'locked', color: number): void {
  const c = t.image as HTMLCanvasElement;
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff6e8';
  g.fillRect(0, 0, 128, 128);
  g.setLineDash([7, 6]);
  g.lineWidth = 4;
  g.strokeStyle = 'rgba(90,60,35,0.45)';
  g.beginPath();
  g.arc(64, 64, 54, 0, Math.PI * 2);
  g.stroke();
  g.setLineDash([]);
  const col = '#' + color.toString(16).padStart(6, '0');
  g.fillStyle = col;
  g.strokeStyle = col;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.beginPath();
  if (icon === 'leaf') {
    g.moveTo(40, 92);
    g.quadraticCurveTo(30, 40, 90, 34);
    g.quadraticCurveTo(96, 92, 40, 92);
    g.fill();
    g.strokeStyle = '#fff6e8';
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(42, 90);
    g.lineTo(80, 48);
    g.stroke();
  } else if (icon === 'house') {
    g.moveTo(24, 64);
    g.lineTo(64, 28);
    g.lineTo(104, 64);
    g.closePath();
    g.fill();
    g.fillRect(36, 62, 56, 40);
    g.fillStyle = '#fff6e8';
    g.fillRect(57, 76, 16, 26);
    g.fillRect(42, 70, 10, 10);
    g.fillRect(77, 70, 10, 10);
  } else if (icon === 'moon') {
    g.arc(64, 64, 34, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff6e8';
    g.beginPath();
    g.arc(80, 54, 30, 0, Math.PI * 2);
    g.fill();
  } else if (icon === 'fish') {
    g.ellipse(58, 64, 30, 19, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(84, 64);
    g.lineTo(106, 46);
    g.lineTo(106, 82);
    g.closePath();
    g.fill();
    g.fillStyle = '#fff6e8';
    g.beginPath();
    g.arc(44, 58, 5, 0, Math.PI * 2);
    g.fill();
  } else {
    g.font = '700 76px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('?', 64, 70);
  }
  t.needsUpdate = true;
}
