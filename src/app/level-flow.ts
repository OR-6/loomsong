/**
 * Level flow (pure, time-driven): load → play → win → stars → cloth
 * playback (the cloth plays itself as a melody) → next level.
 * Also drives the Level 1 first-run hints. No Three.js; unit-tested.
 */
import type { LoomModel, LoomEvent } from '../loom/loom-model.js';
import type { Level } from '../puzzle/levels.js';
import { isWon, rowStatuses, stars, type RowStatus } from '../puzzle/session.js';
import { isLifted } from '../puzzle/tieup.js';
import { WARPS } from '../config.js';
import type { Progress } from '../persistence/progress.js';

export type FlowPhase = 'play' | 'won' | 'playback' | 'between';

export type HintStep = 'lever' | 'shuttle' | 'card' | 'none';

export interface FlowHooks {
  load(level: Level, index: number): void;
  status(level: Level, statuses: RowStatus[], stars: number): void;
  win(stars: number): void;
  /** Schedule a pluck `delay` seconds from now. */
  pluck(warp: number, delay: number): void;
  glowRow(row: number): void;
  hint(step: HintStep, lever: number): void;
  /** Total stars changed (front-beam plaque). */
  totals?(stars: number, level: number): void;
  save(p: Progress): void;
}

export const TIMING = {
  winPause: 0.9,
  rowTime: 0.42,
  noteGap: 0.05,
  afterPlayback: 1.6,
  cardHint: 4.5,
} as const;

export class LevelFlow {
  phase: FlowPhase = 'play';
  index = 0;
  level!: Level;
  lastStars = 0;
  hintStep: HintStep = 'none';
  /** Playing a shared cloth ("weave this"): progress is not advanced. */
  challenge = false;
  private timer = 0;
  private playRow = 0;
  private hintTimer = 0;

  constructor(
    private model: LoomModel,
    private levelAt: (i: number) => Level,
    public progress: Progress,
    private hooks: FlowHooks,
  ) {
    model.on((e) => this.onModel(e));
  }

  start(index = this.progress.level): void {
    this.challenge = false;
    this.index = Math.max(0, Math.floor(index));
    this.load(this.levelAt(this.index));
    this.setHint(this.index === 0 && !this.progress.tutorialDone ? 'lever' : 'none');
  }

  /** Weave someone else's cloth; afterwards resume normal progression. */
  startChallenge(level: Level): void {
    this.challenge = true;
    this.index = this.progress.level;
    this.load(level);
    this.setHint('none');
  }

  private load(level: Level): void {
    this.level = level;
    this.model.reset([...this.level.tieUp]);
    this.phase = 'play';
    this.lastStars = 0;
    this.hooks.load(this.level, this.index);
    this.hooks.totals?.(totalStars(this.progress), this.index);
    this.emitStatus();
  }

  /** Re-emit the card status (e.g. after a settings change). */
  refresh(): void {
    if (this.level) this.emitStatus();
  }

  update(dt: number): void {
    if (this.hintStep === 'card') {
      this.hintTimer -= dt;
      if (this.hintTimer <= 0) this.setHint('none');
    }
    if (this.phase === 'play') return;
    this.timer -= dt;
    if (this.timer > 0) return;
    if (this.phase === 'won') {
      this.phase = 'playback';
      this.playRow = 0;
      this.timer = 0;
    }
    if (this.phase === 'playback') {
      if (this.playRow < this.model.rows.length) {
        this.playRowNotes(this.playRow);
        this.playRow++;
        this.timer = TIMING.rowTime;
      } else {
        this.hooks.glowRow(-1);
        this.phase = 'between';
        this.timer = TIMING.afterPlayback;
      }
      return;
    }
    if (this.phase === 'between') this.start(this.challenge ? this.progress.level : this.index + 1);
  }

  /** Rows alternate direction, like the shuttle did. */
  private playRowNotes(r: number): void {
    this.hooks.glowRow(r);
    const row = this.model.rows[r];
    const ltr = r % 2 === 0;
    let n = 0;
    for (let j = 0; j < WARPS; j++) {
      const i = ltr ? j : WARPS - 1 - j;
      if (isLifted(row, i)) this.hooks.pluck(i, n++ * TIMING.noteGap);
    }
  }

  private onModel(e: LoomEvent): void {
    if (!this.level) return;
    if (e.type === 'lever' && this.hintStep === 'lever' && e.latched) this.setHint('shuttle');
    if (e.type === 'row' && this.hintStep === 'shuttle') {
      this.setHint('card');
      this.hintTimer = TIMING.cardHint;
      this.progress.tutorialDone = true;
      this.hooks.save(this.progress);
    }
    if (e.type === 'row' || e.type === 'undo') {
      if (this.phase === 'play' && isWon(this.level, this.model.rows)) this.win();
      else this.emitStatus();
    }
  }

  private win(): void {
    this.phase = 'won';
    this.timer = TIMING.winPause;
    this.lastStars = stars(this.level.par, this.model.leverFlips);
    if (!this.challenge) {
      const id = this.level.id;
      this.progress.best[id] = Math.max(this.progress.best[id] ?? 0, this.lastStars);
      this.progress.level = this.index + 1;
      this.progress.tutorialDone = true;
    }
    this.progress.lastCloth = {
      tieUp: [...this.level.tieUp],
      rows: [...this.model.rows],
      rootMidi: this.level.rootMidi,
    };
    this.hooks.save(this.progress);
    this.emitStatus();
    this.hooks.win(this.lastStars);
    this.hooks.totals?.(totalStars(this.progress), this.index);
    if (this.hintStep !== 'none') this.setHint('none');
  }

  private emitStatus(): void {
    this.hooks.status(this.level, rowStatuses(this.level, this.model.rows), this.lastStars);
  }

  private setHint(step: HintStep): void {
    this.hintStep = step;
    this.hooks.hint(step, firstLeverForRow0(this.level));
  }
}

export function totalStars(p: Pick<Progress, 'best'>): number {
  let n = 0;
  for (const v of Object.values(p.best)) n += v;
  return n;
}

/** Lowest-index lever that is part of a cheapest way to weave row 0. */
export function firstLeverForRow0(level: Level): number {
  const L = level.tieUp.length;
  let best = -1;
  let bestBits = Infinity;
  for (let s = 1; s < 1 << L; s++) {
    let m = 0;
    for (let k = 0; k < L; k++) if ((s >> k) & 1) m |= level.tieUp[k];
    const bits = s.toString(2).replace(/0/g, '').length;
    if (m === level.target[0] && bits < bestBits) {
      bestBits = bits;
      best = s;
    }
  }
  if (best < 0) return 0;
  for (let k = 0; k < L; k++) if ((best >> k) & 1) return k;
  return 0;
}
