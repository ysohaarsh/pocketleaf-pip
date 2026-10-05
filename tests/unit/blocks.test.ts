import { describe, expect, it } from 'vitest';
import { bumpOffset } from '../../src/game/blocks';
import {
  SCORE_BRICK,
  SCORE_GLIMMER,
  SCORE_SEED,
  SCORE_STOMP,
  START_LIVES,
} from '../../src/game/constants';
import { Tile, type World } from '../../src/game/types';
import { play, type Driver } from './engineHelpers';

/** A level with a single block glyph three rows above Pip's head. */
const blockAbove = (glyph: string, extraRow2 = '..............................'): string[] => [
  '..............................',
  '..............................',
  extraRow2,
  `..${glyph}...........................`.slice(0, 30),
  '..............................',
  '..............................',
  '..P..........................F',
  '##############################',
  '##############################',
];

const tileAtW = (w: World, tx: number, ty: number): number => w.tiles[ty * w.level.width + tx]!;

/** Hold A until Pip lands again. */
function jumpAndLand(d: Driver): void {
  d.tick({ a: true });
  for (let i = 0; i < 120 && !d.world.player.onGround; i++) d.tick({ a: true });
  d.run(2);
}

describe('blocks & items', () => {
  it('a ? block yields one Glimmer once, then is a used block', () => {
    const d = play(blockAbove('?'));
    d.run(2);
    jumpAndLand(d);
    expect(d.world.coins).toBe(1);
    expect(d.world.score).toBe(SCORE_GLIMMER);
    expect(tileAtW(d.world, 2, 3)).toBe(Tile.UsedBlock);
    expect(d.sfx()).toContain('coin');
    jumpAndLand(d);
    expect(d.world.coins).toBe(1);
    expect(d.sfx().filter((s) => s === 'bump')).toHaveLength(1);
    // The popped Glimmer animates then disappears without scoring twice.
    d.run(40);
    expect(d.world.items).toHaveLength(0);
    expect(d.world.score).toBe(SCORE_GLIMMER);
  });

  it('a bumped block animates for a few ticks', () => {
    const d = play(blockAbove('?'));
    d.run(2);
    d.tick({ a: true });
    for (let i = 0; i < 60 && d.world.bumps.length === 0; i++) d.tick({ a: true });
    expect(d.world.bumps).toHaveLength(1);
    d.run(3);
    expect(bumpOffset(d.world, 2, 3)).toBeLessThan(0);
    expect(bumpOffset(d.world, 5, 3)).toBe(0);
    d.run(10);
    expect(d.world.bumps).toHaveLength(0);
  });

  it('a Seed block sprouts a Sun Seed that powers Pip up', () => {
    const d = play(blockAbove('S'));
    d.run(2);
    jumpAndLand(d);
    expect(d.sfx()).toContain('sprout');
    expect(d.world.items[0]!.kind).toBe('sunseed');
    expect(tileAtW(d.world, 2, 3)).toBe(Tile.UsedBlock);
    // Let the Seed slide off the block and land ahead of Pip, then chase it.
    d.run(60);
    for (let i = 0; i < 400 && d.world.player.form === 'small'; i++) d.tick({ right: true });
    expect(d.world.player.form).toBe('bloom');
    expect(d.sfx()).toContain('powerup');
    expect(d.world.score).toBe(SCORE_SEED);
  });

  it('a Sun Seed turns around at walls', () => {
    const d = play([
      '..............................',
      '..............................',
      '..............................',
      '..S...........................',
      '..............................',
      '..............................',
      '..P.....X....................F',
      '##############################',
      '##############################',
    ]);
    d.run(2);
    jumpAndLand(d);
    d.run(30);
    const seed = d.world.items[0]!;
    expect(seed.state).toBe('moving');
    let turned = false;
    for (let i = 0; i < 200 && !turned; i++) turned = d.tick().items[0]!.vx < 0;
    expect(turned).toBe(true);
  });

  it('a second Seed while in Bloom only scores', () => {
    const d = play(blockAbove('S'));
    d.world.player.form = 'bloom';
    d.run(2);
    jumpAndLand(d);
    d.run(60);
    for (let i = 0; i < 400 && d.world.score === 0; i++) d.tick({ right: true });
    expect(d.world.player.form).toBe('bloom');
    expect(d.world.score).toBe(SCORE_SEED);
  });

  it('bricks only bump for small Pip and break for Bloom Pip', () => {
    const small = play(blockAbove('B'));
    small.run(2);
    jumpAndLand(small);
    expect(tileAtW(small.world, 2, 3)).toBe(Tile.Brick);
    expect(small.sfx()).toContain('bump');
    expect(small.world.score).toBe(0);

    const bloom = play(blockAbove('B'));
    bloom.world.player.form = 'bloom';
    bloom.run(2);
    bloom.tick({ a: true });
    for (let i = 0; i < 60 && bloom.world.particles.length === 0; i++) bloom.tick({ a: true });
    expect(tileAtW(bloom.world, 2, 3)).toBe(Tile.Empty);
    expect(bloom.world.particles.filter((p) => p.kind === 'shard')).toHaveLength(4);
    expect(bloom.sfx()).toContain('break');
    expect(bloom.world.score).toBe(SCORE_BRICK);
    bloom.run(120);
    expect(bloom.world.particles).toHaveLength(0);
  });

  it('hard and used blocks just bump', () => {
    const d = play(blockAbove('X'));
    d.run(2);
    jumpAndLand(d);
    expect(d.sfx()).toEqual(['jump', 'bump']);
  });

  it('bumping a block knocks out the enemy standing on it and collects a Glimmer above it', () => {
    const d = play(blockAbove('BB', '..om..........................'));
    d.run(2);
    jumpAndLand(d);
    expect(d.world.score).toBe(SCORE_STOMP + SCORE_GLIMMER);
    expect(d.world.coins).toBe(1);
    expect(d.sfx()).toContain('stomp');
    d.run(120);
    expect(d.world.enemies).toHaveLength(0);
  });

  it('Glimmer tiles are collected on overlap; 100 give an extra life', () => {
    const d = play([
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..P.oo.......................F',
      '##############################',
      '##############################',
    ]);
    d.world.coins = 98;
    d.run(60, { right: true });
    expect(d.world.coins).toBe(0);
    expect(d.world.lives).toBe(START_LIVES + 1);
    expect(d.world.score).toBe(2 * SCORE_GLIMMER);
    expect(d.sfx()).toEqual(['coin', 'coin', 'oneup']);
  });

  it('spikes and pits kill Pip', () => {
    const spikes = play([
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..P..^.......................F',
      '##############################',
      '##############################',
    ]);
    for (let i = 0; i < 120 && spikes.world.scene === 'playing'; i++) spikes.tick({ right: true });
    expect(spikes.world.scene).toBe('dying');

    const pit = play([
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..P..........................F',
      '#####...######################',
      '#####...######################',
    ]);
    for (let i = 0; i < 200 && pit.world.scene === 'playing'; i++) pit.tick({ right: true });
    expect(pit.world.scene).toBe('dying');
    expect(pit.world.player.dead).toBe(true);
  });
});
