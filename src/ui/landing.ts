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
  const sitePhoto = (f: string) => `${import.meta.env.BASE_URL}site/${f}`;
  el.innerHTML = `
    <div class="frame">
      <i class="spool tl"></i><i class="spool tr"></i><i class="spool bl"></i><i class="spool br"></i>
        <header class="rail"><div class="mark plate">
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
              <h1>Loomsong</h1>
            </div></header>
      <main class="felt">
        <section class="hero">
          <div class="pitch">
            <i class="tape" aria-hidden="true"></i>

            <p id="tagline">A tiny loom on your real desk. Hands only.</p>
            <p class="lede">Lift the levers, slide Pip across, and each row you weave sings. Finish a picture and it comes alive as a little knitted toy.</p>
            <div class="go">
              <button id="enter-xr" class="patch" type="button">Enter mixed reality</button>
              <p class="note">Sit at a desk with your controllers down and hand tracking on.</p>
            </div>
            <div class="nohead" id="xr-unsupported" hidden>
              <i class="tape" aria-hidden="true"></i>
              <p>This browser can't open mixed reality. Open this page in your headset's browser, or join a friend's loom as their caller:</p>
              <div class="row"><input id="call-code" maxlength="4" placeholder="CODE" aria-label="Friend's room code" autocomplete="off" /><button type="button" id="call-join" class="patch">Join as caller</button></div>
            </div>

          </div>
          <figure class="photo hero-photo">
            <i class="peg" aria-hidden="true"></i>
            <video class="clip" muted loop playsinline preload="metadata" poster="${sitePhoto('loom-clip-poster.jpg')}" width="960" height="540"
              aria-label="Gameplay: the levers lift, Pip flies across to weave the last rows of a duck, and the finished duck pops off the loom as a knitted plush">
              <source src="${sitePhoto('loom-clip.mp4')}" type="video/mp4" />
            </video>
            <figcaption class="cap-tag">Recorded in the game</figcaption>
          </figure>
        </section>

        <section class="line" aria-label="How it plays">
          <svg class="yarn" viewBox="0 0 1000 90" preserveAspectRatio="none" aria-hidden="true">
            <defs><pattern id="ply-red" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(55)"><rect width="7" height="7" fill="#c43c28"/><rect width="3.2" height="7" fill="#ee6a4f"/></pattern></defs>
            <path d="M-10 6 Q 230 80 480 52 T 1010 14" fill="none" stroke="#8f2a1c" stroke-width="7" stroke-linecap="round" opacity=".35"/>
            <path d="M-10 6 Q 230 80 480 52 T 1010 14" fill="none" stroke="url(#ply-red)" stroke-width="5.5" stroke-linecap="round"/>
          </svg>
          <ol class="steps">
            <li class="s1"><figure class="photo"><i class="peg"></i><img loading="lazy" src="${sitePhoto('levers-close.jpg')}" alt="The red lever lifts its threads" width="800" height="600" /></figure>
              <div class="hang"><b><span class="num" aria-hidden="true">1</span><span class="visually-hidden">Step 1: </span>Lift the levers</b>Each lever lifts its own threads. Pick the ones that make the next row on the card.</div></li>
            <li class="s2"><figure class="photo"><i class="peg"></i><img loading="lazy" src="${sitePhoto('pip-pinch.jpg')}" alt="A glowing ghost hand shows how to pinch Pip" width="800" height="600" /></figure>
              <div class="hang"><b><span class="num" aria-hidden="true">2</span><span class="visually-hidden">Step 2: </span>Slide Pip across</b>Pinch the little bird and slide it through. The row is woven, and its threads ring out.</div></li>
            <li class="s3"><figure class="photo"><i class="peg"></i><img loading="lazy" src="${sitePhoto('plush-dance.jpg')}" alt="The finished duck pops off the loom as a knitted plush" width="800" height="600" /></figure>
              <div class="hang"><b><span class="num" aria-hidden="true">3</span><span class="visually-hidden">Step 3: </span>Watch it come alive</b>A finished picture pops off the loom as a plush and hops onto your shelf.</div></li>
          </ol>
        </section>

        <section class="more" aria-label="What else is on the desk">
          <svg class="yarn small-yarn" viewBox="0 0 1000 60" preserveAspectRatio="none" aria-hidden="true">
            <defs><pattern id="ply-teal" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(55)"><rect width="6" height="6" fill="#178a7b"/><rect width="2.8" height="6" fill="#4fc2b1"/></pattern></defs>
            <path d="M-10 30 Q 300 4 520 22 T 1010 10" fill="none" stroke="#0d5d53" stroke-width="6" stroke-linecap="round" opacity=".35"/>
            <path d="M-10 30 Q 300 4 520 22 T 1010 10" fill="none" stroke="url(#ply-teal)" stroke-width="4.5" stroke-linecap="round"/>
          </svg>
          <figure class="photo small"><i class="peg"></i><span class="label">Garden, on your shelf</span><img loading="lazy" src="${sitePhoto('shelf.jpg')}" alt="Finished plushes on a little shelf with a brass wind-up key" width="800" height="500" /></figure>
          <div class="note-card"><i class="tape"></i><b>Four chapters, eighteen pictures</b><p>Garden teaches your hands, Home combines levers, Night hides what they lift, and Sea weaves in two colours. Wind the key on your shelf and your plushes sing their songs in turn.</p></div>
          <figure class="photo small"><i class="peg"></i><span class="label">Sea: two colours</span><img loading="lazy" src="${sitePhoto('sea-boat.jpg')}" alt="A red boat woven on blue water rows" width="800" height="500" /></figure>
        </section>

        <div class="drawer">
        <figure id="share-card" hidden>
          <span class="pegged"><i class="tape"></i><img id="cloth-img" alt="Your last woven cloth" /></span>
          <figcaption>
            <b>Your last picture</b>
            <button type="button" id="share-btn" class="patch">Share this cloth</button>
            <span id="share-note" role="status"></span>
          </figcaption>
        </figure>

        <div class="prep">
        <h2 class="before">Before you start</h2>
        <div id="settings" aria-label="Settings">
          <span class="tagwrap"><svg class="string" viewBox="0 0 40 26" aria-hidden="true"><path d="M33 13 C 24 2, 6 2, 3 11 C 1 19, 14 25, 24 19 C 28 17, 31 15, 33 13" fill="none" stroke="#e8553e" stroke-width="2.6" stroke-linecap="round"/></svg><button type="button" class="tag" id="hc" role="switch" aria-checked="false">High contrast</button></span>
          <span class="tagwrap"><svg class="string" viewBox="0 0 40 26" aria-hidden="true"><path d="M33 13 C 24 2, 6 2, 3 11 C 1 19, 14 25, 24 19 C 28 17, 31 15, 33 13" fill="none" stroke="#e8553e" stroke-width="2.6" stroke-linecap="round"/></svg><button type="button" class="tag" id="music" role="switch" aria-checked="true">Music</button></span>
          <span class="tagwrap"><svg class="string" viewBox="0 0 40 26" aria-hidden="true"><path d="M33 13 C 24 2, 6 2, 3 11 C 1 19, 14 25, 24 19 C 28 17, 31 15, 33 13" fill="none" stroke="#e8553e" stroke-width="2.6" stroke-linecap="round"/></svg><button type="button" class="tag" id="fit" aria-pressed="false">Fit to my hands</button></span>
          <span class="tagwrap"><svg class="string" viewBox="0 0 40 26" aria-hidden="true"><path d="M33 13 C 24 2, 6 2, 3 11 C 1 19, 14 25, 24 19 C 28 17, 31 15, 33 13" fill="none" stroke="#e8553e" stroke-width="2.6" stroke-linecap="round"/></svg><div role="radiogroup" aria-label="Lever side" id="hand-pick">
            <span class="lbl">Lever box</span>
            <button type="button" data-hand="auto" role="radio" title="On the side of the hand you place the loom with">auto</button>
            <button type="button" data-hand="left" role="radio">left</button>
            <button type="button" data-hand="right" role="radio">right</button>
          </div></span>
          <div id="style-pick" role="radiogroup" aria-label="Loom style" hidden>
            <span class="lbl">Loom style</span>
            <button type="button" data-theme="toy" role="radio">Toy</button>
            <button type="button" data-theme="workshop" role="radio">Workshop</button>
          </div>
        </div>
        </div>
        </div>

        <section id="coop" aria-labelledby="coop-title">
          <figure class="photo phone"><i class="peg"></i><img loading="lazy" src="${sitePhoto('caller-phone.jpg')}" alt="The caller's phone: the picture card and a big button for each lever" width="520" height="787" /></figure>
          <div class="coop-text">
            <h2 id="coop-title">No headset? Be the caller on your phone.</h2>
            <p>The weaver hosts a loom in their headset and reads out the code. Open this page on your phone and join: you see the card and press the levers while they slide Pip. A friend in a second headset can join as the shuttle thrower instead.</p>
            <div class="row">
              <button type="button" id="coop-host" class="patch">Host a loom</button>
              <span class="or">or</span>
              <input id="coop-code" maxlength="4" placeholder="CODE" aria-label="Room code" autocomplete="off" />
              <button type="button" id="coop-join" class="patch">Join</button>
              <button type="button" id="coop-leave" hidden>Leave</button>
            </div>
            <p id="coop-status" role="status"></p>
            <p class="fine">A direct link between your two devices. No accounts, no voice.</p>
          </div>
        </section>

        <footer class="foot">
          <p class="slip"><i class="tape" aria-hidden="true"></i>Made for a mixed-reality game jam, November 2026, with IWSDK. Every sound is CC0: <a href="${import.meta.env.BASE_URL}audio/CREDITS.md">see the credits</a>.</p>
        </footer>
      </main>
    </div>`;
  document.body.appendChild(el);
  weaveHero(el.querySelector<HTMLElement>('.weave')!);
  feltTexture(el);
  // the gameplay clip loops (muted); with reduced motion it stays on its poster frame
  const clip = el.querySelector<HTMLVideoElement>('video.clip')!;
  if (!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    clip.autoplay = true;
    void clip.play().catch(() => {});
  } else clip.controls = true;
  const btn = el.querySelector<HTMLButtonElement>('#enter-xr')!;
  btn.addEventListener('click', () => {
    audio.resume(); // user gesture: unlock audio early
    world.launchXR();
  });
  if (!world.xrEnabled) {
    // no headset here: the main action becomes joining a friend's loom as the caller
    el.querySelector<HTMLElement>('.go')!.hidden = true;
    el.querySelector<HTMLElement>('#xr-unsupported')!.hidden = false;
  }
  const callCode = el.querySelector<HTMLInputElement>('#call-code')!;
  const callJoin = () => void coop.join(callCode.value, 'caller');
  el.querySelector('#call-join')!.addEventListener('click', callJoin);
  callCode.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') callJoin();
  });
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
  // a little duck drawn for the mark: '#' body, 'b' beak, 'e' eye (top → bottom)
  const rows = ['....##..', '...##eb.', '....##..', '#...###.', '#######.', '.#####..', '..###...'];
  const pic = PICTURES.find((p) => p.id === 'duck') ?? PICTURES[0];
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
      c.className = ch === '#' ? 'px' : ch === 'b' ? 'px beak' : ch === 'e' ? 'px eye' : 'gr';
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

/** Soft felt fibre noise for the bed (a small canvas tile, made once). */
function feltTexture(el: HTMLElement): void {
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 160;
    const g = c.getContext('2d')!;
    const img = g.createImageData(160, 160);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random();
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = v > 0.55 ? Math.round((v - 0.55) * 60) : 0; // sparse, faint light fibres
    }
    g.putImageData(img, 0, 0);
    el.style.setProperty('--felt-noise', `url(${c.toDataURL()})`);
  } catch {
    /* plain felt */
  }
}
