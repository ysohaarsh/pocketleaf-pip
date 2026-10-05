/**
 * Original sound effects as pure data: each SFX is a list of chip notes on specific channels at
 * offsets from the trigger time. Inspectable without an AudioContext.
 */
import type { SfxId } from '../game/types';
import type { ChannelId, ChipNote } from './chip';
import { noteNameToMidi } from './notation';
import { midiToFreq } from './scheduler';

/** One note of a sound effect. */
export interface SfxNote {
  channel: ChannelId;
  /** Offset from the trigger time, seconds. */
  at: number;
  note: ChipNote;
}

/** A sound effect definition. */
export interface SfxDef {
  notes: readonly SfxNote[];
}

/** Frequency of a note name; throws on typos so bad data fails at import time. */
function hz(name: string): number {
  const midi = noteNameToMidi(name);
  if (midi === null) throw new Error(`bad note name ${name}`);
  return midiToFreq(midi);
}

/** A run of back-to-back notes on one channel: [noteName, seconds] pairs starting at `at`. */
function phrase(
  channel: ChannelId,
  at: number,
  steps: readonly (readonly [string, number])[],
  voice: Omit<ChipNote, 'freq' | 'duration'>,
): SfxNote[] {
  const out: SfxNote[] = [];
  let t = at;
  for (const [name, len] of steps) {
    out.push({ channel, at: t, note: { ...voice, freq: hz(name), duration: len * 0.85 } });
    t += len;
  }
  return out;
}

/** Every game sound effect. */
export const SFX: Readonly<Record<SfxId, SfxDef>> = {
  jump: {
    notes: [
      {
        channel: 'pulse1',
        at: 0,
        note: { freq: 280, freqEnd: 720, duration: 0.14, duty: 0.5, volume: 0.4, sustain: 0.4 },
      },
    ],
  },
  coin: {
    notes: phrase(
      'pulse1',
      0,
      [
        ['C6', 0.05],
        ['G6', 0.28],
      ],
      { duty: 0.25, volume: 0.4, sustain: 0.15 },
    ),
  },
  stomp: {
    notes: [
      { channel: 'noise', at: 0, note: { freq: 6000, duration: 0.05, volume: 0.45, sustain: 0.2 } },
      { channel: 'wave', at: 0, note: { freq: 160, freqEnd: 55, duration: 0.12, volume: 0.7 } },
    ],
  },
  bump: {
    notes: [
      {
        channel: 'pulse1',
        at: 0,
        note: { freq: 120, freqEnd: 90, duration: 0.07, duty: 0.25, volume: 0.45, sustain: 0.5 },
      },
    ],
  },
  break: {
    notes: [
      {
        channel: 'noise',
        at: 0,
        note: { freq: 9000, freqEnd: 1200, duration: 0.26, volume: 0.6, sustain: 0.05 },
      },
    ],
  },
  powerup: {
    notes: phrase(
      'pulse1',
      0,
      [
        ['C5', 0.05],
        ['E5', 0.05],
        ['G5', 0.05],
        ['C6', 0.05],
        ['E6', 0.05],
        ['G6', 0.05],
        ['C7', 0.16],
      ],
      { duty: 0.25, volume: 0.35, sustain: 0.6 },
    ),
  },
  sprout: {
    notes: [
      [300, 420],
      [380, 500],
      [460, 580],
      [540, 660],
    ].map(([from = 0, to = 0], i): SfxNote => ({
      channel: 'pulse1',
      at: i * 0.06,
      note: { freq: from, freqEnd: to, duration: 0.06, duty: 0.125, volume: 0.3, release: 0.01 },
    })),
  },
  hurt: {
    notes: [
      {
        channel: 'pulse1',
        at: 0,
        note: { freq: 900, freqEnd: 180, duration: 0.32, duty: 0.5, volume: 0.45, sustain: 0.3 },
      },
    ],
  },
  oneup: {
    notes: phrase(
      'pulse1',
      0,
      [
        ['C6', 0.08],
        ['E6', 0.08],
        ['A6', 0.08],
        ['G6', 0.24],
      ],
      { duty: 0.125, volume: 0.35, sustain: 0.5 },
    ),
  },
  pause: {
    notes: phrase(
      'pulse1',
      0,
      [
        ['A5', 0.06],
        ['E6', 0.08],
      ],
      { duty: 0.5, volume: 0.35, sustain: 0.6 },
    ),
  },
  death: {
    notes: [
      ...phrase(
        'pulse1',
        0,
        [
          ['B5', 0.12],
          ['A5', 0.12],
          ['F5', 0.12],
          ['E5', 0.12],
          ['D5', 0.2],
          ['C5', 0.2],
          ['A4', 0.5],
        ],
        { duty: 0.25, volume: 0.4, sustain: 0.5 },
      ),
      ...phrase(
        'wave',
        0,
        [
          ['E3', 0.48],
          ['D3', 0.4],
          ['A2', 0.6],
        ],
        { volume: 0.6, sustain: 0.6 },
      ),
    ],
  },
  clear: {
    notes: [
      ...phrase(
        'pulse1',
        0,
        [
          ['G5', 0.15],
          ['C6', 0.15],
          ['E6', 0.15],
          ['G6', 0.45],
          ['E6', 0.15],
          ['G6', 1.5],
        ],
        { duty: 0.5, volume: 0.35, sustain: 0.6 },
      ),
      ...phrase(
        'pulse2',
        0,
        [
          ['E5', 0.15],
          ['G5', 0.15],
          ['C6', 0.15],
          ['E6', 0.45],
          ['C6', 0.15],
          ['E6', 1.5],
        ],
        { duty: 0.25, volume: 0.25, sustain: 0.6 },
      ),
      ...phrase(
        'wave',
        0,
        [
          ['C3', 0.45],
          ['G3', 0.45],
          ['C3', 1.7],
        ],
        { volume: 0.6, sustain: 0.7 },
      ),
      { channel: 'noise', at: 0, note: { freq: 9000, duration: 0.08, volume: 0.3, sustain: 0.1 } },
      {
        channel: 'noise',
        at: 0.9,
        note: { freq: 9000, duration: 0.08, volume: 0.3, sustain: 0.1 },
      },
    ],
  },
  select: {
    notes: [
      {
        channel: 'pulse1',
        at: 0,
        note: { freq: hz('C7'), duration: 0.025, duty: 0.125, volume: 0.3, release: 0.01 },
      },
    ],
  },
  boot: {
    notes: [
      ...phrase(
        'pulse1',
        0,
        [
          ['A5', 0.1],
          ['E6', 0.7],
        ],
        { duty: 0.25, volume: 0.4, sustain: 0.1, release: 0.1 },
      ),
      {
        channel: 'wave',
        at: 0.1,
        note: { freq: hz('E4'), duration: 0.6, volume: 0.3, sustain: 0.1 },
      },
    ],
  },
};

/** Seconds from trigger until the last note of `def` has fully released. */
export function sfxDuration(def: SfxDef): number {
  let end = 0;
  for (const { at, note } of def.notes)
    end = Math.max(end, at + note.duration + (note.release ?? 0.02));
  return end;
}

/** Channels an SFX occupies (music on these channels is ducked while it plays). */
export function sfxChannels(def: SfxDef): ChannelId[] {
  return [...new Set(def.notes.map((n) => n.channel))];
}
