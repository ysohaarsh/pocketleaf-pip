import { describe, expect, it } from 'vitest';
import {
  JUMP_VELOCITY,
  RUN_SPEED,
  TERMINAL_VELOCITY,
  TICK_RATE,
  TILE,
  WALK_SPEED,
} from '../../src/game/constants';
import { approach } from '../../src/game/physics';
import { Driver, FLAT, play } from './engineHelpers';

/** Jump from flat ground holding A for `holdTicks`; returns apex height in tiles. */
function jumpApex(holdTicks: number): number {
  const d = play(FLAT);
  d.run(2);
  const y0 = d.world.player.y;
  let minY = y0;
  for (let i = 0; i < 120; i++) {
    d.tick({ a: i < holdTicks });
    minY = Math.min(minY, d.world.player.y);
  }
  expect(d.world.player.onGround).toBe(true);
  return (y0 - minY) / TILE;
}

/** Ticks spent jumping after walking off the ledge at column 5, pressing A on airborne tick k. */
function ledgeJump(k: number): boolean {
  const d = play([
    '..............................',
    '..............................',
    '..............................',
    '..............................',
    '..............................',
    '..............................',
    '..P..........................F',
    '######.......................#',
    '######.......................#',
  ]);
  for (let i = 0; i < 200 && d.world.player.onGround; i++) d.tick({ right: true });
  expect(d.world.player.onGround).toBe(false);
  for (let i = 1; i < k; i++) d.tick({ right: true });
  const before = d.sfx().length;
  d.tick({ right: true, a: true });
  return d.sfx().slice(before).includes('jump') && d.world.player.vy < -JUMP_VELOCITY * 0.9;
}

const DROP = [
  '..........',
  '..P.......',
  '..........',
  '..........',
  '..........',
  '..........',
  '.........F',
  '##########',
  '##########',
];

/** Tick index (1-based) on which Pip first lands after spawning in mid-air. */
function landingTick(): number {
  const d = play(DROP);
  for (let t = 1; t < 200; t++) {
    d.tick();
    if (d.world.player.onGround) return t;
  }
  throw new Error('never landed');
}

/** Press A on tick `pressAt` (1-based, released next tick); did a jump fire on the landing tick? */
function bufferedJumpOnLanding(pressAt: number, land: number): boolean {
  const d = play(DROP);
  for (let t = 1; t < land; t++) d.tick({ a: t === pressAt });
  const before = d.sfx().length;
  d.tick();
  return d.sfx().slice(before).includes('jump');
}

describe('player physics & feel', () => {
  it('approach moves toward a target without overshooting', () => {
    expect(approach(0, 10, 3)).toBe(3);
    expect(approach(9, 10, 3)).toBe(10);
    expect(approach(5, -10, 3)).toBe(2);
    expect(approach(-9, -10, 3)).toBe(-10);
  });

  it('held jump peaks at about 3.5 tiles (3-4)', () => {
    const apex = jumpApex(200);
    expect(apex).toBeGreaterThanOrEqual(3);
    expect(apex).toBeLessThanOrEqual(4);
  });

  it('a tapped jump is at least 30% lower than a held one but still about 2 tiles', () => {
    const held = jumpApex(200);
    const tap = jumpApex(1);
    expect(tap).toBeLessThanOrEqual(held * 0.7);
    expect(tap).toBeGreaterThanOrEqual(1.5);
    expect(tap).toBeLessThanOrEqual(2.5);
  });

  it('reaches walk speed in about 0.15 s and run speed with B', () => {
    const d = play(FLAT);
    d.run(2);
    let ticks = 0;
    while (d.world.player.vx < WALK_SPEED && ticks < 60) {
      d.tick({ right: true });
      ticks++;
    }
    expect(ticks / TICK_RATE).toBeGreaterThanOrEqual(0.13);
    expect(ticks / TICK_RATE).toBeLessThanOrEqual(0.17);
    d.run(30, { right: true });
    expect(d.world.player.vx).toBe(WALK_SPEED);
    d.run(40, { right: true, b: true });
    expect(d.world.player.vx).toBe(RUN_SPEED);
    expect(d.world.player.anim).toBe('run');
    // Letting go decelerates to a stop and Pip faces the way he walked.
    d.run(60);
    expect(d.world.player.vx).toBe(0);
    expect(d.world.player.anim).toBe('idle');
    d.run(5, { left: true });
    expect(d.world.player.facing).toBe(-1);
  });

  it('coyote time: a jump 5 ticks after leaving a ledge works, 10 ticks does not', () => {
    expect(ledgeJump(5)).toBe(true);
    expect(ledgeJump(10)).toBe(false);
  });

  it('jump buffer: A pressed up to 6 ticks before landing jumps on landing', () => {
    const land = landingTick();
    expect(bufferedJumpOnLanding(land - 6, land)).toBe(true);
    expect(bufferedJumpOnLanding(land - 3, land)).toBe(true);
    expect(bufferedJumpOnLanding(land - 7, land)).toBe(false);
  });

  it('falls no faster than terminal velocity', () => {
    const d = play(DROP);
    let max = 0;
    for (let i = 0; i < 40; i++) max = Math.max(max, d.tick().player.vy);
    expect(max).toBeLessThanOrEqual(TERMINAL_VELOCITY);
  });

  it('Pip cannot leave the level through its left edge', () => {
    const d = play(FLAT);
    d.run(120, { left: true, b: true });
    expect(d.world.player.x).toBe(0);
  });

  it('jump animation states follow vertical motion', () => {
    const d: Driver = play(FLAT);
    d.run(2);
    d.tick({ a: true });
    expect(d.world.player.anim).toBe('jump');
    d.run(60);
    expect(d.world.player.anim).toBe('idle');
    d.tick({ a: true });
    for (let i = 0; i < 60 && d.world.player.vy <= 0; i++) d.tick({ a: true });
    d.tick({ a: true });
    expect(d.world.player.anim).toBe('fall');
  });
});
