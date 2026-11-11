#!/usr/bin/env node
/** Runs every emulator E2E suite in turn (needs `npx @iwsdk/cli dev up --allow-browser-automation`). */
import { spawnSync } from 'node:child_process';
const suites = ['m0', 'm1', 'm2', 'm3', 'cloth', 'coop', 'plush-sing', 'music-box', 'sea-swap', 'tooltip', 'finale'];
let failed = 0;
for (const s of suites) {
  const r = spawnSync('node', [`tools/e2e-${s}.mjs`], { encoding: 'utf8' });
  const last = (r.stdout || '').trim().split('\n').pop();
  const ok = r.status === 0;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${s.padEnd(11)} ${last ?? ''}`);
}
console.log(failed ? `\n${failed} suite(s) failed` : '\nALL SUITES PASS');
process.exit(failed ? 1 : 0);
