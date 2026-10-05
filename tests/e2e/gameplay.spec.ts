import {
  expect,
  game,
  gotoGame,
  startGame,
  tapKey,
  test,
  waitForAirborne,
  waitForLanded,
} from './fixtures';

test.describe.configure({ mode: 'parallel' });

test('Enter starts the game and reaches the first level', async ({ page }) => {
  await gotoGame(page);
  await startGame(page);
  const state = await game(page);
  expect(state.scene).toBe('playing');
  expect(state.levelId).toBe('1-1');
  expect(state.lives).toBe(3);
  expect(state.coins).toBe(0);
  expect(state.score).toBe(0);
});

test('holding right moves the player right', async ({ page }) => {
  await gotoGame(page);
  await startGame(page);
  const x0 = (await game(page)).player.x;
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(1_000); // measuring a hold duration
  await page.keyboard.up('ArrowRight');
  expect((await game(page)).player.x).toBeGreaterThan(x0 + 8);
});

test('Z jumps: the player rises and lands again', async ({ page }) => {
  await gotoGame(page);
  await startGame(page);
  await waitForLanded(page);
  const y0 = (await game(page)).player.y;
  await tapKey(page, 'z', 150);
  await waitForAirborne(page, y0);
  await waitForLanded(page);
  const after = await game(page);
  expect(after.player.onGround).toBe(true);
  expect(Math.abs(after.player.y - y0)).toBeLessThanOrEqual(1);
});
