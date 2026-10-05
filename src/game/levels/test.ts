import type { LevelDef } from '../types';

const testLevel = (id: string, label: string, name: string, map: readonly string[]): LevelDef => ({
  id,
  label,
  name,
  theme: 'grass',
  timeLimit: 300,
  song: 'grass',
  map,
});

/**
 * Tiny deterministic levels for e2e and engine tests (loadable only with `?test=1&level=<id>`).
 * Coordinates are part of the contract with tests — change them deliberately.
 */
export const TEST_LEVEL_DEFS: readonly LevelDef[] = [
  // Walking right for ~1 s from P (col 1) collects the Glimmer at col 4, row 6.
  testLevel('test-coins', 'T-1', 'Test Coins', [
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
    '.P..o............F..',
    '####################',
    '####################',
  ]),
  // One Mossbug at col 8 and one Snapper at col 16 on flat ground.
  testLevel('test-enemies', 'T-2', 'Test Enemies', [
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '.P......m.......x.....F.',
    '########################',
    '########################',
  ]),
  // Glimmer block at col 4, Sun Seed block at col 7, brick at col 10, all on row 4.
  testLevel('test-blocks', 'T-3', 'Test Blocks', [
    '....................',
    '....................',
    '....................',
    '....................',
    '....?..S..B.........',
    '....................',
    '.P...............F..',
    '####################',
    '####################',
  ]),
];
