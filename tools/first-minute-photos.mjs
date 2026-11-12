#!/usr/bin/env node
// The first minute, as three stills for a gallery strip: a palm resting on the desk (the ring of dots
// filling), the loom unfolding under it, then the first tag and the ghost hand on the lever. Each moment is
// caught by pausing the game in the page when it arrives. Writes artifacts/first-minute/{1,2,3}.png.
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { cli, run, xr, wait, freshSession, HAND, FLAT } from './e2e-lib.mjs';

const OUT = 'artifacts/first-minute';
mkdirSync(OUT, { recursive: true });
const evalJs = (src) => {
  const f = 'tools/_snip.mjs';
  execFileSync('bash', ['-c', `cat > ${f} <<'EOF'\nexport default async function run({ page, frame }) { return await (frame ?? page).evaluate(async () => { ${src} }); }\nEOF`]);
  try {
    return run(f);
  } finally {
    execFileSync('rm', ['-f', f]);
  }
};
const snap = (n) => cli('browser', 'screenshot', '--output-file', `${OUT}/${n}.png`);

await freshSession();
// the warm photo set (a maple desk and a soft backdrop) is part of the loom: before it's placed, borrow it
// and stand it where the desk will be
evalJs(`const g = window.__loom.game; g.view.photoSet(true); const ph = g.view.photo; g.world.scene.add(ph); ph.position.set(0.05, 0.781, -0.45); ph.visible = true; return 1;`);
// a loom resumed from a saved spot folds away first, so it unfolds under the palm like a first visit
evalJs(`const g = window.__loom.game; if (g.placement.phase === 'placed') g.moveLoom(); await new Promise((r) => setTimeout(r, 1500)); return g.placement.phase;`);
// the head looks down at the spot on the desk where the palm will rest
const palm = { x: 0.05, y: 0.8, z: -0.33 };
xr('set-device-state', { state: { fov: 62 } });
xr('set-transform', { device: 'headset', position: { x: 0.02, y: 1.18, z: 0.05 } });
xr('look-at', { device: 'headset', target: { x: 0.04, y: 0.8, z: -0.36 } });
xr('set-transform', { device: 'hand-left', position: { x: -0.9, y: 1.4, z: 0.4 }, orientation: { pitch: 0, yaw: 0, roll: 90 } });
await wait(800);

// 1. the palm rests: hold the moment the ring is about half round
xr('set-transform', { device: HAND, position: palm, orientation: FLAT });
console.log("f1", JSON.stringify(evalJs(`const g = window.__loom.game; const seen = [g.placement.phase]; for (let i = 0; i < 300; i++) { if (g.placement.phase === "steadying" && g.holdRing.count >= 6) break; if (seen.at(-1) !== g.placement.phase) seen.push(g.placement.phase); await new Promise((r) => setTimeout(r, 10)); } g.setPaused(true); return [seen, g.holdRing.count];`)));
snap(1);
// 2. the loom unfolding under the hand
evalJs(`const g = window.__loom.game; g.setPaused(false); for (let i = 0; i < 400; i++) { if (g.placement.phase === 'placed' && g.bloom > 0.3) break; await new Promise((r) => setTimeout(r, 3)); } g.setPaused(true); return g.bloom;`);
snap(2);
// (the borrowed set goes back onto the loom now it's full size)
evalJs(`const g = window.__loom.game; g.setPaused(false); await new Promise((r) => setTimeout(r, 900)); const ph = g.view.photo; g.view.root.add(ph); ph.position.set(0, 0, 0); return 1;`);
// 3. the tour's tag on the lever, the ghost hand showing the push (the hand lifted away, as a player would)
evalJs(`const g = window.__loom.game; g.setPaused(false); return 1;`);
xr('set-transform', { device: HAND, position: { x: 0.9, y: 1.4, z: 0.4 }, orientation: { pitch: 0, yaw: 0, roll: -90 } });
evalJs(`const g = window.__loom.game; const gh = g.view.ghost; for (let i = 0; i < 2000; i++) { if (g.introT < 0 && g.flow.hintStep === 'lever' && gh.root.visible && gh.t > 0.9) break; await new Promise((r) => setTimeout(r, 10)); } g.setPaused(true); return [g.flow.hintStep, gh.root.visible, gh.t];`);
snap(3);
evalJs(`window.__loom.game.setPaused(false); return 1;`);
process.env.PHOTO = '0';
run('tools/photo-on.mjs');
console.log('done');
