import { INTRO_TICKS } from '../constants';
import type { InputFrame, World } from '../types';
import { enterPlaying } from './transitions';

/** Level card; START/A or INTRO_TICKS starts play. */
export function updateIntro(world: World, input: InputFrame): void {
  if (input.pressed.start || input.pressed.a || world.sceneTick >= INTRO_TICKS) {
    enterPlaying(world);
  }
}
