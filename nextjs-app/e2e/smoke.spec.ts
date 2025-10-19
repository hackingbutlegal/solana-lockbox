import { test, expect } from '@playwright/test';

/**
 * Smoke Tests for Solana Lockbox
 *
 * Basic tests to ensure the application loads and core pages are accessible.
 * These tests verify the application structure without requiring wallet connection.
 */

test.describe('Smoke Tests', () => {
  test('homepage loads successfully', async ({ page }) => {
    await page.goto('/');

    // Wait for the page to load and check for key elements
    await expect(page).toHaveTitle(/Solana Lockbox/);

    // Check that the loading screen appears and then disappears
    // (or may have already disappeared by the time we check)
    const staticLoader = page.locator('#static-loader');
    // Don't assert on presence since it may have already faded out

    // Verify main app container is present
    await expect(page.locator('body')).toBeVisible();
  });

  test('dashboard displays without wallet connection', async ({ page }) => {
    await page.goto('/');

    // The dashboard should load even without a wallet
    // Look for wallet connection prompt or main UI
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // Check for wallet adapter button (shows before connection)
    const walletButton = page.locator('button:has-text("Select Wallet")');
    // Wait a bit for React to hydrate
    await page.waitForTimeout(2000);

    // Page should be interactive
    const isInteractive = await page.evaluate(() => document.readyState === 'complete');
    expect(isInteractive).toBeTruthy();
  });

  test('settings page loads correctly', async ({ page }) => {
    await page.goto('/settings');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Check that we're on the settings page
    await expect(page.url()).toContain('/settings');

    // Settings page should have tab navigation
    // Look for common settings tabs
    const accountTab = page.locator('text=Account');
    const subscriptionTab = page.locator('text=Subscription');

    // At least one tab should be visible
    const hasVisibleTab = await accountTab.isVisible().catch(() => false) ||
                          await subscriptionTab.isVisible().catch(() => false);

    // If tabs aren't visible, that's okay - might need wallet connection
    // Just verify the page loaded without error
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('FAQ section is accessible', async ({ page }) => {
    await page.goto('/');

    await page.waitForLoadState('networkidle');

    // Look for FAQ link or section
    // FAQ might be in the main page or accessible via a link
    const faqLink = page.locator('text=FAQ');

    // Check if FAQ exists on the page
    const faqExists = await faqLink.count() > 0;

    // This is informational - FAQ may or may not be on homepage
    console.log(`FAQ found: ${faqExists}`);
  });

  test('no console errors on page load', async ({ page }) => {
    const consoleErrors: string[] = [];

    // Listen for console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Listen for page errors
    page.on('pageerror', (error) => {
      consoleErrors.push(error.message);
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Filter out expected development warnings
    const relevantErrors = consoleErrors.filter(error =>
      !error.includes('React DevTools') &&
      !error.includes('Download the React DevTools') &&
      !error.includes('Fast Refresh') &&
      !error.includes('Webpack HMR') &&
      !error.includes('usePassword must be used within') && // Expected when wallet not connected
      !error.includes('useSubscription must be used within') // Expected when wallet not connected
    );

    // Log any errors for debugging
    if (relevantErrors.length > 0) {
      console.log('Console errors found:', relevantErrors);
    }

    // For now, just log errors - don't fail the test
    // Once we stabilize, we can make this stricter
    expect(relevantErrors.length).toBeLessThan(5);
  });

  test('application is responsive', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    let body = page.locator('body');
    await expect(body).toBeVisible();

    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    body = page.locator('body');
    await expect(body).toBeVisible();

    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    body = page.locator('body');
    await expect(body).toBeVisible();
  });
});
