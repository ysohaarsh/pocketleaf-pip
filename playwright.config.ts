import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env.CI;
const desktopViewport = { width: 1440, height: 900 };

/**
 * E2E runs against the production build (`vite build && vite preview`), so test-only levels and
 * hooks must be reachable via `?test=1` in the shipped bundle.
 *
 * Visual baselines are stored per project AND per platform: a macOS baseline never gates Linux CI.
 * CI generates its own via the `update-snapshots` workflow_dispatch job (`npm run e2e:update`).
 */
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  snapshotPathTemplate:
    '{testDir}/__screenshots__/{projectName}/{platform}/{testFilePath}/{arg}{ext}',
  expect: {
    toHaveScreenshot: { maxDiffPixels: 50, animations: 'disabled' },
  },
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: desktopViewport },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'], viewport: desktopViewport },
    },
    {
      // Chromium-based phone emulation with touch (hasTouch + isMobile).
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
    },
  ],
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
});
