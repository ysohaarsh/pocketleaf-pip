import type { AudioEngine } from '../audio/types';
import { InputHub } from '../input/InputState';
import type { GameHost, GameSnapshot, HostOptions } from './api';

// STUB — replaced by feat/engine. Wires loop + world + renderer + input + audio.
export function createGameHost(_opts: HostOptions, _audio: AudioEngine): GameHost {
  const snapshot: GameSnapshot = { powered: true, scene: 'boot', toast: null };
  return {
    input: new InputHub(),
    attachCanvas: () => undefined,
    resize: () => undefined,
    setPowered: () => undefined,
    setSettings: () => undefined,
    requestPause: () => undefined,
    unlockAudio: () => undefined,
    subscribe: () => () => undefined,
    getSnapshot: () => snapshot,
    destroy: () => undefined,
  };
}
