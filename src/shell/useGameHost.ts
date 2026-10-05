import { useSyncExternalStore } from 'react';
import type { GameHost, GameSnapshot } from '../engine/api';
import type { Buttons } from '../game/types';
import type { InputHub } from '../input/InputState';

/** Low-frequency host state (power, scene, toast). Never re-renders per frame. */
export function useHostSnapshot(host: GameHost): GameSnapshot {
  return useSyncExternalStore(host.subscribe, host.getSnapshot);
}

/** Merged held buttons from every input source, so on-screen buttons depress for any of them. */
export function useHeldButtons(input: InputHub): Buttons {
  return useSyncExternalStore(input.subscribe, input.getHeld);
}
