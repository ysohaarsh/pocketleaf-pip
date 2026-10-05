import type { LevelDef } from '../types';

// STUB — replaced by feat/content.
const stub: LevelDef = {
  id: '1-1',
  label: '1-1',
  name: 'STUB',
  theme: 'grass',
  timeLimit: 300,
  song: 'grass',
  map: [
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    'P........F',
    '##########',
    '##########',
  ],
};

/** Campaign levels in play order. */
export const LEVELS: readonly LevelDef[] = [stub];
/** Levels loadable only with ?test=1&level=<id>. */
export const TEST_LEVELS: Readonly<Record<string, LevelDef>> = {};
