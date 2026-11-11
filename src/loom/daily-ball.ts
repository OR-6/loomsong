/**
 * The picture of the day: a little wrapped present beside the chapter basket,
 * in the day's colour (dotted wrapping paper, a cream ribbon and a bow), with
 * a paper "Today" tag. Poke it to weave today's picture. Once today's picture
 * is woven the ribbon is gone and the lid sits open on its side: empty until
 * tomorrow.
 */
import { BoxGeometry, CanvasTexture, Color, Group, Mesh, MeshStandardMaterial, SphereGeometry, SRGBColorSpace, TorusGeometry } from '@iwsdk/core';
import { Label } from '../ui/label.js';

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
  private ribbon = new Group();
  private state: DailyState = 'hidden';
  private t = 0;
  private hoverA = 0;
  private hoverOn = false;
  private pop = 1;
  /** A paper tag in front: "Today" while it waits. */
  private tag = new Label(0.07, 0.022);

  constructor() {
    this.root.name = 'DailyGift';
    const { w, h } = DAILY_BALL;
    this.paper = new MeshStandardMaterial({ color: 0xe2563b, roughness: 0.88, map: dotsTexture() });
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
    const rib = new MeshStandardMaterial({ color: 0xfff1d6, roughness: 0.6 });
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

  /** Today's colour and whether it is still to do. */
  set(state: DailyState, color: number): void {
    if (state === 'new' && this.state !== 'new') this.pop = 0;
    this.state = state;
    this.root.visible = state !== 'hidden';
    this.paper.color.set(new Color(color));
    this.ribbon.visible = state === 'new';
    this.tag.mesh.visible = state === 'new';
    // opened: the lid leans against the box
    const { w, h } = DAILY_BALL;
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
/** Wrapping paper: lighter dots on the day's colour (the material colour tints it). */
function dotsTexture(): CanvasTexture {
  if (dots) return dots;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#cfcfcf';
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#ffffff';
  for (const [x, y] of [[16, 16], [48, 48], [48, 16], [16, 48]] as const) {
    g.beginPath();
    g.arc(x + (y === 48 ? 0 : 0), y, 5, 0, Math.PI * 2);
    g.fill();
  }
  dots = new CanvasTexture(c);
  dots.colorSpace = SRGBColorSpace;
  return dots;
}
