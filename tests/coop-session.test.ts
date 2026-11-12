import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// A stand-in PeerJS: `mode` decides how the public connection service behaves.
let mode: 'silent' | 'network' | 'ok' = 'silent';
let made = 0;
vi.mock('peerjs', () => ({
  Peer: class {
    private h: Record<string, (...a: unknown[]) => void> = {};
    constructor() {
      made++;
      const m = mode;
      setTimeout(() => {
        if (m === 'ok') this.h.open?.();
        if (m === 'network') this.h.error?.({ type: 'network' });
      }, 10);
    }
    on(ev: string, cb: (...a: unknown[]) => void) {
      this.h[ev] = cb;
    }
    connect() {
      return { on() {}, close() {}, send() {}, open: false };
    }
    destroy() {}
  },
}));

const g = globalThis as unknown as { window: unknown };
beforeEach(() => {
  vi.useFakeTimers();
  // a window with timers and events (Node has EventTarget and CustomEvent)
  const target = new EventTarget();
  g.window = { setTimeout, clearTimeout, dispatchEvent: (e: Event) => target.dispatchEvent(e), addEventListener: target.addEventListener.bind(target) };
  made = 0;
});
afterEach(() => vi.useRealTimers());

describe('co-op when the connection service is down', () => {
  it('a host that never hears back says so after a while (no endless "Connecting…")', async () => {
    mode = 'silent';
    const { coop } = await import('../src/net/coop');
    await coop.host();
    expect(coop.status.state).toBe('hosting');
    await vi.advanceTimersByTimeAsync(13000);
    expect(coop.status.state).toBe('error');
    expect(coop.status.message).toMatch(/co-op server/);
  });

  it('a network hiccup gets one quiet retry before giving up', async () => {
    mode = 'network';
    const { coop } = await import('../src/net/coop');
    await coop.host();
    await vi.advanceTimersByTimeAsync(100);
    expect(coop.status.state).toBe('hosting'); // retrying, not failed yet
    await vi.advanceTimersByTimeAsync(1600);
    await vi.dynamicImportSettled(); // the retry loads the (mock) library again
    await vi.advanceTimersByTimeAsync(200);
    expect(made).toBe(2);
    expect(coop.status.state).toBe('error');
  });

  it('a joiner who never reaches the loom is told to check the code', async () => {
    mode = 'ok';
    const { coop } = await import('../src/net/coop');
    await coop.join('CDFH', 'caller');
    await vi.advanceTimersByTimeAsync(13000);
    expect(coop.status.state).toBe('error');
    expect(coop.status.message).toMatch(/check the code/);
  });
});
