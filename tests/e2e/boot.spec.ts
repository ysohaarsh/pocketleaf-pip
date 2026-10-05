import { expect, game, gotoGame, screen, tapKey, test, waitScene } from './fixtures';

test.describe.configure({ mode: 'parallel' });

test('app boots into a ready canvas and exposes test hooks', async ({ page }) => {
  await gotoGame(page);
  await expect(screen(page)).toHaveAttribute('data-ready', '1');
  const { scene } = await game(page);
  expect(['boot', 'title']).toContain(scene);
});

test('any key skips the boot sequence to the title', async ({ page }) => {
  await gotoGame(page);
  if ((await game(page)).scene === 'boot') {
    await tapKey(page, 'Enter');
  }
  await waitScene(page, 'title');
  expect((await game(page)).scene).toBe('title');
});
