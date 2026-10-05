import type { SfxId, SongId, World } from './types';

/** Queue a sound effect for the host. */
export function emitSfx(world: World, sfx: SfxId): void {
  world.events.push({ kind: 'sfx', sfx });
}

/** Queue a music change for the host (null stops music). */
export function emitMusic(world: World, song: SongId | null): void {
  world.events.push({ kind: 'music', song });
}

/** Record a new high score (and tell the host to persist it) when the score beats it. */
export function checkHighScore(world: World): void {
  if (world.score > world.highScore) {
    world.highScore = world.score;
    world.events.push({ kind: 'highScore', score: world.score });
  }
}
