import { describe, expect, it } from 'vitest';
import { LEVELS } from '../../src/game/levels';
import { TICK_RATE } from '../../src/game/constants';
import tracks from '../fixtures/botTracks.json';
import { decodeTrack, replayTrack } from '../fixtures/botTrack';
import { createWorld, step } from '../../src/game/world';
import { emptyButtons, makeFrame } from '../../src/input/InputState';
import type { Buttons, SceneId } from '../../src/game/types';

const TRACKS: Readonly<Record<string, string>> = tracks;

describe('level completability (bot fixtures from scripts/genBotTracks.ts)', () => {
  it('has a committed track for every campaign level', () => {
    expect(Object.keys(TRACKS).sort()).toEqual(LEVELS.map((l) => l.id).sort());
  });

  for (const def of LEVELS) {
    it(`${def.id} ${def.name}: bot reaches the Beacon within the time limit without damage`, () => {
      const track = TRACKS[def.id];
      expect(track, 'run `npx tsx scripts/genBotTracks.ts`').toBeTypeOf('string');
      const r = replayTrack(def, track!);
      expect(r.cleared).toBe(true);
      expect(r.livesLost).toBe(0);
      expect(r.hurt).toBe(false);
      expect(r.ticks).toBeLessThan(def.timeLimit * TICK_RATE);
      expect(r.timeLeftTicks).toBeGreaterThan(0);
    });
  }

  it('a track that only idles does not clear 1-1', () => {
    expect(replayTrack(LEVELS[0]!, '-:600').cleared).toBe(false);
  });
});

describe('full campaign', () => {
  it('boot → title → 1-1 → 1-2 → 1-3 → win → title is reachable with the bot tracks', () => {
    const world = createWorld({ seed: 1, levels: LEVELS, highScore: 0, freezeAnim: true });
    let prev = emptyButtons();
    const tick = (held: Partial<Buttons> = {}): void => {
      const next = { ...emptyButtons(), ...held };
      step(world, makeFrame(prev, next));
      prev = next;
    };
    const until = (scene: SceneId, held: Partial<Buttons> = {}, limit = 2000): void => {
      for (let i = 0; i < limit && world.scene !== scene; i++) tick(held);
      expect(world.scene).toBe(scene);
    };
    expect(world.scene).toBe('boot');
    tick({ start: true });
    until('title');
    tick();
    tick({ start: true });
    for (const def of LEVELS) {
      until('playing');
      expect(world.level.def.id).toBe(def.id);
      for (const seg of decodeTrack(TRACKS[def.id]!)) {
        for (let i = 0; i < seg.ticks && world.scene === 'playing'; i++) tick(seg.held);
      }
      expect(world.scene).toBe('clear');
      tick();
    }
    until('win', {}, 5000);
    expect(world.score).toBeGreaterThan(0);
    tick();
    tick({ start: true });
    until('title');
  });
});
