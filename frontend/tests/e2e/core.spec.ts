import { test, expect } from '@playwright/test';

test.describe('SpeechFlow Core E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load the main application and display sidebar', async ({ page }) => {
    // Verify the main UI components
    await expect(page.getByTestId('app-title')).toBeVisible();
    await expect(page.getByTestId('sidebar-tabs')).toBeVisible();
    await expect(page.getByTestId('editor-pane')).toBeVisible();
  });

  test('should have recording and upload buttons', async ({ page }) => {
    await expect(page.getByTestId('start-recording-button')).toBeVisible();
    await expect(page.getByTestId('upload-button')).toBeVisible();
  });

  test('should open settings dialog', async ({ page }) => {
    await page.getByTestId('settings-button').click();
    await expect(page.getByTestId('settings-dialog')).toBeVisible();
    // Close it
    await page.getByRole('button', { name: /close/i }).click();
  });
  
  test('can interact with the dictionary tab', async ({ page }) => {
    await page.getByTestId('dictionary-tab').click();
    await expect(page.getByTestId('dictionary-input')).toBeVisible();
    await expect(page.getByTestId('add-word-button')).toBeVisible();
  });
});
