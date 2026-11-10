/**
 * Target card: a small standing card that shows the pattern to weave.
 * Row 0 (first woven, nearest the user on the cloth) is drawn at the
 * bottom, so the card reads like the cloth.
 *
 * Status is never colour-only: next row = arrow; woven match = tick;
 * mismatch = cross plus a hatched row.
 */
import { BoxGeometry, CanvasTexture, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, SRGBColorSpace } from '@iwsdk/core';
import { CARD, WARPS } from '../config.js';
import type { Theme } from './theme.js';
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

  private last: Parameters<TargetCard['draw']> | null = null;
  /** Picture colour for lifted cells (null: theme weft). */
  private color: number | null = null;
  /** Thread budget: par knots + 2 grace knots; each lever move unties one. */
  private par = 0;
  private used = 0;

  /** Second weft colour for '~' rows (Sea), or null. */
  weft: number | null = null;
  /** Night: little stars twinkle in the margins. */
  sparkles = false;
  /** Optional paper tint for the chapter (e.g. a cool dusk for Night). */
  paper: string | null = null;

  setPicture(color: number | null, par: number): void {
    this.color = color;
    this.par = par;
    this.used = 0;
  }

  /** Lever moves so far; redraws only when it changes. */
  setUsed(n: number): void {
    if (n === this.used) return;
    this.used = n;
    if (this.last) this.draw(...this.last);
  }

  constructor(private theme: Theme) {
    this.ctx = this.canvas.getContext('2d')!;
    this.tex = new CanvasTexture(this.canvas);
    this.tex.colorSpace = SRGBColorSpace;
    this.geo = new PlaneGeometry(1, 1);
    this.mesh = new Mesh(
      this.geo,
      new MeshBasicMaterial({ map: this.tex, transparent: true, depthWrite: true }),
    );
    this.mesh.name = 'TargetCard';
    // Kraft cardboard backing: gives the paper card an edge and some thickness.
    const back = new Mesh(new BoxGeometry(1.03, 1.03, 0.0025), new MeshStandardMaterial({ color: 0xc89c6c, roughness: 0.9 }));
    back.position.z = -0.0016;
    back.name = 'CardBacking';
    this.mesh.add(back);
  }

  /**
   * @param stars 0 while playing; 1–3 after a win.
   * @param highContrast thicker outlines and pure black/white cells.
   */
  setTheme(theme: Theme): void {
    this.theme = theme;
    if (this.last) this.draw(...this.last);
  }

  draw(
    title: string,
    target: readonly Mask8[],
    status: readonly RowStatus[],
    stars: number,
    highContrast = false,
  ): void {
    this.last = [title, [...target], [...status], stars, highContrast];
    const th = this.theme;
    const cell = CARD.cell;
    const pad = 0.008;
    const markW = 0.021; // left arrow / right tick column (big enough to read from the seat)
    // Only glyphs on the card (stars after a win); words live on the plaque,
    // where they can meet the 1.5 cm cap-height rule.
    const titleH = stars > 0 || this.par > 0 ? 0.026 : 0;
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
    const lift = hex(this.color ?? th.palette.weft);
    // empty cells take a little of the chapter paper tint (Night's cells read dusk, not white)
    // empty cells: Night's are a pale moonlit lilac so the picture pops on the dusk paper
    const ground = this.sparkles ? '#f3f1fa' : this.paper ? mixHex('#efe6d2', this.paper, 0.5) : '#efe6d2';
    const grace = '#c9b79c';
    const px = (m: number) => m * PX_PER_M;
    g.clearRect(0, 0, c.width, c.height);

    // Card body (linen paper).
    g.fillStyle = highContrast ? '#ffffff' : (this.paper ?? th.paper);
    roundRect(g, 0, 0, c.width, c.height, px(0.006));
    g.fill();
    g.lineWidth = px(highContrast ? 0.0015 : 0.0008);
    g.strokeStyle = th.ink;
    g.stroke();
    if (this.sparkles && !highContrast) {
      // Night: a few little stars in the card's margins
      for (const [fx, fy, r] of NIGHT_STARS) drawTwinkle(g, fx * c.width, fy * c.height, px(r));
    }

    // Title or stars.
    g.fillStyle = th.ink;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    if (stars > 0) {
      for (let i = 0; i < 3; i++) {
        drawStar(g, c.width / 2 + (i - 1) * px(0.026), px(pad + titleH / 2), px(0.0112), i < stars);
      }
    }
    else if (this.par > 0) {
      // Yarn knots: par (solid) + 2 grace (lighter); spent knots go hollow.
      const total = this.par + 2;
      // long budgets wrap onto two rows instead of shrinking into specks
      const lines = total > 8 ? 2 : 1;
      const perRow = Math.ceil(total / lines);
      const gap = Math.min(0.021, (WARPS * cell) / perRow);
      const r = lines === 2 ? Math.min(0.0064, gap * 0.42) : Math.min(0.0085, gap * 0.42);
      for (let i = 0; i < total; i++) {
        const line = Math.floor(i / perRow);
        const j = i - line * perRow;
        const inRow = line === lines - 1 ? total - line * perRow : perRow;
        const x0 = c.width / 2 - ((inRow - 1) * px(gap)) / 2;
        const y = px(pad + titleH / 2 + (lines === 2 ? (line - 0.5) * 0.0134 : 0));
        const spent = i >= total - this.used;
        drawKnot(g, x0 + j * px(gap), y, px(r), i < this.par ? lift : grace, spent, highContrast);
      }
      // a live star meter beside the knots: the stars you'd get right now (knots buy stars)
      const live = this.used <= this.par ? 3 : this.used <= this.par + 2 ? 2 : 1;
      const sx = px(pad + markW + WARPS * cell + markW / 2);
      for (let i = 0; i < 3; i++) drawStar(g, sx, px(pad + titleH / 2 + (i - 1) * 0.0088), px(0.0052), i < live);
    }
    void title;

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
          g.fillStyle = lifted ? '#000000' : '#ffffff';
        } else {
          // Sea: rows woven in the second weft show their water colour
          g.fillStyle = lifted ? lift : row & 256 && this.weft !== null ? hex(this.weft) : ground;
        }
        g.fillRect(px(x) + 1, px(y) + 1, px(cell) - 2, px(cell) - 2);
        if (!highContrast) {
          // a faint grid: count columns against the threads
          g.strokeStyle = this.sparkles ? '#b8b2d8' : '#d8cbb0';
          g.lineWidth = 1.5;
          g.strokeRect(px(x) + 1, px(y) + 1, px(cell) - 2, px(cell) - 2);
        }
        if (highContrast) {
          g.strokeStyle = '#000';
          g.lineWidth = 2;
          g.strokeRect(px(x) + 1, px(y) + 1, px(cell) - 2, px(cell) - 2);
        }
      }
      const cy = px(y + cell / 2);
      if (st === 'match') drawTick(g, px(gridX + WARPS * cell + markW / 2), cy, px(0.0075));
      if (st === 'miss') {
        drawCross(g, px(gridX + WARPS * cell + markW / 2), cy, px(0.007));
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
      if (r === nextRow && stars === 0) drawArrow(g, px(pad + markW / 2), cy, px(0.0075));
    }
    this.tex.needsUpdate = true;
    this.sizeW = wM;
    this.sizeH = hM;
    this.mesh.scale.set(wM * this.pop, hM * this.pop, 1);
  }

  /** Card size in metres (its mesh is a unit plane scaled to this). */
  sizeW = 0.2;
  sizeH = 0.2;
  /** Arrival spring multiplier (1 at rest). */
  pop = 1;
  setPop(p: number): void {
    this.pop = p;
    this.mesh.scale.set(this.sizeW * p, this.sizeH * p, 1);
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

function drawKnot(g: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, spent: boolean, hc: boolean) {
  g.save();
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.lineWidth = r * (hc ? 0.5 : 0.35);
  g.strokeStyle = '#3b2a20';
  if (!spent) {
    g.fillStyle = color;
    g.fill();
    // a little twist line so it reads as yarn, not a dot
    g.stroke();
    g.beginPath();
    g.moveTo(x - r * 0.6, y + r * 0.4);
    g.quadraticCurveTo(x, y - r * 0.5, x + r * 0.6, y + r * 0.4);
    g.strokeStyle = 'rgba(255,255,255,0.7)';
    g.lineWidth = r * 0.25;
    g.stroke();
  } else {
    // spent: an empty, solid pale slot (not a dashed outline that reads as overlap)
    g.fillStyle = '#e4dccb';
    g.fill();
    g.lineWidth = r * 0.18;
    g.strokeStyle = 'rgba(59,42,32,0.35)';
    g.stroke();
  }
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
  g.fillStyle = filled ? '#f5b82e' : 'transparent';
  if (filled) g.fill();
  g.lineWidth = r * 0.2;
  g.strokeStyle = filled ? '#7a4a12' : '#3b2a20';
  g.stroke();
  g.restore();
}

/** Mix two '#rrggbb' colours (t = 0 → a, 1 → b). */
function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  let out = 0;
  for (const sh of [16, 8, 0]) {
    const ca = (pa >> sh) & 255;
    const cb = (pb >> sh) & 255;
    out |= Math.round(ca + (cb - ca) * t) << sh;
  }
  return '#' + out.toString(16).padStart(6, '0');
}

/** Margin stars for the Night card: (x, y) as fractions of the card, radius in m. */
const NIGHT_STARS: [number, number, number][] = [
  [0.05, 0.06, 0.0085],
  [0.95, 0.07, 0.007],
  [0.045, 0.36, 0.006],
  [0.955, 0.3, 0.0075],
  [0.04, 0.66, 0.0072],
  [0.96, 0.62, 0.006],
  [0.06, 0.94, 0.0068],
  [0.94, 0.93, 0.0082],
];

/** A soft four-point twinkle. */
function drawTwinkle(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.save();
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 4;
    const rr = i % 2 === 0 ? r : r * 0.32;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
  g.fillStyle = '#ffe6a0';
  g.fill();
  g.lineWidth = r * 0.16;
  g.strokeStyle = '#b89a4a';
  g.stroke();
  g.restore();
}
