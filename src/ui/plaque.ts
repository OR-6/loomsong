/**
 * Front-beam nameplate: the name of the picture on the loom ("Heart"),
 * printed on a little toy plate leaning on the front rail. Cap height ≥ 1.5 cm.
 */
import { CanvasTexture, Mesh, MeshStandardMaterial, PlaneGeometry, SRGBColorSpace } from '@iwsdk/core';
import { THEMES, type Theme } from './theme.js';

export const PLAQUE = { width: 0.14, height: 0.032, tiltDeg: 55 } as const;

export class Plaque {
  readonly mesh: Mesh;
  private canvas = document.createElement('canvas');
  private tex: CanvasTexture;
  private theme: Theme = THEMES.toy;
  private name = '';

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

  set(name: string): void {
    if (name === this.name) return;
    this.name = name;
    this.draw();
  }

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
    g.fillStyle = '#34507a';
    g.textAlign = 'center';
    g.fillText(this.name, c.width / 2, h * 0.54, c.width - h * 0.7);
    this.tex.needsUpdate = true;
  }
}
