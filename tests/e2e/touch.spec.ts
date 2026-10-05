import type { Locator, Page } from '@playwright/test';
import {
  button,
  centerOf,
  expect,
  game,
  gotoGame,
  startGame,
  test,
  waitForAirborne,
  waitForLanded,
} from './fixtures';

test.describe.configure({ mode: 'parallel' });

const HOLD_MS = 800;

/** Hold an on-screen button with the input type that matches the project, run `during`, release. */
async function holdButton(
  page: Page,
  target: Locator,
  isMobile: boolean,
  during: () => Promise<void>,
): Promise<void> {
  const { x, y } = await centerOf(target);
  if (isMobile) {
    // Real touch events through CDP (the mobile project is Chromium-based).
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x, y, id: 1 }],
    });
    try {
      await during();
    } finally {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await cdp.detach();
    }
  } else {
    await page.mouse.move(x, y);
    await page.mouse.down();
    try {
      await during();
    } finally {
      await page.mouse.up();
    }
  }
}

async function tapButton(page: Page, target: Locator, isMobile: boolean): Promise<void> {
  if (isMobile) {
    const { x, y } = await centerOf(target);
    await page.touchscreen.tap(x, y);
  } else {
    await target.click();
  }
}

test('holding the on-screen right button walks and shows it pressed', async ({
  page,
  isMobile,
}) => {
  await gotoGame(page);
  await startGame(page);
  const right = button(page, 'right');
  await expect(right).toHaveAttribute('data-pressed', 'false');
  const x0 = (await game(page)).player.x;

  await holdButton(page, right, isMobile, async () => {
    await expect(right).toHaveAttribute('data-pressed', 'true');
    await page.waitForTimeout(HOLD_MS); // measuring a hold duration
  });

  await expect(right).toHaveAttribute('data-pressed', 'false');
  expect((await game(page)).player.x).toBeGreaterThan(x0 + 4);
});

test('tapping the on-screen A button jumps', async ({ page, isMobile }) => {
  await gotoGame(page);
  await startGame(page);
  await waitForLanded(page);
  const y0 = (await game(page)).player.y;

  await tapButton(page, button(page, 'a'), isMobile);
  await waitForAirborne(page, y0);
  await waitForLanded(page);
});

test('on-screen buttons animate for keyboard input too', async ({ page }) => {
  await gotoGame(page);
  const pairs: ReadonlyArray<readonly [string, string]> = [
    ['ArrowRight', 'right'],
    ['ArrowLeft', 'left'],
    ['z', 'a'],
    ['x', 'b'],
  ];
  for (const [key, name] of pairs) {
    const btn = button(page, name);
    await expect(btn).toHaveAttribute('data-pressed', 'false');
    await page.keyboard.down(key);
    await expect(btn).toHaveAttribute('data-pressed', 'true');
    await page.keyboard.up(key);
    await expect(btn).toHaveAttribute('data-pressed', 'false');
  }
});

test('every control has an accessible label', async ({ page }) => {
  await gotoGame(page);
  for (const name of ['up', 'down', 'left', 'right', 'a', 'b', 'start', 'select']) {
    await expect(button(page, name)).toHaveAttribute('aria-label', /\S/);
  }
  await expect(page.getByTestId('power-switch')).toHaveAttribute('role', 'switch');
  await expect(page.getByTestId('settings-toggle')).toHaveAttribute('aria-label', /\S/);
  await expect(page.getByTestId('fullscreen-toggle')).toHaveAttribute('aria-label', /\S/);
});
