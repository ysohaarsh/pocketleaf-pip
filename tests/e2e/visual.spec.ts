import { expect, gotoGame, screen, skipBoot, tapKey, test, waitScene, waitTicks } from './fixtures';

/*
 * Visual baselines live in tests/e2e/__screenshots__/<project>/<platform>/. They are generated
 * per platform on purpose (font rendering and compositing differ); CI regenerates its own via the
 * `update-snapshots` workflow_dispatch job. Update locally with `npm run e2e:update`.
 * ?test=1 disables LCD effects and freezes animations so frames are deterministic.
 */

test.describe.configure({ mode: 'parallel' });

test('title screen', async ({ page }) => {
  await gotoGame(page);
  await skipBoot(page);
  await waitTicks(page, 10);
  await expect(screen(page)).toHaveScreenshot('title.png');
});

test('level 1-1 start (paused on the first playing frame)', async ({ page }) => {
  await gotoGame(page);
  await skipBoot(page);
  await waitTicks(page, 2);
  await tapKey(page, 'Enter');
  await waitScene(page, 'intro');

  // Arm an in-page watcher that sends START within one animation frame of 'playing', so the
  // paused frame is (near-)identical on every run regardless of test-runner latency.
  const armed = page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const target = document.activeElement ?? document.body;
        const send = (type: 'keydown' | 'keyup') =>
          target.dispatchEvent(
            new KeyboardEvent(type, { key: 'Enter', code: 'Enter', bubbles: true }),
          );
        const watch = () => {
          if (window.__GAME__?.scene === 'playing') {
            send('keydown');
            requestAnimationFrame(() =>
              requestAnimationFrame(() => {
                send('keyup');
                resolve();
              }),
            );
            return;
          }
          requestAnimationFrame(watch);
        };
        watch();
      }),
  );
  // Let the intro end naturally (no skip) so the first playing frame is reached the same way.
  await armed;
  await waitScene(page, 'paused');
  await expect(screen(page)).toHaveScreenshot('level1-start-paused.png');
});

test('console on the title screen', async ({ page }) => {
  await gotoGame(page);
  await skipBoot(page);
  await waitTicks(page, 10);
  await expect(page).toHaveScreenshot('console.png', { fullPage: true, mask: [] });
});
