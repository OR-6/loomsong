#!/usr/bin/env node
// E2E: settings inside the headset. A "Settings" tag sits by the loom; poking it opens four toggles;
// poking one changes the setting at once (saved like the 2D page) and its tag says so.
import { execFileSync } from 'node:child_process';
import { wait, freshSession, setTable, check, done } from './e2e-lib.mjs';
const S = (a) => JSON.parse(execFileSync('npx', ['@iwsdk/cli', 'browser', 'run', 'tools/settings-tags.mjs'], { encoding: 'utf8', env: { ...process.env, SET_ACTION: a } })).data.result;
await freshSession();
await setTable();
await wait(1500);
let s = S('state');
check('a Settings tag is out, the toggles folded away', s.spots[0] && !s.spots[1] && s.texts[0] === 'Settings', JSON.stringify(s));
s = S('open');
check('poking it opens four toggles', s.open && s.spots.slice(1).every(Boolean), JSON.stringify(s.spots));
s = S('toggle2');
check('High contrast turns on from the headset (saved)', s.hc && s.texts[2] === 'High contrast: on', JSON.stringify(s));
s = S('toggle2');
check('and off again', !s.hc && s.texts[2] === 'High contrast: off', JSON.stringify(s));
s = S('toggle3');
check('Rows by ear can be switched off', s.ear === false && s.texts[3] === 'Rows by ear: off', JSON.stringify(s));
s = S('open');
check('poking Settings again folds them away', !s.open && !s.spots[1], JSON.stringify(s.spots));
done('settings');
