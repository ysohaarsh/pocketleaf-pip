import type { Song } from '../chip';
import { perChord } from './patterns';

/** One chord per bar (A minor). */
const CHORDS = ['Am', 'E', 'F', 'E', 'Am', 'Dm', 'E', 'Am'];

/** Sparse wave-channel lead; the echo fills the gaps. */
const LEAD = [
  'A4 - - . C5 . . .',
  'B4 - - . E4 - - -',
  'F4 - - . A4 . . .',
  'G#4 - - - - - . .',
  'A4 - - . E5 . . .',
  'D5 - C5 . B4 - - .',
  'C5 . B4 . A4 . G#4 .',
  'A4 - - - - - . .',
].join(' | ');

const DRONE: Readonly<Record<string, string>> = {
  Am: 'A2 - - - - - . .',
  E: 'E2 - - - - - . .',
  F: 'F2 - - - - - . .',
  Dm: 'D2 - - - - - . .',
};

/** High glassy drips, mostly silence. */
const DRIPS = [
  '. . . . . . E6 .',
  '. . . . . . . .',
  '. . . . . . . C6',
  '. . . . . . . .',
  '. . . . . . A6 .',
  '. . . . . . . .',
  '. . . . . . . B5',
  '. . . . . . . .',
].join(' | ');

const TICKS = '. . . . h . . . | . . . . . . . . | . . . . h . . . | . . . . . . h .';

/** Level 1-2: slow, minor, cavernous, 92 bpm, 8 bars. */
export const CAVE: Song = {
  bpm: 92,
  stepsPerBeat: 2,
  channels: {
    pulse1: {
      notes: perChord(CHORDS, DRONE),
      duty: 0.5,
      volume: 0.14,
      attack: 0.08,
      sustain: 0.5,
    },
    pulse2: {
      notes: DRIPS,
      duty: 0.125,
      volume: 0.12,
      sustain: 0.1,
      release: 0.2,
      echo: { delay: 0.33, volume: 0.4 },
    },
    wave: {
      notes: LEAD,
      volume: 0.5,
      sustain: 0.5,
      release: 0.08,
      echo: { delay: 0.49, volume: 0.35 },
    },
    noise: { notes: `${TICKS} | ${TICKS}` },
  },
};
