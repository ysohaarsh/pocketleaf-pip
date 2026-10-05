import type { Page } from '@playwright/test';
import { PALETTES, type PaletteId } from '../../src/engine/api';
import {
  canvasColours,
  closeSettings,
  expect,
  gotoGame,
  isOn,
  openSettings,
  skipBoot,
  startGame,
  test,
  toggleControl,
  waitTicks,
} from './fixtures';

test.describe.configure({ mode: 'parallel' });

const W = 160;
const H = 144;

/** The canvas must be an integer upscale of 160x144 and contain only colours of `palette`. */
async function expectPalettePixels(page: Page, palette: PaletteId): Promise<void> {
  const allowed = PALETTES[palette].map((c) => c.toLowerCase());
  await expect
    .poll(
      async () => {
        const { colours } = await canvasColours(page);
        return colours.every((c) => allowed.includes(c));
      },
      { message: `canvas colours should be within the ${palette} palette` },
    )
    .toBe(true);

  const { width, height, colours } = await canvasColours(page);
  expect(width % W).toBe(0);
  expect(height % H).toBe(0);
  const k = width / W;
  expect(k).toBeGreaterThanOrEqual(1);
  expect(height / H).toBe(k);

  expect(colours.length).toBeGreaterThanOrEqual(2);
  expect(colours.length).toBeLessThanOrEqual(4);
  for (const c of colours) expect(allowed).toContain(c);
}

test('title screen is a 4-shade integer-scaled image (LCD off)', async ({ page }) => {
  await gotoGame(page);
  await skipBoot(page);
  await waitTicks(page, 5);
  await expectPalettePixels(page, 'classic');
});

test('playing screen is a 4-shade integer-scaled image (LCD off)', async ({ page }) => {
  await gotoGame(page);
  await startGame(page);
  await waitTicks(page, 5);
  await expectPalettePixels(page, 'classic');
});

test('LCD ghosting is quantised: still within the palette with effects on', async ({ page }) => {
  await gotoGame(page);
  await skipBoot(page);
  await openSettings(page);
  const lcd = page.getByTestId('settings-lcd');
  expect(await isOn(lcd)).toBe(false); // ?test=1 turns LCD effects off
  await toggleControl(lcd);
  await closeSettings(page);

  // Move around so ghosting has something to blend.
  await startGame(page);
  await page.keyboard.down('ArrowRight');
  await waitTicks(page, 30);
  await expectPalettePixels(page, 'classic');
  await page.keyboard.up('ArrowRight');
});

test('Pocket Grey palette repaints the canvas with grey shades only', async ({ page }) => {
  await gotoGame(page);
  await skipBoot(page);
  await openSettings(page);
  await page.getByTestId('settings-palette').selectOption('grey');
  await closeSettings(page);
  await expectPalettePixels(page, 'grey');
});
