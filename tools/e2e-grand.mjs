#!/usr/bin/env node
// E2E: the grand finale. Weave the very last picture (Boat); after the Sea's own finale the loom
// weaves a gold heart by itself, every plush sings, the credits go by, and play goes on.
// Optional: screenshots to OUT dir.
import { cli, run, xr, wait, freshSession, setTable, check, done } from './e2e-lib.mjs';
import { execFileSync } from 'node:child_process';
const OUT = process.argv[2];
const G = (action = 'state') => JSON.parse(execFileSync('npx', ['@iwsdk/cli', 'browser', 'run', 'tools/grand-state.mjs'], { encoding: 'utf8', env: { ...process.env, GRAND_ACTION: action } })).data.result;
const until = async (pred, secs) => {
  let s = G();
  for (let i = 0; i < secs * 2 && !pred(s); i++) {
    await wait(500);
    s = G();
  }
  return s;
};
await freshSession();
await setTable();
await wait(1000);
run('tools/seed-all-but-boat.mjs');
await wait(800);
let s = G();
check('the last picture is up', s.level === 'boat', JSON.stringify(s));
G('solve');
s = await until((x) => x.grand === 'weaving', 70);
check('after the last chapter, the loom starts weaving a thank-you by itself', s.grand === 'weaving' && s.level === 'thanks' && s.plaque === 'Thank you', JSON.stringify(s));
check("the player's hands rest while it weaves", s.allow.levers === false && s.allow.shuttle === false, JSON.stringify(s.allow));
if (OUT) {
  const o = run('tools/state.mjs').debug.loomOrigin;
  await wait(3500);
  xr('set-device-state', { state: { fov: 60 } });
  xr('set-transform', { device: 'headset', position: { x: o[0], y: o[1] + 0.3, z: o[2] + 0.42 } });
  xr('look-at', { device: 'headset', target: { x: o[0], y: o[1] + 0.06, z: o[2] - 0.02 } });
  await wait(600);
  cli('browser', 'screenshot', '--output-file', `${OUT}/grand-weaving.png`);
}
s = await until((x) => x.grand.startsWith('medley'), 40);
check('the heart is woven, then the Garden shelf springs up and sings', s.grand === 'medley garden' && s.rows >= 6, JSON.stringify(s));
s = await until((x) => /Scott Buckley/.test(x.banner), 20);
check('the credits go by on the ribbon', /Scott Buckley/.test(s.banner), s.banner);
if (OUT) {
  cli('browser', 'screenshot', '--output-file', `${OUT}/grand-credits.png`);
  xr('set-device-state', { state: { fov: 90 } });
}
s = await until((x) => x.grand === 'medley sea', 40);
check('chapter by chapter, up to the Sea', s.grand === 'medley sea', JSON.stringify(s));
s = await until((x) => x.grand === 'done', 60);
check('then play goes on with the next pattern, hands back', s.grand === 'done' && !s.challenge && s.phase === 'play' && s.allow.levers === true, JSON.stringify(s));
check('the shelf stays up after the end (the last chapter)', s.shelf === 'Sea 5/5', s.shelf);
done('grand finale');
