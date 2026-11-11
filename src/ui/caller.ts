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

const NAMES: Record<number, string> = { 0xe8553e: 'Red', 0x1fb3a0: 'Teal', 0xf2b632: 'Yellow', 0x7b5bb8: 'Purple' };
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
      #caller{position:fixed;inset:0;z-index:50;color:#3b2a20;font:600 16px/1.3 ${theme.font};
        background:repeating-linear-gradient(92deg,#0000 0 22px,#ffffff0d 22px 24px,#0000 24px 61px,#00000010 61px 62px),
          linear-gradient(180deg,#e2b47c,#c98e55);
        display:flex;flex-direction:column;align-items:center;gap:12px;padding:16px 16px 22px;overflow:auto}
      #caller header{display:flex;align-items:center;gap:10px}
      #caller h1{margin:0;font-size:24px;font-weight:400;color:#3b2a20}
      #caller p.lead{margin:0;text-align:center;max-width:26em;font:600 15px/1.35 system-ui,sans-serif;color:#4a3426}
      #caller .card{width:min(88vw,360px);height:auto;border-radius:10px;box-shadow:0 8px 0 #8a5a33,0 12px 24px #0004;background:#fff}
      #caller .levers{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;width:min(92vw,380px);
        background:#6b3e26;border-radius:18px;padding:14px;box-shadow:inset 0 3px 0 #0003,0 6px 0 #4a2a18}
      #caller .lever{appearance:none;border:0;background:none;display:flex;flex-direction:column;align-items:center;gap:6px;
        padding:6px 4px 10px;color:#f6ead6;font:400 17px ${theme.font};border-radius:14px;cursor:pointer}
      #caller .lever .cap{width:76px;height:76px;border-radius:50%;box-shadow:inset -8px -10px 0 #0002,inset 6px 8px 0 #fff5,0 8px 0 #0004;
        transition:transform .1s, box-shadow .1s}
      #caller .lever .stem{width:12px;height:16px;background:#f3e6cf;border-radius:0 0 6px 6px;margin-top:-4px}
      #caller .lever[aria-pressed="true"] .cap{transform:translateY(8px);box-shadow:inset -6px -8px 0 #0003,inset 4px 6px 0 #fff4,0 0 0 4px #fff8}
      #caller .lever .lifted{font-size:13px;color:#ffe08a;visibility:hidden}
      #caller .lever[aria-pressed="true"] .lifted{visibility:visible}
      #caller .lever:disabled{opacity:.4}
      #caller .lever .strip{display:flex;gap:3px;justify-content:center}
      #caller .lever .strip i{width:9px;height:14px;border-radius:3px;background:#ffffff26}
      #caller .lever .strip i.on{background:#f6ead6}
      #caller .lever .q{font-size:14px;opacity:.75}
      #caller .status{background:#fff6e4;color:#3b2a20;border-radius:999px;padding:8px 16px;font-size:16px;box-shadow:0 3px 0 #0002}
      #caller .leave{appearance:none;border:0;background:none;color:#4a3426;text-decoration:underline;font:600 14px system-ui,sans-serif}
    </style>
    <header>
      <svg width="46" height="40" viewBox="0 0 46 40" aria-hidden="true">
        <ellipse cx="22" cy="24" rx="17" ry="13" fill="#f7c948"/>
        <circle cx="30" cy="14" r="10" fill="#f7c948"/>
        <path d="M39 13 l7 3 -7 3z" fill="#f08a3c"/>
        <circle cx="33" cy="12" r="2.2" fill="#2b2320"/>
        <ellipse cx="18" cy="24" rx="8" ry="5" fill="#f2b632" transform="rotate(-15 18 24)"/>
        <circle cx="27" cy="18" r="2.4" fill="#f4a3a3" opacity=".8"/>
      </svg>
      <h1>You're the caller</h1>
    </header>
    <p class="lead">Press the levers whose threads make the row with the arrow, then tell the weaver to slide Pip.</p>
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
      const cap = document.createElement('span');
      cap.className = 'cap';
      cap.style.background = hex(c);
      const stem = document.createElement('span');
      stem.className = 'stem';
      const name = document.createElement('span');
      name.textContent = `${NAMES[c] ?? `Lever ${k + 1}`} lever`;
      const lifted = document.createElement('span');
      lifted.className = 'lifted';
      lifted.textContent = 'Lifted';
      b.append(cap, stem, name, lifted);
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
