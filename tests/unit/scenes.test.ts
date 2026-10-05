import { describe, expect, it } from 'vitest';
import {
  BOOT_CHIME_TICK,
  BOOT_TICKS,
  CLEAR_TICKS,
  DYING_TICKS,
  INTRO_TICKS,
  SCORE_TIME_BONUS,
  START_LIVES,
  TICK_RATE,
} from '../../src/game/constants';
import { createWorld } from '../../src/game/world';
import type { GameEvent, LevelDef } from '../../src/game/types';
import { Driver, FLAT, level, makeWorld } from './engineHelpers';

/** Short level: the Beacon is a few steps to Pip's right. */
const SHORT = [
  '..........',
  '..........',
  '..........',
  '..........',
  '..........',
  '..........',
  '..P....F..',
  '##########',
  '##########',
];

const L1: LevelDef = level(SHORT, { id: 'a', label: '1-1', song: 'grass', timeLimit: 100 });
const L2: LevelDef = level(SHORT, { id: 'b', label: '1-2', song: 'cave', theme: 'cave' });

const music = (log: GameEvent[]): (string | null)[] =>
  log.flatMap((e) => (e.kind === 'music' ? [e.song] : []));

/** Kill Pip by running the clock out and wait out the dying scene. */
function dieOnce(d: Driver): void {
  d.world.timeTicks = 1;
  d.tick();
  expect(d.world.scene).toBe('dying');
  d.run(DYING_TICKS);
}

describe('scene state machine', () => {
  it('boot fades in, chimes, and reaches the title on its own', () => {
    const d = new Driver(makeWorld([L1], 'boot'));
    d.run(BOOT_CHIME_TICK);
    expect(d.sfx()).toEqual(['boot']);
    expect(d.world.scene).toBe('boot');
    d.run(BOOT_TICKS - BOOT_CHIME_TICK);
    expect(d.world.scene).toBe('title');
    expect(music(d.log)).toEqual(['title']);
  });

  it('any button skips boot', () => {
    const d = new Driver(makeWorld([L1], 'boot'));
    d.run(3);
    d.tick({ b: true });
    expect(d.world.scene).toBe('title');
  });

  it('tick advances in boot and title but not while paused', () => {
    const d = new Driver(makeWorld([L1], 'boot'));
    d.run(5);
    expect(d.world.tick).toBe(5);
    d.tap('start');
    d.run(5);
    expect(d.world.scene).toBe('title');
    expect(d.world.tick).toBe(12);
  });

  it('title → intro → playing → paused → playing', () => {
    const d = new Driver(makeWorld([L1, L2], 'title'));
    expect(d.world.scene).toBe('title');
    d.tap('select');
    expect(d.world.musicOn).toBe(false);
    d.tap('select');
    expect(d.world.musicOn).toBe(true);
    expect(music(d.log)).toEqual(['title', null, 'title']);
    d.tap('start');
    expect(d.world.scene).toBe('intro');
    expect(d.world.lives).toBe(START_LIVES);
    expect(d.world.score).toBe(0);
    d.run(INTRO_TICKS);
    expect(d.world.scene).toBe('playing');
    expect(music(d.log).at(-1)).toBe('grass');
    d.tap('start');
    expect(d.world.scene).toBe('paused');
    expect(d.sfx()).toContain('pause');
    const tick = d.world.tick;
    const x = d.world.player.x;
    d.run(30, { right: true });
    expect(d.world.tick).toBe(tick);
    expect(d.world.player.x).toBe(x);
    d.tick({ start: true, right: true });
    expect(d.world.scene).toBe('playing');
    d.tick();
    expect(d.world.tick).toBe(tick + 1);
  });

  it('A skips the intro card', () => {
    const d = new Driver(makeWorld([L1], 'intro'));
    expect(d.world.scene).toBe('intro');
    d.tap('a');
    expect(d.world.scene).toBe('playing');
  });

  it('running out of time kills Pip and costs a life; Bloom is lost', () => {
    const d = new Driver(makeWorld([L1], 'playing'));
    d.world.player.form = 'bloom';
    d.world.timeTicks = 3;
    d.run(3);
    expect(d.world.scene).toBe('dying');
    expect(d.sfx()).toContain('death');
    expect(music(d.log).at(-1)).toBeNull();
    d.run(DYING_TICKS);
    expect(d.world.scene).toBe('intro');
    expect(d.world.lives).toBe(START_LIVES - 1);
    expect(d.world.player.form).toBe('small');
    expect(d.world.timeTicks).toBe(L1.timeLimit * TICK_RATE);
  });

  it('game over at zero lives; menu moves; CONTINUE restarts the level fresh', () => {
    const d = new Driver(makeWorld([L1, L2], 'playing', { startIndex: 1 }));
    d.world.score = 500;
    for (let i = 0; i < START_LIVES; i++) {
      if (d.world.scene === 'intro') d.tap('start');
      dieOnce(d);
    }
    expect(d.world.scene).toBe('gameover');
    expect(d.world.lives).toBe(0);
    expect(d.world.highScore).toBe(500);
    expect(d.log).toContainEqual({ kind: 'highScore', score: 500 });
    d.tap('down');
    expect(d.world.menuIndex).toBe(1);
    d.tap('up');
    expect(d.world.menuIndex).toBe(0);
    expect(d.sfx().filter((s) => s === 'select')).toHaveLength(2);
    d.tap('start');
    expect(d.world.scene).toBe('intro');
    expect(d.world.levelIndex).toBe(1);
    expect(d.world.lives).toBe(START_LIVES);
    expect(d.world.score).toBe(0);
  });

  it('game over → TITLE returns to the title', () => {
    const d = new Driver(makeWorld([L1], 'playing'));
    for (let i = 0; i < START_LIVES; i++) {
      if (d.world.scene === 'intro') d.tap('a');
      dieOnce(d);
    }
    d.tap('down');
    d.tap('a');
    expect(d.world.scene).toBe('title');
  });

  it('touching the Beacon clears the level, tallies time and advances; the last level wins', () => {
    const d = new Driver(makeWorld([L1, L2], 'playing'));
    for (let i = 0; i < 200 && d.world.scene === 'playing'; i++) d.tick({ right: true });
    expect(d.world.scene).toBe('clear');
    expect(d.sfx()).toContain('clear');
    const secs = Math.ceil(d.world.timeTicks / TICK_RATE);
    const score = d.world.score;
    d.run(CLEAR_TICKS - 1);
    expect(d.world.scene).toBe('clear');
    expect(d.world.timeTicks).toBe(0);
    expect(d.world.score).toBe(score + secs * SCORE_TIME_BONUS);
    d.tick();
    expect(d.world.scene).toBe('intro');
    expect(d.world.levelIndex).toBe(1);
    expect(d.log).toContainEqual({ kind: 'highScore', score: d.world.score });
    d.tap('start');
    for (let i = 0; i < 200 && d.world.scene === 'playing'; i++) d.tick({ right: true });
    d.run(CLEAR_TICKS + 60);
    expect(d.world.scene).toBe('win');
    expect(music(d.log).at(-1)).toBe('ending');
    d.tap('start');
    expect(d.world.scene).toBe('title');
    expect(d.world.levelIndex).toBe(0);
  });

  it('Pip slides down the Beacon pole when touching it mid-air', () => {
    const d = new Driver(
      makeWorld([
        level([
          '..........',
          '..........',
          '..........',
          '..........',
          '..........',
          '..........',
          '..P....F..',
          '#####..###',
          '#####..###',
        ]),
      ]),
    );
    d.run(14, { right: true });
    for (let i = 0; i < 100 && d.world.scene === 'playing'; i++) d.tick({ right: true, a: true });
    expect(d.world.scene).toBe('clear');
    const y = d.world.player.y;
    d.tick();
    expect(d.world.player.y).toBeGreaterThanOrEqual(y);
    d.run(120);
    expect(d.world.player.y + d.world.player.h).toBe(7 * 16);
  });

  it('createWorld validates input and starts where asked', () => {
    expect(() => createWorld({ seed: 1, levels: [], highScore: 0, freezeAnim: false })).toThrow();
    const w = createWorld({ seed: 7, levels: [level(FLAT)], highScore: 42, freezeAnim: false });
    expect(w.scene).toBe('boot');
    expect(w.highScore).toBe(42);
    const t = createWorld({
      seed: 7,
      levels: [level(FLAT)],
      highScore: 0,
      freezeAnim: false,
      startScene: 'title',
    });
    expect(t.scene).toBe('title');
    expect(music(t.events)).toEqual(['title']);
    const p = makeWorld([L1, L2], 'playing', { startIndex: 1 });
    expect(p.levelIndex).toBe(1);
    expect(music(p.events)).toEqual(['cave']);
  });
});
