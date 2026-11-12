#!/usr/bin/env node
// The Devpost gallery, curated from artifacts/gallery (site-photos, strip-draw, finale-photo) into
// artifacts/devpost in story order: payoff first, how it plays, then one shot per idea.
import { cpSync, mkdirSync, rmSync } from 'node:fs';
const ORDER = [
  ['01-picture-comes-alive.jpg', '01-picture-comes-alive.jpg'],
  ['16-how-it-plays.jpg', '02-how-it-plays.jpg'],
  ['02-plushes-help.jpg', '03-plushes-help.jpg'],
  ['03-night-deduce-the-levers.jpg', '04-night-deduce-the-levers.jpg'],
  ['04-a-hand-shows-how.jpg', '05-a-hand-shows-how.jpg'],
  ['06-loom-on-your-desk.jpg', '06-loom-on-your-desk.jpg'],
  ['09-shelf-and-desk.jpg', '07-shelf-and-desk.jpg'],
  ['10-sea-two-colours.jpg', '08-sea-two-colours.jpg'],
  ['11-call-a-friend.jpg', '09-call-a-friend.jpg'],
  ['12-phone-caller.jpg', '10-phone-caller.jpg'],
  ['13-present-of-the-day.jpg', '11-present-of-the-day.jpg'],
  ['14-look-to-play.jpg', '12-look-to-play.jpg'],
  ['17-the-ending.jpg', '13-the-ending.jpg'],
];
rmSync('artifacts/devpost', { recursive: true, force: true });
mkdirSync('artifacts/devpost', { recursive: true });
for (const [from, to] of ORDER) cpSync(`artifacts/gallery/${from}`, `artifacts/devpost/${to}`);
console.log(`artifacts/devpost: ${ORDER.length} images`);
