/**
 * Front-beam nameplate: "Level 4  ★ 12". Diegetic progress display (a
 * reason to come back), printed on a little toy plate leaning on the front rail.
 * Cap height ≥ 1.5 cm.
 */
import { CanvasTexture, Mesh, MeshStandardMaterial, PlaneGeometry, SRGBColorSpace } from '@iwsdk/core';
import { THEMES, type Theme } from './theme.js';

export const PLAQUE = { width: 0.11, height: 0.025, tiltDeg: 55 } as const;

export class Plaque {
  readonly mesh: Mesh;
  private canvas = document.createElement('canvas');
  private tex: CanvasTexture;
  private theme: Theme = THEMES.toy;
  private level = 0;
  private stars = 0;

  constructor() {
    this.canvas.width = 640;
    this.canvas.height = Math.round((512 * PLAQUE.height) / PLAQUE.width);
    this.tex = new CanvasTexture(this.canvas);
    this.tex.colorSpace = SRGBColorSpace;
    this.mesh = new Mesh(
      new PlaneGeometry(PLAQUE.width, PLAQUE.height),
      new MeshStandardMaterial({ map: this.tex, roughness: 0.8, transparent: true }),
    );
    this.mesh.name = 'Plaque';
  }

  setTheme(theme: Theme): void {
    this.theme = theme;
    this.draw();
  }

  set(level: number, stars: number): void {
    this.level = level;
    this.stars = stars;
    this.draw();
  }

  /** Stars glint after a win (visual twin for the arpeggio). */
  private draw(): void {
    const c = this.canvas;
    const g = c.getContext('2d')!;
    const th = this.theme;
    const h = c.height;
    g.clearRect(0, 0, c.width, h);
    // A toy name plate: cream, rounded, with a navy edge (same family as the tray).
    g.fillStyle = '#fff2dc';
    g.beginPath();
    g.roundRect(4, 4, c.width - 8, h - 8, h * 0.3);
    g.fill();
    g.lineWidth = 7;
    g.strokeStyle = '#34507a';
    g.stroke();
    g.textBaseline = 'middle';
    g.font = `400 ${Math.round(h * 0.66)}px ${th.font}`; // cap ≈ 1.6 cm
    const right = c.width - h * 0.35;
    for (const [dy, col] of [[0, '#34507a']] as const) {
      g.fillStyle = col;
      g.textAlign = 'left';
      g.fillText(`Level ${this.level + 1}`, h * 0.35, h * 0.54 + dy);
      g.textAlign = 'right';
      g.fillText(String(this.stars), right, h * 0.54 + dy);
    }
    g.fillStyle = th.ink;
    const w = g.measureText(String(this.stars)).width;
    star(g, right - w - h * 0.45, h * 0.5, h * 0.3, 0xf7be3b);
    this.tex.needsUpdate = true;
  }
}

function star(g: CanvasRenderingContext2D, x: number, y: number, r: number, fill: number) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
  g.fillStyle = '#' + fill.toString(16).padStart(6, '0');
  g.fill();
  g.lineWidth = 3;
  g.stroke();
}
