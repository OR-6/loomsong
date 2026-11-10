/**
 * Front-beam nameplate: "Level 4  ★ 12". Diegetic progress display (a
 * reason to come back), burnt into a little beech board leaning on the front beam.
 * Cap height ≥ 1.5 cm.
 */
import { CanvasTexture, Mesh, MeshStandardMaterial, PlaneGeometry, SRGBColorSpace } from '@iwsdk/core';
import { THEMES, type Theme } from './theme.js';

export const PLAQUE = { width: 0.15, height: 0.034, tiltDeg: 55 } as const;

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
    // A little beech board with burnt-in lettering.
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#f0d3a8');
    grad.addColorStop(1, '#ddb27e');
    g.fillStyle = grad;
    g.beginPath();
    g.roundRect(3, 3, c.width - 6, h - 6, h * 0.22);
    g.fill();
    g.save();
    g.clip();
    g.strokeStyle = 'rgba(150,95,50,0.16)';
    g.lineWidth = 2;
    for (let i = 0; i < 9; i++) {
      const y0 = (h * (i + 0.5)) / 9;
      g.beginPath();
      for (let x = 0; x <= c.width; x += 16) g.lineTo(x, y0 + Math.sin(x * 0.012 + i * 1.7) * h * 0.04);
      g.stroke();
    }
    g.restore();
    g.lineWidth = 5;
    g.strokeStyle = '#b07a46';
    g.beginPath();
    g.roundRect(3, 3, c.width - 6, h - 6, h * 0.22);
    g.stroke();
    g.textBaseline = 'middle';
    g.font = `400 ${Math.round(h * 0.66)}px ${th.font}`; // cap ≈ 1.6 cm
    const right = c.width - h * 0.35;
    // engraved: a light lip under dark burnt lettering
    for (const [dy, col] of [[2, 'rgba(255,240,215,0.8)'], [0, '#4a2e1c']] as const) {
      g.fillStyle = col;
      g.textAlign = 'left';
      g.fillText(`Level ${this.level + 1}`, h * 0.35, h * 0.54 + dy);
      g.textAlign = 'right';
      g.fillText(String(this.stars), right, h * 0.54 + dy);
    }
    g.fillStyle = th.ink;
    const w = g.measureText(String(this.stars)).width;
    star(g, right - w - h * 0.45, h * 0.5, h * 0.3, th.palette.knobs[1]);
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
