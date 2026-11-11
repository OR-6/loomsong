/**
 * The site's living mark: a little loom on the nameplate, weaving for real.
 * Eight cream warps stretched between two wooden beams. For each row the
 * shed opens (the row's picture threads lift and brighten), Pip flies across
 * carrying the weft, each warp twangs as Pip passes it, the beater taps the
 * new row tight, and the row settles as yarn. When the picture is done, notes
 * float up from the cloth and Pip hops onto the beam; then the cloth rolls
 * down onto the beam and the next picture begins. Canvas 2D, drawn only
 * while on screen; a still, finished picture for reduced motion.
 */
import { PICTURES } from '../puzzle/pictures.gen.js';

type Pic = { rows: string[]; color: string };

const WARPS = 8;
const CREAM = '#f3e6cc';
const WOOD = '#c8935a';
const WOOD_DARK = '#8f5e34';
const PIP = '#f7c948';

/** The mark's own duck first (with its beak and eye), then a few of the game's pictures. */
function pictures(): Pic[] {
  const pick = (id: string): Pic | null => {
    const p = PICTURES.find((x) => x.id === id);
    return p ? { rows: p.picture.map((r) => r.replace(/~/g, '.')), color: '#' + p.color.toString(16).padStart(6, '0') } : null;
  };
  return [
    { rows: ['....##..', '...##eb.', '....##..', '#...###.', '#######.', '.#####..', '..###...'], color: '#e9a21a' },
    pick('sprout'),
    pick('heart'),
    pick('boat'),
    pick('owl'),
  ].filter((p): p is Pic => !!p);
}

export function mountWeaveMark(host: HTMLElement): void {
  const canvas = document.createElement('canvas');
  canvas.className = 'weave-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  host.replaceChildren(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const pics = pictures();
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  // layout (css px)
  const W = 150;
  const H = 132;
  const cell = 14;
  const gx = (W - WARPS * cell) / 2; // cloth left
  const beamTop = 20; // room above for Pip to perch
  const beamBot = H - 8;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
  ctx.scale(dpr, dpr);

  // state
  let pi = 0;
  let pic = pics[0];
  let rows = 0; // rows finished (from the bottom)
  let phase: 'shed' | 'fly' | 'beat' | 'sing' | 'roll' = 'shed';
  let t = 0; // time in phase
  const twang = new Float32Array(WARPS); // warp vibration
  const notes: { x: number; y: number; t: number; s: number }[] = [];
  let pipX = -20;
  let fromLeft = true;
  let roll = 0;
  let last = performance.now();
  let raf = 0;
  let visible = true;

  const rowsOf = () => pic.rows.length;
  /** y of the top of row r counted from the bottom (r = 0 sits on the front beam). */
  const rowY = (r: number) => beamBot - 6 - (r + 1) * (cell - 2);
  const cellAt = (r: number, i: number) => pic.rows[rowsOf() - 1 - r]?.[i] ?? '.';
  const lifted = (r: number, i: number) => cellAt(r, i) !== '.';
  const warpX = (i: number) => gx + i * cell + cell / 2;

  const yarnCell = (x: number, y: number, w: number, h: number, col: string, k: number) => {
    ctx.fillStyle = col;
    roundRect(x + 0.6, y + 0.6, w - 1.2, h - 1.2, 2.2);
    ctx.fill();
    // a twist of ply across the cell, and a soft lit top edge
    ctx.strokeStyle = 'rgba(0,0,0,0.13)';
    ctx.lineWidth = 0.9;
    for (let j = 0; j < 3; j++) {
      const sx = x + 2 + j * (w / 3) + ((k * 7) % 3) * 0.4;
      ctx.beginPath();
      ctx.moveTo(sx, y + h - 2);
      ctx.lineTo(sx + w * 0.26, y + 2);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(x + 2, y + 1.5, w - 4, 1.4);
  };

  function roundRect(x: number, y: number, w: number, h: number, r: number) {
    ctx!.beginPath();
    ctx!.moveTo(x + r, y);
    ctx!.arcTo(x + w, y, x + w, y + h, r);
    ctx!.arcTo(x + w, y + h, x, y + h, r);
    ctx!.arcTo(x, y + h, x, y, r);
    ctx!.arcTo(x, y, x + w, y, r);
    ctx!.closePath();
  }

  const beam = (y: number) => {
    const g = ctx.createLinearGradient(0, y - 5, 0, y + 5);
    g.addColorStop(0, '#e2b07a');
    g.addColorStop(0.5, WOOD);
    g.addColorStop(1, WOOD_DARK);
    ctx.fillStyle = g;
    roundRect(gx - 12, y - 5, WARPS * cell + 24, 10, 5);
    ctx.fill();
    // little pegs at the ends
    ctx.fillStyle = WOOD_DARK;
    for (const ex of [gx - 9, gx + WARPS * cell + 9]) {
      ctx.beginPath();
      ctx.arc(ex, y, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const drawPip = (x: number, y: number, flip: boolean, hop = 0) => {
    ctx.save();
    ctx.translate(x, y - hop);
    if (flip) ctx.scale(-1, 1);
    ctx.fillStyle = PIP;
    ctx.beginPath();
    ctx.ellipse(0, 0, 8, 6, 0, 0, Math.PI * 2); // body
    ctx.fill();
    ctx.beginPath();
    ctx.arc(6, -5, 4.6, 0, Math.PI * 2); // head
    ctx.fill();
    ctx.fillStyle = '#f08a3c';
    ctx.beginPath();
    ctx.moveTo(10.2, -5.8);
    ctx.lineTo(14, -4.6);
    ctx.lineTo(10.2, -3.2);
    ctx.fill();
    ctx.fillStyle = '#2b2320';
    ctx.beginPath();
    ctx.arc(7.4, -6, 1.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2b632';
    ctx.beginPath();
    ctx.ellipse(-1.5, 0.5, 4.2, 2.6, -0.3, 0, Math.PI * 2); // wing
    ctx.fill();
    ctx.fillStyle = '#fbf1dc'; // the yarn ball Pip carries
    ctx.beginPath();
    ctx.arc(-7, 3, 2.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  const draw = () => {
    ctx.clearRect(0, 0, W, H);
    const n = rowsOf();
    const shed = phase === 'shed' ? Math.min(1, t / 0.35) : phase === 'fly' ? 1 : phase === 'beat' ? Math.max(0, 1 - t / 0.25) : 0;
    const shift = roll * (n + 1) * (cell - 2); // the finished cloth rolling down onto the beam
    // warps behind the cloth
    for (let i = 0; i < WARPS; i++) {
      const x = warpX(i) + Math.sin(performance.now() / 22 + i) * twang[i];
      const up = rows < n && lifted(rows, i) ? shed : 0;
      ctx.strokeStyle = up > 0 ? '#fffaf0' : CREAM;
      ctx.lineWidth = up > 0 ? 2.1 : 1.6;
      ctx.beginPath();
      ctx.moveTo(warpX(i), beamTop + 4);
      ctx.quadraticCurveTo(x, (beamTop + beamBot) / 2 - up * 4, warpX(i), beamBot - 4);
      ctx.stroke();
    }
    // the cloth so far (clipped to above the front beam while it rolls down)
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, beamBot - 5);
    ctx.clip();
    for (let r = 0; r < Math.min(rows, n); r++) {
      const y = rowY(r) + shift;
      // a beat-in squash on the newest row
      const squash = r === rows - 1 && phase === 'beat' ? 1 - 0.2 * Math.sin(Math.min(1, t / 0.25) * Math.PI) : 1;
      for (let i = 0; i < WARPS; i++) {
        const c = cellAt(r, i);
        if (c === '.') {
          // the cream weft between the picture's threads: woven, but quiet, so the picture reads
          ctx.fillStyle = 'rgba(243,230,204,0.22)';
          ctx.fillRect(gx + i * cell + 1, y + (cell - 2) * (1 - squash) + (cell - 2) * squash * 0.35, cell - 2, (cell - 2) * squash * 0.3);
          continue;
        }
        const col = c === 'b' ? '#f08a3c' : c === 'e' ? '#2b2320' : pic.color;
        yarnCell(gx + i * cell, y + (cell - 2) * (1 - squash), cell, (cell - 2) * squash, col, r * WARPS + i);
      }
    }
    ctx.restore();
    beam(beamTop);
    beam(beamBot);
    // the weft Pip trails across the open shed, and Pip
    if (phase === 'fly' && rows < n) {
      const y = rowY(rows) + (cell - 2) / 2;
      const startX = fromLeft ? gx - 6 : gx + WARPS * cell + 6;
      ctx.strokeStyle = pic.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(pipX, y);
      ctx.stroke();
      drawPip(pipX, y - 3, !fromLeft, Math.sin(Math.min(1, t / 0.6) * Math.PI) * 4);
    } else {
      // perched on the top beam's corner between passes
      const hop = phase === 'sing' ? Math.abs(Math.sin(t * 7)) * 5 : 0;
      drawPip(gx + WARPS * cell - 4, beamTop - 9, true, hop);
    }
    // the beater: a thin bar that taps the new row tight
    if (phase === 'beat' && rows > 0) {
      const k = Math.sin(Math.min(1, t / 0.25) * Math.PI);
      ctx.fillStyle = 'rgba(143,94,52,0.9)';
      roundRect(gx - 4, rowY(rows - 1) - 6 + k * 3, WARPS * cell + 8, 3, 1.5);
      ctx.fill();
    }
    // notes float up when the picture is done: the cloth sings
    for (const m of notes) {
      const a = Math.max(0, 1 - m.t / 1.8);
      ctx.globalAlpha = a;
      ctx.fillStyle = pic.color;
      ctx.font = `${Math.round(12 * m.s)}px serif`;
      ctx.fillText('♪', m.x + Math.sin(m.t * 3) * 3, m.y - m.t * 26);
      ctx.globalAlpha = 1;
    }
  };

  const step = (dt: number) => {
    t += dt;
    for (let i = 0; i < WARPS; i++) twang[i] *= Math.exp(-dt * 6);
    for (let k = notes.length - 1; k >= 0; k--) {
      notes[k].t += dt;
      if (notes[k].t > 1.8) notes.splice(k, 1);
    }
    const n = rowsOf();
    if (phase === 'shed' && t >= 0.35) {
      phase = 'fly';
      t = 0;
      pipX = fromLeft ? gx - 14 : gx + WARPS * cell + 14;
    } else if (phase === 'fly') {
      const k = Math.min(1, t / 0.6);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const a = fromLeft ? gx - 14 : gx + WARPS * cell + 14;
      const b = fromLeft ? gx + WARPS * cell + 14 : gx - 14;
      const prev = pipX;
      pipX = a + (b - a) * e;
      // twang each warp as Pip passes it
      for (let i = 0; i < WARPS; i++) {
        const x = warpX(i);
        if ((prev - x) * (pipX - x) <= 0 && prev !== pipX) twang[i] = lifted(rows, i) ? 2.2 : 1.2;
      }
      if (k >= 1) {
        rows++;
        fromLeft = !fromLeft;
        phase = 'beat';
        t = 0;
      }
    } else if (phase === 'beat' && t >= 0.3) {
      t = 0;
      if (rows >= n) {
        phase = 'sing';
        for (let k = 0; k < 5; k++) notes.push({ x: gx + 10 + k * 22, y: rowY(n - 1) - 2, t: -k * 0.22, s: 0.9 + (k % 2) * 0.35 });
      } else phase = 'shed';
    } else if (phase === 'sing' && t >= 3.6) {
      phase = 'roll';
      t = 0;
    } else if (phase === 'roll') {
      roll = Math.min(1, t / 1.1);
      if (roll >= 1) {
        pi = (pi + 1) % pics.length;
        pic = pics[pi];
        rows = 0;
        roll = 0;
        fromLeft = true;
        phase = 'shed';
        t = 0;
      }
    }
  };

  const frame = (now: number) => {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    step(dt);
    draw();
    if (visible && !document.hidden) raf = requestAnimationFrame(frame);
  };
  const start = () => {
    if (raf || reduce) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  };

  if (reduce) {
    rows = rowsOf();
    phase = 'sing';
    t = 10;
    draw();
    return;
  }
  draw();
  try {
    new IntersectionObserver((es) => {
      visible = es.some((e) => e.isIntersecting);
      if (visible) start();
    }).observe(canvas);
  } catch {
    /* no observer: just run */
  }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) start();
  });
  window.setTimeout(start, 400);
}
