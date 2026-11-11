/**
 * Photos hung on yarn: each pegged photo hangs exactly from its string (the
 * peg's grip sits on the drawn curve, wherever the string sags at that point
 * and whatever the page width), and swings on its peg when the mouse brushes
 * past, the push matching the mouse's speed and direction, settling like a
 * damped pendulum. Reduced motion: hung, but never swinging.
 */

interface Hung {
  /** What moves to meet the string (the photo with its paper tag). */
  box: HTMLElement;
  /** What swings on the peg (the photo). */
  fig: HTMLElement;
  peg: HTMLElement;
  path: SVGPathElement;
  svg: SVGSVGElement;
  a: number; // swing angle (deg)
  v: number; // angular velocity (deg/s)
}

/** Grip point of a peg: where its jaws close on the string (a little below its top). */
const GRIP = 10;

export function hangPhotos(root: HTMLElement): void {
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const hung: Hung[] = [];
  for (const sec of root.querySelectorAll<HTMLElement>('[data-yarn]')) {
    const svg = sec.querySelector<SVGSVGElement>('svg.yarn');
    const path = svg?.querySelector<SVGPathElement>('path[data-line]') ?? svg?.querySelector<SVGPathElement>('path:last-of-type');
    if (!svg || !path) continue;
    for (const box of sec.querySelectorAll<HTMLElement>('[data-hang]')) {
      const peg = box.querySelector<HTMLElement>('.peg');
      const fig = (peg?.parentElement as HTMLElement | null) ?? box;
      if (peg) hung.push({ box, fig, peg, path, svg, a: 0, v: 0 });
    }
  }
  if (!hung.length) return;

  /** The string's height (page px) at page x, read off the drawn curve. */
  const yAt = (h: Hung, x: number): number | null => {
    const r = h.svg.getBoundingClientRect();
    const vb = h.svg.viewBox.baseVal;
    if (!r.width || !vb.width) return null;
    const ux = ((x - r.left) / r.width) * vb.width + vb.x;
    const len = h.path.getTotalLength();
    // binary search along the path for the point at this x (the string runs left to right)
    let lo = 0;
    let hi = len;
    for (let k = 0; k < 24; k++) {
      const mid = (lo + hi) / 2;
      if (h.path.getPointAtLength(mid).x < ux) lo = mid;
      else hi = mid;
    }
    const p = h.path.getPointAtLength((lo + hi) / 2);
    return r.top + ((p.y - vb.y) / vb.height) * r.height;
  };

  /** Move each photo up or down so its peg grips the string. */
  const place = () => {
    for (const h of hung) {
      h.box.style.setProperty('--hang', '0px');
      // swing about the peg's grip
      const pr = h.peg.getBoundingClientRect();
      const fr = h.fig.getBoundingClientRect();
      if (pr.width) h.fig.style.transformOrigin = `${(pr.left + pr.width / 2 - fr.left).toFixed(1)}px ${(pr.top + GRIP - fr.top).toFixed(1)}px`;
    }
    for (let pass = 0; pass < 2; pass++) {
      for (const h of hung) {
        const pr = h.peg.getBoundingClientRect();
        if (!pr.width) continue;
        const y = yAt(h, pr.left + pr.width / 2);
        if (y === null) continue;
        const cur = parseFloat(h.box.style.getPropertyValue('--hang')) || 0;
        const d = y - (pr.top + GRIP);
        // stacked layouts (phones): a photo far from its string just stays where the page puts it
        if (pass === 0 && Math.abs(d) > 90) continue;
        h.box.style.setProperty('--hang', `${(cur + d).toFixed(1)}px`);
      }
    }
  };
  place();
  window.addEventListener('resize', () => requestAnimationFrame(place));
  document.fonts?.ready.then(() => requestAnimationFrame(place)).catch(() => {});
  window.setTimeout(place, 600);
  for (const img of root.querySelectorAll('img')) if (!img.complete) img.addEventListener('load', () => requestAnimationFrame(place), { once: true });

  if (reduce) return;
  // the swing: a damped pendulum about the peg, pushed by the pointer brushing past
  let raf = 0;
  let last = 0;
  const tick = (now: number) => {
    const dt = Math.min(0.04, (now - last) / 1000 || 0.016);
    last = now;
    let live = false;
    for (const h of hung) {
      h.v += (-90 * h.a - 4.2 * h.v) * dt;
      h.a += h.v * dt;
      if (Math.abs(h.a) < 0.02 && Math.abs(h.v) < 0.05) {
        h.a = 0;
        h.v = 0;
      } else live = true;
      h.fig.style.setProperty('--swing', `${h.a.toFixed(2)}deg`);
    }
    raf = live ? requestAnimationFrame(tick) : 0;
  };
  const kick = () => {
    if (!raf) {
      last = performance.now();
      raf = requestAnimationFrame(tick);
    }
  };
  for (const h of hung) {
    let px = 0;
    let pt = 0;
    h.fig.addEventListener('pointerenter', (e) => {
      px = e.clientX;
      pt = e.timeStamp;
    });
    h.fig.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      const dt = Math.max(8, e.timeStamp - pt);
      const vx = (e.clientX - px) / dt; // px per ms
      px = e.clientX;
      pt = e.timeStamp;
      // a brush of the hand: push the way the pointer moves, capped so it never spins
      h.v = Math.max(-60, Math.min(60, h.v + vx * 7));
      kick();
    });
    h.fig.addEventListener('pointerdown', () => {
      h.v += (Math.random() < 0.5 ? -1 : 1) * 30; // a tap sets it swinging too (touch screens)
      kick();
    });
  }
}
