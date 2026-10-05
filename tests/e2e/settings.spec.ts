import type { Page } from '@playwright/test';
import {
  closeSettings,
  expect,
  gotoGame,
  isOn,
  openSettings,
  test,
  toggleControl,
} from './fixtures';

const STORAGE_KEY = 'pocketleaf.settings.v1';

interface StoredSettings {
  volume: number;
  muted: boolean;
  lcd: boolean;
  palette: string;
}

async function stored(page: Page): Promise<StoredSettings | null> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as StoredSettings);
  }, STORAGE_KEY);
}

test('volume, mute and palette persist across a reload', async ({ page }) => {
  await gotoGame(page);
  await openSettings(page);

  const volume = page.getByTestId('settings-volume');
  const mute = page.getByTestId('settings-mute');
  const palette = page.getByTestId('settings-palette');

  // Change the volume with the keyboard so the test is independent of the slider's scale.
  const volumeBefore = await volume.inputValue();
  await volume.focus();
  await page.keyboard.press('End');
  await page.keyboard.press('ArrowLeft');
  await expect(volume).not.toHaveValue(volumeBefore);
  const volumeAfter = await volume.inputValue();

  const mutedAfter = await toggleControl(mute);
  await palette.selectOption('grey');

  await expect.poll(() => stored(page)).toMatchObject({ muted: mutedAfter, palette: 'grey' });
  const saved = (await stored(page))!;
  expect(saved.volume).not.toBe(0.6); // DEFAULT_SETTINGS.volume
  expect(saved.volume).toBeGreaterThanOrEqual(0);
  expect(saved.volume).toBeLessThanOrEqual(1);

  await closeSettings(page);
  await gotoGame(page); // fresh navigation = reload
  await openSettings(page);

  await expect(page.getByTestId('settings-volume')).toHaveValue(volumeAfter);
  expect(await isOn(page.getByTestId('settings-mute'))).toBe(mutedAfter);
  await expect(page.getByTestId('settings-palette')).toHaveValue('grey');
  expect(await stored(page)).toMatchObject({ volume: saved.volume, muted: mutedAfter });
});
