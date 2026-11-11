/**
 * Phone caller: a friend joins your loom's code from a phone (no headset) and
 * gets the picture card plus one big button per lever. They call out — or just
 * press — the levers while you slide Pip in the headset. 2D DOM only; it reads
 * the host's snapshots (coop-protocol) and sends lever presses back.
 */
import type { Transport, Snapshot } from '../net/coop-protocol.js';
import { validSnapshot } from '../net/coop-protocol.js';
import { levelAt } from '../puzzle/catalog.js';
import { rowStatuses } from '../puzzle/session.js';
import { THEMES } from './theme.js';
import { TargetCard } from './target-card.js';

const NAMES: Record<number, string> = { 0xe8553e: 'Red', 0x1fb3a0: 'Teal', 0xe8679e: 'Pink', 0x7cc142: 'Green' };
const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');

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
      #caller{position:fixed;inset:0;z-index:50;background:#2b2320;color:#f6ead6;font:600 16px/1.3 system-ui,sans-serif;
        display:flex;flex-direction:column;align-items:center;gap:14px;padding:18px 16px;overflow:auto}
      #caller h1{margin:0;font-size:20px;color:#f7be3b}
      #caller p{margin:0;opacity:.85;text-align:center;max-width:28em}
      #caller .card{width:min(86vw,360px);height:auto;border-radius:10px;box-shadow:0 6px 20px #0006;background:#fff}
      #caller .levers{display:grid;grid-template-columns:repeat(2,minmax(120px,1fr));gap:12px;width:min(90vw,380px)}
      #caller .lever{appearance:none;border:0;border-radius:18px;padding:18px 10px;font:700 18px system-ui,sans-serif;color:#2b2320;
        box-shadow:inset 0 -6px 0 #0003;transition:transform .08s}
      #caller .lever[aria-pressed="true"]{transform:translateY(3px);box-shadow:inset 0 3px 0 #0004;outline:4px solid #fff8}
      #caller .lever:disabled{opacity:.35}
      #caller .lever .strip{display:flex;gap:3px;justify-content:center;margin-top:8px}
      #caller .lever .strip i{width:10px;height:14px;border-radius:3px;background:#0002}
      #caller .lever .strip i.on{background:#2b2320}
      #caller .lever .q{display:block;margin-top:6px;font-size:14px;opacity:.7}
      #caller .status{font-size:15px;opacity:.9}
      #caller .leave{appearance:none;border:1px solid #f6ead680;background:none;color:#f6ead6;border-radius:999px;padding:8px 18px;font:600 14px system-ui}
    </style>
    <h1>You're the caller</h1>
    <p>Match each row of the card: press the levers whose threads make it, then tell the weaver to slide Pip.</p>
    <div class="cardwrap"></div>
    <div class="levers" role="group" aria-label="Levers"></div>
    <div class="status" role="status">Connecting to loom ${code}…</div>
    <button type="button" class="leave">Leave</button>`;
  el.querySelector('.cardwrap')!.appendChild(card.element);
  card.element.className = 'card';
  const leversEl = el.querySelector<HTMLElement>('.levers')!;
  const statusEl = el.querySelector<HTMLElement>('.status')!;
  el.querySelector('.leave')!.addEventListener('click', onLeave);
  document.body.appendChild(el);

  let level = -1;
  let latched = 0;
  let buttons: HTMLButtonElement[] = [];
  const build = (tie: readonly number[], mystery: boolean) => {
    leversEl.textContent = '';
    buttons = [];
    for (let k = 0; k < tie.length; k++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'lever';
      const c = theme.palette.knobs[k];
      b.style.background = hex(c);
      b.textContent = `${NAMES[c] ?? `Lever ${k + 1}`} lever`;
      // which of the 8 threads this lever lifts (the weaver sees it on the loom; the caller sees it here)
      if (mystery) {
        const q = document.createElement('span');
        q.className = 'q';
        q.textContent = '? threads';
        b.appendChild(q);
      } else {
        const strip = document.createElement('span');
        strip.className = 'strip';
        strip.setAttribute('aria-hidden', 'true');
        for (let i = 0; i < 8; i++) {
          const d = document.createElement('i');
          if ((tie[k] >> i) & 1) d.className = 'on';
          strip.appendChild(d);
        }
        b.appendChild(strip);
      }
      b.addEventListener('click', () => link.send({ k: 'lev', i: k, v: !((latched >> k) & 1) }));
      leversEl.appendChild(b);
      buttons.push(b);
    }
  };
  const apply = (s: Snapshot) => {
    const lv = levelAt(s.l);
    if (s.l !== level) {
      level = s.l;
      build(lv.tieUp, !!lv.mystery);
      card.paper = lv.chapter === 'night' ? '#b9beea' : null;
      card.sparkles = lv.chapter === 'night';
      card.weft = lv.weft ?? null;
      card.setPicture(lv.color ?? null, lv.par);
    }
    latched = s.lat;
    const playing = s.ph === 'play';
    buttons.forEach((b, k) => {
      b.setAttribute('aria-pressed', String(((s.lat >> k) & 1) === 1));
      b.disabled = !playing;
    });
    card.draw(lv.name, lv.target, rowStatuses(lv, s.r), playing ? 0 : s.st);
    const done = s.r.length;
    statusEl.textContent = playing ? `${lv.name}: row ${Math.min(done + 1, lv.target.length)} of ${lv.target.length}` : `${lv.name} woven! ${'★'.repeat(s.st)}`;
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
