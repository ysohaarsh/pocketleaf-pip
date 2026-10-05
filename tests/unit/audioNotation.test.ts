import { describe, expect, it } from 'vitest';
import { noteNameToMidi, parseTrack, TrackSyntaxError } from '../../src/audio/notation';

describe('noteNameToMidi', () => {
  it('maps names, sharps and flats', () => {
    expect(noteNameToMidi('C4')).toBe(60);
    expect(noteNameToMidi('A4')).toBe(69);
    expect(noteNameToMidi('F#5')).toBe(78);
    expect(noteNameToMidi('Bb3')).toBe(58);
    expect(noteNameToMidi('C0')).toBe(12);
    expect(noteNameToMidi('H4')).toBeNull();
    expect(noteNameToMidi('C')).toBeNull();
    expect(noteNameToMidi('C9')).toBeNull();
  });
});

describe('parseTrack', () => {
  it('parses notes, sustains, rests, drums and bar lines', () => {
    const t = parseTrack('C5 . E5 - | G5 - - . | k s h .');
    expect(t.length).toBe(12);
    expect(t.notes).toEqual([
      { step: 0, steps: 1, pitch: { kind: 'tone', midi: 72 } },
      { step: 2, steps: 2, pitch: { kind: 'tone', midi: 76 } },
      { step: 4, steps: 3, pitch: { kind: 'tone', midi: 79 } },
      { step: 8, steps: 1, pitch: { kind: 'drum', drum: 'kick' } },
      { step: 9, steps: 1, pitch: { kind: 'drum', drum: 'snare' } },
      { step: 10, steps: 1, pitch: { kind: 'drum', drum: 'hat' } },
    ]);
  });

  it('tolerates extra whitespace and newlines', () => {
    expect(parseTrack('  C4\n\t.  ').length).toBe(2);
    expect(parseTrack('')).toEqual({ length: 0, notes: [] });
  });

  it('rejects unknown tokens and orphan sustains', () => {
    expect(() => parseTrack('C4 X4')).toThrow(TrackSyntaxError);
    expect(() => parseTrack('- C4')).toThrow(/sustain/);
    expect(() => parseTrack('C4 . -')).toThrow(/sustain/);
  });
});
