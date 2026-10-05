import type { Page } from '@playwright/test';
import {
  expect,
  game,
  gotoGame,
  skipBoot,
  test,
  waitForAirborne,
  waitForLanded,
  waitScene,
  waitTicks,
} from './fixtures';

/** Standard-mapping indices. */
const PAD_A = 0;
const PAD_START = 9;

test.beforeEach(async ({ page }) => {
  // Install a fake standard-mapping gamepad whose state lives in window.__pad.
  await page.addInitScript(() => {
    const state = {
      buttons: Array.from({ length: 17 }, () => false),
      axes: [0, 0, 0, 0],
      connected: true,
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
    Object.defineProperty(window, '__padSnapshot', { value: snapshot });
  });
});

async function connectPad(page: Page): Promise<void> {
  await page.evaluate(() => {
    const snap = window.__padSnapshot!();
    const ev = new Event('gamepadconnected');
    Object.defineProperty(ev, 'gamepad', { value: snap });
    window.dispatchEvent(ev);
  });
}

async function setPadButton(page: Page, index: number, pressed: boolean): Promise<void> {
  await page.evaluate(
    ([i, p]) => {
      const pad = window.__pad!;
      pad.buttons[i] = p;
      pad.timestamp += 1;
    },
    [index, pressed] as const,
  );
}

/** Press, let the sim sample it for a few ticks, release. */
async function tapPad(page: Page, index: number): Promise<void> {
  await setPadButton(page, index, true);
  await waitTicks(page, 3);
  await setPadButton(page, index, false);
  await waitTicks(page, 1);
}

test('a connected controller is announced and drives the game', async ({ page }) => {
  await gotoGame(page);
  await connectPad(page);
  await expect(page.getByText('Controller connected')).toBeVisible();

  await skipBoot(page);
  await waitTicks(page, 2);
  await tapPad(page, PAD_START);
  await page.waitForFunction(() => {
    const s = window.__GAME__?.scene;
    return s === 'intro' || s === 'playing';
  });
  if ((await game(page)).scene === 'intro') await tapPad(page, PAD_START);
  await waitScene(page, 'playing');

  await waitForLanded(page);
  const y0 = (await game(page)).player.y;
  await setPadButton(page, PAD_A, true);
  await waitForAirborne(page, y0);
  await setPadButton(page, PAD_A, false);
  await waitForLanded(page);
});
