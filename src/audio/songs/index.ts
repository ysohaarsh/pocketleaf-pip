import type { SongId } from '../../game/types';
import type { Song } from '../chip';
import { CAVE } from './cave';
import { ENDING } from './ending';
import { GRASS } from './grass';
import { SKY } from './sky';
import { TITLE } from './title';

/** Every song, by id. */
export const SONGS: Readonly<Record<SongId, Song>> = {
  title: TITLE,
  grass: GRASS,
  cave: CAVE,
  sky: SKY,
  ending: ENDING,
};
