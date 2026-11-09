/**
 * Hand occluders: invisible, depth-only spheres on every hand joint (plus
 * midpoints along each bone) so virtual threads pass *behind* the player's
 * real fingers in passthrough. Two draw calls (one InstancedMesh per hand).
 *
 * Also hides IWSDK's own hand mesh on device (you see your real hand in
 * passthrough; the spec asks for only a pinch glow). The emulator keeps it.
 */
import { reportFrameError } from '../app/safe.js';
import {
  createSystem,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
} from '@iwsdk/core';

const FINGERS = ['thumb', 'index-finger', 'middle-finger', 'ring-finger', 'pinky-finger'] as const;
const CHAIN = ['metacarpal', 'phalanx-proximal', 'phalanx-intermediate', 'phalanx-distal', 'tip'];

/** Bone pairs (joint names) whose midpoints also get a sphere. */
export const BONES: Array<[string, string]> = (() => {
  const pairs: Array<[string, string]> = [];
  for (const f of FINGERS) {
    const chain = CHAIN.filter((j) => !(f === 'thumb' && j === 'phalanx-intermediate')).map((j) => `${f}-${j}`);
    pairs.push(['wrist', chain[0]]);
    for (let i = 0; i + 1 < chain.length; i++) pairs.push([chain[i], chain[i + 1]]);
  }
  return pairs;
})();

const JOINTS = 25;
const COUNT = JOINTS + BONES.length;

export const occluderState = { enabled: true };

export class HandOccluderSystem extends createSystem({}) {
  private meshes: Record<'left' | 'right', InstancedMesh> = {} as never;
  private m = new Matrix4();
  private q = new Quaternion();
  private p = new Vector3();
  private s = new Vector3();
  private pos = new Map<string, Vector3>();
  private rad = new Map<string, number>();
  private hidVisuals = false;
  private seen = { left: false, right: false };

  init() {
    const geo = new SphereGeometry(1, 10, 8);
    // Depth only: writes depth, never colour; drawn before the loom.
    const mat = new MeshBasicMaterial({ colorWrite: false, depthWrite: true });
    for (const side of ['left', 'right'] as const) {
      const mesh = new InstancedMesh(geo, mat, COUNT);
      mesh.name = `HandOccluder-${side}`;
      mesh.renderOrder = -10;
      mesh.frustumCulled = false;
      mesh.count = 0;
      this.meshes[side] = mesh;
      this.world.createTransformEntity(mesh);
    }
    (window as unknown as { __occluders: unknown }).__occluders = { meshes: this.meshes, state: occluderState };
  }

  update() {
    try {
      this.step();
    } catch (e) {
      reportFrameError('Occluders', e);
    }
  }

  private step() {
    this.hideIwsdkHands();
    const frame = this.xrFrame;
    const ref = this.renderer.xr.getReferenceSpace();
    if (!frame?.session) this.hidVisuals = false; // re-hide in the next session
    const seen = this.seen;
    seen.left = seen.right = false;
    if (occluderState.enabled && frame?.session && ref && frame.getJointPose) {
      for (const src of frame.session.inputSources) {
        if (!src.hand || (src.handedness !== 'left' && src.handedness !== 'right')) continue;
        this.pos.clear();
        this.rad.clear();
        let i = 0;
        const mesh = this.meshes[src.handedness];
        for (const [name, space] of src.hand.entries()) {
          const pose = frame.getJointPose(space, ref);
          if (!pose) continue;
          const t = pose.transform.position;
          const r = (pose.radius ?? 0.008) * 1.08;
          const v = (this.pos.get(name) ?? new Vector3()).set(t.x, t.y, t.z);
          this.pos.set(name, v);
          this.rad.set(name, r);
          this.write(mesh, i++, v, r);
        }
        for (const [a, b] of BONES) {
          const pa = this.pos.get(a);
          const pb = this.pos.get(b);
          if (!pa || !pb) continue;
          this.p.addVectors(pa, pb).multiplyScalar(0.5);
          this.write(mesh, i++, this.p, ((this.rad.get(a) ?? 0.008) + (this.rad.get(b) ?? 0.008)) / 2);
        }
        mesh.count = i;
        mesh.instanceMatrix.needsUpdate = true;
        seen[src.handedness] = i > 0;
      }
    }
    for (const side of ['left', 'right'] as const) if (!seen[side]) this.meshes[side].count = 0;
  }

  private write(mesh: InstancedMesh, i: number, at: Vector3, r: number) {
    this.m.compose(at, this.q.identity(), this.s.setScalar(r));
    mesh.setMatrixAt(i, this.m);
  }

  /** Real device: hide IWSDK's hand mesh (passthrough shows the real hand). */
  private hideIwsdkHands() {
    if (this.hidVisuals || import.meta.env.DEV) return;
    const ad = this.input.xr.visualAdapters?.hand;
    if (!ad) return;
    ad.left.toggleVisual(false);
    ad.right.toggleVisual(false);
    this.hidVisuals = true;
  }
}
