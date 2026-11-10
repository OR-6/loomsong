/**
 * Audio. One AudioContext, created on the first user gesture (pinch/poke)
 * with latencyHint 'interactive'.
 *
 * Recorded CC0 samples (public/audio, built by tools/audio/build-audio.sh):
 * a real kalimba for the threads (pitch-shifted from the nearest note),
 * wooden clacks and cloth for the loom, a glockenspiel run for a finished
 * picture. Until they've loaded (or if they fail) every voice falls back to
 * the procedural synth: triangle + sine overtone → lowpass.
 * Reverb = convolver with a generated impulse. Master compressor.
 */
import { WARPS } from '../config.js';

const KALIMBA = [47, 49, 51, 54, 56, 59, 61, 63, 66, 69, 71];
const FX: Record<string, number> = { 'wood-light': 5, plank: 5, 'wood-medium': 5, soft: 5, cloth: 4, flip: 3, tick: 3 };
/** The glockenspiel run is in F♯ major pentatonic (pitch class 6). */
const GLOCK_PC = 6;
const audioUrl = (f: string) => `${import.meta.env.BASE_URL}audio/${f}`;

/** Major pentatonic degrees in semitones. */
const PENTA = [0, 2, 4, 7, 9];

export function scaleFreq(warp: number, rootMidi = 62, scale = PENTA): number {
  const octave = Math.floor(warp / scale.length);
  const deg = scale[warp % scale.length];
  const midi = rootMidi + octave * 12 + deg;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

class Synth {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private dry!: GainNode;
  private wet!: GainNode;
  private paused = false;
  rootMidi = 62;
  /** Lowpass brightness multiplier (theme). */
  tone = 1;
  reverbOn = true;
  freqs: number[] = [];
  private bufs = new Map<string, AudioBuffer>();

  constructor() {
    this.setRoot(62);
  }

  setRoot(midi: number) {
    this.rootMidi = midi;
    this.freqs = Array.from({ length: WARPS }, (_, i) => scaleFreq(i, midi));
  }

  /** Create/resume the context. Must be called from a user gesture path. */
  resume(): void {
    try {
      if (!this.ctx) this.build();
      if (this.ctx && this.ctx.state === 'suspended' && !this.paused) void this.ctx.resume();
    } catch {
      /* audio unavailable: game remains fully playable (visual twins) */
    }
  }

  setPaused(p: boolean): void {
    this.paused = p;
    if (!this.ctx) return;
    if (p) void this.ctx.suspend();
    else void this.ctx.resume();
  }

  setReverb(on: boolean): void {
    this.reverbOn = on;
    if (this.wet) this.wet.gain.value = on ? 0.28 : 0;
  }

  private build(): void {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor({ latencyHint: 'interactive' });
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 4;
    this.master = ctx.createGain();
    this.master.gain.value = 0.8;
    this.dry = ctx.createGain();
    this.wet = ctx.createGain();
    this.wet.gain.value = this.reverbOn ? 0.28 : 0;
    const conv = ctx.createConvolver();
    conv.buffer = impulse(ctx, 1.6, 2.5);
    this.dry.connect(this.master);
    this.wet.connect(conv).connect(this.master);
    this.master.connect(comp).connect(ctx.destination);
    void this.load(ctx);
  }

  /** Fetch + decode every sample once (≈ 250 KB). Failures just keep the synth. */
  private async load(ctx: AudioContext): Promise<void> {
    const names = [
      ...KALIMBA.map((m) => `kalimba/k${m}.ogg`),
      ...Object.entries(FX).flatMap(([n, c]) => Array.from({ length: c }, (_, i) => `fx/${n}-${i}.ogg`)),
      'fx/glock-gliss.ogg',
    ];
    await Promise.all(
      names.map(async (n) => {
        try {
          const res = await fetch(audioUrl(n));
          if (!res.ok) return;
          this.bufs.set(n, await ctx.decodeAudioData(await res.arrayBuffer()));
        } catch {
          /* keep the synth voice */
        }
      }),
    );
  }

  /** Play a decoded sample; false if it isn't available (caller falls back). */
  private play(name: string, gain: number, when = 0, rate = 1, wet = true): boolean {
    const ctx = this.ready();
    const buf = this.bufs.get(name);
    if (!ctx || !buf) return false;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(g);
    if (wet) this.bus(g);
    else g.connect(this.dry);
    src.start(ctx.currentTime + when);
    return true;
  }

  /** One of the numbered variants (`wood-light-0..4`), picked at random. */
  private fx(name: string, gain: number, when = 0, wet = false): boolean {
    const n = FX[name] ?? 1;
    const i = Math.floor(Math.random() * n);
    return this.play(`fx/${name}-${i}.ogg`, gain, when, 0.96 + Math.random() * 0.08, wet);
  }

  /** Kalimba note at a MIDI pitch from the nearest recorded note. */
  private kalimba(midi: number, gain: number, when = 0): boolean {
    let best = KALIMBA[0];
    for (const m of KALIMBA) if (Math.abs(m - midi) < Math.abs(best - midi)) best = m;
    return this.play(`kalimba/k${best}.ogg`, gain, when, Math.pow(2, (midi - best) / 12));
  }

  private midiOf(warp: number): number {
    const oct = Math.floor(warp / PENTA.length);
    return this.rootMidi + oct * 12 + PENTA[warp % PENTA.length];
  }

  /** Soft tick when a hand first hovers a control (no haptics on hands). */
  tick(): void {
    this.fx('tick', 0.15);
  }

  /** A mystery lever shows its colour: a bright two-note chime. */
  reveal(): void {
    if (!this.kalimba(this.rootMidi + 19, 0.22)) this.pluck(7, 0.6, 0, 0.14);
    this.kalimba(this.rootMidi + 24, 0.2, 0.08);
  }

  /** Plush hop / soft landing. */
  hop(): void {
    this.fx('soft', 0.5);
  }

  /**
   * Context if it can play now. Every call also (re)tries to start audio:
   * browsers only allow it after a user gesture, and in XR any pinch/poke
   * or session select event can be that gesture, so keep asking.
   */
  private ready(): AudioContext | null {
    if (!this.ctx) this.resume();
    const c = this.ctx;
    if (c && c.state !== 'running' && !this.paused) void c.resume().catch(() => {});
    return c && c.state === 'running' && !this.paused ? c : null;
  }

  private bus(node: AudioNode): void {
    node.connect(this.dry);
    node.connect(this.wet);
  }

  /** Harp-like pluck for warp i; brighter with faster strums. */
  pluck(warp: number, speed = 0.3, when = 0, gain = 0.32): void {
    const ctx = this.ready();
    if (!ctx) return;
    // Recorded kalimba; faster strums are a touch louder.
    if (this.kalimba(this.midiOf(warp), gain * (0.95 + 0.45 * Math.min(1, speed / 0.6)), when)) return;
    const t = ctx.currentTime + when;
    const f = this.freqs[warp] ?? 440;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(gain, t + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    const bright = Math.min(1, speed / 0.6);
    lp.frequency.setValueAtTime((1800 + 3200 * bright) * this.tone, t);
    lp.frequency.exponentialRampToValueAtTime(600, t + 0.6);
    const o1 = ctx.createOscillator();
    o1.type = 'triangle';
    o1.frequency.value = f;
    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = f * 2;
    const g2 = ctx.createGain();
    g2.gain.value = 0.25;
    o1.connect(lp);
    o2.connect(g2).connect(lp);
    lp.connect(env);
    this.bus(env);
    o1.start(t);
    o2.start(t);
    o1.stop(t + 1.5);
    o2.stop(t + 1.5);
  }

  /** Lever click; latch adds a soft tone. */
  click(latched: boolean): void {
    this.resume();
    const ctx = this.ready();
    if (!ctx) return;
    const t = ctx.currentTime;
    if (this.fx(latched ? 'plank' : 'wood-light', latched ? 0.45 : 0.32)) {
      if (latched) this.kalimba(this.rootMidi + 12, 0.08, 0.01);
      return;
    }
    this.noiseBurst(ctx, t, 0.025, 2600, 0.18);
    if (latched) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = this.freqs[0] * 2;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.08, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      o.connect(g);
      this.bus(g);
      o.start(t);
      o.stop(t + 0.3);
    }
  }

  /** Beat (comb) thud at the end of a pass. */
  thud(): void {
    const ctx = this.ready();
    if (!ctx) return;
    if (this.fx('wood-medium', 0.45)) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(55, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g).connect(this.dry);
    o.start(t);
    o.stop(t + 0.25);
    this.noiseBurst(ctx, t, 0.04, 900, 0.12);
  }

  /** Theme switch: a quick shimmer. */
  restyle(): void {
    this.resume();
    this.fx('flip', 0.5);
    for (let i = 0; i < 4; i++) this.pluck(7 - i * 2, 0.6, i * 0.04, 0.12);
  }

  /** Unpick (undo): a quick falling pair. */
  unpick(): void {
    this.fx('cloth', 0.45);
    this.pluck(5, 0.1, 0, 0.16);
    this.pluck(2, 0.1, 0.07, 0.14);
  }

  /** Loom unfolds: soft rising arpeggio. */
  bloom(): void {
    for (let i = 0; i < 4; i++) this.pluck(i * 2, 0.2, i * 0.09, 0.18);
  }

  /** Level complete. */
  arpeggio(): void {
    for (let i = 0; i < WARPS; i++) this.pluck(i, 0.5, i * 0.07, 0.22);
    // Glockenspiel run on top, shifted into the level's key (±6 semitones).
    let shift = (((this.rootMidi - GLOCK_PC) % 12) + 12) % 12;
    if (shift > 6) shift -= 12;
    this.play('fx/glock-gliss.ogg', 0.28, 0.25, Math.pow(2, shift / 12));
  }

  private noiseBurst(ctx: AudioContext, t: number, dur: number, freq: number, gain: number) {
    const len = Math.ceil(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(bp).connect(g).connect(this.dry);
    src.start(t);
  }
}

function impulse(ctx: BaseAudioContext, seconds: number, decay: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

export const audio = new Synth();
