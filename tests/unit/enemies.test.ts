import { describe, expect, it } from 'vitest';
import {
  FLUTTER_AMPLITUDE,
  HURT_INVULN_TICKS,
  SCORE_STOMP,
  SQUASH_TICKS,
  TERMINAL_VELOCITY,
} from '../../src/game/constants';
import { play } from './engineHelpers';

const WALLS = [
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
  'P.......X.m..X.....F',
  '####################',
  '####################',
];

const LEDGE = [
  '....................',
  '....................',
  '....................',
  '..........m.........',
  '.........XXXX.......',
  '....................',
  'P..................F',
  '####################',
  '####################',
];

/** Pip drops from row 1 straight onto an enemy at row 6 in the same column. */
const dropOnto = (glyph: string): string[] => [
  '....................',
  '.....P..............',
  '....................',
  '....................',
  '....................',
  '....................',
  `.....${glyph}.............F`,
  '####################',
  '####################',
];

describe('enemies', () => {
  it('Mossbug walks, turns at walls in both directions', () => {
    const d = play(WALLS);
    const e = d.world.enemies[0]!;
    expect(e.kind).toBe('mossbug');
    d.run(2);
    expect(e.active).toBe(true);
    expect(e.dir).toBe(-1);
    d.run(100);
    expect(e.dir).toBe(1);
    expect(e.x).toBeGreaterThanOrEqual(9 * 16);
    d.run(160);
    expect(e.dir).toBe(-1);
    expect(e.x + e.w).toBeLessThanOrEqual(13 * 16);
  });

  it('Mossbug turns at ledges instead of walking off', () => {
    const d = play(LEDGE);
    const e = d.world.enemies[0]!;
    d.run(5);
    const y = e.y;
    let flips = 0;
    let dir = e.dir;
    let minX = Infinity;
    let maxX = -Infinity;
    for (let i = 0; i < 600; i++) {
      d.tick();
      if (e.dir !== dir) flips++;
      dir = e.dir;
      minX = Math.min(minX, e.x);
      maxX = Math.max(maxX, e.x + e.w);
    }
    expect(e.y).toBe(y);
    expect(flips).toBeGreaterThanOrEqual(2);
    expect(minX).toBeGreaterThanOrEqual(9 * 16 - 1);
    expect(maxX).toBeLessThanOrEqual(13 * 16 + 1);
  });

  it('stomping a Mossbug squashes it, bounces Pip and scores', () => {
    const d = play(dropOnto('m'));
    const e = d.world.enemies[0]!;
    let bounced = false;
    for (let i = 0; i < 40 && e.state === 'walk'; i++) {
      d.tick();
      bounced = d.world.player.vy < 0;
    }
    expect(e.state).toBe('squashed');
    expect(bounced).toBe(true);
    expect(d.world.scene).toBe('playing');
    expect(d.world.score).toBe(SCORE_STOMP);
    expect(d.sfx()).toContain('stomp');
    d.run(SQUASH_TICKS + 1);
    expect(d.world.enemies).toHaveLength(0);
  });

  it('landing on two overlapping enemies in one tick stomps both (regression)', () => {
    const d = play(dropOnto('m'));
    const bug = d.world.enemies[0]!;
    // A Flutter hovering 1 px above the Mossbug's top; timer 29 → next tick sits at the sine peak.
    d.world.enemies.push({
      ...bug,
      id: 999,
      kind: 'flutter',
      timer: 29,
      y: bug.y - 1,
      baseY: bug.y - 1 - FLUTTER_AMPLITUDE,
    });
    const p = d.world.player;
    p.x = bug.x;
    p.y = bug.y - p.h - 3;
    p.vy = TERMINAL_VELOCITY;
    p.onGround = false;
    d.tick();
    expect(d.world.enemies.map((e) => e.state)).toEqual(['squashed', 'dead']);
    expect(d.world.scene).toBe('playing');
    expect(p.invuln).toBe(0);
    expect(d.world.score).toBe(2 * SCORE_STOMP);
  });

  it('a stomp with A held bounces higher', () => {
    const vyAfter = (aHeld: boolean): number => {
      const d = play(dropOnto('m'));
      const e = d.world.enemies[0]!;
      for (let i = 0; i < 40 && e.state === 'walk'; i++) d.tick({ a: aHeld && i > 3 });
      return d.world.player.vy;
    };
    expect(vyAfter(true)).toBeLessThan(vyAfter(false));
  });

  it('side contact with a Mossbug kills small Pip', () => {
    const d = play(
      WALLS.map((r) => r.replace('X', '.')).map((r, i) => (i === 6 ? 'P..m...........X...F' : r)),
    );
    for (let i = 0; i < 200 && d.world.scene === 'playing'; i++) d.tick();
    expect(d.world.scene).toBe('dying');
    expect(d.sfx()).toContain('death');
  });

  it('side contact shrinks Bloom Pip with invulnerability frames', () => {
    const d = play(WALLS.map((r, i) => (i === 6 ? 'P..m...........X...F' : r)));
    d.world.player.form = 'bloom';
    for (let i = 0; i < 200 && d.world.player.form === 'bloom'; i++) d.tick();
    expect(d.world.player.form).toBe('small');
    expect(d.world.player.invuln).toBeGreaterThan(HURT_INVULN_TICKS - 3);
    expect(d.sfx()).toContain('hurt');
    // The Mossbug keeps touching Pip, but i-frames protect him.
    d.run(30);
    expect(d.world.scene).toBe('playing');
  });

  it('Snapper cannot be stomped: landing on it hurts Pip', () => {
    const d = play(dropOnto('x'));
    for (let i = 0; i < 60 && d.world.scene === 'playing'; i++) d.tick();
    expect(d.world.scene).toBe('dying');
    expect(d.world.enemies[0]!.state).toBe('walk');
  });

  it('Flutter bobs on a sine wave and can be stomped', () => {
    const d = play([
      '....................',
      '.....P..............',
      '....................',
      '....................',
      '.....f..............',
      '....................',
      '...................F',
      '####################',
      '####################',
    ]);
    const e = d.world.enemies[0]!;
    const base = e.baseY;
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < 40 && e.state === 'walk'; i++) {
      d.tick();
      lo = Math.min(lo, e.y);
      hi = Math.max(hi, e.y);
    }
    expect(lo).toBeGreaterThanOrEqual(base - FLUTTER_AMPLITUDE - 1e-9);
    expect(hi).toBeLessThanOrEqual(base + FLUTTER_AMPLITUDE + 1e-9);
    expect(e.state).toBe('dead');
    expect(d.world.score).toBe(SCORE_STOMP);
    d.run(120);
    expect(d.world.enemies).toHaveLength(0);
  });

  it('Flutter patrols back and forth over time', () => {
    const d = play([
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '.....f........................',
      '..............................',
      '.........P...................F',
      '##############################',
      '##############################',
    ]);
    const e = d.world.enemies[0]!;
    const dirs = new Set<number>();
    for (let i = 0; i < 400; i++) dirs.add(d.tick().enemies[0]!.dir);
    expect(dirs.size).toBe(2);
    expect(Math.abs(e.y - e.baseY)).toBeLessThanOrEqual(FLUTTER_AMPLITUDE);
  });

  it('enemies far from the camera stay inactive; enemies falling into pits are removed', () => {
    const map = [
      '................................................',
      '................................................',
      '................................................',
      '................................................',
      '................................................',
      '................................................',
      'P....m.........................................m',
      '####..##########################################',
      '####..#################################.......F#',
    ];
    const d = play(map);
    const far = d.world.enemies[1]!;
    const farX = far.x;
    d.run(240);
    expect(far.active).toBe(false);
    expect(far.x).toBe(farX);
    expect(d.world.enemies).toHaveLength(1);
  });
});
