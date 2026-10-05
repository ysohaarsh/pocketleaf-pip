import type { InputFrame, World } from '../types';
import { enterTitle } from './transitions';

/** Ending screen; START returns to the title. */
export function updateWin(world: World, input: InputFrame): void {
  if (input.pressed.start) enterTitle(world);
}
