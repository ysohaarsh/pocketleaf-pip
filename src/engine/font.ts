/** Bitmap font contract. STUB glyphs — replaced by feat/content. */
export interface BitmapFont {
  glyphW: number;
  glyphH: number;
  /** Horizontal advance per character, px. */
  advance: number;
  lineHeight: number;
  /** Rows of '#' (ink) and '.' (clear), glyphH rows of glyphW chars. */
  glyphs: Readonly<Record<string, readonly string[]>>;
}

export const FONT: BitmapFont = { glyphW: 5, glyphH: 7, advance: 6, lineHeight: 8, glyphs: {} };
