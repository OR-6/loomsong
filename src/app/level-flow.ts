/**
 * Level flow (pure, time-driven): load → play → win → stars → cloth
 * playback (the cloth plays itself as a melody) → next level.
 * Also drives the Level 1 first-run hints. No Three.js; unit-tested.
 */
import type { LoomModel, LoomEvent } from '../loom/loom-model.js';
import type { Level } from '../puzzle/levels.js';
import { isWon, rowStatuses, stars, type RowStatus } from '../puzzle/session.js';
import { isLifted, warpsOf, weftOf, type Mask8 } from '../puzzle/tieup.js';
import { WARPS } from '../config.js';
import type { Progress } from '../persistence/progress.js';

export type FlowPhase = 'play' | 'won' | 'playback' | 'between';

/**
 * What to touch next. 'lever': lift lever k; 'unlatch': put lever k back;
 * 'weft': swap Pip's yarn (Sea); 'shuttle': slide Pip; 'undo': pull the spool (last row is wrong);
 * 'card': read the card (the goal, or "match the next row" in idle hints);
 * 'knots': the tutorial explains the knot budget once, after the goal.
 */
export type HintStep = 'lever' | 'unlatch' | 'weft' | 'shuttle' | 'undo' | 'card' | 'knots' | 'none';

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
  winPause: 1.1,
  rowTime: 0.42,
  noteGap: 0.05,
  afterPlayback: 1.6,
  cardHint: 3.5,
  /** Seconds without touching anything before a gentle hint (after the tutorial). */
  idleHint: 12,
} as const;

export class LevelFlow {
  phase: FlowPhase = 'play';
  index = 0;
  level!: Level;
  lastStars = 0;
  hintStep: HintStep = 'none';
  /** Playing a shared cloth ("weave this"): progress is not advanced. */
  challenge = false;
  /** Co-op guest: the host decides wins and level changes. */
  mirror = false;
  private timer = 0;
  private playRow = 0;
  private hintTimer = 0;
  /** Extra seconds to linger before the next level (a chapter finale is playing). */
  extraBetween = 0;
  /** Level 1 on a first run: every step is shown until the picture is woven. */
  tutorial = false;
  /** The goal ("match the card") has been explained once. */
  private goalShown = false;
  private idle = 0;
  /** The current hint came from idling (cleared by the next touch). */
  private idleShown = false;

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
    this.tutorial = this.index === 0 && !this.progress.tutorialDone;
    this.goalShown = false;
    this.idle = 0;
    this.idleShown = false;
    if (this.tutorial) this.guide();
    else this.setHint('none');
  }

  /** Weave someone else's cloth; afterwards resume normal progression. */
  startChallenge(level: Level): void {
    this.challenge = true;
    this.tutorial = false;
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
    if ((this.hintStep === 'card' || this.hintStep === 'knots') && this.hintTimer > 0) {
      this.hintTimer -= dt;
      if (this.hintTimer <= 0) {
        if (this.tutorial && this.hintStep === 'card') {
          // then, once: what the knots above the card mean
          this.setHint('knots');
          this.hintTimer = TIMING.cardHint;
        } else if (this.tutorial) this.guide();
        else this.setHint('none');
      }
    }
    if (this.phase === 'play' && !this.tutorial && !this.mirror && !this.challenge) {
      this.idle += dt;
      if (this.idle > TIMING.idleHint && !this.idleShown) {
        this.idleShown = true;
        this.idleHint();
      }
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
        this.timer = TIMING.afterPlayback + this.extraBetween;
        this.extraBetween = 0;
      }
      return;
    }
    if (this.phase === 'between') {
      if (this.mirror) return; // wait for the host's next level
      this.start(this.challenge ? this.progress.level : this.index + 1);
    }
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

  /** Co-op guest: load the host's level without touching saved progress. */
  mirrorStart(index: number): void {
    this.challenge = false;
    this.tutorial = false;
    this.index = Math.max(0, Math.floor(index));
    this.load(this.levelAt(this.index));
    this.setHint('none');
  }

  /** Co-op guest: the host won; play the same win + melody locally. */
  mirrorWin(stars: number): void {
    if (this.phase !== 'play') return;
    this.phase = 'won';
    this.timer = TIMING.winPause;
    this.lastStars = stars;
    this.emitStatus();
    this.hooks.win(stars);
  }

  private onModel(e: LoomEvent): void {
    if (!this.level) return;
    if (this.mirror) {
      if (e.type === 'sync' || e.type === 'lever') this.emitStatus();
      return;
    }
    // any touch resets the idle clock and clears an idle hint
    if (e.type === 'lever' || e.type === 'row' || e.type === 'undo' || e.type === 'weft') {
      this.idle = 0;
      if (this.idleShown) {
        this.idleShown = false;
        if (!this.tutorial) this.setHint('none');
      }
    }
    if (e.type === 'row' || e.type === 'undo') {
      if (this.phase === 'play' && isWon(this.level, this.model.rows)) {
        this.win();
        return;
      }
      this.emitStatus();
    }
    // two-colour levels: say "swap Pip's yarn" the moment it's the next thing to do (it's never the puzzle)
    if (!this.tutorial && this.level.weft && this.phase === 'play' && !this.mirror) {
      const n = nextStep(this.level, this.model.rows, this.model.latched, this.model.weft);
      if (n.step === 'weft') this.setHint('weft');
      else if (this.hintStep === 'weft') this.setHint('none');
    }
    if (!this.tutorial || this.phase !== 'play') return;
    if (e.type === 'row' && !this.goalShown && this.model.rows.length === 1 && this.model.rows[0] === this.level.target[0]) {
      // the first right row: say the goal once, then keep guiding
      this.goalShown = true;
      this.setHint('card');
      this.hintTimer = TIMING.cardHint;
      return;
    }
    if ((this.hintStep === 'card' || this.hintStep === 'knots') && this.hintTimer > 0) return;
    if (e.type === 'lever' || e.type === 'row' || e.type === 'undo' || e.type === 'weft') this.guide();
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

  /** Tutorial: show the very next action for the current row. */
  private guide(): void {
    const n = nextStep(this.level, this.model.rows, this.model.latched, this.model.weft);
    this.setHint(n.step, n.lever);
  }

  /** After the tutorial, idle hints point at the kind of action, not the answer (except in Garden). */
  private idleHint(): void {
    const n = nextStep(this.level, this.model.rows, this.model.latched, this.model.weft);
    const easy = this.level.chapter === 'garden' || !this.level.chapter;
    if (n.step === 'undo' || n.step === 'shuttle' || n.step === 'weft' || easy) this.setHint(n.step, n.lever);
    else this.setHint('card'); // "match the next row": the puzzle stays the player's
  }

  private setHint(step: HintStep, lever = -1): void {
    this.hintStep = step;
    this.hooks.hint(step, lever >= 0 ? lever : firstLeverForRow0(this.level));
  }
}

export function totalStars(p: Pick<Progress, 'best'>): number {
  let n = 0;
  for (const v of Object.values(p.best)) n += v;
  return n;
}

/**
 * The next action toward the picture: undo a wrong last row; otherwise put back
 * a lever the next row doesn't need, lift one it does (fewest moves from the
 * levers as they are), or throw Pip when the shed already matches.
 */
export function nextStep(level: Level, rows: readonly Mask8[], latched: readonly boolean[], weft: 0 | 1 = 0): { step: HintStep; lever: number } {
  const r = rows.length;
  if (r > 0 && rows[r - 1] !== level.target[r - 1]) return { step: 'undo', lever: -1 };
  if (r >= level.target.length) return { step: 'none', lever: -1 };
  const L = level.tieUp.length;
  let best = -1;
  let bestCost = Infinity;
  for (let s = 0; s < 1 << L; s++) {
    let m = 0;
    for (let k = 0; k < L; k++) if ((s >> k) & 1) m |= level.tieUp[k];
    if (m !== warpsOf(level.target[r])) continue;
    let flips = 0;
    let count = 0;
    for (let k = 0; k < L; k++) {
      const on = ((s >> k) & 1) === 1;
      if (on !== !!latched[k]) flips++;
      if (on) count++;
    }
    const cost = flips * 10 + count;
    if (cost < bestCost) {
      bestCost = cost;
      best = s;
    }
  }
  if (best < 0) return { step: 'card', lever: -1 };
  for (let k = 0; k < L; k++) if (!!latched[k] && !((best >> k) & 1)) return { step: 'unlatch', lever: k };
  for (let k = 0; k < L; k++) if (!latched[k] && (best >> k) & 1) return { step: 'lever', lever: k };
  if (weftOf(level.target[r]) !== weft) return { step: 'weft', lever: -1 };
  return { step: 'shuttle', lever: -1 };
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
    if (m === warpsOf(level.target[0]) && bits < bestBits) {
      bestBits = bits;
      best = s;
    }
  }
  if (best < 0) return 0;
  for (let k = 0; k < L; k++) if ((best >> k) & 1) return k;
  return 0;
}
