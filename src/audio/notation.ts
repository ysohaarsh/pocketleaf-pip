import type { Drum } from './chip';

/** What a parsed step plays: a pitched note (MIDI number) or a drum hit. */
export type Pitch = { kind: 'tone'; midi: number } | { kind: 'drum'; drum: Drum };

/** A note in a parsed track. */
export interface TrackNote {
  /** Step index the note starts on. */
  step: number;
  /** Length in steps (1 + following sustains). */
  steps: number;
  pitch: Pitch;
}

/** Result of `parseTrack`. */
export interface ParsedTrack {
  /** Total length in steps (notes, rests and sustains). */
  length: number;
  notes: TrackNote[];
}

/** Thrown for malformed track notation. */
export class TrackSyntaxError extends Error {
  override name = 'TrackSyntaxError';
}

const SEMITONES: Readonly<Record<string, number>> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const DRUM_TOKENS: Readonly<Record<string, Drum>> = { k: 'kick', s: 'snare', h: 'hat' };
const NOTE_RE = /^([A-G])(#|b)?([0-8])$/;

/**
 * Convert a note name like `C4`, `F#5` or `Bb3` to a MIDI number (C4 = 60, A4 = 69).
 * Returns null when the name is not a valid note.
 */
export function noteNameToMidi(name: string): number | null {
  const m = NOTE_RE.exec(name);
  if (!m) return null;
  const [, letter = '', accidental, octave = '0'] = m;
  const base = SEMITONES[letter];
  if (base === undefined) return null;
  const shift = accidental === '#' ? 1 : accidental === 'b' ? -1 : 0;
  return (Number(octave) + 1) * 12 + base + shift;
}

/**
 * Parse step notation into notes. One whitespace-separated token per step:
 * a note (`C5`, `F#4`, `Bb3`), a drum (`k` kick, `s` snare, `h` hat), `.` rest,
 * `-` sustain (extends the previous note; invalid after a rest or at the start), `|` bar line.
 * @throws TrackSyntaxError on unknown tokens or orphan sustains.
 */
export function parseTrack(src: string): ParsedTrack {
  const notes: TrackNote[] = [];
  let step = 0;
  let current: TrackNote | null = null;
  for (const token of src.split(/\s+/)) {
    if (token === '' || token === '|') continue;
    if (token === '-') {
      if (!current) throw new TrackSyntaxError(`sustain without a note at step ${step}`);
      current.steps += 1;
    } else if (token === '.') {
      current = null;
    } else {
      const drum = DRUM_TOKENS[token];
      const midi = drum ? null : noteNameToMidi(token);
      let pitch: Pitch;
      if (drum) pitch = { kind: 'drum', drum };
      else if (midi !== null) pitch = { kind: 'tone', midi };
      else throw new TrackSyntaxError(`unknown token "${token}" at step ${step}`);
      current = { step, steps: 1, pitch };
      notes.push(current);
    }
    step += 1;
  }
  return { length: step, notes };
}
