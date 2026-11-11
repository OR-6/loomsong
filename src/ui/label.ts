/**
 * Canvas-texture text label drawn as a paper tag (no UI kit). Text ≤ 5 words,
 * cap height ≥ 1.5 cm at the chosen world height.
 */
import { CanvasTexture, Mesh, MeshBasicMaterial, PlaneGeometry } from '@iwsdk/core';
import { THEMES, type Theme } from './theme.js';

export class Label {
  readonly mesh: Mesh;
  private canvas = document.createElement('canvas');
  private ctx: CanvasRenderingContext2D;
  private tex: CanvasTexture;
  private text = '';
  private theme: Theme = THEMES.toy;

  setTheme(theme: Theme): void {
    this.theme = theme;
    const t = this.text;
    this.text = '\u0000';
    this.set(t);
  }

  /** @param heightM world height of the label quad; cap height ≈ 0.5 × this. */
  /** 'tag': a paper luggage tag (hints); 'ribbon': a gold celebration banner. */
  style: 'tag' | 'ribbon' = 'tag';

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
    this.mesh.visible = text.length > 0;
    if (!text) {
      this.tex.needsUpdate = true;
      return;
    }
    if (this.style === 'ribbon') {
      this.drawRibbon(text);
      return;
    }
    // A paper luggage tag: cream card sized to the words, notched left end
    // with a punched hole and a loop of yarn, ink lettering.
    const h = canvas.height;
    const pad = h * 0.34;
    const hole = h * 0.62;
    ctx.font = `400 ${Math.round(h * 0.6)}px ${this.theme.font}`;
    const tw = Math.min(canvas.width - hole - pad * 2 - 8, ctx.measureText(text).width);
    const w = hole + tw + pad * 1.6;
    const x0 = (canvas.width - w) / 2;
    const y0 = h * 0.08;
    const th = h * 0.84;
    const notch = th * 0.32;
    const tag = (dx: number, dy: number) => {
      ctx.beginPath();
      ctx.moveTo(x0 + notch + dx, y0 + dy);
      ctx.lineTo(x0 + w - th * 0.16 + dx, y0 + dy);
      ctx.arcTo(x0 + w + dx, y0 + dy, x0 + w + dx, y0 + th + dy, th * 0.16);
      ctx.arcTo(x0 + w + dx, y0 + th + dy, x0 + dx, y0 + th + dy, th * 0.16);
      ctx.lineTo(x0 + notch + dx, y0 + th + dy);
      ctx.lineTo(x0 + dx, y0 + th - notch + dy);
      ctx.lineTo(x0 + dx, y0 + notch + dy);
      ctx.closePath();
    };
    // soft drop shadow, then the card
    ctx.fillStyle = 'rgba(60,35,20,0.28)';
    tag(h * 0.03, h * 0.05);
    ctx.fill();
    ctx.fillStyle = this.theme.paper;
    tag(0, 0);
    ctx.fill();
    ctx.lineWidth = h * 0.025;
    ctx.strokeStyle = 'rgba(90,60,35,0.35)';
    ctx.stroke();
    // punched hole with a yarn loop through it
    const hx = x0 + hole * 0.62;
    const hy = y0 + th / 2;
    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(hx, hy, th * 0.11, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#e2563b';
    ctx.lineWidth = h * 0.05;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(hx - th * 0.12, hy, th * 0.12, -Math.PI * 0.55, Math.PI * 0.55, true);
    ctx.stroke();
    ctx.fillStyle = this.theme.ink;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x0 + hole + pad * 0.5, y0 + th * 0.56, tw);
    this.tex.needsUpdate = true;
  }

  /** A gold ribbon banner with folded tails and a star at each end (celebrations). */
  private drawRibbon(text: string): void {
    const { ctx, canvas } = this;
    const h = canvas.height;
    ctx.font = `700 ${Math.round(h * 0.5)}px ${this.theme.font}`;
    const tw = Math.min(canvas.width * 0.7, ctx.measureText(text).width);
    const w = tw + h * 1.5;
    const x0 = (canvas.width - w) / 2;
    const y0 = h * 0.14;
    const th = h * 0.7;
    const tail = h * 0.42;
    // folded tails behind, darker
    ctx.fillStyle = '#b9781f';
    for (const sx of [-1, 1]) {
      const ex = sx < 0 ? x0 : x0 + w;
      ctx.beginPath();
      ctx.moveTo(ex, y0 + th * 0.25);
      ctx.lineTo(ex + sx * tail, y0 + th * 0.25);
      ctx.lineTo(ex + sx * tail * 0.6, y0 + th * 0.62);
      ctx.lineTo(ex + sx * tail, y0 + th);
      ctx.lineTo(ex, y0 + th);
      ctx.closePath();
      ctx.fill();
    }
    // the band
    ctx.fillStyle = 'rgba(60,35,20,0.3)';
    ctx.fillRect(x0 + h * 0.03, y0 + h * 0.05, w, th);
    const grad = ctx.createLinearGradient(0, y0, 0, y0 + th);
    grad.addColorStop(0, '#ffd56a');
    grad.addColorStop(1, '#f2a92a');
    ctx.fillStyle = grad;
    ctx.fillRect(x0, y0, w, th);
    ctx.strokeStyle = '#8a5414';
    ctx.lineWidth = h * 0.03;
    ctx.strokeRect(x0, y0, w, th);
    // stitched edges
    ctx.setLineDash([h * 0.06, h * 0.05]);
    ctx.strokeStyle = 'rgba(255,248,225,0.9)';
    ctx.lineWidth = h * 0.02;
    ctx.beginPath();
    ctx.moveTo(x0 + h * 0.08, y0 + h * 0.07);
    ctx.lineTo(x0 + w - h * 0.08, y0 + h * 0.07);
    ctx.moveTo(x0 + h * 0.08, y0 + th - h * 0.07);
    ctx.lineTo(x0 + w - h * 0.08, y0 + th - h * 0.07);
    ctx.stroke();
    ctx.setLineDash([]);
    // stars at both ends
    const star = (cx: number, cy: number, r: number) => {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rr = i % 2 === 0 ? r : r * 0.45;
        ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fillStyle = '#fff6d8';
      ctx.fill();
      ctx.strokeStyle = '#8a5414';
      ctx.lineWidth = r * 0.18;
      ctx.stroke();
    };
    star(x0 + h * 0.38, y0 + th / 2, th * 0.3);
    star(x0 + w - h * 0.38, y0 + th / 2, th * 0.3);
    // lettering: cream with a brown outline
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = h * 0.07;
    ctx.strokeStyle = '#7a4512';
    ctx.strokeText(text, canvas.width / 2, y0 + th * 0.55, tw);
    ctx.fillStyle = '#fffaf0';
    ctx.fillText(text, canvas.width / 2, y0 + th * 0.55, tw);
    this.tex.needsUpdate = true;
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
