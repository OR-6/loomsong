/**
 * Co-op session over WebRTC (PeerJS, loaded on demand). The only part of
 * Loomsong that talks to the network, and only after a player opens
 * "Play together". Signalling goes through PeerJS's public broker; game data
 * flows peer-to-peer (or via PeerJS's TURN relay if direct fails).
 * No accounts, no voice, no personal data: room codes are random.
 */
import type { Transport } from './coop-protocol.js';

export type CoopRole = 'host' | 'guest';
export interface CoopStatus {
  state: 'idle' | 'hosting' | 'joining' | 'connected' | 'error' | 'closed';
  role?: CoopRole;
  code?: string;
  message?: string;
}

/** No vowels (no accidental words), no look-alikes (0/O, 1/I). */
export const CODE_ALPHABET = 'CDFHJKMNPRTVWXY';
const PREFIX = 'loomsong-v1-';

export function randomCode(): string {
  const b = new Uint8Array(4);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => CODE_ALPHABET[x % CODE_ALPHABET.length]).join('');
}

export function normaliseCode(raw: string): string | null {
  const c = raw.trim().toUpperCase();
  return /^[CDFHJKMNPRTVWXY]{4}$/.test(c) ? c : null;
}

type PeerLike = { destroy(): void; on(ev: string, cb: (...a: unknown[]) => void): void; connect(id: string, o?: object): ConnLike };
type ConnLike = { send(d: unknown): void; on(ev: string, cb: (...a: unknown[]) => void): void; close(): void; open: boolean };

class CoopSession {
  status: CoopStatus = { state: 'idle' };
  transport: Transport | null = null;
  private peer: PeerLike | null = null;
  private conn: ConnLike | null = null;
  /** Bumped on every host/join/leave; stale async work and handlers check it. */
  private gen = 0;

  private set(s: CoopStatus): void {
    this.status = s;
    window.dispatchEvent(new CustomEvent('loomsong:coop', { detail: s }));
  }

  private async newPeer(id?: string): Promise<PeerLike> {
    const { Peer } = await import('peerjs');
    return (id ? new Peer(id, { debug: 0 }) : new Peer({ debug: 0 })) as unknown as PeerLike;
  }

  private attach(conn: ConnLike, role: CoopRole, code: string, gen: number): void {
    if (gen !== this.gen) return conn.close();
    this.conn = conn;
    const listeners: Array<(m: unknown) => void> = [];
    const live = () => this.gen === gen && this.conn === conn;
    conn.on('data', (d) => {
      if (live()) listeners.forEach((cb) => cb(d));
    });
    conn.on('close', () => {
      if (live()) this.closed('Your partner left');
    });
    conn.on('error', () => {
      if (live()) this.closed('Connection lost');
    });
    this.transport = {
      send: (m) => {
        if (conn.open) conn.send(m);
      },
      onMessage: (cb) => listeners.push(cb),
    };
    this.set({ state: 'connected', role, code });
  }

  async host(tries = 3): Promise<void> {
    this.leave(true);
    const gen = this.gen;
    const code = randomCode();
    this.set({ state: 'hosting', role: 'host', code, message: 'Connecting…' });
    try {
      const peer = await this.newPeer(PREFIX + code);
      if (gen !== this.gen) return peer.destroy(); // left while loading
      this.peer = peer;
      peer.on('open', () => {
        if (gen === this.gen) this.set({ state: 'hosting', role: 'host', code, message: 'Waiting for a friend' });
      });
      peer.on('connection', (c) => {
        const conn = c as ConnLike;
        if (this.conn || gen !== this.gen) return conn.close(); // one partner only
        conn.on('open', () => this.attach(conn, 'host', code, gen));
      });
      peer.on('error', (e) => {
        if (gen !== this.gen) return;
        const type = (e as { type?: string }).type;
        if (type === 'unavailable-id' && tries > 0) void this.host(tries - 1);
        else this.set({ state: 'error', message: 'Could not reach the co-op server' });
      });
    } catch {
      this.set({ state: 'error', message: 'Co-op is unavailable here' });
    }
  }

  async join(raw: string): Promise<void> {
    const code = normaliseCode(raw);
    if (!code) {
      this.set({ state: 'error', message: 'Codes are 4 letters' });
      return;
    }
    this.leave(true);
    const gen = this.gen;
    this.set({ state: 'joining', role: 'guest', code, message: 'Connecting…' });
    try {
      const peer = await this.newPeer();
      if (gen !== this.gen) return peer.destroy();
      this.peer = peer;
      peer.on('open', () => {
        if (gen !== this.gen) return;
        const conn = peer.connect(PREFIX + code, { reliable: true, serialization: 'json' });
        conn.on('open', () => this.attach(conn, 'guest', code, gen));
      });
      peer.on('error', (e) => {
        if (gen !== this.gen) return;
        const type = (e as { type?: string }).type;
        this.set({ state: 'error', message: type === 'peer-unavailable' ? 'No loom with that code' : 'Could not reach the co-op server' });
      });
    } catch {
      this.set({ state: 'error', message: 'Co-op is unavailable here' });
    }
  }

  private closed(message: string): void {
    this.gen++;
    this.conn = null;
    this.transport = null;
    this.peer?.destroy();
    this.peer = null;
    this.set({ state: 'closed', message });
  }

  leave(silent = false): void {
    this.gen++;
    this.conn?.close();
    this.conn = null;
    this.transport = null;
    this.peer?.destroy();
    this.peer = null;
    if (!silent) this.set({ state: 'idle' });
  }
}

export const coop = new CoopSession();
