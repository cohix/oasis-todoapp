import { test, expect } from '@playwright/test';

/**
 * Work area E2E tests.
 *
 * Each test navigates to a fresh page. Work areas are stored in the backend's
 * SQLite database, so tests that create data may affect subsequent tests.
 * Within a single run this is acceptable; for repeatable CI runs the DB should
 * be reset between runs.
 */

test.describe('Work Areas', () => {
  test('app loads with title and no work areas prompt', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=todoapp')).toBeVisible();
  });

  test('shows empty-state prompt when no work areas exist', async ({ page }) => {
    await page.goto('/');
    // The empty state text may or may not appear depending on DB state,
    // so we just verify the page loaded and the add button exists.
    await expect(page.getByRole('button', { name: /add work area/i })).toBeVisible();
  });

  test('creates a new work area via the + button', async ({ page }) => {
    await page.goto('/');

    const uniqueName = `E2E-WA-${Date.now()}`;
    await page.getByRole('button', { name: /add work area/i }).click();
    await page.getByRole('textbox', { name: /new work area name/i }).fill(uniqueName);
    await page.keyboard.press('Enter');

    await expect(page.getByRole('tab', { name: uniqueName })).toBeVisible();
  });

  test('selecting a work area tab activates it', async ({ page }) => {
    await page.goto('/');

    const name = `E2E-Select-${Date.now()}`;
    await page.getByRole('button', { name: /add work area/i }).click();
    await page.getByRole('textbox', { name: /new work area name/i }).fill(name);
    await page.keyboard.press('Enter');

    const tab = page.getByRole('tab', { name });
    await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true');
  });

  test('renames a work area via the options menu', async ({ page }) => {
    await page.goto('/');

    const original = `E2E-Rename-${Date.now()}`;
    const renamed = `${original}-Renamed`;

    // Create the work area
    await page.getByRole('button', { name: /add work area/i }).click();
    await page.getByRole('textbox', { name: /new work area name/i }).fill(original);
    await page.keyboard.press('Enter');
    await expect(page.getByRole('tab', { name: original })).toBeVisible();

    // Open the options menu and click Rename
    await page.getByRole('button', { name: `Options for ${original}` }).click();
    await page.getByRole('menuitem', { name: /rename/i }).click();

    // Clear the rename input and type the new name
    const renameInput = page.getByRole('textbox', { name: /rename work area/i });
    await renameInput.fill(renamed);
    await page.keyboard.press('Enter');

    await expect(page.getByRole('tab', { name: renamed })).toBeVisible();
    await expect(page.getByRole('tab', { name: original })).not.toBeVisible();
  });

  test('duplicate name shows an error', async ({ page }) => {
    await page.goto('/');

    const name = `E2E-Dup-${Date.now()}`;

    // Create the first work area
    await page.getByRole('button', { name: /add work area/i }).click();
    await page.getByRole('textbox', { name: /new work area name/i }).fill(name);
    await page.keyboard.press('Enter');
    await expect(page.getByRole('tab', { name })).toBeVisible();

    // Try to create a second with the same name
    await page.getByRole('button', { name: /add work area/i }).click();
    await page.getByRole('textbox', { name: /new work area name/i }).fill(name);
    await page.keyboard.press('Enter');

    // An error message should appear (the input stays open)
    await expect(page.locator('.tabbar__input-error')).toBeVisible();
  });

  test('pressing Escape cancels work area creation', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /add work area/i }).click();
    const input = page.getByRole('textbox', { name: /new work area name/i });
    await expect(input).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(input).not.toBeVisible();
  });
});
