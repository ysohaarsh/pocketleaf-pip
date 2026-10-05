import type { AudioEngine } from './types';

// STUB — replaced by feat/audio.
export function createAudioEngine(): AudioEngine {
  return {
    unlocked: false,
    unlock: () => Promise.resolve(),
    playSfx: () => undefined,
    playMusic: () => undefined,
    setVolume: () => undefined,
    setMuted: () => undefined,
    dispose: () => undefined,
  };
}
