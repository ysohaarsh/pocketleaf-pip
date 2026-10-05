import type { InputFrame, World } from '../types';
import { updateBoot } from './boot';
import { updateClear } from './clear';
import { updateDying } from './dying';
import { updateGameOver } from './gameover';
import { updateIntro } from './intro';
import { updatePaused } from './paused';
import { updatePlaying } from './playing';
import { updateTitle } from './title';
import { updateWin } from './win';

/** Run the current scene's update for one tick. */
export function updateScene(world: World, input: InputFrame): void {
  switch (world.scene) {
    case 'boot':
      return updateBoot(world, input);
    case 'title':
      return updateTitle(world, input);
    case 'intro':
      return updateIntro(world, input);
    case 'playing':
      return updatePlaying(world, input);
    case 'paused':
      return updatePaused(world, input);
    case 'dying':
      return updateDying(world);
    case 'gameover':
      return updateGameOver(world, input);
    case 'clear':
      return updateClear(world);
    case 'win':
      return updateWin(world, input);
  }
}
