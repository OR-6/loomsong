/** Draws a finished cloth as an image (2D page share card). */
import { WARPS } from '../config.js';
import { isLifted, type Mask8 } from '../puzzle/tieup.js';
import type { Theme } from './theme.js';

/** `color`: the picture's yarn (else the theme's); `weft`: the second yarn for rows with bit 8 (the Sea's water). */
export function clothDataUrl(rows: readonly Mask8[], theme: Theme, cell = 28, color?: number, weft?: number): string {
  const c = document.createElement('canvas');
  const pad = cell * 0.5;
  c.width = Math.round(WARPS * cell + pad * 2);
  c.height = Math.round(rows.length * cell + pad * 2);
  const g = c.getContext('2d')!;
  g.fillStyle = theme.paper;
  g.fillRect(0, 0, c.width, c.height);
  const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
  rows.forEach((row, r) => {
    for (let i = 0; i < WARPS; i++) {
      const x = pad + i * cell;
      const y = pad + (rows.length - 1 - r) * cell; // the first row woven is the bottom one
      const ground = row & 256 && weft !== undefined ? weft : theme.palette.weft;
      g.fillStyle = hex(isLifted(row, i) ? (color ?? theme.palette.warp) : ground);
      g.fillRect(x + 1, y + 1, cell - 2, cell - 2);
      // pillow shading so it reads as yarn, not pixels
      const gr = g.createRadialGradient(x + cell / 2, y + cell / 2, 2, x + cell / 2, y + cell / 2, cell * 0.75);
      gr.addColorStop(0, 'rgba(255,255,255,0.18)');
      gr.addColorStop(1, 'rgba(0,0,0,0.28)');
      g.fillStyle = gr;
      g.fillRect(x + 1, y + 1, cell - 2, cell - 2);
    }
  });
  return c.toDataURL('image/png');
}
