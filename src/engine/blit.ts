import { SCREEN_H, SCREEN_W } from '../game/constants';
import type { Shade } from '../game/types';

/** Weight of the current frame in LCD ghosting (the rest is the previous blended frame). */
const GHOST_CURRENT = 0.65;

export interface Blitter {
  /**
   * Show a 160x144 shade framebuffer using a palette (4 CSS hex colours, darkest first). With
   * `lcd`, frames are blended in shade space and re-quantised, so only palette colours appear.
   */
  present(fb: Uint8Array, palette: readonly string[], lcd: boolean): void;
  /** Fill the screen with one palette shade (power-off look). */
  clear(shade: Shade, palette: readonly string[]): void;
  /** Largest integer scale fitting the CSS box at this device pixel ratio. */
  resize(cssWidth: number, cssHeight: number, dpr: number): void;
}

/** '#rrggbb' → 0xAABBGGRR (ImageData's little-endian Uint32 layout). */
function packColor(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

/** DOM glue: offscreen 160x144 ImageData → nearest-neighbour upscale into the visible canvas. */
export function createBlitter(canvas: HTMLCanvasElement): Blitter {
  const off = document.createElement('canvas');
  off.width = SCREEN_W;
  off.height = SCREEN_H;
  const offCtx = off.getContext('2d');
  const ctx = canvas.getContext('2d');
  const image = offCtx?.createImageData(SCREEN_W, SCREEN_H) ?? null;
  const out = image ? new Uint32Array(image.data.buffer) : new Uint32Array(0);
  const ghost = new Float32Array(SCREEN_W * SCREEN_H);
  const lut = new Uint32Array(4);
  let lutKey = '';
  let ghostValid = false;

  const setPalette = (palette: readonly string[]): void => {
    const key = palette.join();
    if (key === lutKey) return;
    lutKey = key;
    for (let i = 0; i < 4; i++) lut[i] = packColor(palette[i] ?? '#000000');
  };

  const flush = (): void => {
    if (!image || !offCtx || !ctx) return;
    offCtx.putImageData(image, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, 0, 0, canvas.width, canvas.height);
  };

  return {
    present(fb, palette, lcd) {
      setPalette(palette);
      if (lcd) {
        if (!ghostValid) for (let i = 0; i < fb.length; i++) ghost[i] = fb[i]!;
        for (let i = 0; i < fb.length; i++) {
          const g = GHOST_CURRENT * fb[i]! + (1 - GHOST_CURRENT) * ghost[i]!;
          ghost[i] = g;
          out[i] = lut[Math.round(g) & 3]!;
        }
        ghostValid = true;
      } else {
        for (let i = 0; i < fb.length; i++) out[i] = lut[fb[i]! & 3]!;
        ghostValid = false;
      }
      flush();
    },
    clear(shade, palette) {
      setPalette(palette);
      out.fill(lut[shade]!);
      ghostValid = false;
      flush();
    },
    resize(cssWidth, cssHeight, dpr) {
      const k = Math.max(
        1,
        Math.floor(Math.min((cssWidth * dpr) / SCREEN_W, (cssHeight * dpr) / SCREEN_H)),
      );
      canvas.width = SCREEN_W * k;
      canvas.height = SCREEN_H * k;
      canvas.style.width = `${(SCREEN_W * k) / dpr}px`;
      canvas.style.height = `${(SCREEN_H * k) / dpr}px`;
      // Resizing wipes the canvas; redraw the last frame if there is one.
      if (lutKey) flush();
    },
  };
}
