import { test, expect } from '@playwright/test';

/**
 * Bundle E2E tests.
 *
 * Bundle creation is triggered by dragging one todo onto another. Playwright
 * supports simulating drag-and-drop via the HTML5 drag events API.
 */

async function createWorkArea(page: any, name: string) {
  await page.getByRole('button', { name: /add work area/i }).click();
  await page.getByRole('textbox', { name: /new work area name/i }).fill(name);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('tab', { name })).toBeVisible();
  await page.getByRole('tab', { name }).click();
}

async function createTodo(page: any, title: string) {
  const input = page.getByRole('textbox', { name: /new todo/i });
  await input.fill(title);
  await page.keyboard.press('Enter');
  await expect(page.locator(`text=${title}`)).toBeVisible();
}

/**
 * Simulate an HTML5 drag-and-drop between two elements using JavaScript.
 * Playwright's dragTo() uses mouse events; we dispatch the HTML5 DragEvent API
 * manually to match how the app's event handlers are wired.
 */
async function dragOnto(page: any, sourceSelector: string, targetSelector: string) {
  await page.evaluate(({ src, tgt }: { src: string; tgt: string }) => {
    const source = document.querySelector(src) as HTMLElement;
    const target = document.querySelector(tgt) as HTMLElement;
    if (!source || !target) throw new Error(`Elements not found: ${src} → ${tgt}`);

    const dataTransfer = new DataTransfer();
    source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer }));
    target.dispatchEvent(new DragEvent('dragover', { bubbles: true, dataTransfer, cancelable: true }));
    target.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer }));
    source.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer }));
  }, { src: sourceSelector, tgt: targetSelector });
}

test.describe('Bundles', () => {
  test('dragging one todo onto another creates a bundle', async ({ page }) => {
    await page.goto('/');
    const waName = `E2E-Bundle-Create-${Date.now()}`;
    await createWorkArea(page, waName);
    await createTodo(page, 'Bundle todo A');
    await createTodo(page, 'Bundle todo B');

    // Drag A onto B
    await dragOnto(
      page,
      '.todo-item:first-of-type',
      '.todo-item:last-of-type',
    );

    // A bundle section should now be visible
    await expect(page.locator('section.bundle')).toBeVisible();
    await expect(page.locator('text=Bundle todo A')).toBeVisible();
    await expect(page.locator('text=Bundle todo B')).toBeVisible();
  });

  test('bundle can be renamed', async ({ page }) => {
    await page.goto('/');
    const waName = `E2E-Bundle-Rename-${Date.now()}`;
    await createWorkArea(page, waName);
    await createTodo(page, 'Rename A');
    await createTodo(page, 'Rename B');

    await dragOnto(page, '.todo-item:first-of-type', '.todo-item:last-of-type');
    await expect(page.locator('section.bundle')).toBeVisible();

    // The bundle starts with an empty name input; type a name and confirm
    const bundleInput = page.getByRole('textbox', { name: /bundle name/i });
    await bundleInput.fill('My Bundle');
    await page.keyboard.press('Enter');

    await expect(page.locator('text=My Bundle')).toBeVisible();
  });

  test('deleting the last todo in a bundle removes the bundle', async ({ page }) => {
    await page.goto('/');
    const waName = `E2E-Bundle-AutoDel-${Date.now()}`;
    await createWorkArea(page, waName);
    await createTodo(page, 'Solo A');
    await createTodo(page, 'Solo B');

    await dragOnto(page, '.todo-item:first-of-type', '.todo-item:last-of-type');
    await expect(page.locator('section.bundle')).toBeVisible();

    // Delete both todos — bundle should disappear after the second deletion
    const deleteButtons = page.getByRole('button', { name: /delete todo/i });
    await deleteButtons.first().click();
    await deleteButtons.first().click();

    await expect(page.locator('section.bundle')).not.toBeVisible();
  });
});
