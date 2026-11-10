/**
 * Tutorial ghost hand: a golden-outlined copy of the player's own hand (IWSDK's
 * WebXR generic-hand visual), frozen in a real pinch pose captured from the
 * emulator, looping the gesture on the exact thing to touch: approach, pinch,
 * slide, lift away. It steps aside while the player's hand is busy.
 * Loom-local: add `root` to the loom root.
 */
import { Group, MeshStandardMaterial, Object3D, Quaternion, Skeleton, Vector3, type Bone, type Material, type SkinnedMesh } from '@iwsdk/core';
import { LEVER, SHUTTLE, leverX, shuttleY } from '../config.js';
import { PINCH_POSE } from './pinch-pose.js';

export type GhostGesture = { kind: 'lever'; k: number; back?: boolean } | { kind: 'shuttle'; fromEnd: 0 | 1 } | null;

const LOOP = 2.9;
const _q = new Quaternion();
const _v = new Vector3();
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/** Deep clone with the skinned meshes rebound to the cloned bones (like SkeletonUtils.clone). */
function cloneSkinned(src: Object3D): Object3D {
  const out = src.clone(true);
  const bones = new Map<string, Bone>();
  out.traverse((o) => {
    if ((o as Bone).isBone) bones.set(o.name, o as Bone);
  });
  out.traverse((o) => {
    const m = o as SkinnedMesh;
    if (!m.isSkinnedMesh) return;
    const sk = m.skeleton;
    const mapped = sk.bones.map((b) => bones.get(b.name) ?? b);
    m.bind(new Skeleton(mapped, sk.boneInverses), m.bindMatrix);
    m.frustumCulled = false;
  });
  return out;
}

/** Extra curl (radians per joint: proximal, intermediate, distal) for the three free fingers,
 * so the pose reads as a pinch (thumb and index together, the rest tucked), not an open hand. */
const CURL = [-1.05, -1.2, -0.7];
const FREE = ['middle-finger', 'ring-finger', 'pinky-finger'];
const JOINTS = ['metacarpal', 'phalanx-proximal', 'phalanx-intermediate', 'phalanx-distal', 'tip'];

/** Curls fingers in model space (the WebXR hand rig's joints are flat siblings). */
function curlFingers(model: Object3D, angles: number[]): void {
  const by = new Map<string, Object3D>();
  model.traverse((o) => by.set(o.name, o));
  const a = by.get('index-finger-phalanx-proximal');
  const b = by.get('pinky-finger-phalanx-proximal');
  if (!a || !b) return;
  const axis = new Vector3().subVectors(b.position, a.position).normalize();
  const r = new Quaternion();
  const piv = new Vector3();
  for (const f of FREE) {
    const chain = JOINTS.map((j) => by.get(`${f}-${j}`));
    if (chain.some((c) => !c)) continue;
    for (let j = 1; j <= 3; j++) {
      r.setFromAxisAngle(axis, angles[j - 1]);
      piv.copy(chain[j]!.position);
      for (let k = j + 1; k < chain.length; k++) {
        const o = chain[k]!;
        o.position.sub(piv).applyQuaternion(r).add(piv);
        o.quaternion.premultiply(r);
      }
      // the joint itself turns too (its bone segment points at the next joint)
      chain[j]!.quaternion.premultiply(r);
    }
  }
}

export class GhostHand {
  readonly root = new Group();
  private inner = new Group();
  /** Tilts the captured pose about the pinch point: wrist up and back, fingers curling down. */
  private tilt = new Group();
  private model: Object3D | null = null;
  private gesture: GhostGesture = null;
  private side: 1 | -1 = 1;
  private t = 0;
  private idle = 0;
  private from = new Vector3();
  private to = new Vector3();

  constructor() {
    this.root.name = 'GhostHand';
    this.root.visible = false;
    this.root.add(this.inner);
    this.inner.add(this.tilt);
    this.tilt.quaternion.set(-0.22228, -0.04777, 0.13775, 0.96402);
  }

  get ready(): boolean {
    return this.model !== null;
  }

  /** Clone the player's hand visual once it has loaded. */
  attach(src: Object3D): void {
    if (this.model) return;
    const m = cloneSkinned(src);
    m.position.set(0, 0, 0);
    m.quaternion.set(0, 0, 0, 1);
    m.visible = true;
    // the captured pinch pose
    m.traverse((o) => {
      const b = PINCH_POSE.bones[o.name as keyof typeof PINCH_POSE.bones];
      if (!b || !(o as Bone).isBone) return;
      o.position.fromArray(b.p);
      o.quaternion.fromArray(b.q);
    });
    curlFingers(m, CURL);
    // A soft, glowing body with a crisp golden edge (own materials, so the
    // player's hands are untouched).
    const body = new MeshStandardMaterial({
      color: 0xf4f7ff,
      emissive: 0xb8d6ff,
      emissiveIntensity: 0.25,
      roughness: 0.6,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
    });
    // a soft blue rim (fresnel) so the fingers' outlines read, not a milky blob
    body.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace(
        '#include <dithering_fragment>',
        `float rim = pow(1.0 - clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0.0, 1.0), 0.9);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.239, 0.545, 1.0), rim);
        gl_FragColor.a = max(gl_FragColor.a, rim);
        #include <dithering_fragment>`,
      );
    };
    m.traverse((o) => {
      const mesh = o as SkinnedMesh;
      if (!mesh.isSkinnedMesh) return;
      const src = mesh.material as Material & { uniforms?: Record<string, { value: unknown }> };
      if (src.uniforms?.outlineColor) {
        // the outline trick needs IWSDK's hidden inner mesh; the ghost has a solid body instead
        mesh.visible = false;
      } else {
        mesh.material = body;
        mesh.renderOrder = 998;
      }
    });
    // place the model so its pinch point sits at the inner group's origin
    m.quaternion.fromArray(PINCH_POSE.quat);
    _v.fromArray(PINCH_POSE.pinch).applyQuaternion(m.quaternion);
    m.position.copy(_v).multiplyScalar(-1);
    this.tilt.add(m);
    this.model = m;
  }

  /** What to demonstrate (null hides it). `side` is the lever bank side. */
  show(g: GhostGesture, side: 1 | -1): void {
    const same =
      g?.kind === this.gesture?.kind &&
      (g?.kind !== 'lever' || (this.gesture?.kind === 'lever' && g.k === this.gesture.k && !!g.back === !!this.gesture.back)) &&
      (g?.kind !== 'shuttle' || (this.gesture?.kind === 'shuttle' && g.fromEnd === this.gesture.fromEnd));
    if (same && side === this.side) return;
    this.gesture = g;
    this.side = side;
    this.t = 0;
    if (g?.kind === 'shuttle') {
      // Side-on from the outside end: the hand on that side reaches in, fingers
      // pointing along the race, so the seat sees thumb and index pinch in profile.
      const out = g.fromEnd === 0 ? -1 : 1;
      this.inner.scale.set(out * 0.85, 0.85, 0.85);
      this.inner.rotation.set(0, out * Math.PI / 2, 0);
    } else {
      // a right hand for a right-hand lever bank; mirrored for the left
      this.inner.scale.set(side * 0.75, 0.75, 0.75);
      this.inner.rotation.set(0, 0, 0);
    }
  }

  /** `busy`: the player's hand is hovering or holding something. */
  update(dt: number, busy: boolean): void {
    const g = this.gesture;
    if (!this.model || !g) {
      this.root.visible = false;
      return;
    }
    if (busy) {
      this.idle = 1.2;
      this.t = 0;
      this.root.visible = false;
      return;
    }
    if (this.idle > 0) {
      this.idle -= dt;
      this.root.visible = false;
      return;
    }
    this.t = (this.t + dt) % LOOP;
    if (g.kind === 'lever') {
      const x = leverX(g.k, this.side);
      // away to lift it; back toward you to put it down
      const a = g.back ? LEVER.restZ - LEVER.travel : LEVER.restZ;
      const b = g.back ? LEVER.restZ : LEVER.restZ - LEVER.travel;
      this.from.set(x, LEVER.knobY, a);
      this.to.set(x, LEVER.knobY, b);
    } else {
      // pinch the boat's back edge (outside end), so Pip stays visible
      const back = g.fromEnd === 0 ? -0.04 : 0.04; // well behind the tail, so Pip stays in view
      const a = (g.fromEnd === 0 ? SHUTTLE.minX : SHUTTLE.maxX) + back;
      const b = (g.fromEnd === 0 ? SHUTTLE.maxX : SHUTTLE.minX) + back;
      this.from.set(a, shuttleY(a) + 0.002, SHUTTLE.z);
      this.to.set(b, shuttleY(b) + 0.002, SHUTTLE.z);
    }
    const t = this.t;
    let s = 1;
    const p = this.root.position;
    if (t < 0.5) {
      // approach from above and behind
      const k = ease(t / 0.5);
      p.copy(this.from).add(_v.set(0, 0.07 * (1 - k), 0.03 * (1 - k)));
      s = Math.min(1, t / 0.15);
    } else if (t < 0.75) {
      p.copy(this.from); // pinch
    } else if (t < 1.85) {
      const k = ease((t - 0.75) / 1.1);
      p.lerpVectors(this.from, this.to, k);
      if (g.kind === 'shuttle') p.y = shuttleY(p.x) + 0.002;
    } else if (t < 2.3) {
      const k = (t - 1.85) / 0.45;
      p.copy(this.to).add(_v.set(0, 0.05 * k, 0.02 * k));
      s = 1 - k;
    } else s = 0;
    this.root.visible = s > 0.01;
    this.root.scale.setScalar(Math.max(0.001, s));
    void _q;
  }
}
