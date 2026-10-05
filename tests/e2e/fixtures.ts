import { test as base, expect, type Locator, type Page } from '@playwright/test';
import type { GameState, SceneId } from './types';

export { expect };
export type { GameState, SceneId };

/**
 * Console messages that are known to be benign browser noise. Keep this EXACT-match and commented;
 * never add app errors here. Currently empty: the app must run with a clean console.
 */
const ALLOWED_CONSOLE_ERRORS: readonly string[] = [];

interface Fixtures {
  /** Auto fixture: fails the test at teardown on any console error or uncaught page error. */
  consoleGuard: undefined;
}

export const test = base.extend<Fixtures>({
  consoleGuard: [
    async ({ page }, use, testInfo) => {
      // Headless WebKit on CI occasionally fires a native window blur / visibilitychange mid-test.
      // The game correctly pauses and releases held input on those, which made input-driven specs
      // flaky. Drop only *trusted* (browser-generated) focus-loss events; the pause-on-blur
      // behaviour itself is still covered by specs that dispatch synthetic blur events.
      await page.addInitScript(() => {
        const dropTrusted = (e: Event): void => {
          if (e.isTrusted) e.stopImmediatePropagation();
        };
        window.addEventListener('blur', dropTrusted, true);
        document.addEventListener('visibilitychange', dropTrusted, true);
      });
      const problems: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() !== 'error') return;
        const text = msg.text();
        if (ALLOWED_CONSOLE_ERRORS.includes(text)) return;
        const loc = msg.location();
        problems.push(`console.error: ${text}${loc.url ? ` (${loc.url}:${loc.lineNumber})` : ''}`);
      });
      page.on('pageerror', (err) => {
        problems.push(`pageerror: ${err.name}: ${err.message}`);
      });
      await use(undefined);
      if (problems.length > 0) {
        await testInfo.attach('console-errors', {
          body: problems.join('\n'),
          contentType: 'text/plain',
        });
      }
      expect(problems, 'browser console must stay free of errors').toEqual([]);
    },
    { auto: true },
  ],
});

export const SCREEN = 'canvas[data-testid="screen"]';

export function screen(page: Page): Locator {
  return page.locator(SCREEN);
}

/** Navigate, wait for the first rendered frame and for the test hooks. */
export async function gotoGame(page: Page, query = '?test=1'): Promise<void> {
  await page.goto(`/${query}`);
  await page.locator(`${SCREEN}[data-ready="1"]`).waitFor({ state: 'attached' });
  await page.waitForFunction(() => window.__GAME__ !== undefined);
  // The game pauses and releases held input on window blur (by design). Headless browsers can
  // deliver a late blur/visibility change after load, so make sure the page is focused and visible
  // before tests start driving input.
  await page.bringToFront();
  await page.evaluate(() => window.focus());
  await page.waitForFunction(() => document.hasFocus() && document.visibilityState === 'visible');
}

/** Read a plain-data snapshot of window.__GAME__. */
export async function game(page: Page): Promise<GameState> {
  return page.evaluate(() => {
    const g = window.__GAME__;
    if (!g) throw new Error('window.__GAME__ is not exposed (is ?test=1 set?)');
    return {
      scene: g.scene,
      tick: g.tick,
      player: { ...g.player },
      coins: g.coins,
      score: g.score,
      lives: g.lives,
      levelId: g.levelId,
      timeLeft: g.timeLeft,
      stats: { ...g.stats },
    };
  });
}

export async function scene(page: Page): Promise<SceneId> {
  return page.evaluate(() => window.__GAME__!.scene);
}

export async function waitScene(page: Page, target: SceneId, timeout = 10_000): Promise<void> {
  await page.waitForFunction((s) => window.__GAME__?.scene === s, target, { timeout });
}

/** Wait until the simulation has advanced `ticks` ticks past its current value. */
export async function waitTicks(page: Page, ticks: number): Promise<void> {
  const start = await page.evaluate(() => window.__GAME__!.tick);
  await page.waitForFunction((t) => (window.__GAME__?.tick ?? -1) >= t, start + ticks);
}

/** Tap a key long enough for at least one 60 Hz tick to sample it. */
export async function tapKey(page: Page, key: string, holdMs = 50): Promise<void> {
  await page.keyboard.down(key);
  await page.waitForTimeout(holdMs);
  await page.keyboard.up(key);
}

/** From any boot state, end up on the title screen. */
export async function skipBoot(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const s = window.__GAME__?.scene;
    return s === 'boot' || s === 'title';
  });
  if ((await scene(page)) === 'boot') {
    await tapKey(page, 'Enter');
  }
  await waitScene(page, 'title');
}

/**
 * boot → title → (Enter) intro → (Enter skip, or natural timeout) playing.
 * `?level=<id>` URLs start directly in 'playing', which is accepted as-is.
 */
export async function startGame(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const s = window.__GAME__?.scene;
    return s === 'boot' || s === 'title' || s === 'playing';
  });
  if ((await scene(page)) === 'playing') return;
  await skipBoot(page);
  // The title may need a few ticks before it accepts input; release fully before pressing again.
  await waitTicks(page, 2);
  await tapKey(page, 'Enter');
  await page.waitForFunction(() => {
    const s = window.__GAME__?.scene;
    return s === 'intro' || s === 'playing';
  });
  if ((await scene(page)) === 'intro') {
    await waitTicks(page, 2);
    await tapKey(page, 'Enter');
  }
  // The intro also ends by itself after ~2.5 s, so this cannot hang on a missed skip.
  await waitScene(page, 'playing');
}

/** Wait (polling every animation frame) until the player is clearly above `y0`. */
export async function waitForAirborne(page: Page, y0: number, minRise = 4): Promise<void> {
  await page.waitForFunction(
    ([y, d]) => {
      const p = window.__GAME__?.player;
      return p !== undefined && p.y < y - d;
    },
    [y0, minRise] as const,
    { polling: 'raf', timeout: 5_000 },
  );
}

/** Wait until the player stands on ground again. */
export async function waitForLanded(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__GAME__?.player.onGround === true, undefined, {
    timeout: 5_000,
  });
}

/** Center of an element in CSS px. */
export async function centerOf(locator: Locator): Promise<{ x: number; y: number }> {
  const box = await locator.boundingBox();
  if (!box) throw new Error('element has no bounding box');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

export function button(page: Page, name: string): Locator {
  return page.getByTestId(`btn-${name}`);
}

/** RGBA colours (as '#rrggbb' or '#rrggbbaa' when not opaque) present in the visible canvas. */
export async function canvasColours(
  page: Page,
): Promise<{ width: number; height: number; colours: string[] }> {
  return page.locator(SCREEN).evaluate((el) => {
    const canvas = el as HTMLCanvasElement;
    // Copy through a 2D canvas so this works whatever context the screen uses.
    const copy = document.createElement('canvas');
    copy.width = canvas.width;
    copy.height = canvas.height;
    const ctx = copy.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('2D context unavailable');
    ctx.drawImage(canvas, 0, 0);
    const data = ctx.getImageData(0, 0, copy.width, copy.height).data;
    const seen = new Set<string>();
    const hex = (n: number) => n.toString(16).padStart(2, '0');
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3]!;
      seen.add(
        `#${hex(data[i]!)}${hex(data[i + 1]!)}${hex(data[i + 2]!)}${a === 255 ? '' : hex(a)}`,
      );
    }
    return { width: canvas.width, height: canvas.height, colours: [...seen].sort() };
  });
}

/** Open the settings popover (idempotent). */
export async function openSettings(page: Page): Promise<void> {
  const toggle = page.getByTestId('settings-toggle');
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
  await expect(page.getByTestId('settings-panel')).toBeVisible();
}

/** Close the settings popover (idempotent). */
export async function closeSettings(page: Page): Promise<void> {
  const toggle = page.getByTestId('settings-toggle');
  if ((await toggle.getAttribute('aria-expanded')) === 'true') await toggle.click();
  await expect(page.getByTestId('settings-panel')).toBeHidden();
}

/** Whether a checkbox or role=switch control is on. */
export async function isOn(locator: Locator): Promise<boolean> {
  return locator.evaluate((el) => {
    const aria = el.getAttribute('aria-checked');
    if (aria !== null) return aria === 'true';
    return el instanceof HTMLInputElement ? el.checked : false;
  });
}

/** Flip a checkbox/switch and wait until the state actually changed. */
export async function toggleControl(locator: Locator): Promise<boolean> {
  const before = await isOn(locator);
  await locator.click();
  await expect.poll(() => isOn(locator)).toBe(!before);
  return !before;
}
