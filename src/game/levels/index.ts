import type { LevelDef } from '../types';
import { LEVEL_1_1 } from './1-1';
import { LEVEL_1_2 } from './1-2';
import { LEVEL_1_3 } from './1-3';
import { TEST_LEVEL_DEFS } from './test';

/** Campaign levels in play order. */
export const LEVELS: readonly LevelDef[] = [LEVEL_1_1, LEVEL_1_2, LEVEL_1_3];

/** Levels loadable only with ?test=1&level=<id>, keyed by id. */
export const TEST_LEVELS: Readonly<Record<string, LevelDef>> = Object.fromEntries(
  TEST_LEVEL_DEFS.map((def) => [def.id, def]),
);

/** Look a level up by id in the campaign first, then the test levels. */
export function getLevelDef(id: string): LevelDef | undefined {
  return LEVELS.find((def) => def.id === id) ?? TEST_LEVELS[id];
}
