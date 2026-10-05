import { expect, game, gotoGame, startGame, tapKey, test, waitScene } from './fixtures';

test('START pauses the simulation and resumes it', async ({ page }) => {
  await gotoGame(page);
  await startGame(page);

  await tapKey(page, 'Enter');
  await waitScene(page, 'paused');
  const frozen = (await game(page)).tick;
  await page.waitForTimeout(500); // measuring that wall time passes without ticks
  expect((await game(page)).tick).toBe(frozen);

  await tapKey(page, 'Enter');
  await waitScene(page, 'playing');
  await expect.poll(async () => (await game(page)).tick).toBeGreaterThan(frozen);
});
