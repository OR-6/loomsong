/**
 * The picture of the day: a little present beside the chapter basket, in
 * brown kraft paper with a ribbon and bow in the day's colour, and a paper
 * "Today" tag. Poke it to weave today's picture. Once it is woven the ribbon
 * is gone, the lid leans against the box, and tomorrow's picture peeks out as
 * a felt silhouette with a "Tomorrow" tag.
 */
import { BoxGeometry, CanvasTexture, Color, Group, Mesh, MeshStandardMaterial, SphereGeometry, SRGBColorSpace, TorusGeometry } from '@iwsdk/core';
import { Label } from '../ui/label.js';
import { cutout, disposePlush } from './plush.js';
import type { Mask8 } from '../puzzle/tieup.js';

export const DAILY_BALL = {
  /** Beside the basket, on its outer side (x is multiplied by -side). */
  x: 0.322,
  /** Touch point: the middle of the box. */
  y: 0.016,
  z: 0.17,
  /** Box size (m). */
  w: 0.034,
  h: 0.026,
} as const;

export type DailyState = 'hidden' | 'new' | 'done';

export class DailyBall {
  readonly root = new Group();
  private box = new Group();
  private lid = new Group();
  private paper: MeshStandardMaterial;
  private rib: MeshStandardMaterial;
  /** Tomorrow's picture, peeking out of the opened box. */
  private peek: Group | null = null;
  private peekKey = '';
  private ribbon = new Group();
  private state: DailyState = 'hidden';
  private t = 0;
  private hoverA = 0;
  private hoverOn = false;
  private pop = 1;
  /** Seconds left of the opening: the lid pops off and the box sinks away before it hides. */
  private opening = 0;
  /** A paper tag in front: "Today" while it waits. */
  private tag = new Label(0.07, 0.022);

  constructor() {
    this.root.name = 'DailyGift';
    const { w, h } = DAILY_BALL;
    this.paper = new MeshStandardMaterial({ color: 0xc9a57a, roughness: 0.92, map: dotsTexture() }); // kraft
    const body = new Mesh(new BoxGeometry(w, h * 0.78, w), this.paper);
    body.position.y = h * 0.39;
    body.castShadow = true;
    this.box.add(body);
    // the lid: a touch wider, with its own rim
    const lidMesh = new Mesh(new BoxGeometry(w * 1.08, h * 0.26, w * 1.08), this.paper);
    lidMesh.castShadow = true;
    this.lid.add(lidMesh);
    this.lid.position.y = h * 0.78 + h * 0.13;
    this.box.add(this.lid);
    // cream ribbon both ways over body and lid, and a bow lying on the lid
    const rib = (this.rib = new MeshStandardMaterial({ color: 0xe2563b, roughness: 0.75 }));
    for (const ry of [0, Math.PI / 2]) {
      const band = new Mesh(new BoxGeometry(w * 1.1, h * 1.06, w * 0.16), rib);
      band.rotation.y = ry;
      band.position.y = h * 0.53;
      this.ribbon.add(band);
    }
    const loop = new TorusGeometry(w * 0.2, w * 0.055, 8, 24);
    for (const s of [-1, 1]) {
      const l = new Mesh(loop, rib);
      l.position.set(s * w * 0.19, h * 1.1, 0);
      l.rotation.set(Math.PI / 2 - 0.5, s * 0.35, 0); // lying back on the lid, not standing up
      l.scale.set(1, 0.62, 1);
      this.ribbon.add(l);
    }
    const knot = new Mesh(new SphereGeometry(w * 0.08, 10, 8), rib);
    knot.position.y = h * 1.08;
    this.ribbon.add(knot);
    this.box.add(this.ribbon);
    this.root.add(this.box);
    this.tag.set('Today');
    this.tag.mesh.name = 'DailyTag';
    this.tag.mesh.position.set(0, h * 0.42, w * 0.56 + 0.002);
    this.tag.mesh.rotation.x = -0.35;
    this.root.add(this.tag.mesh);
    this.root.visible = false;
  }

  setSide(side: 1 | -1): void {
    this.root.position.set(-side * DAILY_BALL.x, 0, DAILY_BALL.z);
    this.root.rotation.y = side * 0.18; // turned a little toward the seat
  }

  /** Poked: the ribbon snaps, the lid pops off and the box sinks away (today's picture is on the loom). */
  open(): void {
    this.opening = 0.75;
    this.ribbon.visible = false;
    this.tag.mesh.visible = false;
  }

  /** Today's colour, whether it is still to do, and (once done) tomorrow's picture to peek out. */
  set(state: DailyState, color: number, tomorrow?: { key: string; rows: readonly Mask8[] }): void {
    if (state === 'hidden' && this.opening > 0) {
      this.state = 'hidden'; // hide once the opening has played
      return;
    }
    if (state === 'new' && this.state !== 'new') this.pop = 0;
    this.state = state;
    this.root.visible = state !== 'hidden';
    this.rib.color.set(new Color(color));
    this.ribbon.visible = state === 'new';
    this.tag.set(state === 'new' ? 'Today' : 'Tomorrow');
    this.tag.mesh.visible = state !== 'hidden';
    // opened: the tag hangs beside the box, so tomorrow's picture shows inside it
    const { w, h } = DAILY_BALL;
    if (state === 'done') this.tag.mesh.position.set(0, h * 0.2, w * 0.62); // in front, below the silhouette
    else this.tag.mesh.position.set(0, h * 0.42, w * 0.56 + 0.002);
    const want = state === 'done' && tomorrow ? tomorrow.key : '';
    if (want !== this.peekKey) {
      if (this.peek) disposePlush(this.peek);
      this.peek = null;
      this.peekKey = want;
      if (tomorrow && want) {
        this.peek = cutout(tomorrow.rows);
        this.peek.scale.setScalar(0.62);
        // dark navy felt, so tomorrow's shape stands out against the kraft and the cream tag
        this.peek.traverse((o) => {
          const m = (o as Mesh).material as MeshStandardMaterial | undefined;
          if (m?.color) m.color.setHex(0x34507a);
        });
        this.peek.position.set(0, DAILY_BALL.h * 0.35, -DAILY_BALL.w * 0.1); // standing in the box, its top over the rim
        this.box.add(this.peek);
      }
    }
    // opened: the lid leans against the box
    if (state === 'done') {
      this.lid.position.set(w * 0.62, h * 0.5, 0);
      this.lid.rotation.set(0, 0, -1.25);
    } else {
      this.lid.position.set(0, h * 0.78 + h * 0.13, 0);
      this.lid.rotation.set(0, 0, 0);
    }
  }

  hover(on: boolean): void {
    this.hoverOn = on;
  }

  update(dt: number): void {
    if (!this.root.visible) return;
    this.t += dt;
    if (this.opening > 0) {
      this.opening -= dt;
      const k = 1 - Math.max(0, this.opening) / 0.75; // 0 → 1
      const { w, h } = DAILY_BALL;
      this.lid.position.set(w * 0.3 * k, h * 0.91 + 0.06 * Math.sin(Math.min(1, k * 1.6) * Math.PI * 0.5) - 0.03 * k * k, 0);
      this.lid.rotation.set(0.6 * k, 0, -1.4 * k);
      this.box.scale.setScalar(Math.max(0.001, 1 - Math.max(0, k - 0.45) / 0.55));
      if (this.opening <= 0) {
        this.root.visible = this.state !== 'hidden';
        this.box.scale.setScalar(1);
      }
      return;
    }
    this.pop = Math.min(1, this.pop + dt / 0.5);
    this.hoverA += ((this.hoverOn ? 1 : 0) - this.hoverA) * Math.min(1, dt * 12);
    const b = this.pop - 1;
    const popS = 1 + 2.2 * b * b * b + 1.2 * b * b; // a little bounce as it appears
    // still to do: now and then it gives a small hop, as if something inside wants out
    const hop = this.state === 'new' ? Math.max(0, Math.sin(this.t * 2.2)) ** 12 : 0;
    this.box.scale.setScalar(Math.max(0.001, popS) * (1 + 0.1 * this.hoverA));
    this.box.position.y = 0.006 * hop + 0.004 * this.hoverA;
    this.box.rotation.z = this.state === 'new' ? 0.06 * hop * Math.sin(this.t * 9) : 0;
  }
}

let dots: CanvasTexture | null = null;
/** Kraft wrapping paper: plain, with a few long paper fibres (the material colour tints it). */
function dotsTexture(): CanvasTexture {
  if (dots) return dots;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ececec';
  g.fillRect(0, 0, 128, 128);
  let seed = 9;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  g.lineWidth = 1;
  for (let i = 0; i < 70; i++) {
    const x = rnd() * 128;
    const y = rnd() * 128;
    const a = rnd() * Math.PI;
    const l = 4 + rnd() * 10;
    g.strokeStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.35)';
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  dots = new CanvasTexture(c);
  dots.colorSpace = SRGBColorSpace;
  return dots;
}
