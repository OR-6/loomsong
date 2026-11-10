/**
 * Felt craft mat under the loom: frames the play space on any desk, takes the
 * loom's shadow, and unrolls (back to front) when the loom is placed.
 */
import { CanvasTexture, Mesh, MeshStandardMaterial, PlaneGeometry, SRGBColorSpace } from '@iwsdk/core';

export const MAT = { width: 0.72, depth: 0.39, backZ: -0.165, y: 0.0012, offsetX: 0.06 } as const;

function feltTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = Math.round((1024 * MAT.depth) / MAT.width);
  const g = c.getContext('2d')!;
  const W = c.width;
  const H = c.height;
  const r = H * 0.09;
  g.clearRect(0, 0, W, H);
  g.beginPath();
  g.roundRect(4, 4, W - 8, H - 8, r);
  g.fillStyle = '#4f6d7a';
  g.fill();
  // felt fibres: dense tiny speckles, lighter and darker
  g.save();
  g.clip();
  for (let i = 0; i < 9000; i++) {
    const x = (i * 7919) % W;
    const y = (i * 104729) % H;
    const l = (i * 31) % 3;
    g.fillStyle = l === 0 ? 'rgba(255,255,255,0.07)' : l === 1 ? 'rgba(0,0,0,0.08)' : 'rgba(120,160,175,0.10)';
    g.fillRect(x, y, 2, 1 + ((i >> 3) % 2));
  }
  g.restore();
  // running stitch around the edge in cream yarn
  g.setLineDash([18, 12]);
  g.lineWidth = 5;
  g.lineCap = 'round';
  g.strokeStyle = '#f3e6cf';
  g.beginPath();
  g.roundRect(26, 26, W - 52, H - 52, r * 0.7);
  g.stroke();
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Plane lying on the desk; pivot on its back edge so scale.z unrolls it toward you. */
export function makeMat(): Mesh {
  const geo = new PlaneGeometry(MAT.width, MAT.depth);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, MAT.depth / 2);
  const m = new Mesh(geo, new MeshStandardMaterial({ map: feltTexture(), roughness: 1, transparent: true, alphaTest: 0.5 }));
  m.name = 'FeltMat';
  m.receiveShadow = true;
  m.position.set(-MAT.offsetX, MAT.y, MAT.backZ);
  m.renderOrder = -2;
  return m;
}
