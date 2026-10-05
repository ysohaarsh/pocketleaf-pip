/**
 * Generates tests/fixtures/botTracks.json: for each campaign level, a beam search over short
 * macro-actions on the real deterministic simulation finds an input track that reaches the Beacon
 * without taking damage. Run after changing physics constants or level maps:
 *   npx tsx scripts/genBotTracks.ts
 */
import { writeFileSync } from 'node:fs';
import { LEVELS } from '../src/game/levels';
import { step } from '../src/game/world';
import { emptyButtons, makeFrame } from '../src/input/InputState';
import type { Buttons, LevelDef, World } from '../src/game/types';
import { botWorld, encodeTrack, heldFromMask, replayTrack } from '../tests/fixtures/botTrack';

const TICKS_PER_ACTION = 6;
const BEAM_WIDTH = 160;
const ACTIONS = ['RB', 'RBA', 'R', 'RA', '-', 'A', 'L', 'LA', 'LB', 'LBA'] as const;

interface Node {
  world: World;
  prev: Buttons;
  masks: string[];
}

function advance(node: Node, mask: string): Node | null {
  const world = structuredClone(node.world);
  const held = heldFromMask(mask);
  let prev = node.prev;
  for (let i = 0; i < TICKS_PER_ACTION; i++) {
    step(world, makeFrame(prev, held));
    prev = held;
    if (world.events.some((e) => e.kind === 'sfx' && e.sfx === 'hurt')) return null;
    if (world.scene === 'clear') return { world, prev, masks: [...node.masks, mask] };
    if (world.scene !== 'playing') return null;
  }
  return { world, prev, masks: [...node.masks, mask] };
}

function key(w: World): string {
  const p = w.player;
  return [
    Math.round(p.x / 3),
    Math.round(p.y / 3),
    Math.round(p.vx / 30),
    Math.round(p.vy / 60),
    p.form,
    p.onGround ? 1 : 0,
  ].join(',');
}

/** Progress heuristic: rightward distance, a little credit for being grounded and powered up. */
function score(w: World): number {
  return w.player.x + (w.player.onGround ? 4 : 0) + (w.player.form === 'bloom' ? 8 : 0);
}

function solve(def: LevelDef): string {
  let beam: Node[] = [{ world: botWorld(def), prev: emptyButtons(), masks: [] }];
  const maxDepth = Math.floor((def.timeLimit * 60) / TICKS_PER_ACTION);
  let best = 0;
  for (let depth = 0; depth < maxDepth; depth++) {
    const next = new Map<string, Node>();
    for (const node of beam) {
      for (const mask of ACTIONS) {
        const child = advance(node, mask);
        if (!child) continue;
        if (child.world.scene === 'clear') return encodeTrack(child.masks, TICKS_PER_ACTION);
        const k = key(child.world);
        const seen = next.get(k);
        if (!seen || score(child.world) > score(seen.world)) next.set(k, child);
      }
    }
    beam = [...next.values()].sort((a, b) => score(b.world) - score(a.world)).slice(0, BEAM_WIDTH);
    if (beam.length === 0) throw new Error(`${def.id}: every branch died at depth ${depth}`);
    const x = beam[0]!.world.player.x;
    if (x > best) best = x;
    if (depth % 50 === 0) console.log(`  ${def.id} depth ${depth} best x ${best.toFixed(0)}`);
  }
  throw new Error(`${def.id}: no route found (best x ${best.toFixed(0)})`);
}

const tracks: Record<string, string> = {};
for (const def of LEVELS) {
  console.log(`solving ${def.id} …`);
  const track = solve(def);
  const r = replayTrack(def, track);
  if (!r.cleared || r.hurt || r.livesLost) throw new Error(`${def.id}: replay mismatch`);
  console.log(`  ${def.id} cleared in ${r.ticks} ticks (${(r.ticks / 60).toFixed(1)} s)`);
  tracks[def.id] = track;
}
writeFileSync(
  new URL('../tests/fixtures/botTracks.json', import.meta.url),
  JSON.stringify(tracks, null, 2) + '\n',
);
console.log('wrote tests/fixtures/botTracks.json');
