/**
 * Character art (16x16, facing RIGHT — the renderer mirrors for left).
 * Rows are palette indices: '0' darkest … '3' lightest, '.' transparent.
 *
 * Pip is a round fox-sprout: pointed ears, a single leaf on top, a short bushy tail on the left.
 */
import { patchRows } from './build';

/** Pip standing still. Rows 0-3: leaf sprout and ear tips; rows 14-15: feet. */
export const PIP_IDLE: readonly string[] = [
  '........000.....',
  '.......02220....',
  '...0....000.0...',
  '..010...0..010..',
  '..011000000110..',
  '..022222222220..',
  '.02222222022020.',
  '.02222222022020.',
  '.02222333333220.',
  '002223333333220.',
  '012223333333220.',
  '.02222333332220.',
  '..022222222220..',
  '...0000000000...',
  '....010..010....',
  '...0000..0000...',
];

/** Run frame 1: feet apart. */
export const PIP_RUN1 = patchRows(PIP_IDLE, {
  14: '...010....010...',
  15: '..0000....0000..',
});

/** Run frame 2: feet together under the body. */
export const PIP_RUN2 = patchRows(PIP_IDLE, {
  14: '......0110......',
  15: '.....000000.....',
});

/** Jumping: paw raised, tail up, legs spread. */
export const PIP_JUMP = patchRows(PIP_IDLE, {
  3: '..010...0..010.0',
  4: '..011000000110.0',
  5: '..022222222220.0',
  6: '.022222220220200',
  8: '002222333333220.',
  9: '012223333333220.',
  10: '.02223333333220.',
  14: '..010......010..',
  15: '................',
});

/** Falling: ears flung out, legs dangling. */
export const PIP_FALL = patchRows(PIP_IDLE, {
  2: '..0.....000..0..',
  14: '....010..010....',
  15: '.....0....0.....',
});

/** Defeated: front-facing with crossed eyes and an open mouth. */
export const PIP_DEAD: readonly string[] = [
  '........000.....',
  '.......02220....',
  '...0....000.0...',
  '..010...0..010..',
  '..011000000110..',
  '..022222222220..',
  '.02202022020220.',
  '.02220222202220.',
  '.02202022020220.',
  '.02222200222220.',
  '.02222300322220.',
  '.02222200222220.',
  '..022222222220..',
  '...0000000000...',
  '....010..010....',
  '...0000..0000...',
];

/** Bloom crown: a big open flower replacing the leaf sprout (rows 0-3). */
const BLOOM_CROWN: Readonly<Record<number, string>> = {
  0: '....00.00.00....',
  1: '...0330330330...',
  2: '...0331001330...',
  3: '..010333333010..',
};

export const BLOOM_IDLE = patchRows(PIP_IDLE, BLOOM_CROWN);
export const BLOOM_RUN1 = patchRows(PIP_RUN1, BLOOM_CROWN);
export const BLOOM_RUN2 = patchRows(PIP_RUN2, BLOOM_CROWN);
export const BLOOM_JUMP = patchRows(PIP_JUMP, BLOOM_CROWN);
export const BLOOM_FALL = patchRows(PIP_FALL, BLOOM_CROWN);

/** Mossbug: a round beetle with a mossy shell. Walk frame 1 (legs splayed). */
export const MOSSBUG_WALK1: readonly string[] = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '......0000......',
  '....00121200....',
  '...0121212120...',
  '..012121212120..',
  '..021212121210..',
  '.01212121212120.',
  '.00000000000000.',
  '.03333333303030.',
  '..000000000000..',
  '..0.0.0..0.0.0..',
  '.0.0.0....0.0.0.',
];

/** Mossbug walk frame 2 (legs straight). */
export const MOSSBUG_WALK2 = patchRows(MOSSBUG_WALK1, {
  14: '...0.0.0..0.0.0.',
  15: '...0.0.0..0.0.0.',
});

/** Squashed Mossbug: flat, all content in the bottom 6 rows. */
export const MOSSBUG_SQUASHED: readonly string[] = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '....00000000....',
  '..001212121200..',
  '.01212121212120.',
  '.00000000000000.',
  '.03033333333030.',
  '..000000000000..',
];

/** Snapper: a shelled critter with a row of spikes on its back (do not stomp). Frame 1. */
export const SNAPPER_WALK1: readonly string[] = [
  '................',
  '................',
  '................',
  '...0...0...0....',
  '..030.030.030...',
  '.0333033303330..',
  '.0000000000000..',
  '.0121212121210..',
  '.012121212121000',
  '.012121212120300',
  '.000000000000330',
  '..0222222222000.',
  '..000000000000..',
  '...00...00..00..',
  '..00...00..00...',
  '..00...00..00...',
];

/** Snapper frame 2: feet shuffled. */
export const SNAPPER_WALK2 = patchRows(SNAPPER_WALK1, {
  13: '...00...00..00..',
  14: '...00...00..00..',
  15: '....00...00..00.',
});

/** Flutter: a leaf-winged moth. Wings up. */
export const FLUTTER_1: readonly string[] = [
  '......0..0......',
  '.0000..00..0000.',
  '.01220.00.02210.',
  '..01220..02210..',
  '..012220022210..',
  '...0122002210...',
  '....01200210....',
  '......0110......',
  '.....001100.....',
  '....01200210....',
  '....02100120....',
  '.....000000.....',
  '.......00.......',
  '................',
  '................',
  '................',
];

/** Flutter wings down. */
export const FLUTTER_2: readonly string[] = [
  '................',
  '......0..0......',
  '.......00.......',
  '.......00.......',
  '.0000.0110.0000.',
  '.01220011002210.',
  '.01222011022210.',
  '..012220022210..',
  '...0120000210...',
  '....00100100....',
  '....01200210....',
  '.....000000.....',
  '.......00.......',
  '................',
  '................',
  '................',
];
