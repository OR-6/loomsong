/**
 * 2D landing page shown outside XR: title, one Enter button, judge hint.
 * (Zero floating menus in XR; this is the browser page only.)
 */
import { VisibilityState, type World } from '@iwsdk/core';
import { audio } from '../audio/synth.js';
import { loadProgress, workshopUnlocked } from '../persistence/progress.js';
import type { ThemeId } from './theme.js';
import { loadSettings, saveSettings, type HandPref } from '../persistence/settings.js';

export function mountLanding(world: World): void {
  const el = document.createElement('div');
  el.id = 'landing';
  el.innerHTML = `
    <h1>Loomsong</h1>
    <p>A tiny loom on your real desk. Hands only.</p>
    <button id="enter-xr" type="button">Enter XR</button>
    <div id="style-pick" role="radiogroup" aria-label="Loom style" hidden>
      <button type="button" data-theme="toy" role="radio">Toy</button>
      <button type="button" data-theme="workshop" role="radio">Workshop</button>
    </div>
    <p class="small">Sit at a desk, controllers down, hand tracking on.</p>
    <div id="settings">
      <button type="button" id="hc" role="switch" aria-checked="false">High contrast</button>
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

  // Accessibility settings.
  const hc = el.querySelector<HTMLButtonElement>('#hc')!;
  const handPick = el.querySelector<HTMLElement>('#hand-pick')!;
  const syncSettings = () => {
    const st = loadSettings();
    hc.setAttribute('aria-checked', String(st.highContrast));
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
    if (s === VisibilityState.NonImmersive) sync();
  });
}
