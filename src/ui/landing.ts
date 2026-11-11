/**
 * 2D landing page shown outside XR: title, one Enter button, judge hint.
 * (Zero floating menus in XR; this is the browser page only.)
 */
import { VisibilityState, type World } from '@iwsdk/core';
import { audio } from '../audio/synth.js';
import { loadProgress, workshopUnlocked } from '../persistence/progress.js';
import { THEMES, type ThemeId } from './theme.js';
import { clothDataUrl } from './cloth-image.js';
import { clothFromHash, shareUrl } from '../net/share.js';
import { loadSettings, saveSettings, type HandPref } from '../persistence/settings.js';
import { coop, type CoopStatus } from '../net/coop.js';
import { PICTURES } from '../puzzle/pictures.gen.js';
import { mountCaller, shouldCall, unmountCaller } from './caller.js';

export function mountLanding(world: World): void {
  const el = document.createElement('div');
  el.id = 'landing';
  el.innerHTML = `
    <div class="frame">
      <i class="spool tl"></i><i class="spool tr"></i><i class="spool bl"></i><i class="spool br"></i>
      <main class="felt">
        <section class="hero">
          <div class="weave" aria-hidden="true">
            <div class="warps"></div>
            <div class="cloth"></div>
            <svg class="pip" viewBox="0 0 46 40" width="46" height="40">
              <path d="M6 30 q16 9 34 0 l-3 6 q-14 5 -28 0z" fill="#b5703f"/>
              <ellipse cx="22" cy="22" rx="15" ry="11" fill="#f7c948"/>
              <circle cx="31" cy="13" r="9" fill="#f7c948"/>
              <path d="M39 12 l7 3 -7 3z" fill="#f08a3c"/>
              <circle cx="34" cy="11" r="2" fill="#2b2320"/>
              <ellipse cx="18" cy="21" rx="7" ry="4.5" fill="#f2b632" transform="rotate(-15 18 21)"/>
              <circle cx="11" cy="27" r="4.5" fill="#fbf1dc"/>
            </svg>
          </div>
          <div class="pitch">
            <h1>Loomsong</h1>
            <p id="tagline">A tiny loom on your real desk. Hands only.</p>
            <p class="lede">Lift the levers, slide Pip across, and each row you weave sings. Finish a picture and it comes alive as a little knitted toy.</p>
            <button id="enter-xr" type="button">Enter mixed reality</button>
            <p class="note" id="xr-unsupported" hidden>This browser can't open mixed reality. Open this page in your headset's browser, or join a friend's loom from your phone below.</p>
            <p class="note">Sit at a desk with your controllers down and hand tracking on.</p>
            <div id="style-pick" role="radiogroup" aria-label="Loom style" hidden>
              <button type="button" data-theme="toy" role="radio">Toy</button>
              <button type="button" data-theme="workshop" role="radio">Workshop</button>
            </div>
          </div>
        </section>

        <ol class="steps" aria-label="How it plays">
          <li><b>Lift the levers</b><span>Each lever lifts its own threads. Pick the ones that make the next row on the card.</span></li>
          <li><b>Slide Pip across</b><span>Pinch the little bird and slide it through. The row is woven, and its threads ring out.</span></li>
          <li><b>Watch it come alive</b><span>A finished picture pops off the loom as a plush and hops onto your shelf.</span></li>
        </ol>

        <figure id="share-card" hidden>
          <img id="cloth-img" alt="Your last woven cloth" />
          <figcaption>
            <button type="button" id="share-btn">Share this cloth</button>
            <span id="share-note" role="status"></span>
          </figcaption>
        </figure>

        <div id="settings" aria-label="Settings">
          <button type="button" class="tag" id="hc" role="switch" aria-checked="false">High contrast</button>
          <button type="button" class="tag" id="music" role="switch" aria-checked="true">Music</button>
          <button type="button" class="tag" id="fit" aria-pressed="false">Fit to my hands</button>
          <div role="radiogroup" aria-label="Lever side" id="hand-pick">
            <span class="lbl">Levers</span>
            <button type="button" data-hand="auto" role="radio" title="On the side of the hand you place the loom with">Auto</button>
            <button type="button" data-hand="left" role="radio">Left</button>
            <button type="button" data-hand="right" role="radio">Right</button>
          </div>
        </div>

        <details id="coop">
          <summary>Play together</summary>
          <p>Host a loom in your headset and read out the code. A friend on a <b>phone</b> joins as your caller: they see the card and press the levers while you slide Pip. A friend in a second headset joins as the shuttle thrower.</p>
          <div class="row">
            <button type="button" id="coop-host">Host a loom</button>
            <input id="coop-code" maxlength="4" placeholder="CODE" aria-label="Room code" autocomplete="off" />
            <button type="button" id="coop-join">Join</button>
            <button type="button" id="coop-leave" hidden>Leave</button>
          </div>
          <p id="coop-status" role="status"></p>
          <p class="fine">Connects you directly to the other player over WebRTC, through a public PeerJS server. No accounts, no voice.</p>
        </details>
      </main>
    </div>`;
  document.body.appendChild(el);
  weaveHero(el.querySelector<HTMLElement>('.weave')!);
  const btn = el.querySelector<HTMLButtonElement>('#enter-xr')!;
  btn.addEventListener('click', () => {
    audio.resume(); // user gesture: unlock audio early
    world.launchXR();
  });
  if (!world.xrEnabled) {
    btn.disabled = true;
    el.querySelector<HTMLElement>('#xr-unsupported')!.hidden = false;
  }
  const pick = el.querySelector<HTMLElement>('#style-pick')!;
  const sync = () => {
    const p = loadProgress();
    pick.hidden = !workshopUnlocked(p);
    for (const b of pick.querySelectorAll<HTMLButtonElement>('button')) {
      b.setAttribute('aria-checked', String(b.dataset.theme === p.theme));
    }
  };
  pick.addEventListener('click', (e) => {
    const id = (e.target as HTMLElement).dataset?.theme as ThemeId | undefined;
    if (!id) return;
    window.dispatchEvent(new CustomEvent('loomsong:theme', { detail: id }));
    sync();
  });
  window.addEventListener('loomsong:unlocked', sync);
  sync();

  // Shared cloth arriving by link.
  if (clothFromHash(location.hash)) {
    el.querySelector<HTMLElement>('#tagline')!.textContent = 'Someone sent you a cloth. Weave it.';
  }

  // Share card: the last finished cloth.
  const card = el.querySelector<HTMLElement>('#share-card')!;
  const img = el.querySelector<HTMLImageElement>('#cloth-img')!;
  const note = el.querySelector<HTMLElement>('#share-note')!;
  const syncCloth = () => {
    const p = loadProgress();
    card.hidden = !p.lastCloth;
    if (p.lastCloth) img.src = clothDataUrl(p.lastCloth.rows, THEMES[p.theme]);
  };
  el.querySelector('#share-btn')!.addEventListener('click', async () => {
    const c = loadProgress().lastCloth;
    if (!c) return;
    const url = shareUrl(c);
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Loomsong', text: 'Can you weave my cloth?', url });
        note.textContent = '';
        return;
      }
      await navigator.clipboard.writeText(url);
      note.textContent = 'Link copied';
    } catch {
      note.textContent = url; // last resort: show it to copy by hand
    }
  });
  window.addEventListener('loomsong:cloth', syncCloth);
  syncCloth();

  // Co-op (hidden behind a disclosure; never in the first-run flow).
  const status = el.querySelector<HTMLElement>('#coop-status')!;
  const codeIn = el.querySelector<HTMLInputElement>('#coop-code')!;
  const leaveBtn = el.querySelector<HTMLButtonElement>('#coop-leave')!;
  el.querySelector('#coop-host')!.addEventListener('click', () => void coop.host());
  // a phone (no immersive AR) joins as the caller: the card and lever buttons
  const join = async () => void coop.join(codeIn.value, (await shouldCall()) ? 'caller' : 'guest');
  el.querySelector('#coop-join')!.addEventListener('click', () => void join());
  codeIn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') void join();
  });
  leaveBtn.addEventListener('click', () => coop.leave());
  const showCoop = (st: CoopStatus) => {
    const msg: Record<CoopStatus['state'], string> = {
      idle: '',
      hosting: `Your code: ${st.code ?? ''}. ${st.message ?? ''}`,
      joining: st.message ?? 'Connecting…',
      connected:
        st.role === 'host'
          ? `Connected (${st.code}). Enter XR.`
          : st.role === 'caller'
            ? `Connected (${st.code}). You're the caller.`
            : `Connected (${st.code}). You throw the shuttle. Enter XR.`,
      error: st.message ?? 'Something went wrong',
      closed: st.message ?? 'Disconnected',
    };
    status.textContent = msg[st.state];
    const busy = st.state === 'hosting' || st.state === 'joining' || st.state === 'connected';
    leaveBtn.hidden = !busy;
    for (const id of ['#coop-host', '#coop-join']) el.querySelector<HTMLButtonElement>(id)!.disabled = busy;
    codeIn.disabled = busy;
  };
  window.addEventListener('loomsong:coop', (e) => showCoop((e as CustomEvent<CoopStatus>).detail));
  // the phone caller's own screen
  window.addEventListener('loomsong:coop', (e) => {
    const st = (e as CustomEvent<CoopStatus>).detail;
    if (st.role === 'caller' && st.state === 'connected' && coop.transport) mountCaller(coop.transport, st.code ?? '', () => coop.leave());
    else if (st.state !== 'connected') unmountCaller();
  });

  // Accessibility settings.
  const hc = el.querySelector<HTMLButtonElement>('#hc')!;
  const music = el.querySelector<HTMLButtonElement>('#music')!;
  const handPick = el.querySelector<HTMLElement>('#hand-pick')!;
  const fit = el.querySelector<HTMLButtonElement>('#fit')!;
  const syncSettings = () => {
    const st = loadSettings();
    hc.setAttribute('aria-checked', String(st.highContrast));
    music.setAttribute('aria-checked', String(st.music));
    fit.setAttribute('aria-pressed', String(st.calibrateNext));
    fit.textContent = st.calibrateNext
      ? 'Fitting on next entry'
      : st.calibration
        ? 'Refit my hands'
        : 'Fit to my hands';
    for (const b of handPick.querySelectorAll<HTMLButtonElement>('button')) {
      b.setAttribute('aria-checked', String(b.dataset.hand === st.hand));
    }
  };
  const changed = () => window.dispatchEvent(new CustomEvent('loomsong:settings'));
  hc.addEventListener('click', () => {
    const st = loadSettings();
    saveSettings({ ...st, highContrast: !st.highContrast });
    syncSettings();
    changed();
  });
  music.addEventListener('click', () => {
    const st = loadSettings();
    saveSettings({ ...st, music: !st.music });
    syncSettings();
    changed();
  });
  fit.addEventListener('click', () => {
    const st = loadSettings();
    saveSettings({ ...st, calibrateNext: !st.calibrateNext });
    syncSettings();
  });
  handPick.addEventListener('click', (e) => {
    const hand = (e.target as HTMLElement).dataset?.hand as HandPref | undefined;
    if (!hand) return;
    saveSettings({ ...loadSettings(), hand });
    syncSettings();
    changed();
  });
  syncSettings();
  world.visibilityState.subscribe((s) => {
    el.style.display = s === VisibilityState.NonImmersive ? '' : 'none';
    if (s === VisibilityState.NonImmersive) {
      sync();
      syncCloth();
    }
  });
}

/**
 * The hero: the Duck woven row by row from the bottom, Pip flying across before
 * each row lands (the page's one orchestrated motion; instant with reduced motion).
 */
function weaveHero(box: HTMLElement): void {
  const pic = PICTURES.find((p) => p.id === 'duck') ?? PICTURES[0];
  const rows = pic.picture; // top → bottom
  const color = '#' + pic.color.toString(16).padStart(6, '0');
  const cloth = box.querySelector<HTMLElement>('.cloth')!;
  const pip = box.querySelector<SVGElement>('.pip')!;
  box.style.setProperty('--rows', String(rows.length));
  box.style.setProperty('--pic', color);
  const rowEls: HTMLElement[] = [];
  for (const r of rows) {
    const row = document.createElement('div');
    row.className = 'row';
    for (const ch of r) {
      const c = document.createElement('i');
      c.className = ch === '#' ? 'px' : 'gr';
      row.appendChild(c);
    }
    cloth.appendChild(row);
    rowEls.push(row);
  }
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (reduce) {
    rowEls.forEach((r) => r.classList.add('in'));
    pip.classList.add('rest');
    return;
  }
  // weave from the bottom row up, Pip crossing the shed each time (alternating sides)
  let i = rowEls.length - 1;
  let fromLeft = true;
  const next = () => {
    if (i < 0) {
      pip.classList.add('rest');
      return;
    }
    const row = rowEls[i];
    pip.style.setProperty('--y', String(i));
    pip.classList.toggle('flip', !fromLeft);
    pip.classList.remove('fly-l', 'fly-r');
    void pip.getBoundingClientRect();
    pip.classList.add(fromLeft ? 'fly-r' : 'fly-l');
    window.setTimeout(() => row.classList.add('in'), 330);
    fromLeft = !fromLeft;
    i--;
    window.setTimeout(next, 560);
  };
  window.setTimeout(next, 500);
}
