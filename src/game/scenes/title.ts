import { emitMusic, emitSfx } from '../events';
import type { InputFrame, World } from '../types';
import { startGame } from './transitions';

/** Title: START begins a new game; SELECT toggles music. */
export function updateTitle(world: World, input: InputFrame): void {
  if (input.pressed.start) {
    startGame(world, 0);
    return;
  }
  if (input.pressed.select) {
    world.musicOn = !world.musicOn;
    emitSfx(world, 'select');
    emitMusic(world, world.musicOn ? 'title' : null);
  }
}
