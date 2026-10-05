/** Native screen width in game pixels. */
export const SCREEN_W = 160;

/** Below this many CSS px per game pixel the LCD dot grid would swamp the image. */
const MIN_GRID_SCALE = 2;

export interface LcdOverlayVars {
  /** CSS px per game pixel (may be fractional when the host scales in device pixels). */
  scale: number;
  /** Whether the dot grid is drawn at this scale. */
  grid: boolean;
}

/** Derive the LCD overlay parameters from the canvas's laid-out CSS width. */
export function lcdOverlayVars(canvasClientWidth: number): LcdOverlayVars {
  const scale =
    canvasClientWidth > 0 ? Math.round((canvasClientWidth / SCREEN_W) * 1000) / 1000 : 0;
  return { scale, grid: scale >= MIN_GRID_SCALE };
}
