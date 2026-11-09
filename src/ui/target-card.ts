/**
 * Target card: a small standing card that shows the pattern to weave.
 * Row 0 (first woven, nearest the user on the cloth) is drawn at the
 * bottom, so the card reads like the cloth.
 *
 * Status is never colour-only: next row = arrow; woven match = tick;
 * mismatch = cross plus a hatched row.
 */
import { CanvasTexture, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace } from '@iwsdk/core';
import { CARD, WARPS } from '../config.js';
import type { Palette } from '../loom/loom-view.js';
import { DISPLAY_FONT } from './fonts.js';
import type { RowStatus } from '../puzzle/session.js';
import { isLifted, type Mask8 } from '../puzzle/tieup.js';

const PX_PER_M = 3200; // canvas resolution

export class TargetCard {
  readonly mesh: Mesh;
  private canvas = document.createElement('canvas');
  private ctx: CanvasRenderingContext2D;
  private tex: CanvasTexture;
  private geo: PlaneGeometry;
  heightM = 0.1;

  constructor(private palette: Palette) {
    this.ctx = this.canvas.getContext('2d')!;
    this.tex = new CanvasTexture(this.canvas);
    this.tex.colorSpace = SRGBColorSpace;
    this.geo = new PlaneGeometry(1, 1);
    this.mesh = new Mesh(
      this.geo,
      new MeshBasicMaterial({ map: this.tex, transparent: true, depthWrite: true }),
    );
    this.mesh.name = 'TargetCard';
  }

  /**
   * @param stars 0 while playing; 1–3 after a win.
   * @param highContrast thicker outlines and pure black/white cells.
   */
  draw(
    title: string,
    target: readonly Mask8[],
    status: readonly RowStatus[],
    stars: number,
    highContrast = false,
  ): void {
    const cell = CARD.cell;
    const pad = 0.008;
    const markW = 0.012; // left arrow / right tick column
    const titleH = 0.014;
    const rows = status.length;
    const wM = pad * 2 + markW * 2 + cell * WARPS;
    const hM = pad * 2 + titleH + cell * rows;
    this.heightM = hM;
    const c = this.canvas;
    const w = Math.round(wM * PX_PER_M);
    const h = Math.round(hM * PX_PER_M);
    if (w !== c.width || h !== c.height) {
      c.width = w;
      c.height = h;
      this.tex.dispose(); // size changed: force a fresh GPU texture
    }
    const g = this.ctx;
    const px = (m: number) => m * PX_PER_M;
    g.clearRect(0, 0, c.width, c.height);

    // Card body (linen paper).
    g.fillStyle = highContrast ? '#ffffff' : '#fff6e8'; // cream paper
    roundRect(g, 0, 0, c.width, c.height, px(0.006));
    g.fill();
    g.lineWidth = px(highContrast ? 0.0015 : 0.0008);
    g.strokeStyle = '#2b2118';
    g.stroke();

    // Title or stars.
    g.fillStyle = '#3b2a20';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    if (stars > 0) {
      for (let i = 0; i < 3; i++) {
        drawStar(g, c.width / 2 + (i - 1) * px(0.014), px(pad + titleH / 2), px(0.0055), i < stars);
      }
    } else {
      g.font = `400 ${Math.round(px(0.0095))}px ${DISPLAY_FONT}`;
      g.fillText(title, c.width / 2, px(pad + titleH / 2));
    }

    const gridX = pad + markW;
    const gridTop = pad + titleH;
    const nextRow = status.indexOf('todo');
    for (let r = 0; r < rows; r++) {
      // row 0 at the bottom
      const y = gridTop + (rows - 1 - r) * cell;
      const row = r < target.length ? target[r] : 0;
      const st = status[r];
      for (let i = 0; i < WARPS; i++) {
        const x = gridX + i * cell;
        const lifted = isLifted(row, i);
        if (r >= target.length) {
          g.fillStyle = '#d8ccb8'; // extra row beyond target
        } else if (highContrast) {
          g.fillStyle = lifted ? '#ffffff' : '#000000';
        } else {
          g.fillStyle = hex(lifted ? this.palette.warp : this.palette.weft);
        }
        g.fillRect(px(x) + 1, px(y) + 1, px(cell) - 2, px(cell) - 2);
        if (highContrast) {
          g.strokeStyle = '#000';
          g.lineWidth = 2;
          g.strokeRect(px(x) + 1, px(y) + 1, px(cell) - 2, px(cell) - 2);
        }
      }
      const cy = px(y + cell / 2);
      if (st === 'match') drawTick(g, px(gridX + WARPS * cell + markW / 2), cy, px(0.0035));
      if (st === 'miss') {
        drawCross(g, px(gridX + WARPS * cell + markW / 2), cy, px(0.0032));
        // hatch the row so a miss reads without colour
        g.save();
        g.strokeStyle = 'rgba(30,20,10,0.85)';
        g.lineWidth = px(0.0006);
        g.beginPath();
        for (let x = 0; x < WARPS * cell; x += 0.003) {
          g.moveTo(px(gridX + x), px(y + cell));
          g.lineTo(px(gridX + x + cell * 0.6), px(y));
        }
        g.stroke();
        g.restore();
      }
      if (r === nextRow && stars === 0) drawArrow(g, px(pad + markW / 2), cy, px(0.0035));
    }
    this.tex.needsUpdate = true;
    this.mesh.scale.set(wM, hM, 1);
  }
}

function hex(n: number): string {
  return '#' + n.toString(16).padStart(6, '0');
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function drawTick(g: CanvasRenderingContext2D, x: number, y: number, s: number) {
  g.save();
  g.strokeStyle = '#2f5d34';
  g.lineWidth = s * 0.45;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(x - s, y);
  g.lineTo(x - s * 0.25, y + s * 0.8);
  g.lineTo(x + s, y - s * 0.8);
  g.stroke();
  g.restore();
}

function drawCross(g: CanvasRenderingContext2D, x: number, y: number, s: number) {
  g.save();
  g.strokeStyle = '#7a1e1e';
  g.lineWidth = s * 0.45;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(x - s, y - s);
  g.lineTo(x + s, y + s);
  g.moveTo(x + s, y - s);
  g.lineTo(x - s, y + s);
  g.stroke();
  g.restore();
}

function drawArrow(g: CanvasRenderingContext2D, x: number, y: number, s: number) {
  g.save();
  g.fillStyle = '#3b2a20';
  g.beginPath();
  g.moveTo(x - s * 0.7, y - s);
  g.lineTo(x + s, y);
  g.lineTo(x - s * 0.7, y + s);
  g.closePath();
  g.fill();
  g.restore();
}

function drawStar(g: CanvasRenderingContext2D, x: number, y: number, r: number, filled: boolean) {
  g.save();
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
  g.fillStyle = filled ? '#c9a14a' : 'transparent';
  if (filled) g.fill();
  g.lineWidth = r * 0.18;
  g.strokeStyle = '#3b2a20';
  g.stroke();
  g.restore();
}
