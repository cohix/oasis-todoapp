import { test, expect } from '@playwright/test';

/**
 * Todo E2E tests.
 * Each test creates its own work area to avoid cross-test data dependencies.
 */

async function createWorkArea(page: any, name: string) {
  await page.getByRole('button', { name: /add work area/i }).click();
  await page.getByRole('textbox', { name: /new work area name/i }).fill(name);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('tab', { name })).toBeVisible();
  await page.getByRole('tab', { name }).click();
}

test.describe('Todos', () => {
  test('shows empty state when a work area has no todos', async ({ page }) => {
    await page.goto('/');
    const waName = `E2E-Empty-${Date.now()}`;
    await createWorkArea(page, waName);
    await expect(page.locator('text=No todos yet')).toBeVisible();
  });

  test('creates a todo by pressing Enter in the input', async ({ page }) => {
    await page.goto('/');
    const waName = `E2E-Create-${Date.now()}`;
    await createWorkArea(page, waName);

    await page.getByRole('textbox', { name: /new todo/i }).fill('Buy milk');
    await page.keyboard.press('Enter');

    await expect(page.locator('text=Buy milk')).toBeVisible();
  });

  test('clears the todo input after creation', async ({ page }) => {
    await page.goto('/');
    const waName = `E2E-Clear-${Date.now()}`;
    await createWorkArea(page, waName);

    const input = page.getByRole('textbox', { name: /new todo/i });
    await input.fill('Temporary task');
    await page.keyboard.press('Enter');

    await expect(input).toHaveValue('');
  });

  test('created todo has status "To Do"', async ({ page }) => {
    await page.goto('/');
    const waName = `E2E-Status-${Date.now()}`;
    await createWorkArea(page, waName);

    await page.getByRole('textbox', { name: /new todo/i }).fill('Status check');
    await page.keyboard.press('Enter');
    await expect(page.locator('text=Status check')).toBeVisible();

    await expect(page.getByLabel('Status: To Do')).toBeVisible();
  });

  test('transitions todo from "To Do" to "In Progress"', async ({ page }) => {
    await page.goto('/');
    const waName = `E2E-InProgress-${Date.now()}`;
    await createWorkArea(page, waName);

    await page.getByRole('textbox', { name: /new todo/i }).fill('In progress task');
    await page.keyboard.press('Enter');
    await expect(page.locator('text=In progress task')).toBeVisible();

    await page.getByRole('button', { name: /mark as in progress/i }).click();

    await expect(page.getByLabel('Status: In Progress')).toBeVisible();
  });

  test('transitions todo from "To Do" to "Done"', async ({ page }) => {
    await page.goto('/');
    const waName = `E2E-Done-${Date.now()}`;
    await createWorkArea(page, waName);

    await page.getByRole('textbox', { name: /new todo/i }).fill('Done task');
    await page.keyboard.press('Enter');
    await expect(page.locator('text=Done task')).toBeVisible();

    await page.getByRole('button', { name: /mark as done/i }).click();

    await expect(page.getByLabel('Status: Done')).toBeVisible();
  });

  test('deletes a todo', async ({ page }) => {
    await page.goto('/');
    const waName = `E2E-Delete-${Date.now()}`;
    await createWorkArea(page, waName);

    await page.getByRole('textbox', { name: /new todo/i }).fill('Delete me');
    await page.keyboard.press('Enter');
    await expect(page.locator('text=Delete me')).toBeVisible();

    await page.getByRole('button', { name: /delete todo/i }).click();

    await expect(page.locator('text=Delete me')).not.toBeVisible();
  });

  test('multiple todos are shown in the same work area', async ({ page }) => {
    await page.goto('/');
    const waName = `E2E-Multi-${Date.now()}`;
    await createWorkArea(page, waName);

    const input = page.getByRole('textbox', { name: /new todo/i });
    await input.fill('Task Alpha');
    await page.keyboard.press('Enter');
    await expect(page.locator('text=Task Alpha')).toBeVisible();

    await input.fill('Task Beta');
    await page.keyboard.press('Enter');
    await expect(page.locator('text=Task Beta')).toBeVisible();

    await expect(page.locator('text=Task Alpha')).toBeVisible();
  });

  test('todos are isolated between work areas', async ({ page }) => {
    await page.goto('/');
    const ts = Date.now();
    const wa1 = `E2E-ISO1-${ts}`;
    const wa2 = `E2E-ISO2-${ts}`;

    // Create todo in wa1
    await createWorkArea(page, wa1);
    await page.getByRole('textbox', { name: /new todo/i }).fill('WA1 task');
    await page.keyboard.press('Enter');
    await expect(page.locator('text=WA1 task')).toBeVisible();

    // Create todo in wa2 — should not see WA1 task
    await createWorkArea(page, wa2);
    await page.getByRole('textbox', { name: /new todo/i }).fill('WA2 task');
    await page.keyboard.press('Enter');
    await expect(page.locator('text=WA2 task')).toBeVisible();
    await expect(page.locator('text=WA1 task')).not.toBeVisible();

    // Switch back to wa1 — should see WA1 task not WA2 task
    await page.getByRole('tab', { name: wa1 }).click();
    await expect(page.locator('text=WA1 task')).toBeVisible();
    await expect(page.locator('text=WA2 task')).not.toBeVisible();
  });

  test('data persists after page reload', async ({ page }) => {
    await page.goto('/');
    const waName = `E2E-Persist-${Date.now()}`;
    await createWorkArea(page, waName);

    await page.getByRole('textbox', { name: /new todo/i }).fill('Persisted task');
    await page.keyboard.press('Enter');
    await expect(page.locator('text=Persisted task')).toBeVisible();

    // Reload and verify the data is still there
    await page.reload();
    await page.getByRole('tab', { name: waName }).click();
    await expect(page.locator('text=Persisted task')).toBeVisible();
  });
});
