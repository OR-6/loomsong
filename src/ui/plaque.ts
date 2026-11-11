/**
 * Front-beam nameplate: the name of the picture on the loom ("Heart"), painted
 * on a little wooden slat (walnut edges, a cream painted face with the grain
 * showing through, two nail heads) lying in front of the loom. Cap height ≥ 1.5 cm.
 */
import { BoxGeometry, CanvasTexture, Mesh, MeshStandardMaterial, SRGBColorSpace } from '@iwsdk/core';
import { THEMES, type Theme } from './theme.js';

export const PLAQUE = { width: 0.118, height: 0.032, thick: 0.005, tiltDeg: 55 } as const;

export class Plaque {
  readonly mesh: Mesh;
  private canvas = document.createElement('canvas');
  private tex: CanvasTexture;
  private theme: Theme = THEMES.toy;
  private name = '';

  constructor() {
    this.canvas.width = 640;
    this.canvas.height = Math.round((640 * PLAQUE.height) / PLAQUE.width); // the slat face's own aspect
    this.tex = new CanvasTexture(this.canvas);
    this.tex.colorSpace = SRGBColorSpace;
    // a slat of wood: walnut on every side, the painted face on top (+z)
    const edge = new MeshStandardMaterial({ color: 0x7a4a2c, roughness: 0.9, envMapIntensity: 0.3 });
    const face = new MeshStandardMaterial({ map: this.tex, roughness: 0.9, envMapIntensity: 0.3 });
    this.mesh = new Mesh(new BoxGeometry(PLAQUE.width, PLAQUE.height, PLAQUE.thick), [edge, edge, edge, edge, face, edge]);
    this.mesh.position.z = 0;
    this.mesh.castShadow = true;
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
    // the slat's face: walnut showing at the edges, cream paint brushed on, the grain through it
    g.fillStyle = '#7a4a2c';
    g.fillRect(0, 0, c.width, h);
    g.fillStyle = '#fff2dc';
    g.beginPath();
    g.roundRect(10, 9, c.width - 20, h - 18, h * 0.12);
    g.fill();
    let seed = 5;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 18; i++) {
      const y = 12 + rnd() * (h - 24);
      g.strokeStyle = `rgba(120,80,40,${0.05 + rnd() * 0.06})`;
      g.lineWidth = 1 + rnd() * 2;
      g.beginPath();
      g.moveTo(12, y);
      for (let x = 12; x <= c.width - 12; x += 40) g.lineTo(x, y + Math.sin(x * 0.03 + i) * 2);
      g.stroke();
    }
    // two nail heads holding it to the loom
    for (const x of [h * 0.34, c.width - h * 0.34]) {
      g.fillStyle = '#8d8f93';
      g.beginPath();
      g.arc(x, h / 2, h * 0.075, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.5)';
      g.beginPath();
      g.arc(x - h * 0.02, h / 2 - h * 0.02, h * 0.025, 0, Math.PI * 2);
      g.fill();
    }
    g.textBaseline = 'middle';
    g.font = `400 ${Math.round(h * 0.66)}px ${th.font}`; // cap ≈ 1.6 cm
    g.fillStyle = '#3b2a1c';
    g.textAlign = 'center';
    g.fillText(this.name, c.width / 2, h * 0.54, c.width - h * 1.0); // clear of the nails
    this.tex.needsUpdate = true;
  }
}
