import { describe, expect, it, vi } from 'vitest';
import { SCREEN_H, SCREEN_W } from '../../src/game/constants';
import type { SceneId, Sprite, SpriteId, World } from '../../src/game/types';
import { Driver, level, makeWorld } from './engineHelpers';

// Test doubles for the content workstream's data: a solid-block font and a few marked sprites.
vi.mock('../../src/engine/font', () => {
  const block = ['#####', '#####', '#####', '#####', '#####', '#####', '#####'];
  const glyphs: Record<string, readonly string[]> = {};
  for (const ch of "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-.:!?x&'/$%") glyphs[ch] = block;
  return { FONT: { glyphW: 5, glyphH: 7, advance: 6, lineHeight: 8, glyphs } };
});
vi.mock('../../src/engine/sprites', () => {
  const T = 255;
  const mk = (w: number, h: number, px: number[]): Sprite => ({
    w,
    h,
    pixels: Uint8Array.from(px),
  });
  const solid = (w: number, h: number, v: number): Sprite =>
    mk(w, h, new Array<number>(w * h).fill(v));
  const table: Partial<Record<SpriteId, Sprite>> = {
    pip_idle: mk(4, 1, [0, 1, 2, 3]),
    tile_ground_top: solid(16, 16, 0),
    tile_ground: solid(16, 16, 1),
    tile_block: solid(16, 16, 2),
    mossbug_walk1: solid(8, 8, 1),
    sunseed: mk(2, 2, [0, 9, T, 1]),
    shard: solid(2, 2, 0),
    hill: solid(8, 4, 2),
    cloud: solid(8, 4, 2),
    bush: solid(8, 4, 1),
    stalactite: solid(4, 8, 1),
  };
  return { getSprite: (id: SpriteId): Sprite => table[id] ?? mk(1, 1, [T]) };
});

const { rasterize } = await import('../../src/engine/renderer');
const draw = await import('../../src/engine/draw');

const MAP = [
  '......................',
  '......................',
  '......................',
  '.....?S.B.............',
  '......................',
  '......................',
  '..P..m.......^......F.',
  '######################',
  '######################',
];

const fbOf = (world: World): Uint8Array => {
  const fb = new Uint8Array(SCREEN_W * SCREEN_H);
  rasterize(world, fb);
  return fb;
};

const px = (fb: Uint8Array, x: number, y: number): number => fb[y * SCREEN_W + x]!;

describe('renderer', () => {
  it('writes only shades 0..3 in every scene and theme', () => {
    const scenes: SceneId[] = [
      'boot',
      'title',
      'intro',
      'playing',
      'paused',
      'dying',
      'gameover',
      'clear',
      'win',
    ];
    for (const theme of ['grass', 'cave', 'sky'] as const) {
      const d = new Driver(makeWorld([level(MAP, { theme })]));
      d.run(20, { right: true, a: true });
      d.world.particles.push({ kind: 'shard', x: 40, y: 40, vx: 0, vy: 0, timer: 5, value: 0 });
      d.world.particles.push({ kind: 'score', x: 40, y: 50, vx: 0, vy: 0, timer: 5, value: 200 });
      d.world.particles.push({ kind: 'sparkle', x: 60, y: 50, vx: 0, vy: 0, timer: 5, value: 0 });
      d.world.items.push({
        id: 99,
        kind: 'sunseed',
        x: 80,
        y: 40,
        w: 12,
        h: 12,
        vx: 0,
        vy: 0,
        state: 'emerging',
        timer: 0,
      });
      d.world.items.push({
        id: 98,
        kind: 'popGlimmer',
        x: 90,
        y: 40,
        w: 8,
        h: 14,
        vx: 0,
        vy: 0,
        state: 'emerging',
        timer: 0,
      });
      for (const scene of scenes) {
        d.world.scene = scene;
        const fb = fbOf(d.world);
        expect(fb.every((v) => v <= 3)).toBe(true);
      }
    }
  });

  it('draws a one-row HUD on a solid strip with a rule below', () => {
    const w = makeWorld([level(MAP)]);
    w.score = 888888;
    const fb = fbOf(w);
    const inked = (x0: number, x1: number): number => {
      let n = 0;
      for (let y = 1; y < 8; y++) for (let x = x0; x < x1; x++) if (px(fb, x, y) === 0) n++;
      return n;
    };
    // Score digits occupy columns 0-5 (x 1..36) and are inked in shade 0 over the sky strip.
    expect(inked(1, 36)).toBeGreaterThan(30);
    // The gap after the score stays sky.
    for (let y = 1; y < 8; y++) expect(px(fb, 38, y)).toBe(3);
    // Hourglass top bar at column 22.
    for (let x = 133; x < 138; x++) expect(px(fb, x, 1)).toBe(0);
    // 1 px rule under the strip, then the playfield.
    for (let x = 0; x < 160; x += 17) expect(px(fb, x, 9)).toBe(2);
    // Cave HUD: dark strip, light ink, mid rule.
    const cave = fbOf(makeWorld([level(MAP, { theme: 'cave' })]));
    expect(px(cave, 133, 1)).toBe(3);
    expect(px(cave, 38, 4)).toBe(0);
    expect(px(cave, 50, 9)).toBe(1);
  });

  it('paused darkens every shade by one and shows a PAUSED box', () => {
    const w = makeWorld([level(MAP)]);
    const play = fbOf(w);
    w.scene = 'paused';
    const paused = fbOf(w);
    let checked = 0;
    for (let y = 0; y < SCREEN_H; y++) {
      if (y >= 60 && y < 80) continue;
      for (let x = 0; x < SCREEN_W; x++) {
        expect(px(paused, x, y)).toBe(Math.max(0, px(play, x, y) - 1));
        checked++;
      }
    }
    expect(checked).toBe(SCREEN_W * (SCREEN_H - 20));
    expect(px(paused, 80, 61)).toBe(3);
  });

  it('flips Pip horizontally with his facing', () => {
    const w = makeWorld([level(MAP)]);
    const p = w.player;
    const sx = Math.round(p.x + p.w / 2 - 2) - w.camera.x;
    const sy = Math.round(p.y + p.h - 1);
    const right = fbOf(w);
    expect([0, 1, 2, 3].map((i) => px(right, sx + i, sy))).toEqual([0, 1, 2, 3]);
    p.facing = -1;
    const left = fbOf(w);
    expect([0, 1, 2, 3].map((i) => px(left, sx + i, sy))).toEqual([3, 2, 1, 0]);
  });

  it('blinks Pip during invulnerability unless animations are frozen', () => {
    const w = makeWorld([level(MAP)]);
    const p = w.player;
    const sx = Math.round(p.x + p.w / 2 - 2) - w.camera.x;
    const sy = Math.round(p.y + p.h - 1);
    p.invuln = 10;
    w.tick = 4;
    w.freezeAnim = false;
    expect(px(fbOf(w), sx, sy)).toBe(3);
    w.freezeAnim = true;
    expect(px(fbOf(w), sx, sy)).toBe(0);
  });

  it('cave tiles are drawn one shade lighter', () => {
    const grass = fbOf(makeWorld([level(MAP)]));
    const cave = fbOf(makeWorld([level(MAP, { theme: 'cave' })]));
    expect(px(grass, 8, 7 * 16 + 4)).toBe(0);
    expect(px(cave, 8, 7 * 16 + 4)).toBe(1);
    expect(px(cave, 8, 8 * 16 + 4)).toBe(2);
    expect(px(cave, 150, 100)).toBe(0);
  });

  it('boot fades from dark to light and game over shows a cursor', () => {
    const w = makeWorld([level(MAP)], 'boot');
    w.sceneTick = 1;
    expect(px(fbOf(w), 0, 143)).toBe(1);
    w.sceneTick = 100;
    expect(px(fbOf(w), 0, 143)).toBe(3);
    w.scene = 'gameover';
    w.menuIndex = 0;
    const a = fbOf(w);
    w.menuIndex = 1;
    const b = fbOf(w);
    expect(px(a, 55, 73)).toBe(3);
    expect(px(b, 55, 73)).toBe(0);
    expect(px(b, 55, 85)).toBe(3);
  });

  it('draw primitives clip and remap', () => {
    const fb = new Uint8Array(SCREEN_W * SCREEN_H).fill(3);
    draw.fillRect(fb, -5, -5, 10, 10, 0);
    expect(px(fb, 4, 4)).toBe(0);
    expect(px(fb, 5, 5)).toBe(3);
    draw.drawSprite(fb, { w: 2, h: 2, pixels: Uint8Array.from([0, 1, 2, 3]) }, 158, 142, {
      flipY: true,
      remap: [3, 3, 1, 1],
    });
    expect(px(fb, 158, 142)).toBe(1);
    expect(px(fb, 159, 143)).toBe(3);
    draw.plot(fb, -1, 0, 0);
    draw.plot(fb, 0, 999, 0);
    expect(draw.textWidth('')).toBe(0);
    expect(draw.textWidth('AB')).toBe(11);
    expect(draw.pad(42, 6)).toBe('000042');
    draw.darken(fb);
    expect(px(fb, 0, 0)).toBe(0);
    expect(px(fb, 100, 100)).toBe(2);
  });
});
