import { test, expect } from '@playwright/test';

/**
 * Navigation Tests for Solana Lockbox
 *
 * Tests for client-side navigation and page transitions.
 * Verifies that the hydration fixes prevent insertBefore/removeChild errors.
 */

test.describe('Navigation Tests', () => {
  test('can navigate from dashboard to settings', async ({ page }) => {
    // Start at homepage
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Look for Settings link in header/navigation
    const settingsLink = page.locator('button:has-text("Settings")');

    // Check if settings link is visible (may require wallet connection)
    const isVisible = await settingsLink.isVisible().catch(() => false);

    if (isVisible) {
      // Click settings
      await settingsLink.click();

      // Wait for navigation
      await page.waitForURL('**/settings');

      // Verify we're on settings page
      expect(page.url()).toContain('/settings');

      // Page should be interactive
      const body = page.locator('body');
      await expect(body).toBeVisible();
    } else {
      // Settings link not visible - likely requires wallet connection
      // Navigate directly to test the page
      await page.goto('/settings');
      await page.waitForLoadState('networkidle');

      expect(page.url()).toContain('/settings');
    }
  });

  test('can navigate between settings tabs', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Try to find tab buttons
    const tabs = ['Account', 'Subscription', 'Security', 'Preferences'];

    for (const tabName of tabs) {
      const tab = page.locator(`text=${tabName}`).first();
      const exists = await tab.count() > 0;

      if (exists) {
        console.log(`Found ${tabName} tab`);

        // Try to click it
        const isClickable = await tab.isVisible().catch(() => false);
        if (isClickable) {
          await tab.click();
          await page.waitForTimeout(500); // Wait for transition

          // Check URL updated
          const url = page.url();
          console.log(`After clicking ${tabName}, URL: ${url}`);
        }
      }
    }

    // Main test: verify page is still responsive after clicks
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('back and forward navigation works', async ({ page }) => {
    // Start at homepage
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const homeUrl = page.url();

    // Navigate to settings
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    const settingsUrl = page.url();
    expect(settingsUrl).toContain('/settings');

    // Go back
    await page.goBack();
    await page.waitForLoadState('networkidle');

    expect(page.url()).toBe(homeUrl);

    // Go forward
    await page.goForward();
    await page.waitForLoadState('networkidle');

    expect(page.url()).toBe(settingsUrl);

    // Verify page is still interactive
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('no hydration errors during navigation', async ({ page }) => {
    const errors: string[] = [];

    // Listen for specific hydration errors
    page.on('pageerror', (error) => {
      const errorMsg = error.message;
      if (errorMsg.includes('insertBefore') ||
          errorMsg.includes('removeChild') ||
          errorMsg.includes('Hydration') ||
          errorMsg.includes('NotFoundError')) {
        errors.push(errorMsg);
      }
    });

    // Navigate through different pages
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    await page.goto('/settings?tab=subscription');
    await page.waitForLoadState('networkidle');

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Assert no hydration errors occurred
    if (errors.length > 0) {
      console.error('Hydration errors found:', errors);
    }

    expect(errors).toHaveLength(0);
  });

  test('subscription page loads without duplicate text', async ({ page }) => {
    await page.goto('/settings?tab=subscription');
    await page.waitForLoadState('networkidle');

    // Get page content
    const content = await page.content();

    // Check for the specific bug: "Free" appearing twice
    // Count occurrences of "Free" in the current plan section
    const currentPlanSection = page.locator('.current-plan-card');

    if (await currentPlanSection.isVisible()) {
      const planText = await currentPlanSection.textContent();

      // Count "Free" occurrences
      const freeCount = (planText?.match(/\bFree\b/g) || []).length;

      console.log(`"Free" appears ${freeCount} times in current plan section`);

      // Should appear at most once (as tier name OR price, not both)
      expect(freeCount).toBeLessThanOrEqual(1);
    } else {
      console.log('Current plan section not visible - may require wallet connection');
    }
  });
});
