import { describe, expect, it } from 'vitest';
import { CoopGuest, CoopHost, validGuestMsg, validSnapshot, type Transport } from '../src/net/coop-protocol';
import { LoomController } from '../src/loom/loom-controller';
import { LoomModel } from '../src/loom/loom-model';
import { LevelFlow, type FlowHooks } from '../src/app/level-flow';
import { levelAt } from '../src/puzzle/catalog';

const DT = 1 / 72;

/** In-memory, JSON-serialising pipe pair (like a real data channel). */
function pipe(): [Transport, Transport] {
  const a: Array<(m: unknown) => void> = [];
  const b: Array<(m: unknown) => void> = [];
  const q: Array<() => void> = [];
  const mk = (mine: typeof a, theirs: typeof a): Transport => ({
    send: (m) => {
      const json = JSON.stringify(m);
      q.push(() => theirs.forEach((cb) => cb(JSON.parse(json))));
    },
    onMessage: (cb) => mine.push(cb),
  });
  const ta = mk(a, b);
  const tb = mk(b, a);
  (ta as unknown as { flush: () => void }).flush = () => q.splice(0).forEach((f) => f());
  return [ta, tb];
}

function side(progressLevel = 0) {
  const log: string[] = [];
  const hooks: FlowHooks = {
    load: (l) => log.push(`load ${l.id}`),
    status: () => {},
    win: (s) => log.push(`win ${s}`),
    pluck: () => {},
    glowRow: () => {},
    hint: () => {},
    save: () => {},
  };
  const model = new LoomModel([]);
  const flow = new LevelFlow(model, levelAt, { level: progressLevel, best: {}, tutorialDone: true, theme: 'toy' }, hooks);
  flow.start();
  const controller = new LoomController(model);
  controller.syncFromModel();
  return { model, flow, controller, log };
}

const idle = { tracked: false, pinching: false, edge: 'none' as const, pinch: { x: 0, y: 1, z: 0 }, index: { x: 0, y: 1, z: 0 }, indexVel: { x: 0, y: 0, z: 0 } };

function step(h: ReturnType<typeof side>, g: ReturnType<typeof side>, host: CoopHost, guest: CoopGuest, link: Transport, frames = 1) {
  for (let i = 0; i < frames; i++) {
    h.controller.update({ left: idle, right: idle }, DT);
    h.flow.update(DT);
    host.tick(DT);
    g.controller.update({ left: idle, right: idle }, DT);
    g.flow.update(DT);
    guest.tick(DT);
    (link as unknown as { flush: () => void }).flush();
  }
}

describe('co-op protocol', () => {
  it('validates messages strictly', () => {
    expect(validGuestMsg({ k: 'sh', t: 0.5, h: true })).toBe(true);
    expect(validGuestMsg({ k: 'sh', t: 2, h: true })).toBe(false);
    expect(validGuestMsg({ k: 'req', what: 'rm -rf' })).toBe(false);
    expect(validSnapshot({ k: 's', l: 0, lat: 1, r: [3], sd: 0, t: 0, ph: 'play', st: 0 })).toBe(true);
    expect(validSnapshot({ k: 's', l: 0, lat: 99, r: [3], sd: 0, t: 0, ph: 'play', st: 0 })).toBe(false);
    expect(validSnapshot({ k: 's', l: 0, lat: 1, r: [300], sd: 0, t: 0, ph: 'play', st: 0 })).toBe(true); // a Sea water row (weft bit)
    expect(validSnapshot({ k: 's', l: 0, lat: 1, r: [600], sd: 0, t: 0, ph: 'play', st: 0 })).toBe(false);
    expect(validGuestMsg({ k: 'hi', who: 'caller' })).toBe(true);
    expect(validGuestMsg({ k: 'hi', who: 'admin' })).toBe(false);
    expect(validGuestMsg({ k: 'lev', i: 2, v: true })).toBe(true);
    expect(validGuestMsg({ k: 'lev', i: 7, v: true })).toBe(false);
    expect(validGuestMsg({ k: 'lev', i: 1.5, v: true })).toBe(false);
  });

  it('a phone caller works the host levers; the headset keeps Pip', () => {
    const [a, b] = pipe();
    const h = side(0);
    const host = new CoopHost(h, a);
    let heard = 0;
    host.onCaller = () => heard++;
    const flush = () => (a as unknown as { flush: () => void }).flush();
    // a lever press before saying hello is ignored
    b.send({ k: 'lev', i: 0, v: true });
    flush();
    expect(h.model.latched[0]).toBe(false);
    b.send({ k: 'hi', who: 'caller' });
    flush();
    expect(heard).toBe(1);
    expect(h.controller.allow).toEqual({ levers: true, shuttle: true });
    b.send({ k: 'lev', i: 0, v: true });
    flush();
    expect(h.model.latched[0]).toBe(true);
    // a phone never drives the shuttle
    b.send({ k: 'req', what: 'throw' });
    flush();
    expect(h.model.rows.length).toBe(0);
  });

  it('roles: host may not grab the shuttle, guest may not grab levers', () => {
    const [a, b] = pipe();
    const h = side();
    const g = side(5);
    new CoopHost(h, a);
    new CoopGuest(g, b);
    expect(h.controller.nearest({ x: -0.135, y: 0.017, z: -0.031 }, 0.03)).toBeNull();
    expect(g.controller.nearest({ x: 0.142, y: 0.024, z: 0.075 }, 0.03)).toBeNull();
  });

  it('guest mirrors the host level, levers; the guest shuttle weaves rows on the host', () => {
    const [a, b] = pipe();
    const h = side(0);
    const g = side(5); // guest's own save is elsewhere; it must follow the host
    const host = new CoopHost(h, a);
    const guest = new CoopGuest(g, b);
    step(h, g, host, guest, a, 6);
    expect(g.flow.level.id).toBe('sprout');
    // Warden latches lever 0
    h.controller.toggleLever(0);
    step(h, g, host, guest, a, 6);
    expect(g.model.latched[0]).toBe(true);
    // Shuttler drags across (simulate the guest's own slider being held)
    g.controller.shuttle.held = true;
    for (let i = 0; i <= 30; i++) {
      g.controller.shuttle.t = i / 30;
      step(h, g, host, guest, a, 1);
    }
    g.controller.shuttle.held = false;
    step(h, g, host, guest, a, 10);
    expect(h.model.rows).toEqual([0b00011000]);
    expect(g.model.rows).toEqual([0b00011000]);
    expect(g.model.shuttleSide).toBe(1);
  });

  it('guest throw/undo requests act on the host; the win plays on both', () => {
    const [a, b] = pipe();
    const h = side(0);
    const g = side(0);
    const host = new CoopHost(h, a);
    const guest = new CoopGuest(g, b);
    step(h, g, host, guest, a, 4);
    h.controller.toggleLever(0);
    step(h, g, host, guest, a, 4);
    g.controller.throwShuttle(); // poke → request
    step(h, g, host, guest, a, 90);
    expect(h.model.rows.length).toBe(1);
    g.controller.doUndo(); // bobbin → request
    step(h, g, host, guest, a, 10);
    expect(h.model.rows.length).toBe(0);
    expect(g.model.rows.length).toBe(0);
    // finish Sprout cooperatively: [L0],[L0],[L0+L1]
    const throwAndWait = () => {
      g.controller.throwShuttle();
      step(h, g, host, guest, a, 90);
    };
    throwAndWait();
    throwAndWait();
    h.controller.toggleLever(1);
    step(h, g, host, guest, a, 4);
    throwAndWait();
    expect(h.log.some((l) => l.startsWith('win'))).toBe(true);
    expect(g.log.some((l) => l.startsWith('win'))).toBe(true);
    // host advances after playback; the guest follows
    step(h, g, host, guest, a, 72 * 8);
    expect(h.flow.level.id).toBe('tulip');
    expect(g.flow.level.id).toBe('tulip');
  });
});
