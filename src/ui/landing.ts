/**
 * 2D landing page shown outside XR: title, one Enter button, judge hint.
 * (Zero floating menus in XR; this is the browser page only.)
 */
import { VisibilityState, type World } from '@iwsdk/core';
import { audio } from '../audio/synth.js';

export function mountLanding(world: World): void {
  const el = document.createElement('div');
  el.id = 'landing';
  el.innerHTML = `
    <h1>Loomsong</h1>
    <p>A tiny loom on your real desk. Hands only.</p>
    <button id="enter-xr" type="button">Enter XR</button>
    <p class="small">Sit at a desk, controllers down, hand tracking on.</p>
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
  world.visibilityState.subscribe((s) => {
    el.style.display = s === VisibilityState.NonImmersive ? '' : 'none';
  });
}
