/** Draws a finished cloth as an image (2D page share card). */
import { WARPS } from '../config.js';
import { isLifted, type Mask8 } from '../puzzle/tieup.js';
import type { Theme } from './theme.js';

export function clothDataUrl(rows: readonly Mask8[], theme: Theme, cell = 28): string {
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
      const y = pad + r * cell;
      g.fillStyle = hex(isLifted(row, i) ? theme.palette.warp : theme.palette.weft);
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
