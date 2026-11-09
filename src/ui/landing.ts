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

export function mountLanding(world: World): void {
  const el = document.createElement('div');
  el.id = 'landing';
  el.innerHTML = `
    <h1>Loomsong</h1>
    <p id="tagline">A tiny loom on your real desk. Hands only.</p>
    <button id="enter-xr" type="button">Enter XR</button>
    <div id="style-pick" role="radiogroup" aria-label="Loom style" hidden>
      <button type="button" data-theme="toy" role="radio">Toy</button>
      <button type="button" data-theme="workshop" role="radio">Workshop</button>
    </div>
    <p class="small">Sit at a desk, controllers down, hand tracking on.</p>
    <figure id="share-card" hidden>
      <img id="cloth-img" alt="Your last woven cloth" />
      <figcaption>
        <button type="button" id="share-btn">Share this cloth</button>
        <span id="share-note" role="status"></span>
      </figcaption>
    </figure>
    <div id="settings">
      <button type="button" id="hc" role="switch" aria-checked="false">High contrast</button>
      <button type="button" id="fit" aria-pressed="false">Fit to my hands</button>
      <div role="radiogroup" aria-label="Lever side" id="hand-pick">
        <span class="lbl">Levers</span>
        <button type="button" data-hand="auto" role="radio">Auto</button>
        <button type="button" data-hand="left" role="radio">Left</button>
        <button type="button" data-hand="right" role="radio">Right</button>
      </div>
    </div>
    <p class="small" id="xr-unsupported" hidden>WebXR AR is not available in this browser. Open this page in Meta Quest Browser.</p>`;
  document.body.appendChild(el);
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

  // Accessibility settings.
  const hc = el.querySelector<HTMLButtonElement>('#hc')!;
  const handPick = el.querySelector<HTMLElement>('#hand-pick')!;
  const fit = el.querySelector<HTMLButtonElement>('#fit')!;
  const syncSettings = () => {
    const st = loadSettings();
    hc.setAttribute('aria-checked', String(st.highContrast));
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
