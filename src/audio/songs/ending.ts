import type { Song } from '../chip';
import { perChord, repeat } from './patterns';

/** One chord per bar (C major). */
const CHORDS = ['C', 'C', 'F', 'G', 'F', 'C', 'G', 'C'];

const MELODY = [
  'C5 . C5 . G5 - - .',
  'E5 . G5 . C6 - - -',
  'A5 . A5 . G5 . F5 .',
  'G5 - - - - - . .',
  'F5 . F5 . A5 - - .',
  'E5 . E5 . G5 - - -',
  'D5 . E5 . F5 . B5 .',
  'C6 - - - - - . .',
].join(' | ');

const HARMONY: Readonly<Record<string, string>> = {
  C: 'E4 . E4 . G4 - - .',
  F: 'F4 . F4 . A4 - - .',
  G: 'D4 . D4 . B4 - - .',
};

const BASS: Readonly<Record<string, string>> = {
  C: 'C3 . C3 . G2 . C3 .',
  F: 'F2 . F2 . C3 . F2 .',
  G: 'G2 . G2 . D3 . G2 .',
};

/** Ending: short triumphant march loop, 132 bpm, 8 bars. */
export const ENDING: Song = {
  bpm: 132,
  stepsPerBeat: 2,
  channels: {
    pulse1: { notes: MELODY, duty: 0.5, volume: 0.32, sustain: 0.7 },
    pulse2: { notes: perChord(CHORDS, HARMONY), duty: 0.25, volume: 0.17, sustain: 0.6 },
    wave: { notes: perChord(CHORDS, BASS), volume: 0.55, sustain: 0.7 },
    noise: { notes: `${repeat('k . s . k k s .', 7)} | k . s . s s s s` },
  },
};
