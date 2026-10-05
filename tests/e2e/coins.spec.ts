import { expect, game, gotoGame, startGame, test } from './fixtures';

test('walking into a Glimmer collects it and scores', async ({ page }) => {
  // test-coins: flat floor, player at col 1, one Glimmer 3 tiles to the right on the walking row.
  await gotoGame(page, '?test=1&level=test-coins');
  await startGame(page);
  const before = await game(page);
  expect(before.levelId).toBe('test-coins');
  expect(before.coins).toBe(0);

  await page.keyboard.down('ArrowRight');
  try {
    await expect.poll(async () => (await game(page)).coins, { timeout: 3_000 }).toBe(1);
  } finally {
    await page.keyboard.up('ArrowRight');
  }
  expect((await game(page)).score).toBeGreaterThan(before.score);
});
