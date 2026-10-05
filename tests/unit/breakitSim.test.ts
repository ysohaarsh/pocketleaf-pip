import { describe, expect, it } from 'vitest';
import {
  CLEAR_TICKS,
  DYING_TICKS,
  INTRO_TICKS,
  MAX_LIVES,
  MAX_SCORE,
  SCORE_STOMP,
  START_LIVES,
  TERMINAL_VELOCITY,
  TICK_RATE,
  TILE,
} from '../../src/game/constants';
import { hashWorld } from '../../src/game/hash';
import { LEVELS } from '../../src/game/levels';
import { BUTTON_NAMES, Tile, type Buttons, type SceneId } from '../../src/game/types';
import { rasterize } from '../../src/engine/renderer';
import { Driver, FLAT, level, makeWorld, play } from './engineHelpers';

const ALL: Partial<Buttons> = Object.fromEntries(BUTTON_NAMES.map((b) => [b, true]));

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

/** Pip above an enemy glyph in column 5. */
const OVER = (glyph: string): string[] => [
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

describe('break-it: simulation edge cases', () => {
  it('holding all 8 buttons for minutes from boot never corrupts the world', () => {
    const d = new Driver(makeWorld([...LEVELS], 'boot'));
    const seen = new Set<SceneId>();
    for (let i = 0; i < 20000; i++) {
      d.tick(i % 997 === 0 ? {} : ALL);
      seen.add(d.world.scene);
      expect(Number.isFinite(d.world.player.x + d.world.player.y + d.world.timeTicks)).toBe(true);
    }
    expect(seen).toContain('playing');
    expect(seen).toContain('paused');
  });

  it('left+right together cancel out and keep facing', () => {
    const d = play(FLAT);
    d.run(60, { left: true, right: true });
    expect(d.world.player.vx).toBe(0);
    expect(d.world.player.facing).toBe(1);
  });

  it('A held through landing does not jump again', () => {
    const d = play(FLAT);
    d.run(200, { a: true });
    expect(d.sfx().filter((s) => s === 'jump')).toHaveLength(1);
    expect(d.world.player.onGround).toBe(true);
  });

  it('START mashed every tick only toggles pause; time runs only on playing ticks', () => {
    const d = play(FLAT);
    const t0 = d.world.timeTicks;
    let playingTicks = 0;
    for (let i = 0; i < 400; i++) {
      const before = d.world.scene;
      d.tick({ start: i % 2 === 0 });
      if (before === 'playing' && d.world.scene === 'playing') playingTicks++;
    }
    expect(t0 - d.world.timeTicks).toBe(playingTicks);
  });

  it('time never runs out while paused', () => {
    const d = play(FLAT);
    d.world.timeTicks = 2;
    d.tap('start');
    d.run(10 * TICK_RATE);
    expect(d.world.scene).toBe('paused');
    expect(d.world.timeTicks).toBe(2);
  });

  it('START on the tick of a fatal hit pauses first; the hit lands after resuming', () => {
    const d = play(OVER('x'));
    const p = d.world.player;
    const e = d.world.enemies[0]!;
    p.x = e.x;
    p.y = e.y - p.h - 1;
    p.vy = TERMINAL_VELOCITY;
    p.onGround = false;
    d.tick({ start: true });
    expect(d.world.scene).toBe('paused');
    d.tick();
    d.tick({ start: true });
    expect(d.world.scene).toBe('playing');
    d.tick();
    expect(d.world.scene).toBe('dying');
  });

  it('dying on the same tick a Sun Seed touches Pip does not collect it', () => {
    const map = [...FLAT];
    map[6] = '..P^' + map[6]!.slice(4);
    const d = play(map);
    const p = d.world.player;
    p.x = 3 * TILE + 3;
    p.y = 7 * TILE - p.h - 4; // feet inside the spike's lethal band
    p.vy = 60;
    p.onGround = false;
    d.world.items.push({
      id: 500,
      kind: 'sunseed',
      x: p.x,
      y: p.y,
      w: 12,
      h: 12,
      vx: 0,
      vy: 0,
      state: 'moving',
      timer: 99,
    });
    d.tick();
    expect(d.world.scene).toBe('dying');
    expect(p.form).toBe('small');
    expect(d.sfx()).not.toContain('powerup');
  });

  it('stomping still works while invulnerable', () => {
    const d = play(OVER('m'));
    const p = d.world.player;
    const e = d.world.enemies[0]!;
    p.invuln = 60;
    p.x = e.x;
    p.y = e.y - p.h - 3;
    p.vy = TERMINAL_VELOCITY;
    p.onGround = false;
    d.tick();
    expect(e.state).toBe('squashed');
    expect(d.world.score).toBe(SCORE_STOMP);
    expect(d.world.scene).toBe('playing');
  });

  it('two enemies hitting Bloom Pip on the same tick cost Bloom once, not a life', () => {
    const d = play(OVER('x'));
    const p = d.world.player;
    const e = d.world.enemies[0]!;
    d.world.enemies.push({ ...e, id: 777, x: e.x + 2 });
    p.form = 'bloom';
    p.x = e.x + 1;
    p.y = e.y;
    p.vy = 0;
    d.tick();
    expect(p.form).toBe('small');
    expect(d.world.scene).toBe('playing');
    expect(d.sfx().filter((s) => s === 'hurt')).toHaveLength(1);
  });

  it('the timer hitting 0 on the Beacon tick kills instead of clearing', () => {
    const d = play(SHORT);
    for (let i = 0; i < 600; i++) {
      const probe = new Driver(structuredClone(d.world));
      probe.prev = { ...d.prev };
      probe.tick({ right: true });
      if (probe.world.scene === 'clear') break;
      d.tick({ right: true });
    }
    d.world.timeTicks = 1;
    d.tick({ right: true });
    expect(d.world.scene).toBe('dying');
  });

  it('the 100th Glimmer just before the Beacon gives one life and keeps through the tally', () => {
    const map = [...SHORT];
    map[6] = '..P...oF..';
    const d = new Driver(makeWorld([level(map), level(SHORT)]));
    d.world.coins = 99;
    d.world.lives = MAX_LIVES - 1;
    d.world.score = MAX_SCORE - 50;
    for (let i = 0; i < 400 && d.world.scene === 'playing'; i++) d.tick({ right: true });
    expect(d.world.scene).toBe('clear');
    d.run(CLEAR_TICKS + 100);
    expect(d.world.scene).toBe('intro');
    expect(d.world).toMatchObject({ coins: 0, lives: MAX_LIVES, score: MAX_SCORE });
    // Max values still render (6-digit score, 2-digit lives).
    rasterize(d.world, new Uint8Array(160 * 144));
  });

  it('game over → continue → clear; win → title → new game resets everything', () => {
    const short = level(SHORT, { timeLimit: 100 });
    const d = new Driver(makeWorld([short, short], 'title'));
    d.tap('start');
    for (let k = 0; k < START_LIVES; k++) {
      d.run(INTRO_TICKS + 1);
      expect(d.world.scene).toBe('playing');
      d.world.timeTicks = 1;
      d.tick();
      d.run(DYING_TICKS);
    }
    expect(d.world.scene).toBe('gameover');
    d.tap('start');
    expect(d.world).toMatchObject({ scene: 'intro', lives: START_LIVES, score: 0 });
    d.run(INTRO_TICKS + 1);
    d.world.player.form = 'bloom';
    d.world.coins = 50;
    d.run(CLEAR_TICKS + 200, { right: true });
    d.run(INTRO_TICKS + 1);
    d.run(CLEAR_TICKS + 200, { right: true });
    expect(d.world.scene).toBe('win');
    d.tap('start');
    expect(d.world.scene).toBe('title');
    d.tap('start');
    expect(d.world).toMatchObject({ score: 0, coins: 0, lives: START_LIVES, scene: 'intro' });
    expect(d.world.player.form).toBe('small');
    expect(d.world.timeTicks).toBe(100 * TICK_RATE);
  });

  it('same input track → same hash, across a full death / game over / continue cycle', () => {
    const run = (): { hash: string; scenes: Set<SceneId> } => {
      const d = new Driver(makeWorld([...LEVELS], 'boot', { seed: 77 }));
      const scenes = new Set<SceneId>();
      for (let t = 0; t < 40000; t++) {
        const over = d.world.scene === 'gameover';
        d.tick({
          right: t % 300 < 250,
          a: t % 37 < 12,
          b: t % 500 > 200,
          start: (over && t % 50 === 0) || t % 4000 === 3 || t % 4000 === 9,
        });
        scenes.add(d.world.scene);
      }
      return { hash: hashWorld(d.world), scenes };
    };
    const a = run();
    expect(a.scenes).toContain('gameover');
    expect(a.scenes).toContain('paused');
    expect(run().hash).toBe(a.hash);
  });

  it('a Glimmer tile under the Beacon pole is collected (no stuck tile)', () => {
    const d = play(SHORT);
    const { tx, ty } = d.world.level.beacon;
    d.world.tiles[ty * d.world.level.width + tx] = Tile.Glimmer;
    for (let i = 0; i < 400 && d.world.scene === 'playing'; i++) d.tick({ right: true });
    expect(d.world.scene).toBe('clear');
    expect(d.world.coins).toBe(1);
  });

  it('START held across title → intro → playing pauses nothing; a press on the intro timeout tick starts play', () => {
    const d = new Driver(makeWorld([level(SHORT)], 'title'));
    d.run(INTRO_TICKS + 20, { start: true });
    expect(d.world.scene).toBe('playing');
    const d2 = new Driver(makeWorld([level(SHORT)], 'intro'));
    d2.run(INTRO_TICKS - 1);
    d2.tick({ start: true });
    expect(d2.world.scene).toBe('playing');
    d2.tick({ start: true });
    expect(d2.world.scene).toBe('playing');
  });

  it('START on the tick Pip reaches the Beacon pauses; the clear follows on resume', () => {
    const d = play(SHORT);
    for (let i = 0; i < 600; i++) {
      const probe = new Driver(structuredClone(d.world));
      probe.prev = { ...d.prev };
      probe.tick({ right: true });
      if (probe.world.scene === 'clear') break;
      d.tick({ right: true });
    }
    d.tick({ right: true, start: true });
    expect(d.world.scene).toBe('paused');
    d.tick();
    d.tick({ start: true });
    d.tick({ right: true });
    expect(d.world.scene).toBe('clear');
  });

  it('START on the first game-over tick picks CONTINUE', () => {
    const d = play(SHORT);
    d.world.lives = 1;
    d.world.timeTicks = 1;
    d.tick();
    d.run(DYING_TICKS);
    expect(d.world.scene).toBe('gameover');
    d.tick({ start: true });
    expect(d.world).toMatchObject({ scene: 'intro', lives: START_LIVES });
  });
});
