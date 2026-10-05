import { emitSfx } from '../events';
import type { InputFrame, World } from '../types';
import { resumePlaying } from './transitions';

/** Paused: START resumes. */
export function updatePaused(world: World, input: InputFrame): void {
  if (input.pressed.start) {
    emitSfx(world, 'pause');
    resumePlaying(world);
  }
}
