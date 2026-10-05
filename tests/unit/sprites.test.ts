import { describe, expect, it } from 'vitest';
import { SPRITE_IDS, getSprite } from '../../src/engine/sprites';
import { patchRows, sprite } from '../../src/engine/spriteData/build';
import { TRANSPARENT, type SpriteId } from '../../src/game/types';

const EXPECTED_SIZE: Partial<Record<SpriteId, [number, number]>> = {
  shard: [8, 8],
  icon_glimmer: [8, 8],
  icon_pip: [8, 8],
  cloud: [32, 16],
  bush: [32, 16],
  hill: [48, 32],
};

/** Every id in the SpriteId union, spelled out so a new id fails this test until drawn. */
const ALL_IDS: readonly SpriteId[] = [
  'pip_idle',
  'pip_run1',
  'pip_run2',
  'pip_jump',
  'pip_fall',
  'pip_dead',
  'bloom_idle',
  'bloom_run1',
  'bloom_run2',
  'bloom_jump',
  'bloom_fall',
  'mossbug_walk1',
  'mossbug_walk2',
  'mossbug_squashed',
  'snapper_walk1',
  'snapper_walk2',
  'flutter_1',
  'flutter_2',
  'glimmer_1',
  'glimmer_2',
  'glimmer_3',
  'sunseed',
  'beacon_top',
  'beacon_pole',
  'beacon_flag',
  'tile_ground_top',
  'tile_ground',
  'tile_brick',
  'tile_block',
  'tile_used',
  'tile_oneway',
  'tile_spike',
  'tile_hard',
  'shard',
  'cloud',
  'bush',
  'hill',
  'stalactite',
  'icon_glimmer',
  'icon_pip',
];

const rowHasInk = (id: SpriteId, y: number): boolean => {
  const s = getSprite(id);
  for (let x = 0; x < s.w; x++) if (s.pixels[y * s.w + x] !== TRANSPARENT) return true;
  return false;
};

describe('sprites', () => {
  it('covers every SpriteId', () => {
    expect([...SPRITE_IDS].sort()).toEqual([...ALL_IDS].sort());
  });

  it.each(ALL_IDS)('%s has the right size and only legal pixels', (id) => {
    const s = getSprite(id);
    const [w, h] = EXPECTED_SIZE[id] ?? [16, 16];
    expect(s.w).toBe(w);
    expect(s.h).toBe(h);
    expect(s.pixels.length).toBe(w * h);
    for (const p of s.pixels) expect([0, 1, 2, 3, TRANSPARENT]).toContain(p);
    expect(s.pixels.some((p) => p !== TRANSPARENT)).toBe(true);
  });

  it('returns cached instances', () => {
    expect(getSprite('pip_idle')).toBe(getSprite('pip_idle'));
  });

  it('keeps solid tiles opaque in their body and the one-way plank thin', () => {
    for (const id of ['tile_ground', 'tile_ground_top', 'tile_brick', 'tile_hard'] as const) {
      expect(getSprite(id).pixels.includes(TRANSPARENT)).toBe(false);
    }
    for (let y = 6; y < 16; y++) expect(rowHasInk('tile_oneway', y)).toBe(false);
  });

  it('keeps the squashed Mossbug in the bottom 6 rows', () => {
    for (let y = 0; y < 10; y++) expect(rowHasInk('mossbug_squashed', y)).toBe(false);
    expect(rowHasInk('mossbug_squashed', 15)).toBe(true);
  });

  it('grounds walking characters on the bottom row', () => {
    for (const id of [
      'pip_idle',
      'pip_run1',
      'pip_run2',
      'mossbug_walk1',
      'snapper_walk1',
    ] as const)
      expect(rowHasInk(id, 15)).toBe(true);
  });

  it('distinguishes animation frames', () => {
    const differ = (a: SpriteId, b: SpriteId): boolean =>
      getSprite(a).pixels.some((p, i) => p !== getSprite(b).pixels[i]);
    expect(differ('pip_run1', 'pip_run2')).toBe(true);
    expect(differ('pip_idle', 'bloom_idle')).toBe(true);
    expect(differ('glimmer_1', 'glimmer_2')).toBe(true);
    expect(differ('glimmer_1', 'glimmer_3')).toBe(true);
    expect(differ('flutter_1', 'flutter_2')).toBe(true);
    expect(differ('mossbug_walk1', 'mossbug_walk2')).toBe(true);
    expect(differ('snapper_walk1', 'snapper_walk2')).toBe(true);
  });

  it('sprite() rejects ragged rows and illegal characters', () => {
    expect(() => sprite(['00', '0'])).toThrow(/width/);
    expect(() => sprite(['0x'])).toThrow(/illegal/);
    expect(() => sprite([])).toThrow(/no rows/);
    const s = sprite(['.3']);
    expect([...s.pixels]).toEqual([TRANSPARENT, 3]);
    expect(patchRows(['a', 'b'], { 1: 'c' })).toEqual(['a', 'c']);
  });
});
