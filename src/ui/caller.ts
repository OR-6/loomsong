/**
 * Phone caller: a friend joins your loom's code from a phone (no headset) and
 * holds the picture. The headset can't see it any more, and the phone can't see
 * which threads each lever lifts, so the two of you have to talk: the caller
 * describes the row, taps squares to pin their threads on the weaver's loom, and
 * can ring Pip to wave hello. Each finished picture leaves the caller a postcard.
 * 2D DOM only; it reads the host's snapshots (coop-protocol) and sends pins back.
 */
import type { Transport, Snapshot } from '../net/coop-protocol.js';
import { validSnapshot } from '../net/coop-protocol.js';
import { levelAt } from '../puzzle/catalog.js';
import { rowStatuses } from '../puzzle/session.js';
import { isLifted } from '../puzzle/tieup.js';
import { WARPS } from '../config.js';
import { THEMES } from './theme.js';
import { audio } from '../audio/synth.js';
import { keyFor } from '../audio/soundtrack.js';
import { TargetCard } from './target-card.js';

const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
const ALBUM_KEY = 'loomsong-caller-postcards';

interface Postcard {
  l: number;
  stars: number;
  day: string;
}

function loadAlbum(): Postcard[] {
  try {
    const a = JSON.parse(localStorage.getItem(ALBUM_KEY) ?? '[]') as unknown;
    if (!Array.isArray(a)) return [];
    return a.filter((p): p is Postcard => !!p && Number.isInteger(p.l) && p.l >= 0 && p.l < 9999 && typeof p.day === 'string').slice(-40);
  } catch {
    return [];
  }
}
function saveAlbum(a: Postcard[]): void {
  try {
    localStorage.setItem(ALBUM_KEY, JSON.stringify(a.slice(-40)));
  } catch {
    /* private mode: the album just doesn't keep */
  }
}

let mounted: { el: HTMLElement; stop: () => void } | null = null;

export function mountCaller(link: Transport, code: string, onLeave: () => void): void {
  unmountCaller();
  const theme = THEMES.toy;
  const card = new TargetCard(theme);
  const el = document.createElement('section');
  el.id = 'caller';
  el.setAttribute('aria-label', 'Phone caller');
  el.innerHTML = `
    <style>
      #caller{position:fixed;inset:0;z-index:50;color:#3b2a20;font:600 16px/1.3 ${theme.font};
        background:repeating-linear-gradient(92deg,#0000 0 22px,#ffffff0d 22px 24px,#0000 24px 61px,#00000010 61px 62px),
          linear-gradient(180deg,#e2b47c,#c98e55);
        display:flex;flex-direction:column;align-items:center;gap:12px;padding:16px 16px 22px;overflow:auto}
      #caller header{display:flex;align-items:center;gap:10px}
      #caller h1{margin:0;font-size:24px;font-weight:400;color:#3b2a20}
      #caller p.lead{margin:0;text-align:center;max-width:24em;font:600 15px/1.35 system-ui,sans-serif;color:#4a3426}
      #caller .card{width:min(88vw,360px);height:auto;border-radius:10px;box-shadow:0 8px 0 #8a5a33,0 12px 24px #0004;background:#fff;
        cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
      #caller .tools{display:flex;gap:10px;flex-wrap:wrap;justify-content:center}
      #caller .patch{appearance:none;border:2px dashed #fff6e488;outline:3px solid #b8452d;outline-offset:-1px;background:#d9533c;color:#fff6e4;
        font:400 18px ${theme.font};padding:10px 18px;border-radius:14px;box-shadow:0 5px 0 #8f3322;cursor:pointer;min-height:48px}
      #caller .patch.soft{background:#fff6e4;color:#3b2a20;outline-color:#c9a57a;border-color:#c9a57a88;box-shadow:0 5px 0 #b48a5c}
      #caller .patch:active{transform:translateY(3px);box-shadow:0 2px 0 #8f3322}
      #caller .patch:disabled{opacity:.45}
      #caller .status{background:#fff6e4;color:#3b2a20;border-radius:999px;padding:8px 16px;font-size:16px;box-shadow:0 3px 0 #0002;text-align:center}
      #caller [hidden]{display:none !important}
      #caller .album{display:flex;flex-direction:column;align-items:center;gap:6px}
      #caller .album h2{margin:0;font:400 16px ${theme.font};color:#4a3426}
      #caller .album .strip{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;max-width:min(92vw,380px)}
      #caller .album canvas{width:54px;height:36px;border-radius:3px;box-shadow:0 2px 0 #0003;cursor:pointer}
      #caller .leave{appearance:none;border:0;background:none;color:#4a3426;text-decoration:underline;font:600 14px system-ui,sans-serif}
      #caller .post{position:fixed;inset:0;background:#2b1a10f2;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);z-index:5;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:16px}
      #caller .post[hidden]{display:none}
      #caller .post canvas{width:min(92vw,520px);height:auto;border-radius:6px;box-shadow:0 14px 40px #0008;transform:rotate(-2deg);
        animation:pc-in .5s cubic-bezier(.2,1.4,.4,1) both}
      @keyframes pc-in{from{transform:translateY(40px) rotate(-8deg) scale(.8);opacity:0}}
      @media (prefers-reduced-motion:reduce){#caller .post canvas{animation:none}}
      #caller .post .tools .patch{font-size:17px}
    </style>
    <header>
      <svg width="46" height="40" viewBox="0 0 46 40" aria-hidden="true">
        <ellipse cx="22" cy="24" rx="17" ry="13" fill="#f7c948"/>
        <circle cx="30" cy="14" r="10" fill="#f7c948"/>
        <path d="M39 13 l7 3 -7 3z" fill="#f08a3c"/>
        <circle cx="33" cy="12" r="2.2" fill="#2b2320"/>
        <ellipse cx="18" cy="24" rx="8" ry="5" fill="#f2b632" transform="rotate(-15 18 24)"/>
      </svg>
      <h1>You're the caller</h1>
    </header>
    <p class="lead">Only you can see the picture. Describe the yellow row to your weaver. Tap up to two squares a row to pin them on their loom; the rest you say. You'll hear each row as it's woven.</p>
    <div class="cardwrap"></div>
    <div class="tools">
      <button type="button" class="patch ring">Ring Pip</button>
      <button type="button" class="patch soft clear" disabled>Take pins out</button>
    </div>
    <div class="status" role="status" aria-live="polite">Connecting to loom ${code}…</div>
    <div class="album" hidden><h2>Postcards from the loom</h2><div class="strip"></div></div>
    <button type="button" class="leave">Leave</button>
    <div class="post" hidden role="dialog" aria-label="Postcard">
      <div class="pcwrap"></div>
      <div class="tools">
        <button type="button" class="patch keep">Save postcard</button>
        <button type="button" class="patch soft close">Back to the picture</button>
      </div>
    </div>`;
  el.querySelector('.cardwrap')!.appendChild(card.element);
  card.element.className = 'card';
  card.element.setAttribute('role', 'img');
  Object.assign(el, { card }); // diagnostics: tests find squares by the card's own layout
  const statusEl = el.querySelector<HTMLElement>('.status')!;
  const ringBtn = el.querySelector<HTMLButtonElement>('.ring')!;
  const clearBtn = el.querySelector<HTMLButtonElement>('.clear')!;
  const albumEl = el.querySelector<HTMLElement>('.album')!;
  const stripEl = el.querySelector<HTMLElement>('.album .strip')!;
  const postEl = el.querySelector<HTMLElement>('.post')!;
  el.querySelector('.leave')!.addEventListener('click', onLeave);
  document.body.appendChild(el);

  let level = -1;
  let rowsDone = -1;
  let pins = 0;
  let pinHintUntil = 0;
  let last: Snapshot | null = null;
  let wasPlaying = false;
  let album = loadAlbum();

  const setPin = (i: number, on: boolean) => {
    if (((pins >> i) & 1) === (on ? 1 : 0)) return;
    pins = on ? pins | (1 << i) : pins & ~(1 << i);
    link.send({ k: 'pin', i, on });
  };
  const clearPins = (send: boolean) => {
    if (send) for (let i = 0; i < WARPS; i++) setPin(i, false);
    else pins = 0;
  };

  // tap a square: pin (or unpin) its thread in the headset; two pins a row, the rest is said out loud
  const MAX_PINS = 2;
  card.element.addEventListener('click', (e) => {
    audio.resume(); // a tap is a gesture: the phone may play sound from now on
    if (!last || last.ph !== 'play') return;
    const b = card.element.getBoundingClientRect();
    const hit = card.cellAt((e.clientX - b.left) / b.width, (e.clientY - b.top) / b.height);
    if (!hit) return;
    const on = !((pins >> hit.i) & 1);
    let n = 0;
    for (let i = 0; i < WARPS; i++) n += (pins >> i) & 1;
    if (on && n >= MAX_PINS) {
      pinHintUntil = performance.now() + 2600;
      navigator.vibrate?.([8, 40, 8]);
      apply(last);
      return;
    }
    setPin(hit.i, on);
    navigator.vibrate?.(12);
    apply(last);
  });
  clearBtn.addEventListener('click', () => {
    clearPins(true);
    if (last) apply(last);
  });
  let ringAt = 0;
  ringBtn.addEventListener('click', () => {
    audio.resume();
    const now = performance.now();
    if (now - ringAt < 1500) return; // one wave at a time
    ringAt = now;
    link.send({ k: 'ring' });
    navigator.vibrate?.([10, 60, 10]);
  });

  // the postcard: shown when a picture is finished, kept in the phone's album
  let shownCard: HTMLCanvasElement | null = null;
  const showPostcard = (p: Postcard) => {
    const c = drawPostcard(p, 1040, 680, theme.font);
    c.setAttribute('role', 'img');
    c.setAttribute('aria-label', `Postcard: ${levelAt(p.l).name}, woven together`);
    const wrap = postEl.querySelector('.pcwrap')!;
    wrap.textContent = '';
    wrap.appendChild(c);
    shownCard = c;
    postEl.hidden = false;
    postEl.querySelector<HTMLButtonElement>('.close')!.focus();
  };
  postEl.querySelector('.close')!.addEventListener('click', () => (postEl.hidden = true));
  postEl.querySelector('.keep')!.addEventListener('click', () => {
    if (!shownCard) return;
    const a = document.createElement('a');
    a.download = 'loomsong-postcard.png';
    a.href = shownCard.toDataURL('image/png');
    a.click();
  });
  const drawAlbum = () => {
    albumEl.hidden = album.length === 0;
    stripEl.textContent = '';
    for (const p of album.slice().reverse()) {
      const c = drawPostcard(p, 216, 144, theme.font, true);
      c.title = levelAt(p.l).name;
      c.addEventListener('click', () => showPostcard(p));
      stripEl.appendChild(c);
    }
  };
  drawAlbum();

  // the woven row's tune, then a soft right/wrong (the weaver hears it in the headset too)
  const playRow = (lv: ReturnType<typeof levelAt>, rows: readonly number[]) => {
    const r = rows.length - 1;
    const row = rows[r];
    audio.setRoot(keyFor(lv.chapter, lv.rootMidi));
    let k = 0;
    for (let j = 0; j < WARPS; j++) {
      const i = r % 2 === 0 ? j : WARPS - 1 - j;
      if (isLifted(row, i)) audio.pluck(i, 0.35, 0.05 + k++ * 0.09, 0.3);
    }
    audio.verdict(rowStatuses(lv, rows)[r] === 'match');
  };
  const apply = (s: Snapshot) => {
    last = s;
    const lv = levelAt(s.l);
    if (s.l !== level) {
      level = s.l;
      card.paper = lv.chapter === 'night' ? '#b9beea' : null;
      card.sparkles = lv.chapter === 'night';
      card.weft = lv.weft ?? null;
      card.setPicture(lv.color ?? null, lv.chapter === 'garden' ? 0 : lv.par); // as in the headset: Garden's card counts no knots
    }
    // the headset takes pins out once their row is woven: so does the phone, and it plays the new row
    if (s.r.length !== rowsDone) {
      const grew = rowsDone >= 0 && s.r.length === rowsDone + 1;
      rowsDone = s.r.length;
      clearPins(false);
      if (grew) playRow(lv, s.r);
    }
    const playing = s.ph === 'play';
    if (wasPlaying && !playing && s.st > 0) {
      const day = new Date().toISOString().slice(0, 10);
      const p: Postcard = { l: s.l, stars: s.st, day };
      album = [...album.filter((q) => !(q.l === p.l && q.day === p.day)), p];
      saveAlbum(album);
      drawAlbum();
      showPostcard(p);
    }
    wasPlaying = playing;
    card.pinned = playing ? pins : 0;
    const title = playing ? 'What is it?' : lv.name; // the name comes with the plush, on both sides
    card.draw(title, lv.target, rowStatuses(lv, s.r), playing ? 0 : s.st);
    clearBtn.disabled = !pins || !playing;
    const next = Math.min(s.r.length + 1, lv.target.length);
    const row = lv.target[next - 1] ?? 0;
    let filled = 0;
    for (let i = 0; i < WARPS; i++) if (isLifted(row, i)) filled++;
    const sq = `${filled} coloured square${filled === 1 ? '' : 's'}`;
    statusEl.textContent = playing && performance.now() < pinHintUntil ? 'Two pins a row: say the rest out loud' : playing ? `Row ${next} of ${lv.target.length}: ${sq}` : `${lv.name} woven! ${'★'.repeat(s.st)}`;
    card.element.setAttribute('aria-label', `The picture card. Row ${next} has ${sq}.`);
  };
  // repaint at most ~10×/s (snapshots come at 20 Hz)
  let pending: Snapshot | null = null;
  link.onMessage((m) => {
    if (validSnapshot(m)) pending = m;
  });
  const timer = window.setInterval(() => {
    if (!pending || !mounted) return;
    const s = pending;
    pending = null;
    apply(s);
  }, 100);
  mounted = { el, stop: () => window.clearInterval(timer) };
}

/**
 * A postcard of a finished picture: the picture stitched on the left, the
 * message side on the right with a Pip stamp, a postmark and the day.
 */
function drawPostcard(p: Postcard, w: number, h: number, font: string, small = false): HTMLCanvasElement {
  const lv = levelAt(p.l);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  const s = w / 1040;
  // card stock with a soft speckle (deterministic: the same postcard every time)
  g.fillStyle = '#f6ecd8';
  g.fillRect(0, 0, w, h);
  let seed = p.l * 9301 + 49297;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  g.fillStyle = 'rgba(120,80,40,0.07)';
  for (let k = 0; k < 900 * s * s + 40; k++) g.fillRect(rnd() * w, rnd() * h, 2 * s + 0.5, 2 * s + 0.5);
  g.strokeStyle = '#d9533c';
  g.lineWidth = 10 * s;
  g.strokeRect(14 * s, 14 * s, w - 28 * s, h - 28 * s);
  // the picture, stitched: a square per cell on a felt patch
  const rows = lv.target.length;
  const area = Math.min(440 * s, ((h - 120 * s) / rows) * WARPS);
  const cell = area / WARPS;
  const px0 = 60 * s;
  const py0 = (h - cell * rows) / 2;
  g.fillStyle = '#efe2c6';
  g.fillRect(px0 - 16 * s, py0 - 16 * s, area + 32 * s, cell * rows + 32 * s);
  g.setLineDash([10 * s, 7 * s]);
  g.strokeStyle = '#b48a5c';
  g.lineWidth = 3 * s;
  g.strokeRect(px0 - 8 * s, py0 - 8 * s, area + 16 * s, cell * rows + 16 * s);
  g.setLineDash([]);
  const lift = hex(lv.color ?? THEMES.toy.palette.weft);
  for (let r = 0; r < rows; r++) {
    const y = py0 + (rows - 1 - r) * cell;
    for (let i = 0; i < WARPS; i++) {
      const on = isLifted(lv.target[r], i);
      const water = !on && lv.target[r] & 256 && lv.weft != null;
      g.fillStyle = on ? lift : water ? hex(lv.weft!) : '#f8f1e2';
      const gap = cell * 0.08;
      g.fillRect(px0 + i * cell + gap, y + gap, cell - gap * 2, cell - gap * 2);
    }
  }
  if (small) return c;
  // the message side
  const mx = w * 0.58;
  g.strokeStyle = '#c9b79c';
  g.lineWidth = 3 * s;
  g.beginPath();
  g.moveTo(mx, 70 * s);
  g.lineTo(mx, h - 70 * s);
  g.stroke();
  g.fillStyle = '#3b2a20';
  g.font = `400 ${46 * s}px ${font}`;
  g.fillText(lv.name, mx + 36 * s, 210 * s);
  g.font = `600 ${26 * s}px system-ui, sans-serif`;
  g.fillStyle = '#5a4030';
  g.fillText('Woven together', mx + 36 * s, 256 * s);
  g.fillText('You called it, they wove it.', mx + 36 * s, 296 * s);
  g.fillStyle = '#d9533c';
  g.font = `400 ${36 * s}px ${font}`;
  g.fillText('★'.repeat(p.stars) + '☆'.repeat(Math.max(0, 3 - p.stars)), mx + 36 * s, 352 * s);
  // address lines
  g.strokeStyle = '#c9b79c';
  g.lineWidth = 2 * s;
  for (let k = 0; k < 3; k++) {
    g.beginPath();
    g.moveTo(mx + 36 * s, (430 + k * 58) * s);
    g.lineTo(w - 60 * s, (430 + k * 58) * s);
    g.stroke();
  }
  g.fillStyle = '#8a6a50';
  g.font = `600 ${22 * s}px system-ui, sans-serif`;
  const [yy, mm, dd] = p.day.split('-').map(Number);
  const when = new Date(yy, (mm || 1) - 1, dd || 1).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  g.fillText(when, mx + 36 * s, (430 + 2 * 58 - 12) * s);
  // the stamp: Pip on a scalloped square
  const sx = w - 200 * s;
  const sy = 50 * s;
  const sw = 140 * s;
  g.fillStyle = '#fff8ea';
  for (let k = 0; k <= 7; k++) {
    for (const [ax, ay] of [
      [sx + (k * sw) / 7, sy],
      [sx + (k * sw) / 7, sy + sw],
      [sx, sy + (k * sw) / 7],
      [sx + sw, sy + (k * sw) / 7],
    ]) {
      g.beginPath();
      g.arc(ax, ay, 8 * s, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.fillRect(sx, sy, sw, sw);
  g.fillStyle = '#2a9d8f';
  g.fillRect(sx + 12 * s, sy + 12 * s, sw - 24 * s, sw - 24 * s);
  g.fillStyle = '#f7c948';
  g.beginPath();
  g.ellipse(sx + 62 * s, sy + 82 * s, 34 * s, 26 * s, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.arc(sx + 80 * s, sy + 58 * s, 20 * s, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#f08a3c';
  g.beginPath();
  g.moveTo(sx + 98 * s, sy + 54 * s);
  g.lineTo(sx + 114 * s, sy + 60 * s);
  g.lineTo(sx + 98 * s, sy + 66 * s);
  g.fill();
  g.fillStyle = '#2b2320';
  g.beginPath();
  g.arc(sx + 86 * s, sy + 54 * s, 4 * s, 0, Math.PI * 2);
  g.fill();
  // postmark rings over the stamp's corner
  g.strokeStyle = 'rgba(59,42,32,0.45)';
  g.lineWidth = 3 * s;
  g.beginPath();
  g.arc(sx - 10 * s, sy + sw - 10 * s, 46 * s, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.arc(sx - 10 * s, sy + sw - 10 * s, 36 * s, 0, Math.PI * 2);
  g.stroke();
  for (let k = 0; k < 3; k++) {
    g.beginPath();
    for (let x = 0; x < 120; x += 4) {
      const xx = sx + 40 * s + x * s;
      const yy = sy + sw - 30 * s + k * 14 * s + Math.sin(x / 9) * 4 * s;
      if (x === 0) g.moveTo(xx, yy);
      else g.lineTo(xx, yy);
    }
    g.stroke();
  }
  return c;
}

export function unmountCaller(): void {
  if (!mounted) return;
  mounted.stop();
  mounted.el.remove();
  mounted = null;
}

/** True when this device can't run the immersive game (a phone or laptop): join as a caller. */
export async function shouldCall(): Promise<boolean> {
  try {
    const xr = (navigator as Navigator & { xr?: { isSessionSupported(m: string): Promise<boolean> } }).xr;
    return !(xr && (await xr.isSessionSupported('immersive-ar')));
  } catch {
    return true;
  }
}
