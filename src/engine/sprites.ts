/**
 * Sprite registry. All art is original and authored in code as palette-index rows
 * (see src/engine/spriteData/*). Every sprite is built and validated once at module load.
 */
import type { Sprite, SpriteId } from '../game/types';
import { sprite } from './spriteData/build';
import * as C from './spriteData/characters';
import * as I from './spriteData/items';
import * as S from './spriteData/scenery';
import * as T from './spriteData/tiles';

const SOURCES: Readonly<Record<SpriteId, readonly string[]>> = {
  pip_idle: C.PIP_IDLE,
  pip_run1: C.PIP_RUN1,
  pip_run2: C.PIP_RUN2,
  pip_jump: C.PIP_JUMP,
  pip_fall: C.PIP_FALL,
  pip_dead: C.PIP_DEAD,
  bloom_idle: C.BLOOM_IDLE,
  bloom_run1: C.BLOOM_RUN1,
  bloom_run2: C.BLOOM_RUN2,
  bloom_jump: C.BLOOM_JUMP,
  bloom_fall: C.BLOOM_FALL,
  mossbug_walk1: C.MOSSBUG_WALK1,
  mossbug_walk2: C.MOSSBUG_WALK2,
  mossbug_squashed: C.MOSSBUG_SQUASHED,
  snapper_walk1: C.SNAPPER_WALK1,
  snapper_walk2: C.SNAPPER_WALK2,
  flutter_1: C.FLUTTER_1,
  flutter_2: C.FLUTTER_2,
  glimmer_1: I.GLIMMER_1,
  glimmer_2: I.GLIMMER_2,
  glimmer_3: I.GLIMMER_3,
  sunseed: I.SUNSEED,
  beacon_top: I.BEACON_TOP,
  beacon_pole: I.BEACON_POLE,
  beacon_flag: I.BEACON_FLAG,
  tile_ground_top: T.TILE_GROUND_TOP,
  tile_ground: T.TILE_GROUND,
  tile_brick: T.TILE_BRICK,
  tile_block: T.TILE_BLOCK,
  tile_used: T.TILE_USED,
  tile_oneway: T.TILE_ONEWAY,
  tile_spike: T.TILE_SPIKE,
  tile_hard: T.TILE_HARD,
  shard: I.SHARD,
  cloud: S.CLOUD,
  bush: S.BUSH,
  hill: S.HILL,
  stalactite: S.STALACTITE,
  icon_glimmer: I.ICON_GLIMMER,
  icon_pip: I.ICON_PIP,
};

/** Every sprite id, in declaration order. */
export const SPRITE_IDS = Object.keys(SOURCES) as SpriteId[];

const CACHE = Object.fromEntries(SPRITE_IDS.map((id) => [id, sprite(SOURCES[id], id)])) as Record<
  SpriteId,
  Sprite
>;

/** Returns the (shared, cached) bitmap for a sprite id. Do not mutate the result. */
export function getSprite(id: SpriteId): Sprite {
  return CACHE[id];
}
