/**
 * Initialize Test Vault Helper
 *
 * Creates and initializes a vault for the mock wallet before running tests.
 * This ensures all CRUD tests have a properly initialized vault to work with.
 */

import { Page } from '@playwright/test';

/**
 * Initialize a vault for the test wallet
 * This should be called after wallet connection in tests that need an initialized vault
 */
export async function initializeTestVault(page: Page): Promise<boolean> {
  console.log('[VAULT INIT] Starting vault initialization...');

  try {
    // Check if vault is already initialized by looking for the password manager UI
    const hasPasswordManager = await page.locator('.pm-container, .password-manager, .new-password-button')
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    if (hasPasswordManager) {
      console.log('[VAULT INIT] ✅ Vault already initialized - password manager visible');
      return true;
    }

    // Check if we're on the landing page
    const onLandingPage = await page.locator('text=/world.*first blockchain.*password manager/i')
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    if (onLandingPage) {
      console.log('[VAULT INIT] On landing page - wallet not connected yet');
      return false;
    }

    // Look for vault initialization UI
    const initButton = page.locator(
      'button:has-text("Initialize Vault"), ' +
      'button:has-text("Create Vault"), ' +
      'button:has-text("Get Started"), ' +
      'button:has-text("Initialize")'
    ).first();

    if (await initButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('[VAULT INIT] Found initialization button, clicking...');
      await initButton.click();
      await page.waitForTimeout(2000);

      // Wait for transaction confirmation
      await page.waitForTimeout(3000);

      // Verify vault was initialized
      const vaultInitialized = await page.locator('.pm-container, .password-manager, .new-password-button')
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (vaultInitialized) {
        console.log('[VAULT INIT] ✅ Vault successfully initialized');
        return true;
      } else {
        console.log('[VAULT INIT] ⚠️ Vault initialization may have failed - password manager not visible');
        return false;
      }
    }

    // If we get here, check if we're already in the password manager
    const inPasswordManager = await page.locator('.pm-container, .password-manager')
      .isVisible({ timeout: 1000 })
      .catch(() => false);

    if (inPasswordManager) {
      console.log('[VAULT INIT] ✅ Already in password manager');
      return true;
    }

    console.log('[VAULT INIT] ⚠️ Could not find initialization button or password manager');
    return false;

  } catch (error) {
    console.error('[VAULT INIT] ❌ Error during vault initialization:', error);
    return false;
  }
}

/**
 * Check if vault is initialized
 */
export async function isVaultInitialized(page: Page): Promise<boolean> {
  const hasPasswordManager = await page.locator('.pm-container, .password-manager, .new-password-button')
    .isVisible({ timeout: 2000 })
    .catch(() => false);

  const hasVaultData = await page.evaluate(() => {
    // Check if there's any indication of vault data in the page
    const body = document.body.textContent || '';
    return body.includes('Free') || body.includes('Premium') || body.includes('Storage');
  }).catch(() => false);

  return hasPasswordManager && hasVaultData;
}

/**
 * Wait for vault to be ready (initialized and loaded)
 */
export async function waitForVaultReady(page: Page, timeout: number = 10000): Promise<boolean> {
  console.log('[VAULT INIT] Waiting for vault to be ready...');

  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const isReady = await isVaultInitialized(page);

    if (isReady) {
      console.log('[VAULT INIT] ✅ Vault is ready');
      return true;
    }

    await page.waitForTimeout(500);
  }

  console.log('[VAULT INIT] ⚠️ Timeout waiting for vault to be ready');
  return false;
}

/**
 * Reset vault for testing (navigate back to landing and reconnect)
 */
export async function resetTestVault(page: Page): Promise<void> {
  console.log('[VAULT INIT] Resetting test vault...');

  // Disconnect wallet if connected
  const disconnectButton = page.locator('button:has-text("Disconnect")').first();
  if (await disconnectButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await disconnectButton.click();
    await page.waitForTimeout(1000);
  }

  // Navigate to home
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  console.log('[VAULT INIT] ✅ Vault reset complete');
}
