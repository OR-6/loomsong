/**
 * A finished chapter becomes a little quilt for the real wall: its pictures
 * sewn side by side as felt panels with cream sashing and a running stitch,
 * hung from a wooden dowel by a loop of twine. Origin: the middle of the
 * dowel (where it hangs); the quilt faces +Z.
 */
import {
  CanvasTexture,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
  SRGBColorSpace,
} from '@iwsdk/core';
import { WARPS } from '../config.js';
import { isLifted, type Mask8 } from '../puzzle/tieup.js';

export interface QuiltPanel {
  rows: readonly Mask8[];
  color: number;
}

/** Quilt width on the wall at arm's length (m); it's scaled up on far walls. */
export const QUILT_W = 0.36;

/** `gold`: every picture of the chapter has its gold bow: the binding is gold thread. */
export function buildQuilt(title: string, panels: readonly QuiltPanel[], font = 'Lilita One, sans-serif', gold = false): Group {
  const g = new Group();
  g.name = 'Quilt';
  // patchwork: a patch per picture and one embroidered with the chapter's name, two to a row
  const patches = panels.length + 1;
  const cols = 2;
  const rowsN = Math.ceil(patches / cols);
  const cellPx = 24;
  const patchW = WARPS * cellPx + 44;
  const patchH = 6 * cellPx + 44;
  const bind = 16;
  const W = cols * patchW + 2 * bind;
  const H = rowsN * patchH + 2 * bind;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d')!;
  let seed = 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  // binding: a tomato edge all round
  x.fillStyle = gold ? '#d9a521' : '#c8442f';
  x.fillRect(0, 0, W, H);
  const grounds = ['#f3e7cf', '#b9cfa3', '#bcd3e8', '#f3c9bf', '#ecd38c'];
  const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const far = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  for (let k = 0; k < rowsN * cols; k++) {
    const px = bind + (k % cols) * patchW;
    const py = bind + Math.floor(k / cols) * patchH;
    const p = panels[k];
    // a ground that stands apart from the picture's yarn
    const col = p ? '#' + p.color.toString(16).padStart(6, '0') : '#c8442f';
    const ground = p ? grounds.reduce((best, gr) => (far(rgb(gr), rgb(col)) > far(rgb(best), rgb(col)) ? gr : best), grounds[k % grounds.length]) : '#f3e7cf';
    x.fillStyle = ground;
    x.fillRect(px, py, patchW, patchH);
    // a faint gingham on some patches, like scraps from different cloths
    if (k % 2 === 1) {
      x.fillStyle = 'rgba(255,255,255,0.18)';
      for (let i = 0; i < patchW; i += 16) x.fillRect(px + i, py, 7, patchH);
      for (let j = 0; j < patchH; j += 16) x.fillRect(px, py + j, patchW, 7);
    }
    for (let i = 0; i < 160; i++) {
      x.fillStyle = rnd() < 0.5 ? 'rgba(80,50,20,0.06)' : 'rgba(255,255,255,0.1)';
      x.fillRect(px + rnd() * patchW, py + rnd() * patchH, 3, 1);
    }
    if (p) {
      const n = p.rows.length;
      const ox = px + (patchW - WARPS * cellPx) / 2;
      const oy = py + (patchH - n * cellPx) / 2;
      for (let r = 0; r < n; r++) {
        const y = oy + (n - 1 - r) * cellPx; // row 0 at the bottom
        for (let i = 0; i < WARPS; i++) {
          if (!isLifted(p.rows[r], i)) continue;
          x.fillStyle = col;
          x.fillRect(ox + i * cellPx + 1, y + 1, cellPx - 2, cellPx - 2);
          x.fillStyle = 'rgba(255,255,255,0.12)';
          x.fillRect(ox + i * cellPx + 3, y + 3, cellPx - 8, 4);
        }
      }
    } else if (k > panels.length) {
      // a spare patch: Pip, the loom's bird, appliquéd in felt (the quilter's mark)
      const cx = px + patchW / 2;
      const cy = py + patchH / 2 + patchH * 0.06;
      const u = Math.min(patchW, patchH) / 100;
      x.lineWidth = 2.5;
      x.setLineDash([6, 5]);
      x.strokeStyle = 'rgba(70,45,25,0.55)';
      x.fillStyle = '#f7c948';
      x.beginPath();
      x.ellipse(cx - 6 * u, cy + 6 * u, 26 * u, 19 * u, 0, 0, Math.PI * 2); // body
      x.fill();
      x.stroke();
      x.beginPath();
      x.arc(cx + 14 * u, cy - 12 * u, 15 * u, 0, Math.PI * 2); // head
      x.fill();
      x.stroke();
      x.fillStyle = '#f2a83a';
      x.beginPath();
      x.ellipse(cx - 12 * u, cy + 6 * u, 13 * u, 8 * u, -0.3, 0, Math.PI * 2); // wing
      x.fill();
      x.stroke();
      x.setLineDash([]);
      x.fillStyle = '#f08a3c';
      x.beginPath();
      x.moveTo(cx + 27 * u, cy - 15 * u);
      x.lineTo(cx + 38 * u, cy - 11 * u);
      x.lineTo(cx + 27 * u, cy - 7 * u);
      x.closePath();
      x.fill(); // beak
      x.fillStyle = '#2b2320';
      x.beginPath();
      x.arc(cx + 18 * u, cy - 15 * u, 2.6 * u, 0, Math.PI * 2);
      x.fill(); // a button eye
    } else {
      // the name patch: big embroidered letters with a stitched outline
      const size = Math.min(patchH * 0.42, (patchW * 1.6) / Math.max(4, title.length));
      x.font = `400 ${Math.round(size)}px ${font}`;
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.lineWidth = 5;
      x.strokeStyle = '#8f2f20';
      x.setLineDash([6, 4]);
      x.strokeText(title, px + patchW / 2, py + patchH / 2 + 4, patchW - 30);
      x.setLineDash([]);
      x.fillStyle = '#c8442f';
      x.fillText(title, px + patchW / 2, py + patchH / 2 + 4, patchW - 30);
    }
    // the quilting stitch around each patch, and the seam
    x.setLineDash([9, 6]);
    x.strokeStyle = 'rgba(70,45,25,0.6)';
    x.lineWidth = 3;
    x.strokeRect(px + 10, py + 10, patchW - 20, patchH - 20);
    x.setLineDash([]);
    x.strokeStyle = 'rgba(70,45,25,0.35)';
    x.lineWidth = 2;
    x.strokeRect(px, py, patchW, patchH);
  }
  // a stitch along the binding
  x.setLineDash([8, 6]);
  x.strokeStyle = 'rgba(255,236,210,0.85)';
  x.lineWidth = 2.5;
  x.strokeRect(bind / 2, bind / 2, W - bind, H - bind);
  x.setLineDash([]);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  const w = QUILT_W;
  const h = (w * H) / W;
  const cloth = new Mesh(new PlaneGeometry(w, h, 6, 6), new MeshStandardMaterial({ map: tex, roughness: 0.95 }));
  cloth.name = 'QuiltCloth';
  // a little sag and waviness so it reads as cloth, not a poster
  const pos = cloth.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    pos.setZ(i, 0.004 * Math.sin((vx / w) * Math.PI * 3) * (0.5 - vy / h) + 0.003 * (1 - Math.abs(vx / (w / 2))));
  }
  cloth.geometry.computeVertexNormals();
  cloth.position.y = -h / 2 - 0.008;
  g.add(cloth);
  // the dowel, with knobbed ends
  const wood = new MeshStandardMaterial({ color: 0xc8935a, roughness: 0.8 });
  const dowel = new Mesh(new CylinderGeometry(0.006, 0.006, w + 0.04, 12), wood);
  dowel.rotation.z = Math.PI / 2;
  g.add(dowel);
  for (const s of [-1, 1]) {
    const knob = new Mesh(new SphereGeometry(0.009, 12, 8), wood);
    knob.position.x = s * (w / 2 + 0.022);
    g.add(knob);
  }
  // fabric tabs looped over the dowel
  const tabMat = new MeshStandardMaterial({ color: 0xc8442f, roughness: 0.95 });
  for (const f of [-0.38, 0, 0.38]) {
    const tab = new Mesh(new CylinderGeometry(0.0085, 0.0085, 0.03, 12, 1, true, Math.PI * 0.15, Math.PI * 1.7), tabMat);
    tab.rotation.z = Math.PI / 2;
    tab.position.x = f * w;
    g.add(tab);
  }
  g.userData.height = h;
  return g;
}

export function disposeQuilt(g: Group): void {
  g.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    m.geometry.dispose();
    const mat = m.material as MeshStandardMaterial;
    mat.map?.dispose();
    mat.dispose();
  });
  g.removeFromParent();
}
