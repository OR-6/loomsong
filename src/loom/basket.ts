/**
 * Yarn basket: the diegetic chapter picker. One ball of yarn per chapter, in
 * the chapter's colour; locked chapters are undyed wool. Hovering a ball lifts
 * it and shows the chapter's name on a paper tag.
 */
import { Group, Mesh, MeshStandardMaterial, Object3D, SphereGeometry } from '@iwsdk/core';
import { BASKET, skeinPos } from '../config.js';
import { Label } from '../ui/label.js';
import { yarnTexture } from './textures.js';
import { cloneModel, loomModels } from './models.js';

export type SkeinState = 'locked' | 'open' | 'current';
const UNDYED = 0xe6dccb;
const _p = { x: 0, y: 0, z: 0 };

export class Basket {
  readonly root = new Group();
  private bowl: Object3D | null = null;
  private balls: Mesh[] = [];
  private mats: MeshStandardMaterial[] = [];
  private lift = new Float32Array(BASKET.balls);
  private states: SkeinState[] = [];
  private names: string[] = [];
  private hovered = -1;
  private side: 1 | -1 = 1;
  private label = new Label(0.14, 0.024);

  constructor() {
    this.root.name = 'Basket';
    const m = loomModels();
    if (m?.basket) {
      this.bowl = cloneModel(m.basket);
      this.bowl.traverse((o) => {
        if ((o as Mesh).isMesh) o.castShadow = o.receiveShadow = true;
      });
      this.root.add(this.bowl);
    }
    const geo = new SphereGeometry(BASKET.ballR, 20, 14);
    for (let i = 0; i < BASKET.balls; i++) {
      const tex = yarnTexture().clone();
      tex.repeat.set(3, 3);
      tex.rotation = i * 0.7;
      tex.needsUpdate = true;
      const mat = new MeshStandardMaterial({ color: UNDYED, roughness: 0.95, map: tex });
      const b = new Mesh(geo, mat);
      b.name = `Skein${i}`;
      b.rotation.set(i * 1.3, i * 0.9, i * 0.4);
      b.castShadow = true;
      this.mats.push(mat);
      this.balls.push(b);
      this.root.add(b);
    }
    this.label.mesh.name = 'BasketTag';
    this.root.add(this.label.mesh);
    this.setSide(1);
  }

  setSide(side: 1 | -1): void {
    this.side = side;
    this.bowl?.position.set(-side * BASKET.x, 0, BASKET.z);
    this.place();
    this.label.mesh.position.set(-side * BASKET.x, 0.075, BASKET.z);
  }

  /** Chapter names, colours and states (locked / open / current). */
  set(names: readonly string[], colors: readonly number[], states: readonly SkeinState[]): void {
    this.names = [...names];
    this.states = [...states];
    for (let i = 0; i < this.balls.length; i++) {
      const on = i < names.length;
      this.balls[i].visible = on;
      if (!on) continue;
      const locked = states[i] === 'locked';
      this.mats[i].color.set(locked ? UNDYED : colors[i]);
      this.balls[i].scale.setScalar(locked ? 0.85 : 1);
    }
    this.showLabel();
  }

  /** Hovered ball (-1 for none). */
  hover(i: number): void {
    if (i === this.hovered) return;
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

  private place(): void {
    for (let i = 0; i < this.balls.length; i++) {
      skeinPos(i, this.side, _p);
      this.balls[i].position.set(_p.x, _p.y + this.lift[i], _p.z);
    }
  }

  update(dt: number): void {
    let moved = false;
    for (let i = 0; i < this.balls.length; i++) {
      // current chapter sits a little proud; the hovered one lifts more
      const want = i === this.hovered ? 0.012 : this.states[i] === 'current' ? 0.005 : 0;
      const d = want - this.lift[i];
      if (Math.abs(d) > 1e-5) {
        this.lift[i] += d * Math.min(1, dt * 12);
        moved = true;
      }
      if (this.states[i] === 'current') this.mats[i].emissive.copy(this.mats[i].color).multiplyScalar(0.12);
      else this.mats[i].emissive.setScalar(0);
    }
    if (moved) this.place();
  }
}

