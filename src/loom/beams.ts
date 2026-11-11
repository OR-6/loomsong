/**
 * The toy loom's frame as square, chamfered beams. The model's frame parts are
 * round tubes, which met like plastic pipe at elbows. Each part is replaced by a
 * square beam with 45° chamfered edges that fills the same bounding box, with UVs
 * so a faint grain runs along its length, and wooden pegs where the side rails
 * meet the front and back beams: a joined wooden toy.
 */
import { BufferAttribute, CylinderGeometry, ExtrudeGeometry, Mesh, Shape, Vector3 } from '@iwsdk/core';
import type { Material, Object3D } from '@iwsdk/core';

/** Frame parts drawn as beams (names in the loom model). */
export const BEAM_PARTS = ['BackBeam', 'FrontBeam', 'HeddleBar', 'PostL', 'PostR', 'RailL', 'RailR', 'EaselStretcher'] as const;

/** A beam filling the box [min, max] (m), its long axis the box's longest side. */
export function beamGeometry(min: Vector3, max: Vector3): ExtrudeGeometry {
  const size = new Vector3().subVectors(max, min);
  const axis = size.x >= size.y && size.x >= size.z ? 'x' : size.y >= size.z ? 'y' : 'z';
  // cross-section (a × b) and length, in the beam's own frame (length along +z)
  const [a, b, len] = axis === 'x' ? [size.z, size.y, size.x] : axis === 'y' ? [size.x, size.z, size.y] : [size.x, size.y, size.z];
  // slimmer than the round tube's box: a square beam reads heavier than a tube of the same width
  const w = a * 0.86;
  const h = b * 0.86;
  const c = Math.min(w, h) * 0.2; // the chamfer
  const s = new Shape();
  s.moveTo(-w / 2 + c, -h / 2);
  s.lineTo(w / 2 - c, -h / 2);
  s.lineTo(w / 2, -h / 2 + c);
  s.lineTo(w / 2, h / 2 - c);
  s.lineTo(w / 2 - c, h / 2);
  s.lineTo(-w / 2 + c, h / 2);
  s.lineTo(-w / 2, h / 2 - c);
  s.lineTo(-w / 2, -h / 2 + c);
  s.closePath();
  const end = c * 0.6; // softly eased ends
  const geo = new ExtrudeGeometry(s, { depth: Math.max(0.001, len - end * 2), bevelEnabled: true, bevelThickness: end, bevelSize: end * 0.5, bevelOffset: -end * 0.5, bevelSegments: 2, curveSegments: 1 });
  geo.translate(0, 0, -(len - end * 2) / 2);
  // grain along the length: u along the beam, v around it
  const pos = geo.getAttribute('position') as BufferAttribute;
  const uv = new Float32Array(pos.count * 2);
  for (let k = 0; k < pos.count; k++) {
    uv[k * 2] = pos.getZ(k) / 0.12;
    uv[k * 2 + 1] = (pos.getX(k) + pos.getY(k)) / 0.035;
  }
  geo.setAttribute('uv', new BufferAttribute(uv, 2));
  // into the part's own frame and place
  if (axis === 'x') geo.rotateY(Math.PI / 2);
  else if (axis === 'y') geo.rotateX(-Math.PI / 2);
  geo.translate((min.x + max.x) / 2, (min.y + max.y) / 2, (min.z + max.z) / 2);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Replace the frame's tube parts with beams (in place, before the frame's static
 * merge), and add pegs at the rail joints. `grain` goes on the beams' paint.
 */
export function squareTheFrame(frame: Object3D, grain: (m: Material) => void, pegMat: Material): void {
  frame.updateMatrixWorld(true);
  const box = new Vector3();
  const lo = new Vector3();
  const hi = new Vector3();
  const rails: { x: number; top: number }[] = [];
  const beamsZ: number[] = [];
  for (const name of BEAM_PARTS) {
    const m = frame.getObjectByName(name) as Mesh | undefined;
    if (!m?.isMesh) continue;
    m.geometry.computeBoundingBox();
    const bb = m.geometry.boundingBox!;
    lo.copy(bb.min);
    hi.copy(bb.max);
    m.geometry = beamGeometry(lo, hi);
    m.userData.sharedGeometry = false; // our own geometry now: disposed with the frame
    grain(m.material as Material);
    box.subVectors(hi, lo);
    if (name === 'RailL' || name === 'RailR') rails.push({ x: (lo.x + hi.x) / 2, top: lo.y + box.y * 0.93 });
    if (name === 'FrontBeam' || name === 'BackBeam') beamsZ.push((lo.z + hi.z) / 2);
  }
  // a walnut peg head on each rail over each beam joint
  const peg = new CylinderGeometry(0.0034, 0.0034, 0.002, 14);
  for (const r of rails) {
    for (const z of beamsZ) {
      const p = new Mesh(peg, pegMat);
      p.name = 'FramePeg';
      p.position.set(r.x, r.top + 0.0008, z);
      frame.add(p);
    }
  }
}
