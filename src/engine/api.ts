import type { InputHub } from '../input/InputState';
import type { SceneId } from '../game/types';

/** The engine ⇄ shell contract. React talks to the engine only through GameHost. */

export type PaletteId = 'classic' | 'grey';

/** RGB hex strings, darkest → lightest. */
export const PALETTES: Record<PaletteId, readonly [string, string, string, string]> = {
  classic: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'],
  grey: ['#1c1c1c', '#555555', '#aaaaaa', '#e0e0e0'],
};

export interface Settings {
  /** Master volume 0..1. */
  volume: number;
  muted: boolean;
  /** LCD effects: ghosting + dot grid + grain + vignette. */
  lcd: boolean;
  palette: PaletteId;
}

export const DEFAULT_SETTINGS: Settings = {
  volume: 0.6,
  muted: false,
  lcd: true,
  palette: 'classic',
};

/** Low-frequency state the shell renders. Never changes per frame unless something real happened. */
export interface GameSnapshot {
  powered: boolean;
  scene: SceneId;
  /** Transient message such as "Controller connected", or null. */
  toast: string | null;
}

export interface HostOptions {
  /** ?test=1 — fixed seed, LCD off, frozen animations, window.__GAME__ exposed. */
  test: boolean;
  /** ?level=<id> — start straight into a specific level (test levels only in test mode). */
  levelOverride: string | null;
  seed: number;
  reducedMotion: boolean;
  /** Persisted high score loader/saver injected by the host's caller. */
  storage: Pick<Storage, 'getItem' | 'setItem'> | null;
}

export interface GameHost {
  /** The single merged input state; shell sources (touch) write here, buttons read here. */
  readonly input: InputHub;
  /** Attach the visible canvas; the host renders into it from its own rAF loop. */
  attachCanvas(canvas: HTMLCanvasElement): void;
  /** Available CSS box for the screen; host picks the largest integer scale that fits. */
  resize(cssWidth: number, cssHeight: number, devicePixelRatio: number): void;
  setPowered(on: boolean): void;
  setSettings(settings: Settings): void;
  /** Force the paused scene (used for blur / visibility / settings popover). */
  requestPause(): void;
  /** Called on the first user gesture so audio may start. */
  unlockAudio(): void;
  subscribe(listener: () => void): () => void;
  getSnapshot(): GameSnapshot;
  destroy(): void;
}
