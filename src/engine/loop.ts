import { DT, MAX_FRAME_TIME, MAX_STEPS_PER_FRAME } from '../game/constants';

export interface LoopStats {
  /** Frames rendered since the loop was created (running total). */
  frames: number;
  /** Mean interval between frames over the last STATS_WINDOW frames (ms). */
  avgFrameMs: number;
  /** Longest interval between frames within the same window (ms). */
  maxFrameMs: number;
}

export interface LoopOptions {
  /** Called once at the start of every frame, before any steps (e.g. gamepad polling). */
  beforeSteps?: () => void;
  /** Advance the simulation by exactly one fixed DT. */
  step: () => void;
  /** Draw; alpha in [0,1) is the leftover fraction of a step. */
  render: (alpha: number) => void;
  /** Clock in ms (default performance.now). */
  now?: () => number;
  raf?: (cb: () => void) => number;
  caf?: (id: number) => void;
}

export interface Loop {
  start(): void;
  stop(): void;
  isRunning(): boolean;
  stats(): LoopStats;
}

/** Number of frame intervals averaged for the stats. */
const STATS_WINDOW = 120;
/** Tolerance so frames of exactly DT never lose a step to float error (s). */
const EPS = 1e-9;

/**
 * requestAnimationFrame loop with a fixed-timestep accumulator: real elapsed time (clamped to
 * MAX_FRAME_TIME) is consumed in DT steps, at most MAX_STEPS_PER_FRAME per frame (any backlog
 * beyond that is dropped), then render(alpha) is called once.
 */
export function createLoop(opts: LoopOptions): Loop {
  const now = opts.now ?? (() => performance.now());
  const raf = opts.raf ?? ((cb: () => void) => requestAnimationFrame(cb));
  const caf = opts.caf ?? ((id: number) => cancelAnimationFrame(id));
  const intervals = new Float64Array(STATS_WINDOW);
  let frames = 0;
  let handle: number | null = null;
  let last = 0;
  let acc = 0;

  const frame = (): void => {
    if (handle === null) return;
    const t = now();
    const ms = t - last;
    last = t;
    intervals[frames % STATS_WINDOW] = ms;
    frames++;
    acc += Math.min(ms / 1000, MAX_FRAME_TIME);
    opts.beforeSteps?.();
    let steps = 0;
    while (acc + EPS >= DT && steps < MAX_STEPS_PER_FRAME) {
      opts.step();
      acc -= DT;
      steps++;
    }
    if (acc + EPS >= DT) acc = 0;
    opts.render(Math.max(0, acc / DT));
    // step/render may have stopped the loop; only then is the handle cleared.
    if (handle !== null) handle = raf(frame);
  };

  return {
    start() {
      if (handle !== null) return;
      last = now();
      acc = 0;
      handle = raf(frame);
    },
    stop() {
      if (handle === null) return;
      caf(handle);
      handle = null;
    },
    isRunning: () => handle !== null,
    stats() {
      const n = Math.min(frames, STATS_WINDOW);
      let sum = 0;
      let max = 0;
      for (let i = 0; i < n; i++) {
        const v = intervals[i]!;
        sum += v;
        max = Math.max(max, v);
      }
      return { frames, avgFrameMs: n ? sum / n : 0, maxFrameMs: max };
    },
  };
}
