/**
 * Procedural textures (generated once, shared). Grayscale maps multiplied by
 * material / instance colours, so every theme and palette reuses them.
 */
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from '@iwsdk/core';

let weave: CanvasTexture | null = null;
let grain: CanvasTexture | null = null;

/** One woven cell: a soft pillow of yarn with fibre lines (256²). */
export function weaveTexture(): CanvasTexture {
  if (weave) return weave;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  // pillow shading: bright centre, darker edges where yarn dips under
  const grad = g.createRadialGradient(128, 128, 20, 128, 128, 170);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.7, '#e6e6e6');
  grad.addColorStop(1, '#a8a8a8');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  // fibre lines (slight twist) — deterministic
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  g.lineWidth = 2;
  for (let i = 0; i < 46; i++) {
    const y = rnd() * 256;
    g.strokeStyle = `rgba(0,0,0,${0.05 + rnd() * 0.08})`;
    g.beginPath();
    g.moveTo(0, y);
    g.bezierCurveTo(80, y - 10 + rnd() * 20, 170, y - 10 + rnd() * 20, 256, y + 6);
    g.stroke();
  }
  weave = new CanvasTexture(c);
  weave.colorSpace = SRGBColorSpace;
  return weave;
}

/** Faint painted-wood grain (tileable along U). */
export function grainTexture(): CanvasTexture {
  if (grain) return grain;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 256, 64);
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 26; i++) {
    const y = rnd() * 64;
    const a = 0.03 + rnd() * 0.06;
    g.strokeStyle = `rgba(60,35,10,${a})`;
    g.lineWidth = 1 + rnd() * 2;
    g.beginPath();
    g.moveTo(0, y);
    for (let x = 0; x <= 256; x += 32) g.lineTo(x, y + Math.sin(x * 0.05 + i) * 2.5);
    g.stroke();
  }
  grain = new CanvasTexture(c);
  grain.colorSpace = SRGBColorSpace;
  grain.wrapS = grain.wrapT = RepeatWrapping;
  return grain;
}

let yarn: CanvasTexture | null = null;
/**
 * Twisted yarn for the warps: diagonal plies with soft shading, white so the
 * material colour tints it. Mapped around (u) and along (v) a cylinder.
 */
export function yarnTexture(): CanvasTexture {
  if (yarn) return yarn;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 64, 64);
  // Two plies twisting: diagonal bands with a darker groove between them.
  for (let k = -64; k < 128; k += 16) {
    const grad = g.createLinearGradient(k, 0, k + 16, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0.28)');
    grad.addColorStop(0.25, 'rgba(255,255,255,0)');
    grad.addColorStop(0.6, 'rgba(255,255,255,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.18)');
    g.save();
    g.transform(1, 0, -1, 1, 0, 0); // shear → diagonal twist
    g.fillStyle = grad;
    g.fillRect(k, 0, 16, 128);
    g.restore();
  }
  // A few loose fibres.
  g.strokeStyle = 'rgba(255,255,255,0.35)';
  g.lineWidth = 1;
  for (let i = 0; i < 18; i++) {
    const x = (i * 37) % 64;
    const y = (i * 23) % 64;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + 6, y + 3);
    g.stroke();
  }
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(1, 14);
  t.colorSpace = SRGBColorSpace;
  yarn = t;
  return t;
}
