/**
 * Blender-authored models (tools/blender/*.py → public/models/*.glb), loaded
 * by the IWSDK asset manifest. Clones share geometry with the cached GLTF, so
 * they are tagged and never have their geometry disposed.
 */
import { AssetManager, BufferAttribute, BufferGeometry, Matrix3, Matrix4, Mesh, Object3D, Vector3, type Material } from '@iwsdk/core';

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

/**
 * Draw-call diet: merge the static meshes under `root` (those `keep` doesn't
 * protect) into one mesh per material, baked into `root`'s space. Meshes the
 * game moves, mirrors, recolours or hides by name must be kept. Geometries
 * with different attribute sets are left alone. Returns how many meshes went.
 */
export function mergeStatic(root: Object3D, keep: (o: Object3D) => boolean): number {
  root.updateMatrixWorld(true);
  const inv = new Matrix4().copy(root.matrixWorld).invert();
  // clones carry their own copy of each material: group by name (copies are identical)
  const groups = new Map<string, Mesh[]>();
  const protectedSubtree = (o: Object3D): boolean => {
    for (let p: Object3D | null = o; p && p !== root; p = p.parent) if (keep(p)) return true;
    return false;
  };
  root.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh || (m as Mesh & { isInstancedMesh?: boolean }).isInstancedMesh || Array.isArray(m.material) || protectedSubtree(o) || !m.visible) return;
    const key = (m.material as Material).name || (m.material as Material).uuid;
    const list = groups.get(key) ?? [];
    list.push(m);
    groups.set(key, list);
  });
  let removed = 0;
  const mat = new Matrix4();
  const nrm = new Matrix3();
  const v = new Vector3();
  for (const meshes of groups.values()) {
    if (meshes.length < 2) continue;
    const material = meshes[0].material as Material;
    const names = Object.keys(meshes[0].geometry.attributes).sort().join(',');
    const ok = meshes.filter((m) => Object.keys(m.geometry.attributes).sort().join(',') === names && m.geometry.index);
    if (ok.length < 2) continue;
    let vCount = 0;
    let iCount = 0;
    for (const m of ok) {
      vCount += m.geometry.attributes.position.count;
      iCount += m.geometry.index!.count;
    }
    const out = new BufferGeometry();
    const attrs: Record<string, Float32Array> = {};
    for (const key of names.split(',')) attrs[key] = new Float32Array(vCount * meshes[0].geometry.attributes[key].itemSize);
    const index = new Uint32Array(iCount);
    let vo = 0;
    let io = 0;
    for (const m of ok) {
      const g = m.geometry;
      mat.multiplyMatrices(inv, m.matrixWorld);
      nrm.getNormalMatrix(mat);
      const n = g.attributes.position.count;
      for (const key of Object.keys(attrs)) {
        const a = g.attributes[key] as BufferAttribute;
        const size = a.itemSize;
        const dst = attrs[key];
        for (let i = 0; i < n; i++) {
          if (key === 'position') {
            v.fromBufferAttribute(a, i).applyMatrix4(mat);
            dst.set([v.x, v.y, v.z], (vo + i) * 3);
          } else if (key === 'normal') {
            v.fromBufferAttribute(a, i).applyMatrix3(nrm).normalize();
            dst.set([v.x, v.y, v.z], (vo + i) * 3);
          } else {
            for (let c = 0; c < size; c++) dst[(vo + i) * size + c] = a.array[i * size + c] as number;
          }
        }
      }
      const idx = g.index!;
      for (let i = 0; i < idx.count; i++) index[io + i] = (idx.getX(i) as number) + vo;
      vo += n;
      io += idx.count;
    }
    for (const key of Object.keys(attrs)) out.setAttribute(key, new BufferAttribute(attrs[key], meshes[0].geometry.attributes[key].itemSize));
    out.setIndex(new BufferAttribute(index, 1));
    out.computeBoundingSphere();
    const merged = new Mesh(out, material);
    merged.name = `Merged_${(material as Material).name || 'mat'}`;
    merged.userData.mergedFrom = ok.length;
    root.add(merged);
    for (const m of ok) {
      m.removeFromParent();
      removed++;
    }
  }
  return removed;
}
