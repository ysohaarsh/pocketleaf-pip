import { expect, game, gotoGame, startGame, tapKey, test } from './fixtures';

/*
 * Perf smoke: steady-state frame cost while running and jumping through 1-1.
 * Locally the budget is one 60 Hz frame (+ a little jitter). Shared CI runners are noisy and
 * often software-rendered, so CI uses a relaxed — but still enforced — budget and logs the numbers.
 */
const LOCAL_AVG_MS = 17.5;
const CI_AVG_MS = 25;
const RUN_MS = 5_000;

test('steady-state frame time stays within budget', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'perf stats are measured on desktop Chromium');

  await gotoGame(page);
  await startGame(page);
  const before = (await game(page)).stats;

  await page.keyboard.down('ArrowRight');
  try {
    const end = Date.now() + RUN_MS;
    while (Date.now() < end) {
      await tapKey(page, 'z', 200); // periodic jumps; timing is the point of this loop
      await page.waitForTimeout(400);
    }
  } finally {
    await page.keyboard.up('ArrowRight');
  }

  const after = (await game(page)).stats;
  const summary = {
    frames: after.frames - before.frames,
    avgFrameMs: after.avgFrameMs,
    maxFrameMs: after.maxFrameMs,
    longTasks: after.longTasks - before.longTasks,
  };
  console.log(`[perf] ${JSON.stringify(summary)}`);
  await testInfo.attach('perf-stats', {
    body: JSON.stringify(summary, null, 2),
    contentType: 'application/json',
  });

  expect(summary.frames, 'the loop must keep rendering').toBeGreaterThan((RUN_MS / 1000) * 30);
  expect(summary.avgFrameMs).toBeLessThanOrEqual(process.env.CI ? CI_AVG_MS : LOCAL_AVG_MS);
  expect(summary.longTasks).toBe(0);
});
