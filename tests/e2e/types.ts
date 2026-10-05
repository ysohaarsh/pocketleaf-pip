/**
 * Shape of the test hooks the engine exposes on `window.__GAME__` in dev or `?test=1`
 * (see docs/PLAN.md "Engine ⇄ shell contract details"). Kept in sync with src/game/types.ts.
 */
import type { PlayerForm, SceneId } from '../../src/game/types';

export type { SceneId };

export interface PlayerProbe {
  x: number;
  y: number;
  vx: number;
  vy: number;
  form: PlayerForm;
  onGround: boolean;
}

export interface FrameStats {
  frames: number;
  avgFrameMs: number;
  maxFrameMs: number;
  longTasks: number;
}

export interface GameProbe {
  readonly scene: SceneId;
  readonly tick: number;
  readonly player: PlayerProbe;
  readonly coins: number;
  readonly score: number;
  readonly lives: number;
  readonly levelId: string;
  readonly timeLeft: number;
  readonly stats: FrameStats;
  world(): unknown;
}

/** A plain-data snapshot of the probe that survives page.evaluate serialisation. */
export interface GameState {
  scene: SceneId;
  tick: number;
  player: PlayerProbe;
  coins: number;
  score: number;
  lives: number;
  levelId: string;
  timeLeft: number;
  stats: FrameStats;
}

/** State of the fake gamepad installed by gamepad.spec.ts. */
export interface FakePadState {
  buttons: boolean[];
  axes: number[];
  connected: boolean;
  timestamp: number;
}

declare global {
  interface Window {
    __GAME__?: GameProbe;
    __pad?: FakePadState;
    /** Returns a Gamepad-like snapshot of __pad (installed by gamepad.spec.ts). */
    __padSnapshot?: () => unknown;
  }
}
