/**
 * Blender-authored models (tools/blender/*.py → public/models/*.glb), loaded
 * by the IWSDK asset manifest. Clones share geometry with the cached GLTF, so
 * they are tagged and never have their geometry disposed.
 */
import { AssetManager, Mesh, Object3D, type Material } from '@iwsdk/core';

export interface LoomModels {
  frame: Object3D;
  knob: Object3D;
  bobbin: Object3D;
  pip: Object3D | null;
  shelf: Object3D | null;
  basket: Object3D | null;
}

let cached: LoomModels | null | undefined;

export function loomModels(): LoomModels | null {
  if (cached !== undefined) return cached;
  try {
    const loom = AssetManager.getGLTF('loom');
    const pip = AssetManager.getGLTF('pip');
    const frame = loom?.scene.getObjectByName('Frame');
    const knob = loom?.scene.getObjectByName('LeverKnob');
    const bobbin = loom?.scene.getObjectByName('Bobbin');
    cached = frame && knob && bobbin ? { frame, knob, bobbin, pip: pip?.scene.getObjectByName('Pip') ?? null, shelf: loom?.scene.getObjectByName('Shelf') ?? null, basket: loom?.scene.getObjectByName('Basket') ?? null } : null;
  } catch {
    cached = null;
  }
  return cached;
}

/**
 * Deep clone sharing geometry; materials are cloned so per-instance colour,
 * tint and highlight never leak between instances.
 */
export function cloneModel(src: Object3D, tint?: (m: Material, name: string) => void): Object3D {
  const o = src.clone(true);
  o.position.set(0, 0, 0);
  o.traverse((n) => {
    const m = n as Mesh;
    if (!m.isMesh) return;
    m.userData.sharedGeometry = true;
    const mat = (m.material as Material).clone();
    tint?.(mat, (m.material as Material).name);
    m.material = mat;
  });
  return o;
}

/** First material found under `root` on a mesh named `meshName`. */
export function materialOf(root: Object3D, meshName: string): Material | null {
  const m = root.getObjectByName(meshName) as Mesh | undefined;
  return (m?.material as Material) ?? null;
}
