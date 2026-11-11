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
  TubeGeometry,
  CatmullRomCurve3,
  Vector3,
} from '@iwsdk/core';
import { WARPS } from '../config.js';
import { isLifted, type Mask8 } from '../puzzle/tieup.js';

export interface QuiltPanel {
  rows: readonly Mask8[];
  color: number;
}

/** Quilt width on the wall (m). */
export const QUILT_W = 0.36;

export function buildQuilt(title: string, panels: readonly QuiltPanel[], font = 'Lilita One, sans-serif'): Group {
  const g = new Group();
  g.name = 'Quilt';
  const cols = panels.length <= 3 ? panels.length : 2;
  const rowsN = Math.ceil(panels.length / cols);
  // canvas: panels of 8x6 cells, sashing between, a title strip at the bottom
  const cellPx = 22;
  const panelW = WARPS * cellPx;
  const panelH = 6 * cellPx;
  const sash = 26;
  const titleH = 54;
  const W = cols * panelW + (cols + 1) * sash;
  const H = rowsN * panelH + (rowsN + 1) * sash + titleH;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d')!;
  // cream sashing with a woven feel
  x.fillStyle = '#f3e7cf';
  x.fillRect(0, 0, W, H);
  let seed = 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 900; i++) {
    x.fillStyle = rnd() < 0.5 ? 'rgba(120,90,50,0.05)' : 'rgba(255,255,255,0.12)';
    x.fillRect(rnd() * W, rnd() * H, 3, 1);
  }
  panels.forEach((p, k) => {
    const px = sash + (k % cols) * (panelW + sash);
    const py = sash + Math.floor(k / cols) * (panelH + sash);
    // panel ground: undyed felt
    x.fillStyle = '#e8dcc3';
    x.fillRect(px, py, panelW, panelH);
    const n = p.rows.length;
    const top = py + (panelH - n * cellPx) / 2;
    const col = '#' + p.color.toString(16).padStart(6, '0');
    for (let r = 0; r < n; r++) {
      const y = top + (n - 1 - r) * cellPx; // row 0 at the bottom
      for (let i = 0; i < WARPS; i++) {
        if (!isLifted(p.rows[r], i)) continue;
        x.fillStyle = col;
        x.fillRect(px + i * cellPx + 1, y + 1, cellPx - 2, cellPx - 2);
        x.fillStyle = 'rgba(255,255,255,0.1)';
        x.fillRect(px + i * cellPx + 2, y + 2, cellPx - 6, 4);
      }
    }
    // a running stitch around each panel
    x.setLineDash([8, 6]);
    x.strokeStyle = 'rgba(110,80,50,0.7)';
    x.lineWidth = 2.5;
    x.strokeRect(px - 7, py - 7, panelW + 14, panelH + 14);
    x.setLineDash([]);
  });
  // stitched title along the bottom
  x.fillStyle = '#d9533c';
  x.fillRect(sash, H - titleH - sash * 0.4, W - 2 * sash, titleH - 8);
  x.setLineDash([7, 5]);
  x.strokeStyle = 'rgba(255,241,214,0.95)';
  x.lineWidth = 2.5;
  x.strokeRect(sash + 6, H - titleH - sash * 0.4 + 6, W - 2 * sash - 12, titleH - 20);
  x.setLineDash([]);
  x.fillStyle = '#fff4de';
  x.font = `400 ${Math.round(titleH * 0.55)}px ${font}`;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(title, W / 2, H - titleH / 2 - sash * 0.4 + 2);
  // binding edge
  x.strokeStyle = '#b9a07a';
  x.lineWidth = 8;
  x.strokeRect(4, 4, W - 8, H - 8);
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
  // twine up to a nail
  const twine = new Mesh(
    new TubeGeometry(new CatmullRomCurve3([new Vector3(-w * 0.42, 0, 0.002), new Vector3(0, 0.08, 0), new Vector3(w * 0.42, 0, 0.002)]), 16, 0.0012, 5),
    new MeshStandardMaterial({ color: 0x8b6a48, roughness: 0.9 }),
  );
  g.add(twine);
  const nail = new Mesh(new SphereGeometry(0.004, 8, 6), new MeshStandardMaterial({ color: 0x6e6a66, metalness: 0.6, roughness: 0.4 }));
  nail.position.set(0, 0.08, 0);
  g.add(nail);
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
