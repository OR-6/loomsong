/**
 * Loomsong entry point. World options come from iwsdk.config.json via the
 * virtual project module; systems are registered explicitly in run order.
 */
import { World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { GameSystem } from './app/game-system.js';
import { HandTrackerSystem } from './input/hands.js';
import { HandOccluderSystem } from './input/occluders.js';
import { mountLanding } from './ui/landing.js';
import { loadFonts } from './ui/fonts.js';

const container = document.getElementById('scene-container') as HTMLDivElement;

await loadFonts();

World.create(container, projectOptions).then((world) => {
  world.registerSystem(HandTrackerSystem, { priority: -5 });
  world.registerSystem(GameSystem, { priority: 0 });
  world.registerSystem(HandOccluderSystem, { priority: 1 });
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('probe')) {
    void import('./probe.js').then((m) => world.registerSystem(m.ProbeSystem));
  }
  mountLanding(world);
});
