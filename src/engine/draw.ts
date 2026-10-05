import { SCREEN_H, SCREEN_W } from '../game/constants';
import type { Shade, Sprite } from '../game/types';
import { FONT } from './font';

/**
 * Pure drawing primitives over a 160x144 framebuffer of shade indices (0..3). Everything clips to
 * the screen and only ever writes values 0..3.
 */

/** Maps each source shade to the shade actually written. */
export type Remap = readonly [Shade, Shade, Shade, Shade];

export interface SpriteOpts {
  flipX?: boolean;
  flipY?: boolean;
  remap?: Remap;
}

/** Fill the whole framebuffer. */
export function fill(fb: Uint8Array, shade: Shade): void {
  fb.fill(shade);
}

/** Fill a clipped rectangle. */
export function fillRect(
  fb: Uint8Array,
  x: number,
  y: number,
  w: number,
  h: number,
  shade: Shade,
): void {
  const x0 = Math.max(0, Math.round(x));
  const y0 = Math.max(0, Math.round(y));
  const x1 = Math.min(SCREEN_W, Math.round(x + w));
  const y1 = Math.min(SCREEN_H, Math.round(y + h));
  for (let yy = y0; yy < y1; yy++)
    fb.fill(shade, yy * SCREEN_W + x0, yy * SCREEN_W + Math.max(x0, x1));
}

/** A filled box with a 1 px border. */
export function box(
  fb: Uint8Array,
  x: number,
  y: number,
  w: number,
  h: number,
  bg: Shade,
  border: Shade,
): void {
  fillRect(fb, x, y, w, h, border);
  fillRect(fb, x + 1, y + 1, w - 2, h - 2, bg);
}

/** Set one clipped pixel. */
export function plot(fb: Uint8Array, x: number, y: number, shade: Shade): void {
  if (x < 0 || y < 0 || x >= SCREEN_W || y >= SCREEN_H) return;
  fb[y * SCREEN_W + x] = shade;
}

/**
 * Draw a palette-indexed sprite with its top-left at integer (x, y). Transparent (or any non-shade)
 * pixels are skipped; flipX mirrors horizontally, flipY vertically.
 */
export function drawSprite(
  fb: Uint8Array,
  sprite: Sprite,
  x: number,
  y: number,
  opts: SpriteOpts = {},
): void {
  const ox = Math.round(x);
  const oy = Math.round(y);
  const { w, h, pixels } = sprite;
  for (let sy = 0; sy < h; sy++) {
    const py = oy + sy;
    if (py < 0 || py >= SCREEN_H) continue;
    const srcRow = (opts.flipY ? h - 1 - sy : sy) * w;
    for (let sx = 0; sx < w; sx++) {
      const px = ox + sx;
      if (px < 0 || px >= SCREEN_W) continue;
      const v = pixels[srcRow + (opts.flipX ? w - 1 - sx : sx)] ?? 255;
      if (v > 3) continue;
      fb[py * SCREEN_W + px] = opts.remap ? opts.remap[v as Shade] : v;
    }
  }
}

function glyphFor(ch: string): readonly string[] | undefined {
  return FONT.glyphs[ch] ?? FONT.glyphs[ch.toUpperCase()];
}

/** Width in px of a single line of text. */
export function textWidth(text: string): number {
  return text.length === 0 ? 0 : text.length * FONT.advance - (FONT.advance - FONT.glyphW);
}

/** Draw one line of text with the bitmap font; unknown characters advance but draw nothing. */
export function drawText(fb: Uint8Array, text: string, x: number, y: number, shade: Shade): void {
  let cx = Math.round(x);
  const oy = Math.round(y);
  for (const ch of text) {
    const glyph = glyphFor(ch);
    if (glyph) {
      glyph.forEach((row, gy) => {
        for (let gx = 0; gx < row.length; gx++)
          if (row[gx] === '#') plot(fb, cx + gx, oy + gy, shade);
      });
    }
    cx += FONT.advance;
  }
}

/** Draw text horizontally centred on the screen. */
export function drawTextCentered(fb: Uint8Array, text: string, y: number, shade: Shade): void {
  drawText(fb, text, Math.floor((SCREEN_W - textWidth(text)) / 2), y, shade);
}

/** Darken every pixel by one shade (0 stays 0). */
export function darken(fb: Uint8Array): void {
  for (let i = 0; i < fb.length; i++) {
    const v = fb[i]!;
    fb[i] = v > 0 ? v - 1 : 0;
  }
}

/** Zero-padded decimal. */
export function pad(n: number, width: number): string {
  return String(Math.max(0, Math.floor(n))).padStart(width, '0');
}
