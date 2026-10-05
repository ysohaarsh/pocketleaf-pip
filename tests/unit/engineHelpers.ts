import { createWorld, step } from '../../src/game/world';
import { emptyButtons, makeFrame } from '../../src/input/InputState';
import type { Buttons, GameEvent, LevelDef, SceneId, World } from '../../src/game/types';

/** Build an inline LevelDef from 9 map rows. */
export function level(map: string[], extra: Partial<LevelDef> = {}): LevelDef {
  return {
    id: 'test',
    label: '1-1',
    name: 'TEST FIELD',
    theme: 'grass',
    timeLimit: 300,
    song: 'grass',
    map,
    ...extra,
  };
}

/** A flat 40-wide level: Pip at column 2, Beacon far right, ground at rows 7-8. */
export const FLAT = [
  '........................................',
  '........................................',
  '........................................',
  '........................................',
  '........................................',
  '........................................',
  '..P..................................F..',
  '########################################',
  '########################################',
];

/** Drives a world with held-button sets, deriving pressed/released edges like the InputHub. */
export class Driver {
  prev: Buttons = emptyButtons();
  /** Every event emitted since construction (or the last drain). */
  log: GameEvent[] = [];

  constructor(public world: World) {
    this.log.push(...world.events);
  }

  tick(held: Partial<Buttons> = {}): World {
    const next = { ...emptyButtons(), ...held };
    step(this.world, makeFrame(this.prev, next));
    this.prev = next;
    this.log.push(...this.world.events);
    return this.world;
  }

  run(n: number, held: Partial<Buttons> = {}): World {
    for (let i = 0; i < n; i++) this.tick(held);
    return this.world;
  }

  /** Press-and-release a button over two ticks. */
  tap(name: keyof Buttons): World {
    this.tick({ [name]: true });
    return this.tick();
  }

  sfx(): string[] {
    return this.log.flatMap((e) => (e.kind === 'sfx' ? [e.sfx] : []));
  }
}

/** A world already in the given scene on the given levels. */
export function makeWorld(
  levels: LevelDef[],
  startScene: SceneId = 'playing',
  extra: { startIndex?: number; highScore?: number; seed?: number } = {},
): World {
  return createWorld({
    seed: extra.seed ?? 1,
    levels,
    startIndex: extra.startIndex ?? 0,
    highScore: extra.highScore ?? 0,
    freezeAnim: true,
    startScene,
  });
}

/** A playing driver on the given map. */
export function play(map: string[], extra: Partial<LevelDef> = {}): Driver {
  return new Driver(makeWorld([level(map, extra)]));
}
