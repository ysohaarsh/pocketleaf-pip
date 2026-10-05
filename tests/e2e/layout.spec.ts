import type { Page } from '@playwright/test';
import { button, expect, gotoGame, skipBoot, test } from './fixtures';

test.describe.configure({ mode: 'parallel' });

const CONTROLS = [
  'btn-up',
  'btn-down',
  'btn-left',
  'btn-right',
  'btn-a',
  'btn-b',
  'btn-start',
  'btn-select',
] as const;

const MIN_TARGET = 48;

async function maybeSaveScreenshot(page: Page, name: string): Promise<void> {
  if (!process.env.SAVE_SCREENSHOTS) return;
  await page.screenshot({ path: `docs/screenshots/${name}.png` });
}

async function expectNoPageOverflow(page: Page): Promise<void> {
  const m = await page.evaluate(() => {
    const el = document.scrollingElement ?? document.documentElement;
    return {
      sw: el.scrollWidth,
      sh: el.scrollHeight,
      cw: el.clientWidth,
      ch: el.clientHeight,
    };
  });
  expect(m.sw, 'no horizontal page overflow').toBeLessThanOrEqual(m.cw);
  expect(m.sh, 'no vertical page overflow').toBeLessThanOrEqual(m.ch);
}

async function expectTouchTargets(page: Page): Promise<void> {
  for (const id of CONTROLS) {
    const box = await page.getByTestId(id).boundingBox();
    expect(box, `${id} is rendered`).not.toBeNull();
    expect(box!.width, `${id} width`).toBeGreaterThanOrEqual(MIN_TARGET);
    expect(box!.height, `${id} height`).toBeGreaterThanOrEqual(MIN_TARGET);
  }
}

test.describe('phone', () => {
  test.beforeEach(({ isMobile }) => {
    test.skip(!isMobile, 'phone layout is checked in the mobile project');
  });

  test('portrait 390x844 fits without scrolling and has big touch targets', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoGame(page);
    await skipBoot(page);
    await expectNoPageOverflow(page);
    await expectTouchTargets(page);
    await maybeSaveScreenshot(page, 'phone-portrait');
  });

  test('landscape 844x390 fits without scrolling and has big touch targets', async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await gotoGame(page);
    await skipBoot(page);
    await expectNoPageOverflow(page);
    await expectTouchTargets(page);
    await maybeSaveScreenshot(page, 'phone-landscape');
  });
});

test.describe('desktop', () => {
  test.beforeEach(({ isMobile }) => {
    test.skip(isMobile, 'desktop layout is checked in the desktop projects');
  });

  test('the whole console is visible in the viewport', async ({ page }, testInfo) => {
    await gotoGame(page);
    await skipBoot(page);
    const viewport = page.viewportSize()!;
    const box = await page.getByTestId('console').boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
    await expectNoPageOverflow(page);
    await expect(button(page, 'a')).toBeInViewport({ ratio: 1 });
    await expect(page.getByTestId('screen')).toBeInViewport({ ratio: 1 });
    await maybeSaveScreenshot(page, `desktop-${testInfo.project.name}`);
  });
});
