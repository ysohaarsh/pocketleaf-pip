import type { Page } from '@playwright/test';
import { button, expect, game, gotoGame, scene, test, waitScene } from './fixtures';

/** Fake standard pad (initially disconnected) driven through window.__pad. */
async function installPad(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const state = {
      buttons: Array.from({ length: 17 }, () => false),
      axes: [0, 0, 0, 0],
      connected: false,
      timestamp: 0,
    };
    window.__pad = state;
    const snapshot = () => ({
      id: 'Test Pad (STANDARD GAMEPAD)',
      index: 0,
      connected: state.connected,
      mapping: 'standard',
      timestamp: state.timestamp,
      axes: [...state.axes],
      buttons: state.buttons.map((pressed) => ({
        pressed,
        touched: pressed,
        value: pressed ? 1 : 0,
      })),
      vibrationActuator: null,
      hapticActuators: [],
    });
    Object.defineProperty(navigator, 'getGamepads', {
      configurable: true,
      value: () => [state.connected ? snapshot() : null, null, null, null],
    });
  });
}

async function setPad(page: Page, patch: { connected?: boolean; held?: number[] }): Promise<void> {
  await page.evaluate((p) => {
    const pad = window.__pad!;
    if (p.connected !== undefined) pad.connected = p.connected;
    if (p.held) pad.buttons = pad.buttons.map((_, i) => p.held!.includes(i));
    pad.timestamp += 1;
  }, patch);
}

const blur = (page: Page): Promise<void> =>
  page.evaluate(() => void window.dispatchEvent(new Event('blur')));

test('a blur while Pip is dying pauses the retry instead of playing unattended', async ({
  page,
}) => {
  await gotoGame(page, '?test=1&level=test-enemies');
  await waitScene(page, 'playing');
  await page.keyboard.down('ArrowRight');
  await waitScene(page, 'dying');
  await page.keyboard.up('ArrowRight');
  await blur(page);
  await waitScene(page, 'intro');
  await page.waitForFunction(() => window.__GAME__?.scene !== 'intro');
  expect(await scene(page)).toBe('paused');
});

test('a controller holding START through a blur does not unpause the game', async ({ page }) => {
  await installPad(page);
  await gotoGame(page, '?test=1&level=test-coins');
  await waitScene(page, 'playing');
  await setPad(page, { connected: true, held: [15] });
  await expect(button(page, 'right')).toHaveAttribute('data-pressed', 'true');
  await setPad(page, { held: [] });
  await setPad(page, { held: [9] }); // START down → paused
  await waitScene(page, 'paused');
  await setPad(page, { held: [] });
  await page.waitForTimeout(100); // let the release be sampled while paused
  await setPad(page, { held: [9] }); // START down again → playing, and keep holding it
  await waitScene(page, 'playing');
  await blur(page);
  await page.waitForTimeout(300); // several frames of pad polling with START still held
  expect(await scene(page)).toBe('paused');
  // Unplugging releases everything.
  await setPad(page, { connected: false });
  await expect(button(page, 'start')).toHaveAttribute('data-pressed', 'false');
});

test('resizing mid-jump keeps integer scaling and leaves the simulation alone', async ({
  page,
}) => {
  await gotoGame(page, '?test=1&level=test-coins');
  await waitScene(page, 'playing');
  await page.keyboard.down('z');
  for (const [width, height] of [
    [400, 700],
    [1280, 500],
    [333, 333],
    [900, 1200],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(100);
    const size = await page
      .locator('canvas[data-testid="screen"]')
      .evaluate((c: HTMLCanvasElement) => ({ w: c.width, h: c.height }));
    expect(size.w % 160).toBe(0);
    expect(size.w / 160).toBe(size.h / 144);
  }
  await page.keyboard.up('z');
  const g = await game(page);
  expect(g.scene).toBe('playing');
  expect(Number.isFinite(g.player.y)).toBe(true);
});
