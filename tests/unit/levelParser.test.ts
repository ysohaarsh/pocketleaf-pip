import { describe, expect, it } from 'vitest';
import { LevelError, parseLevel, validateLevel } from '../../src/game/levelParser';
import { Tile, type LevelDef } from '../../src/game/types';

const base = (map: string[]): LevelDef => ({
  id: 't',
  label: 'T',
  name: 'T',
  theme: 'grass',
  timeLimit: 100,
  song: 'grass',
  map,
});

const good = [
  '..........',
  '..........',
  '..........',
  '..........',
  '...?S.o...',
  '..........',
  'P..m..x..F',
  '####==^###',
  '##########',
];

describe('levelParser', () => {
  it('parses tiles, spawns and markers', () => {
    const lvl = parseLevel(base(good));
    expect(lvl.width).toBe(10);
    expect(lvl.height).toBe(9);
    expect(lvl.start).toEqual({ tx: 0, ty: 6 });
    expect(lvl.beacon).toEqual({ tx: 9, ty: 6 });
    expect(lvl.tiles[4 * 10 + 3]).toBe(Tile.CoinBlock);
    expect(lvl.tiles[4 * 10 + 4]).toBe(Tile.SeedBlock);
    expect(lvl.tiles[4 * 10 + 6]).toBe(Tile.Glimmer);
    expect(lvl.tiles[7 * 10 + 4]).toBe(Tile.OneWay);
    expect(lvl.tiles[7 * 10 + 6]).toBe(Tile.Spike);
    expect(lvl.spawns.map((s) => s.kind)).toEqual(['mossbug', 'snapper']);
    expect(lvl.tiles[6 * 10 + 3]).toBe(Tile.Empty);
  });

  it('rejects missing markers, ragged rows and unknown glyphs', () => {
    const bad = good.map((r) => r.replace('P', '.').replace('F', 'F'));
    bad[2] = '.....Z....';
    bad[3] = '...';
    const problems = validateLevel(base(bad));
    expect(problems.some((p) => p.includes('exactly one P'))).toBe(true);
    expect(problems.some((p) => p.includes("unknown glyph 'Z'"))).toBe(true);
    expect(problems.some((p) => p.includes('row 3'))).toBe(true);
    expect(() => parseLevel(base(bad))).toThrow(LevelError);
  });

  it('rejects wrong row counts and duplicate beacons', () => {
    expect(validateLevel(base(good.slice(1))).length).toBeGreaterThan(0);
    const dup = [...good];
    dup[5] = 'F.........';
    expect(validateLevel(base(dup)).some((p) => p.includes('exactly one F'))).toBe(true);
  });
});
