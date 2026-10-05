import type { SfxId, SongId } from '../game/types';

/** The audio contract consumed by the engine runtime. */
export interface AudioEngine {
  /** Create/resume the AudioContext. Must be called from a user gesture. Idempotent. */
  unlock(): Promise<void>;
  readonly unlocked: boolean;
  playSfx(id: SfxId): void;
  /** Start (or switch to) a looping song; null stops music. */
  playMusic(song: SongId | null): void;
  /** Master volume 0..1. */
  setVolume(volume: number): void;
  setMuted(muted: boolean): void;
  dispose(): void;
}
