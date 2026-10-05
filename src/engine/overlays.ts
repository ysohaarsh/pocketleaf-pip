import { BOOT_CHIME_TICK, SCREEN_H, SCREEN_W, TICK_RATE } from '../game/constants';
import type { Shade, World } from '../game/types';
import { box, drawText, drawTextCentered, fill, fillRect, pad, plot, textWidth } from './draw';

/** Animation frame index: floor(tick / ticksPerFrame) mod frames, or 0 when animations are frozen. */
export function phase(world: World, ticksPerFrame: number, frames: number): number {
  return world.freezeAnim ? 0 : Math.floor(world.tick / ticksPerFrame) % frames;
}

/** True on the "visible" half of a slow blink (always true when frozen). */
function blinkOn(world: World): boolean {
  return phase(world, 30, 2) === 0;
}

/** HUD text column → x (6 px advance, 1 px margin). */
const col = (c: number): number => c * 6 + 1;

/** Height of the HUD strip in px: one 8 px text row plus a 1 px rule. */
export const HUD_H = 10;

/** 5x7 hourglass drawn before the timer (the font has no clock glyph). */
const HOURGLASS = ['#####', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#####'];

/**
 * One compact row on a solid strip: score · Glimmers · lives · level · hourglass time.
 * e.g. "001200  $x07  %x3   1-2   ⧗287"
 */
export function drawHud(fb: Uint8Array, world: World): void {
  const cave = world.level.def.theme === 'cave';
  const ink: Shade = cave ? 3 : 0;
  // Solid backing so sprites passing under the HUD never mix with its text.
  fillRect(fb, 0, 0, SCREEN_W, HUD_H, cave ? 0 : 3);
  fillRect(fb, 0, HUD_H - 1, SCREEN_W, 1, cave ? 1 : 2);
  const secs = Math.ceil(world.timeTicks / TICK_RATE);
  drawText(fb, pad(world.score, 6), col(0), 1, ink);
  drawText(fb, `$x${pad(world.coins, 2)}`, col(7), 1, ink);
  drawText(fb, `%x${world.lives}`, col(12), 1, ink);
  drawText(fb, world.level.def.label, col(17), 1, ink);
  HOURGLASS.forEach((row, dy) => {
    for (let dx = 0; dx < row.length; dx++)
      if (row[dx] === '#') plot(fb, col(22) + dx, 1 + dy, ink);
  });
  drawText(fb, pad(secs, 3), col(23), 1, ink);
}

function drawBoot(fb: Uint8Array, world: World): void {
  const t = world.sceneTick;
  fill(fb, t < 10 ? 1 : t < 20 ? 2 : 3);
  const target = Math.floor(SCREEN_H / 2) - 4;
  const y = Math.min(target, Math.round(-8 + ((target + 8) * t) / BOOT_CHIME_TICK));
  drawTextCentered(fb, 'POCKETLEAF', y, 0);
}

function drawTitle(fb: Uint8Array, world: World): void {
  box(fb, 4, 20, SCREEN_W - 8, 64, 3, 0);
  drawTextCentered(fb, 'PIP & THE POCKET KINGDOM', 28, 0);
  drawTextCentered(fb, `HI ${pad(world.highScore, 6)}`, 44, 0);
  if (blinkOn(world)) drawTextCentered(fb, 'PRESS START', 58, 0);
  drawTextCentered(fb, world.musicOn ? 'MUSIC ON' : 'MUSIC OFF', 72, 1);
}

function drawIntro(fb: Uint8Array, world: World): void {
  fill(fb, 0);
  drawTextCentered(fb, `WORLD ${world.level.def.label}`, 44, 3);
  drawTextCentered(fb, world.level.def.name.toUpperCase(), 58, 3);
  drawTextCentered(fb, `%x${world.lives}`, 78, 3);
}

function drawPaused(fb: Uint8Array): void {
  const w = textWidth('PAUSED') + 16;
  box(fb, Math.floor((SCREEN_W - w) / 2), 60, w, 20, 3, 0);
  drawTextCentered(fb, 'PAUSED', 66, 0);
}

/** A small right-pointing cursor triangle. */
function cursor(fb: Uint8Array, x: number, y: number, shade: Shade): void {
  for (let i = 0; i < 4; i++) for (let j = -i; j <= i; j++) plot(fb, x + 3 - i, y + 3 + j, shade);
}

function drawGameOver(fb: Uint8Array, world: World): void {
  fill(fb, 0);
  drawTextCentered(fb, 'GAME OVER', 44, 3);
  drawText(fb, 'CONTINUE', 62, 70, 3);
  drawText(fb, 'TITLE', 62, 82, 3);
  cursor(fb, 52, world.menuIndex === 0 ? 70 : 82, 3);
  drawTextCentered(fb, `SCORE ${pad(world.score, 6)}`, 108, 2);
}

function drawClear(fb: Uint8Array): void {
  const w = textWidth('BEACON LIT!') + 16;
  box(fb, Math.floor((SCREEN_W - w) / 2), 36, w, 20, 3, 0);
  drawTextCentered(fb, 'BEACON LIT!', 42, 0);
}

function drawWin(fb: Uint8Array, world: World): void {
  fill(fb, 3);
  drawTextCentered(fb, 'THE KINGDOM GLOWS!', 28, 0);
  drawTextCentered(fb, 'THANK YOU PIP!', 42, 1);
  drawTextCentered(fb, `SCORE ${pad(world.score, 6)}`, 66, 0);
  drawTextCentered(fb, `HI ${pad(world.highScore, 6)}`, 80, 0);
  if (blinkOn(world)) drawTextCentered(fb, 'PRESS START', 108, 0);
}

/** Scene-specific overlay (or full-screen card) drawn on top of the playfield. */
export function drawOverlay(fb: Uint8Array, world: World): void {
  switch (world.scene) {
    case 'boot':
      return drawBoot(fb, world);
    case 'title':
      return drawTitle(fb, world);
    case 'intro':
      return drawIntro(fb, world);
    case 'paused':
      return drawPaused(fb);
    case 'gameover':
      return drawGameOver(fb, world);
    case 'clear':
      return drawClear(fb);
    case 'win':
      return drawWin(fb, world);
    default:
      return;
  }
}
