/**
 * The picture of the day: a ball of yarn in the day's colour, wrapped like a
 * present (a cream ribbon crossing it and a bow on top), sitting beside the
 * chapter basket. Poke it to weave today's picture. While today's picture is
 * still to do it breathes a little; once woven it sits still with its ribbon
 * untied (the bow is gone), until tomorrow.
 */
import { Color, Group, Mesh, MeshStandardMaterial, SphereGeometry, TorusGeometry } from '@iwsdk/core';
import { yarnTexture } from './textures.js';
import { Label } from '../ui/label.js';

export const DAILY_BALL = {
  /** Beside the basket, on its outer side (x is multiplied by -side). */
  x: 0.318,
  y: 0.019,
  z: 0.168,
  r: 0.019,
} as const;

export type DailyState = 'hidden' | 'new' | 'done';

export class DailyBall {
  readonly root = new Group();
  private ball: Mesh;
  private mat: MeshStandardMaterial;
  private bow = new Group();
  private ribbons: Mesh[] = [];
  private state: DailyState = 'hidden';
  private t = 0;
  private hoverA = 0;
  private hoverOn = false;
  private pop = 1;
  /** A paper tag in front: "Today" while it waits. */
  private tag = new Label(0.05, 0.017);

  constructor() {
    this.root.name = 'DailyBall';
    const R = DAILY_BALL.r;
    const tex = yarnTexture().clone();
    tex.repeat.set(4, 4);
    tex.needsUpdate = true;
    this.mat = new MeshStandardMaterial({ color: 0xe2563b, roughness: 0.95, map: tex });
    this.ball = new Mesh(new SphereGeometry(R, 22, 16), this.mat);
    this.ball.castShadow = true;
    this.root.add(this.ball);
    // a cream ribbon crossing the ball both ways
    const ribbonMat = new MeshStandardMaterial({ color: 0xfff1d6, roughness: 0.7 });
    const band = new TorusGeometry(R * 1.01, R * 0.11, 6, 36);
    for (const ry of [0, Math.PI / 2]) {
      const b = new Mesh(band, ribbonMat);
      b.rotation.y = ry;
      this.root.add(b);
      this.ribbons.push(b);
    }
    // the bow: two loops and a knot on top
    const loop = new TorusGeometry(R * 0.5, R * 0.16, 8, 24);
    for (const s of [-1, 1]) {
      const l = new Mesh(loop, ribbonMat);
      l.position.set(s * R * 0.48, R * 1.22, 0);
      l.rotation.set(0, 0, s * 0.55); // loops face the player
      l.scale.set(1, 0.72, 1);
      l.castShadow = true;
      this.bow.add(l);
    }
    const knot = new Mesh(new SphereGeometry(R * 0.26, 12, 10), ribbonMat);
    knot.position.y = R * 1.08;
    this.bow.add(knot);
    this.root.add(this.bow);
    this.tag.set('Today');
    this.tag.mesh.name = 'DailyTag';
    this.tag.mesh.position.set(0, -R * 0.55, R * 1.35);
    this.tag.mesh.rotation.x = -0.5;
    this.root.add(this.tag.mesh);
    this.root.visible = false;
  }

  setSide(side: 1 | -1): void {
    this.root.position.set(-side * DAILY_BALL.x, DAILY_BALL.y, DAILY_BALL.z);
  }

  /** Today's colour and whether it is still to do. */
  set(state: DailyState, color: number): void {
    if (state === 'new' && this.state !== 'new') this.pop = 0;
    this.state = state;
    this.root.visible = state !== 'hidden';
    this.mat.color.set(new Color(color));
    this.bow.visible = state === 'new';
    this.tag.mesh.visible = state === 'new';
    for (const r of this.ribbons) r.visible = state === 'new';
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
    // still to do: a slow breath and a sway, so it reads as "something new"
    const breathe = this.state === 'new' ? 0.04 * Math.sin(this.t * 2.4) : 0;
    const s = Math.max(0.001, popS) * (1 + breathe + 0.12 * this.hoverA);
    this.root.scale.setScalar(s);
    this.root.rotation.z = this.state === 'new' ? 0.08 * Math.sin(this.t * 1.3) : 0;
    this.root.position.y = DAILY_BALL.y + 0.006 * this.hoverA;
  }
}
