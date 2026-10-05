import { createWorld, step } from '../../src/game/world';
import { emptyButtons, makeFrame } from '../../src/input/InputState';
import type { Buttons, LevelDef, World } from '../../src/game/types';

/**
 * A bot input track: run-length segments of held buttons, e.g. "RB:12 RBA:6 R:30".
 * Letters: R right, L left, A jump, B run; "-" means nothing held.
 */
export type Segment = { held: Buttons; ticks: number };

const LETTERS: Readonly<Record<string, keyof Buttons>> = { R: 'right', L: 'left', A: 'a', B: 'b' };

export function heldFromMask(mask: string): Buttons {
  const held = emptyButtons();
  for (const ch of mask) {
    const name = LETTERS[ch];
    if (name) held[name] = true;
    else if (ch !== '-') throw new Error(`unknown track letter '${ch}'`);
  }
  return held;
}

export function decodeTrack(track: string): Segment[] {
  return track
    .trim()
    .split(/\s+/)
    .map((token) => {
      const [mask, n] = token.split(':');
      const ticks = Number(n);
      if (!mask || !Number.isInteger(ticks) || ticks <= 0)
        throw new Error(`bad segment '${token}'`);
      return { held: heldFromMask(mask), ticks };
    });
}

/** Merge consecutive equal masks and print the compact form. */
export function encodeTrack(masks: readonly string[], ticksPerMask: number): string {
  const out: string[] = [];
  let cur = '';
  let n = 0;
  for (const m of masks) {
    if (m === cur) n += ticksPerMask;
    else {
      if (n > 0) out.push(`${cur}:${n}`);
      cur = m;
      n = ticksPerMask;
    }
  }
  if (n > 0) out.push(`${cur}:${n}`);
  return out.join(' ');
}

/** A fresh world dropped straight into play on one level (what the bot and its test use). */
export function botWorld(def: LevelDef): World {
  return createWorld({
    seed: 1,
    levels: [def],
    highScore: 0,
    freezeAnim: true,
    startScene: 'playing',
  });
}

export interface ReplayResult {
  cleared: boolean;
  ticks: number;
  livesLost: number;
  hurt: boolean;
  timeLeftTicks: number;
  world: World;
}

/** Replay a track; stops as soon as the level is cleared or Pip dies. */
export function replayTrack(def: LevelDef, track: string): ReplayResult {
  const world = botWorld(def);
  const lives = world.lives;
  let prev = emptyButtons();
  let ticks = 0;
  let hurt = false;
  for (const seg of decodeTrack(track)) {
    for (let i = 0; i < seg.ticks; i++) {
      step(world, makeFrame(prev, seg.held));
      prev = seg.held;
      ticks++;
      if (world.events.some((e) => e.kind === 'sfx' && e.sfx === 'hurt')) hurt = true;
      if (world.scene !== 'playing') {
        return {
          cleared: world.scene === 'clear',
          ticks,
          livesLost: lives - world.lives,
          hurt,
          timeLeftTicks: world.timeTicks,
          world,
        };
      }
    }
  }
  return {
    cleared: false,
    ticks,
    livesLost: lives - world.lives,
    hurt,
    timeLeftTicks: world.timeTicks,
    world,
  };
}
