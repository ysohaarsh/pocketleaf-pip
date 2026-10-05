import type { Song } from '../chip';
import { perChord, repeat } from './patterns';

/** One chord per bar (C major). */
const CHORDS = ['C', 'F', 'G', 'C', 'F', 'C', 'G', 'C', 'F', 'C', 'Em', 'C', 'F', 'G', 'G', 'C'];

const MELODY = [
  'E5 . G5 E5 C5 . D5 E5',
  'F5 - E5 D5 C5 - . .',
  'D5 . F5 D5 B4 . C5 D5',
  'E5 - D5 C5 G4 - . .',
  'A4 . C5 A4 F5 . E5 D5',
  'E5 . G5 . C6 - B5 A5',
  'G5 . E5 . D5 . F5 E5',
  'C5 - - - . . G4 .',
  'A5 - G5 . F5 . E5 .',
  'F5 . A5 . G5 - . .',
  'E5 - D5 . C5 . B4 .',
  'C5 . E5 . D5 - . .',
  'F5 . F5 G5 A5 . F5 .',
  'G5 . G5 A5 B5 . G5 .',
  'C6 . B5 A5 G5 . F5 D5',
  'C5 - - . G4 . B4 .',
].join(' | ');

const STABS: Readonly<Record<string, string>> = {
  C: '. E4 . G4 . E4 . G4',
  F: '. F4 . A4 . F4 . A4',
  G: '. B3 . D4 . B3 . D4',
  Em: '. G4 . B4 . G4 . B4',
};

const BASS: Readonly<Record<string, string>> = {
  C: 'C3 . G3 . C4 . G3 .',
  F: 'F2 . C3 . F3 . C3 .',
  G: 'G2 . D3 . G3 . D3 .',
  Em: 'E2 . B2 . E3 . B2 .',
};

const BEAT = 'k . h . s . h h';
const FILL = 'k . h . s . s s';

/** Level 1-1: bouncy major-key romp, 140 bpm, 16 bars. */
export const GRASS: Song = {
  bpm: 140,
  stepsPerBeat: 2,
  channels: {
    pulse1: { notes: MELODY, duty: 0.5, volume: 0.32, sustain: 0.6 },
    pulse2: { notes: perChord(CHORDS, STABS), duty: 0.25, volume: 0.16, sustain: 0.4 },
    wave: { notes: perChord(CHORDS, BASS), volume: 0.55, sustain: 0.8 },
    noise: { notes: repeat(`${repeat(BEAT, 3)} | ${FILL}`, 4) },
  },
};
