import { describe, expect, it } from 'vitest';
import { FONT, validateGlyphs } from '../../src/engine/font';

const REQUIRED = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', ...'0123456789', ...` -.,:!?'&/x*+()#$%`];

describe('font', () => {
  it('has the contract metrics', () => {
    expect(FONT).toMatchObject({ glyphW: 5, glyphH: 7, advance: 6, lineHeight: 8 });
  });

  it.each(REQUIRED)('defines %j as a 5x7 glyph', (ch) => {
    const rows = FONT.glyphs[ch];
    expect(rows).toBeDefined();
    expect(rows!.length).toBe(7);
    for (const row of rows!) expect(row).toMatch(/^[#.]{5}$/);
  });

  it('gives every visible glyph some ink and keeps space blank', () => {
    for (const ch of REQUIRED) {
      const ink = FONT.glyphs[ch]!.join('').includes('#');
      expect(ink).toBe(ch !== ' ');
    }
  });

  it('keeps glyphs distinct', () => {
    const seen = new Map<string, string>();
    for (const ch of REQUIRED) {
      const key = FONT.glyphs[ch]!.join('|');
      expect(seen.get(key), `${ch} duplicates ${seen.get(key)}`).toBeUndefined();
      seen.set(key, ch);
    }
  });

  it('validateGlyphs rejects malformed glyphs', () => {
    expect(() => validateGlyphs({ A: ['#####'] }, 5, 7)).toThrow(/rows/);
    expect(() => validateGlyphs({ A: Array<string>(7).fill('###') }, 5, 7)).toThrow(/row 0/);
    expect(() => validateGlyphs({ AB: Array<string>(7).fill('#####') }, 5, 7)).toThrow(/single/);
  });
});
