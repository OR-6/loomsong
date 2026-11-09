/**
 * Canvas-texture text label (no font files, no UI kit). Text ≤ 5 words,
 * cap height ≥ 1.5 cm at the chosen world height.
 */
import { CanvasTexture, Mesh, MeshBasicMaterial, PlaneGeometry } from '@iwsdk/core';
import { DISPLAY_FONT } from './fonts.js';

export class Label {
  readonly mesh: Mesh;
  private canvas = document.createElement('canvas');
  private ctx: CanvasRenderingContext2D;
  private tex: CanvasTexture;
  private text = '';

  /** @param heightM world height of the label quad; cap height ≈ 0.5 × this. */
  constructor(public widthM = 0.2, public heightM = 0.035) {
    this.canvas.width = 1024;
    this.canvas.height = Math.round((1024 * heightM) / widthM);
    this.ctx = this.canvas.getContext('2d')!;
    this.tex = new CanvasTexture(this.canvas);
    this.mesh = new Mesh(
      new PlaneGeometry(widthM, heightM),
      new MeshBasicMaterial({ map: this.tex, transparent: true, depthWrite: false }),
    );
    this.mesh.renderOrder = 10;
  }

  set(text: string): void {
    if (text === this.text) return;
    this.text = text;
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const h = canvas.height;
    ctx.fillStyle = 'rgba(43,33,24,0.82)'; // ink
    roundRect(ctx, 0, 0, canvas.width, h, h * 0.3);
    ctx.fill();
    ctx.fillStyle = '#fff4e0';
    ctx.font = `400 ${Math.round(h * 0.66)}px ${DISPLAY_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, h * 0.54);
    this.tex.needsUpdate = true;
    this.mesh.visible = text.length > 0;
  }
}

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
