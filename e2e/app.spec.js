import { test, expect } from '@playwright/test';

test.describe('RPM Inventory App', () => {
  test('loads the login page successfully', async ({ page }) => {
    await page.goto('/');
    
    // Verify the title is correct
    await expect(page).toHaveTitle(/RPM Stock/);
    
    // Verify that the login section is visible.
    // The app shows "Inventory Management System" on the login screen
    const heading = page.locator('p', { hasText: 'Inventory Management System' });
    await expect(heading).toBeVisible();

    // Verify the Microsoft Login button is present
    const loginButton = page.locator('button', { hasText: /Login with Microsoft/i });
    await expect(loginButton).toBeVisible();
  });
});
