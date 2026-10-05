import { describe, expect, it } from 'vitest';
import { fnv1a, hashWorld } from '../../src/game/hash';
import type { Buttons } from '../../src/game/types';
import { Driver, level, makeWorld } from './engineHelpers';

const MAP = [
  '................................................',
  '................................................',
  '................................................',
  '.......?S?B.........o.o.o.......................',
  '.............................====...............',
  '................................................',
  '..P......m.......x..........m.........f.......F.',
  '##########################...###################',
  '##########################...###################',
];

/** A deterministic scripted input for tick t (walk/run right, periodic jumps, a pause). */
function script(t: number, variant: number): Partial<Buttons> {
  if (t < 10) return {};
  if (t === 10 || t === 11) return { start: true };
  return {
    right: t % 200 < 170,
    left: t % 200 >= 185,
    b: t % 300 > 150,
    a: (t + variant) % 45 < 14,
    start: t === 400 || t === 430,
  };
}

function run(variant: number, ticks = 900): { hash: string; hashes: string[] } {
  const d = new Driver(makeWorld([level(MAP)], 'title', { seed: 1234 }));
  const hashes: string[] = [];
  for (let t = 0; t < ticks; t++) {
    d.tick(script(t, variant));
    if (t % 100 === 0) hashes.push(hashWorld(d.world));
  }
  return { hash: hashWorld(d.world), hashes };
}

describe('deterministic replay', () => {
  it('the same input script over 900 ticks hashes identically', () => {
    const a = run(0);
    const b = run(0);
    expect(a.hash).toBe(b.hash);
    expect(a.hashes).toEqual(b.hashes);
    // The run actually went somewhere (hashes change over time).
    expect(new Set(a.hashes).size).toBeGreaterThan(5);
  });

  it('a different input script produces a different hash', () => {
    expect(run(7).hash).not.toBe(run(0).hash);
  });

  it('hashWorld ignores events and levels but sees state', () => {
    const w = makeWorld([level(MAP)]);
    const h = hashWorld(w);
    w.events.push({ kind: 'sfx', sfx: 'coin' });
    expect(hashWorld(w)).toBe(h);
    w.player.x += 0.00001;
    expect(hashWorld(w)).toBe(h);
    w.player.x += 1;
    expect(hashWorld(w)).not.toBe(h);
  });

  it('fnv1a matches the reference vectors', () => {
    expect(fnv1a('')).toBe('811c9dc5');
    expect(fnv1a('a')).toBe('e40c292c');
  });
});
