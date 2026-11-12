/**
 * Call a friend from inside the headset: a little teal felt toy telephone on the desk,
 * on the lever side in front of the bank. Poke it and the loom is hosted; its paper
 * tag shows the four-letter code to read out to a friend, who joins on a phone as
 * the caller. While it waits for them the handset rattles now and then, like a
 * ringing toy; once they're on, it rests and the tag says so. Poke it again to hang up.
 */
import { CatmullRomCurve3, CircleGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry, CapsuleGeometry, TubeGeometry, Vector3 } from '@iwsdk/core';
import { Label } from '../ui/label.js';
import { feltTexture } from './textures.js';
import { mergeStatic } from './models.js';

export const TOY_PHONE = {
  /** On the lever side, in front of the bank (x is multiplied by side). */
  x: 0.36,
  z: 0.185,
  /** Touch point height: the handset. */
  y: 0.024,
} as const;

export type PhoneState = 'idle' | 'calling' | 'connected';

export class ToyPhone {
  readonly root = new Group();
  private handset = new Group();
  private tag = new Label(0.13, 0.03);
  private state: PhoneState = 'idle';
  private t = 0;
  private hoverK = 0;
  private hovered = false;

  constructor() {
    this.root.name = 'ToyPhone';
    const felt = feltTexture();
    const shell = new MeshStandardMaterial({ color: 0x2a9d8f, roughness: 1, map: felt, envMapIntensity: 0.3 }); // teal felt: the desk already has red (spool, pins, a knob)
    const cream = new MeshStandardMaterial({ color: 0xfff1d6, roughness: 0.95, map: felt, envMapIntensity: 0.3 });
    const ink = new MeshStandardMaterial({ color: 0x3b2a20, roughness: 0.9 });
    const mustard = new MeshStandardMaterial({ color: 0xf2b632, roughness: 0.9, map: felt });
    // the body: a soft felt dome on a flat base
    const body = new Mesh(new SphereGeometry(1, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), shell);
    body.scale.set(0.027, 0.02, 0.023);
    body.castShadow = true;
    const base = new Mesh(new CircleGeometry(1, 28), shell);
    base.rotation.x = Math.PI / 2;
    base.scale.set(0.027, 0.023, 1);
    // the dial on the sloping front: a cream disc, a ring of finger holes, a mustard button
    const dial = new Group();
    const disc = new Mesh(new CylinderGeometry(0.0115, 0.0115, 0.0025, 24), cream);
    dial.add(disc);
    const hole = new SphereGeometry(0.0017, 8, 6);
    for (let k = 0; k < 8; k++) {
      const a = -Math.PI * 0.15 + (k / 8) * Math.PI * 1.6;
      const h = new Mesh(hole, ink);
      h.position.set(Math.cos(a) * 0.0078, 0.0012, Math.sin(a) * 0.0078);
      h.scale.y = 0.4;
      dial.add(h);
    }
    const hub = new Mesh(new CylinderGeometry(0.0035, 0.0035, 0.0035, 14), mustard);
    hub.position.y = 0.0012;
    dial.add(hub);
    dial.position.set(0, 0.0125, 0.0155);
    dial.rotation.x = 0.85; // lying on the dome's front slope, facing up toward the seat
    // the handset across the top: a cream bar with an ear and a mouth cup
    const bar = new Mesh(new CapsuleGeometry(0.0048, 0.03, 4, 12), cream);
    bar.rotation.z = Math.PI / 2;
    bar.castShadow = true;
    this.handset.add(bar);
    for (const s of [-1, 1]) {
      const cup = new Mesh(new SphereGeometry(0.0082, 14, 10), cream);
      cup.position.set(s * 0.019, -0.0032, 0);
      cup.scale.set(0.9, 0.62, 1);
      cup.castShadow = true;
      this.handset.add(cup);
    }
    this.handset.position.set(0, 0.0215, -0.003);
    // a curly cord from the handset round to the side of the body
    const pts: Vector3[] = [];
    for (let k = 0; k <= 60; k++) {
      const u = k / 60;
      const a = u * Math.PI * 2 * 6;
      const x = 0.027 + 0.004 * Math.sin(u * Math.PI);
      pts.push(new Vector3(x + 0.0022 * Math.cos(a), 0.017 - 0.011 * u + 0.0022 * Math.sin(a), -0.006 + 0.004 * u));
    }
    const cord = new Mesh(new TubeGeometry(new CatmullRomCurve3(pts), 240, 0.0007, 5, false), cream);
    this.root.add(body, base, dial, this.handset, cord);
    this.tag.set('Call a phone');
    this.tag.mesh.name = 'PhoneTag';
    this.tag.mesh.position.set(0, 0.006, 0.034);
    this.tag.mesh.rotation.x = -0.35;
    this.root.add(this.tag.mesh);
    // the static parts in one draw per material (the handset rattles and the tag changes: they stay apart)
    mergeStatic(this.root, (o) => o === this.handset || o === this.tag.mesh);
  }

  setSide(side: 1 | -1): void {
    this.root.position.set(side * TOY_PHONE.x, 0, TOY_PHONE.z);
    this.root.rotation.y = -side * 0.25; // turned toward the seat
  }

  /** Idle ("Call a friend"), calling (dialling, then the code to read out), connected, or a practice call. */
  setState(state: PhoneState, code = '', practice = false): void {
    this.state = state;
    this.tag.set(state === 'idle' ? 'Call a phone' : state === 'calling' ? (code && code !== '…' ? `Code ${code}` : 'Dialling…') : practice ? 'Practice call' : 'Phone connected');
  }

  get phoneState(): PhoneState {
    return this.state;
  }

  hover(on: boolean): void {
    this.hovered = on;
  }

  update(dt: number): void {
    this.t += dt;
    this.hoverK += ((this.hovered ? 1 : 0) - this.hoverK) * Math.min(1, dt * 10);
    this.root.scale.setScalar(1 + 0.06 * this.hoverK);
    // waiting for the friend: the handset rattles in its cradle twice every couple of seconds
    const h = this.handset;
    if (this.state === 'calling') {
      const p = this.t % 2.2;
      const ring = p < 0.5 ? Math.abs(Math.sin(p * 44)) * (1 - p / 0.5) : 0;
      h.position.y = 0.0215 + 0.003 * ring;
      h.rotation.z = 0.12 * Math.sin(this.t * 50) * ring;
    } else {
      h.position.y = 0.0215;
      h.rotation.z = 0;
    }
  }
}
