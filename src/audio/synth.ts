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

/** Background music level (before ducking). */
const MUSIC_GAIN = 0.55;
/** Bass roots per bar, in semitones from the key: I – vi – IV – V. */
const PROGRESSION = [0, -3, 5, 7];
interface Mood {
  bpm: number;
  /** Chance of a melody note per beat. */
  density: number;
  /** Melody register above the key (semitones). */
  octave: number;
  level: number;
  padGain: number;
  padBright: number;
}
/** Per chapter: Garden bright and lively, Home warm, Night slow and low, Sea drifting. */
const MOODS: Record<string, Mood> = {
  garden: { bpm: 76, density: 0.5, octave: 24, level: 1, padGain: 0.05, padBright: 900 },
  home: { bpm: 70, density: 0.45, octave: 24, level: 0.95, padGain: 0.055, padBright: 800 },
  night: { bpm: 58, density: 0.32, octave: 19, level: 0.85, padGain: 0.065, padBright: 520 },
  sea: { bpm: 64, density: 0.38, octave: 24, level: 0.9, padGain: 0.06, padBright: 650 },
};
/** Melody steps on the pentatonic (mostly by step, sometimes a skip). */
const STEPS = [-2, -1, -1, 0, 1, 1, 2];
const midiHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

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
  /** Background music bus (its own gain so plucks can duck it). */
  private musicBus: GainNode | null = null;
  private musicOn = true;
  private mood: Mood = MOODS.garden;
  /** Next beat time (AudioContext seconds) and position in the phrase. */
  private nextBeat = 0;
  private beat = 0;
  private melodyDeg = 4;
  /** Music is silent until this time (the win song plays alone). */
  private holdUntil = 0;
  private pad: { osc: OscillatorNode[]; gain: GainNode; lp: BiquadFilterNode } | null = null;
  /** Music notes scheduled so far (debug/E2E). */
  musicNotes = 0;

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
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = this.musicOn ? MUSIC_GAIN : 0;
    this.musicBus.connect(this.dry);
    this.musicBus.connect(this.wet);
    void this.load(ctx);
  }

  /** Fetch + decode every sample once (≈ 250 KB). Failures just keep the synth. */
  private async load(ctx: AudioContext): Promise<void> {
    // index.json lists exactly the files that exist (optional ones like Pip's voice included).
    let names: string[];
    try {
      const res = await fetch(audioUrl('index.json'));
      names = res.ok ? ((await res.json()) as string[]) : [];
    } catch {
      names = [];
    }
    if (!names.length) {
      names = [
        ...KALIMBA.map((m) => `kalimba/k${m}.ogg`),
        ...Object.entries(FX).flatMap(([n, c]) => Array.from({ length: c }, (_, i) => `fx/${n}-${i}.ogg`)),
        'fx/glock-gliss.ogg',
      ];
    }
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

  /** One of the loaded numbered variants (`wood-light-0..4`), picked at random. */
  private fx(name: string, gain: number, when = 0, wet = false): boolean {
    let n = 0;
    while (this.bufs.has(`fx/${name}-${n}.ogg`)) n++;
    if (!n) return false;
    const i = Math.floor(Math.random() * n);
    return this.play(`fx/${name}-${i}.ogg`, gain, when, 0.96 + Math.random() * 0.08, wet);
  }

  /**
   * Pip's voice: recorded bird chirps when present (public/audio/fx/pip-*),
   * otherwise quick high kalimba grace notes (still a real recording).
   */
  chirp(kind: 'happy' | 'sad' | 'cheer'): void {
    if (this.fx(`pip-${kind}`, kind === 'sad' ? 0.35 : 0.4, 0, true)) return;
    const r = this.rootMidi;
    if (kind === 'happy') {
      this.kalimba(r + 24, 0.12, 0);
      this.kalimba(r + 28, 0.12, 0.06);
    } else if (kind === 'sad') {
      this.kalimba(r + 19, 0.12, 0);
      this.kalimba(r + 14, 0.11, 0.16);
    } else {
      [24, 28, 31, 36, 31, 36].forEach((d, i) => this.kalimba(r + d, 0.1, 0.05 + i * 0.07));
    }
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

  /** Undo spool ratchet: a tick that rises with each notch of the pull. */
  ratchet(notch: number): void {
    this.play(`fx/tick-${notch % 3}.ogg`, 0.22, 0, 1 + notch * 0.08, false);
  }

  /** Something is picked up: a soft, slightly low tick. */
  grab(): void {
    const n = Math.floor(Math.random() * 3);
    this.play(`fx/tick-${n}.ogg`, 0.2, 0, 0.85, false);
  }

  /** Pip is picked up: a little chirp, higher and quieter than a happy one. */
  pipGrab(): void {
    const n = this.bufs.has('fx/pip-happy-1.ogg') && Math.random() < 0.5 ? 1 : 0;
    if (!this.play(`fx/pip-happy-${n}.ogg`, 0.2, 0, 1.15 + Math.random() * 0.1, true)) this.kalimba(this.rootMidi + 28, 0.08);
  }

  /** A row's verdict, under Pip's chirp: a bright sparkle when right, a soft low bonk when wrong. */
  verdict(good: boolean): void {
    const r = this.rootMidi;
    if (good) {
      this.kalimba(r + 24, 0.1, 0.05);
      this.kalimba(r + 31, 0.08, 0.11);
    } else {
      this.play(`fx/wood-medium-${Math.floor(Math.random() * 5)}.ogg`, 0.32, 0.03, 0.78, false);
      this.kalimba(r + 1, 0.09, 0.08); // a sour semitone
      this.kalimba(r, 0.08, 0.22);
    }
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
    this.duck(ctx, when);
    // Recorded kalimba; faster strums are a touch louder.
    // ±8% level and ±10 cents so repeated notes never sound copy-pasted
    const vary = 0.92 + Math.random() * 0.16;
    if (this.kalimba(this.midiOf(warp) + (Math.random() - 0.5) * 0.2, gain * vary * (0.95 + 0.45 * Math.min(1, speed / 0.6)), when)) return;
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
    if (this.fx(latched ? 'plank' : 'wood-light', latched ? 0.45 : 0.32)) return; // the lever's own threads strum (game)
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
    // (no thread run here: the picture's own song follows; the moment stays uncluttered)
    // Glockenspiel run on top, shifted into the level's key (±6 semitones).
    let shift = (((this.rootMidi - GLOCK_PC) % 12) + 12) % 12;
    if (shift > 6) shift -= 12;
    this.play('fx/glock-gliss.ogg', 0.28, 0.25, Math.pow(2, shift / 12));
  }

  // ---- Background music: a soft generative music box in the level's key ----

  /** Music on/off (settings). */
  setMusic(on: boolean): void {
    this.musicOn = on;
    const ctx = this.ctx;
    if (ctx && this.musicBus) this.musicBus.gain.setTargetAtTime(on ? MUSIC_GAIN : 0, ctx.currentTime, 0.3);
    if (!on) this.stopPad();
  }

  /** Per-chapter mood: tempo, register and density. */
  setMood(chapter: string): void {
    this.mood = MOODS[chapter] ?? MOODS.garden;
    if (this.pad && this.ctx) this.pad.lp.frequency.setTargetAtTime(this.mood.padBright, this.ctx.currentTime, 1.5);
  }

  /** Silence the music for `seconds` (the win song plays alone), then fade back in. */
  holdMusic(seconds: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    this.holdUntil = ctx.currentTime + seconds;
    this.pad?.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
  }

  /** Plucks duck the music a little so the threads stay the lead voice. */
  private duck(ctx: AudioContext, when: number): void {
    const b = this.musicBus;
    if (!b || !this.musicOn) return;
    const t = ctx.currentTime + when;
    b.gain.cancelScheduledValues(t);
    b.gain.setTargetAtTime(MUSIC_GAIN * 0.45, t, 0.03);
    b.gain.setTargetAtTime(MUSIC_GAIN, t + 0.35, 0.5);
  }

  /** Call every frame: schedules the next few notes ahead on the audio clock. */
  music(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || this.paused || !this.musicOn || !this.musicBus) return;
    const now = ctx.currentTime;
    if (now < this.holdUntil) {
      this.nextBeat = this.holdUntil + 0.6;
      return;
    }
    this.ensurePad(ctx);
    if (this.pad && this.pad.gain.gain.value < 0.001) this.pad.gain.gain.setTargetAtTime(this.mood.padGain, now, 1.2);
    if (this.nextBeat < now) this.nextBeat = now + 0.05;
    const m = this.mood;
    const spb = 60 / m.bpm;
    while (this.nextBeat < now + 0.25) {
      const t = this.nextBeat;
      const when = t - now;
      const bar = Math.floor(this.beat / 4) % PROGRESSION.length;
      const inBar = this.beat % 4;
      const root = this.rootMidi + PROGRESSION[bar];
      // bass: the chord root, low and soft, on the downbeat
      if (inBar === 0) {
        this.kalimbaTo(this.musicBus, root - 12, 0.09 * m.level, when);
        this.retunePad(root, t);
      }
      // melody: a gentle random walk on the pentatonic, sparse, an octave up
      if (Math.random() < m.density) {
        const step = STEPS[Math.floor(Math.random() * STEPS.length)];
        this.melodyDeg = Math.max(0, Math.min(6, this.melodyDeg + step));
        // a music-box bell an octave above the top thread: never mistaken for a pluck
        const midi = this.rootMidi + m.octave + Math.floor(this.melodyDeg / 5) * 12 + PENTA[this.melodyDeg % 5];
        this.bell(midi, (inBar === 0 ? 0.05 : 0.036) * m.level, when);
        // now and then a soft echo a half-beat later
        if (Math.random() < 0.2) this.bell(midi + 12, 0.014 * m.level, when + spb / 2);
      }
      this.nextBeat += spb * (inBar === 3 && Math.random() < 0.3 ? 1.08 : 1); // a little rubato
      this.beat++;
    }
  }

  /** A soft music-box bell (sine + a quiet inharmonic partial, fast decay) on the music bus. */
  private bell(midi: number, gain: number, when: number): void {
    const ctx = this.ctx;
    const bus = this.musicBus;
    if (!ctx || !bus) return;
    const t = ctx.currentTime + when;
    const f = midiHz(midi);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(gain, t + 0.006);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    const o1 = ctx.createOscillator();
    o1.type = 'sine';
    o1.frequency.value = f;
    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = f * 4.2; // the tine's bright overtone
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.18, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    o1.connect(env);
    o2.connect(g2).connect(env);
    env.connect(bus);
    o1.start(t);
    o2.start(t);
    o1.stop(t + 1.7);
    o2.stop(t + 0.3);
    this.musicNotes++;
  }

  /** A kalimba note routed to a given bus (the music), pitched from the nearest sample. */
  private kalimbaTo(bus: AudioNode, midi: number, gain: number, when: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    let best = KALIMBA[0];
    for (const k of KALIMBA) if (Math.abs(k - midi) < Math.abs(best - midi)) best = k;
    const buf = this.bufs.get(`kalimba/k${best}.ogg`);
    if (!buf) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = Math.pow(2, (midi - best) / 12);
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(g).connect(bus);
    src.start(ctx.currentTime + when);
    this.musicNotes++;
  }

  /** A warm, slowly breathing drone under everything (two detuned sines → lowpass). */
  private ensurePad(ctx: AudioContext): void {
    if (this.pad || !this.musicBus) return;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = this.mood.padBright;
    lp.Q.value = 0.3;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 120;
    lfo.connect(lfoGain).connect(lp.frequency);
    const osc: OscillatorNode[] = [];
    for (const [ratio, det, type] of [[0.5, -4, 'sine'], [0.5, 4, 'sine'], [0.75, 0, 'triangle']] as const) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = midiHz(this.rootMidi - 12) * ratio * 2;
      o.detune.value = det;
      const og = ctx.createGain();
      og.gain.value = type === 'triangle' ? 0.25 : 0.5;
      o.connect(og).connect(lp);
      o.start();
      osc.push(o);
    }
    osc.push(lfo);
    lfo.start();
    lp.connect(gain).connect(this.musicBus);
    this.pad = { osc, gain, lp };
  }

  private retunePad(root: number, t: number): void {
    if (!this.pad) return;
    const f = midiHz(root - 12);
    this.pad.osc[0].frequency.setTargetAtTime(f, t, 0.4);
    this.pad.osc[1].frequency.setTargetAtTime(f, t, 0.4);
    this.pad.osc[2].frequency.setTargetAtTime(f * 1.5, t, 0.4); // the fifth
  }

  private stopPad(): void {
    if (!this.pad) return;
    for (const o of this.pad.osc) o.stop();
    this.pad.gain.disconnect();
    this.pad = null;
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
