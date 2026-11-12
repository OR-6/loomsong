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
  /** Caller co-op: the picture is secret here; only woven rows show. */
  secret = false;
  /** Phone caller: threads they've pinned show a pin on the next row. */
  pinned = 0;
  /** Night: little stars twinkle in the margins. */
  sparkles = false;
  /** Optional paper tint for the chapter (e.g. a cool dusk for Night). */
  paper: string | null = null;

  /** The card's canvas (the phone caller shows it as a plain 2D image). */
  get element(): HTMLCanvasElement {
    return this.canvas;
  }

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
    const ground = this.sparkles ? '#f3f1fa' : this.paper ? '#f4ecda' : '#efe6d2'; // empty cells stay cream, even on Night's lavender card
    const grace = '#c9b79c';
    const px = (m: number) => m * PX_PER_M;
    g.clearRect(0, 0, c.width, c.height);

    // Card body (linen paper).
    g.fillStyle = highContrast ? '#ffffff' : (this.paper ?? th.paper);
    roundRect(g, 0, 0, c.width, c.height, px(0.006));
    g.fill();
    if (!highContrast) {
      // paper grain: flecks and fibres, so it reads as card stock, not a screen
      g.save();
      g.clip();
      g.fillStyle = g.createPattern(paperGrain(), 'repeat')!;
      g.fillRect(0, 0, c.width, c.height);
      g.restore();
    }
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
        const last = false; // (a red ring on the last knot read as failure: running out only costs stars)
        drawKnot(g, x0 + j * px(gap), y, px(r), i < this.par ? lift : grace, spent, highContrast, last);
      }
      // a live star meter beside the knots: the stars you'd get right now (knots buy stars)
      const live = this.used <= this.par ? 3 : this.used <= this.par + 2 ? 2 : 1;
      const sx = px(pad + markW + WARPS * cell + markW / 2);
      for (let i = 0; i < 3; i++) drawStar(g, sx, px(pad + titleH / 2 + (i - 1) * 0.0088), px(0.0052), i < live);
    }
    void title;

    const gridX = pad + markW;
    const gridTop = pad + titleH;
    this.layout = { gridX, gridTop, cell, rows, wM, hM };
    const nextRow = status.indexOf('todo');
    if (!highContrast) {
      // a pencil grid ruled by hand under the paint: it shows in the gaps, a hair off true
      g.save();
      g.strokeStyle = 'rgba(70,60,50,0.22)';
      g.lineWidth = px(0.00035);
      g.beginPath();
      for (let i = 0; i <= WARPS; i++) {
        const x = px(gridX + i * cell) + ((i * 37) % 5) - 2;
        g.moveTo(x, px(gridTop) - 3);
        g.lineTo(x + ((i * 13) % 3) - 1, px(gridTop + rows * cell) + 3);
      }
      for (let r = 0; r <= rows; r++) {
        const y = px(gridTop + r * cell) + ((r * 29) % 5) - 2;
        g.moveTo(px(gridX) - 3, y);
        g.lineTo(px(gridX + WARPS * cell) + 3, y + ((r * 11) % 3) - 1);
      }
      g.stroke();
      g.restore();
    }
    for (let r = 0; r < rows; r++) {
      // row 0 at the bottom
      const y = gridTop + (rows - 1 - r) * cell;
      const row = r < target.length ? target[r] : 0;
      const st = status[r];
      // caller co-op: rows still to weave are hidden here (only the phone sees the picture)
      const hidden = this.secret && st === 'todo';
      // the row to weave next sits on a soft yellow band (easier to find than the pin alone)
      if (r === nextRow && stars === 0 && !highContrast) {
        g.fillStyle = 'rgba(247,180,40,0.72)';
        roundRect(g, px(gridX - 0.002), px(y + 0.0006), px(WARPS * cell + 0.004), px(cell - 0.0012), px(cell * 0.2));
        g.fill();
        g.strokeStyle = '#c9861d';
        g.lineWidth = px(0.0009);
        g.stroke();
      }
      for (let i = 0; i < WARPS; i++) {
        const x = gridX + i * cell;
        const lifted = !hidden && isLifted(row, i);
        if (hidden) {
          g.fillStyle = (i + r) % 2 === 0 ? '#e6dcc6' : '#ddd1b8'; // a blank, checked swatch: ask your caller
        } else if (r >= target.length) {
          g.fillStyle = '#d8ccb8'; // extra row beyond target
        } else if (highContrast) {
          g.fillStyle = lifted ? '#000000' : '#ffffff';
        } else {
          // Sea: rows woven in the second weft show their water colour
          g.fillStyle = lifted ? lift : row & 256 && this.weft !== null ? hex(this.weft) : ground;
        }
        if (highContrast) {
          g.fillRect(px(x) + 1, px(y) + 1, px(cell) - 2, px(cell) - 2);
        } else {
          // painted squares with paper showing between them (no ruled grid): each a touch
          // uneven in size and tone, like gouache dabbed on card
          const j = ((i * 7 + r * 13) % 5) / 5; // deterministic wobble 0..1
          const j2 = ((i * 11 + r * 5) % 7) / 7;
          const gap = px(cell) * (0.07 + 0.03 * j);
          const sz = px(cell) - gap * 2;
          // stamped by hand: a hair of tilt, corners of mixed roundness
          g.save();
          g.translate(px(x) + gap + sz / 2, px(y) + gap * (1.2 - 0.4 * j) + sz / 2);
          g.rotate((j2 - 0.5) * 0.05);
          roundRect(g, -sz / 2, -sz / 2, sz, sz, px(cell) * (0.07 + 0.11 * j2));
          g.fill();
          g.fillStyle = `rgba(${j < 0.5 ? '255,255,255' : '60,40,20'},${0.04 + 0.04 * j})`;
          g.fill();
          if (lifted) {
            // the paint pools a little at the edge, as gouache does
            g.strokeStyle = 'rgba(40,25,15,0.16)';
            g.lineWidth = px(0.00045);
            g.stroke();
          }
          g.restore();
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
      if (r === nextRow && stars === 0) drawPin(g, px(pad + markW / 2), cy, px(0.0075));
      if (r === nextRow && stars === 0 && this.pinned) {
        for (let i = 0; i < WARPS; i++) if ((this.pinned >> i) & 1) drawPinHead(g, px(gridX + i * cell + cell / 2), cy, px(cell * 0.36));
      }
    }
    this.tex.needsUpdate = true;
    this.sizeW = wM;
    this.sizeH = hM;
    this.mesh.scale.set(wM * this.pop, hM * this.pop, 1);
  }

  private layout = { gridX: 0, gridTop: 0, cell: 0, rows: 0, wM: 1, hM: 1 };

  /** Row r's middle in the card mesh's own (unit-plane) space, a hair in front of the paper; null past the last row. */
  rowLocal(r: number, out: { x: number; y: number; z: number; set(x: number, y: number, z: number): unknown }): boolean {
    const L = this.layout;
    if (r < 0 || r >= L.rows) return false;
    const y = L.gridTop + (L.rows - 1 - r) * L.cell + L.cell / 2;
    out.set((L.gridX + (WARPS * L.cell) / 2) / L.wM - 0.5, 0.5 - y / L.hM, 0.004);
    return true;
  }

  /** The cell under a point on the card's canvas (0..1 across, 0..1 down), or null. */
  cellAt(u: number, v: number): { r: number; i: number } | null {
    const L = this.layout;
    const x = u * L.wM - L.gridX;
    const y = v * L.hM - L.gridTop;
    const i = Math.floor(x / L.cell);
    const rr = Math.floor(y / L.cell);
    if (i < 0 || i >= WARPS || rr < 0 || rr >= L.rows) return null;
    return { r: L.rows - 1 - rr, i };
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

/** A dressmaker's pin pushed into the card beside the next row: a red glass head and a steel shaft pointing at it. */
function drawPin(g: CanvasRenderingContext2D, x: number, y: number, s: number) {
  g.save();
  g.strokeStyle = '#8a8f96';
  g.lineWidth = s * 0.22;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(x - s * 0.55, y);
  g.lineTo(x + s * 1.15, y);
  g.stroke();
  g.fillStyle = '#d9533c';
  g.beginPath();
  g.arc(x - s * 0.6, y, s * 0.55, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.beginPath();
  g.arc(x - s * 0.78, y - s * 0.18, s * 0.16, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

let grain: HTMLCanvasElement | null = null;
/** A small tile of paper grain (flecks and short fibres), drawn once. */
function paperGrain(): HTMLCanvasElement {
  if (grain) return grain;
  grain = document.createElement('canvas');
  grain.width = grain.height = 128;
  const g = grain.getContext('2d')!;
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < 520; k++) {
    g.fillStyle = rnd() < 0.5 ? `rgba(90,70,50,${0.05 + rnd() * 0.07})` : `rgba(255,255,255,${0.08 + rnd() * 0.1})`;
    g.fillRect(rnd() * 128, rnd() * 128, 1 + rnd() * 1.5, 1 + rnd() * 1.5);
  }
  g.lineWidth = 0.6;
  for (let k = 0; k < 26; k++) {
    const x = rnd() * 128;
    const y = rnd() * 128;
    const a = rnd() * Math.PI;
    g.strokeStyle = `rgba(110,90,70,${0.06 + rnd() * 0.06})`;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a) * 4 + 2, y + Math.sin(a) * 4 - 2, x + Math.cos(a) * 9, y + Math.sin(a) * 9);
    g.stroke();
  }
  return grain;
}

/** A dressmaker's pin seen from above: a felt ball head with a highlight (the caller's mark on a thread). */
function drawPinHead(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.save();
  g.fillStyle = 'rgba(40,20,10,0.35)';
  g.beginPath();
  g.arc(x + r * 0.15, y + r * 0.2, r, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#e2563b';
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#7a2a1c';
  g.lineWidth = r * 0.16;
  g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.6)';
  g.beginPath();
  g.arc(x - r * 0.35, y - r * 0.35, r * 0.28, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

export function drawArrow(g: CanvasRenderingContext2D, x: number, y: number, s: number) {
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

function drawKnot(g: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, spent: boolean, hc: boolean, last = false) {
  g.save();
  g.lineCap = 'round';
  g.lineJoin = 'round';
  if (!spent) {
    // a little bow of yarn: two loops, the knot, two tails; each lever move unties one
    const yarn = (w: number, c: string) => {
      g.lineWidth = w;
      g.strokeStyle = c;
      g.beginPath();
      g.ellipse(x - r * 0.55, y - r * 0.12, r * 0.55, r * 0.36, -0.35, 0, Math.PI * 2);
      g.moveTo(x + r * 1.1, y - r * 0.12);
      g.ellipse(x + r * 0.55, y - r * 0.12, r * 0.55, r * 0.36, 0.35, 0, Math.PI * 2);
      g.moveTo(x - r * 0.08, y + r * 0.1);
      g.quadraticCurveTo(x - r * 0.35, y + r * 0.55, x - r * 0.62, y + r * 0.95);
      g.moveTo(x + r * 0.08, y + r * 0.1);
      g.quadraticCurveTo(x + r * 0.35, y + r * 0.55, x + r * 0.62, y + r * 0.95);
      g.stroke();
    };
    yarn(r * (hc ? 0.62 : 0.5), '#3b2a20'); // an ink edge
    yarn(r * (hc ? 0.4 : 0.32), hc ? '#000000' : color);
    g.fillStyle = hc ? '#000000' : color;
    g.strokeStyle = '#3b2a20';
    g.lineWidth = r * 0.12;
    g.beginPath();
    g.arc(x, y - r * 0.05, r * 0.24, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    if (last) {
      // the last knot left: a red ring round it (the next move costs a star)
      g.lineWidth = r * 0.16;
      g.strokeStyle = '#d9533c';
      g.beginPath();
      g.arc(x, y + r * 0.1, r * 1.25, 0, Math.PI * 2);
      g.stroke();
    }
  } else {
    // untied: just a faint ring where the bow was
    g.lineWidth = r * 0.14;
    g.strokeStyle = 'rgba(59,42,32,0.28)';
    g.beginPath();
    g.arc(x, y, r * 0.42, 0, Math.PI * 2);
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
