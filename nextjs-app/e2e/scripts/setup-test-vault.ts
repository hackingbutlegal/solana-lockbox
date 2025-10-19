/**
 * Test Vault Setup Script
 *
 * This script manually initializes a vault for the test wallet.
 * Run this before executing CRUD tests to ensure a vault exists.
 *
 * Usage:
 *   npx tsx e2e/scripts/setup-test-vault.ts
 */

import { chromium, Browser, Page } from '@playwright/test';
import { mockWalletConnection } from '../helpers/wallet-helpers';

async function setupTestVault() {
  console.log('🚀 Starting test vault setup...\n');

  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    // Launch browser
    console.log('1️⃣ Launching browser...');
    browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    page = await context.newPage();

    // Inject mock wallet BEFORE navigation
    console.log('2️⃣ Injecting mock wallet...');
    await mockWalletConnection(page);

    // Navigate to app
    console.log('3️⃣ Navigating to app...');
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Verify mock wallet was injected
    const hasMockWallet = await page.evaluate(() => {
      return !!(window as any).solana?.isPhantom;
    });

    if (!hasMockWallet) {
      throw new Error('Mock wallet was not injected properly!');
    }
    console.log('   ✅ Mock wallet injected successfully');

    // Click "Select Wallet" button
    console.log('4️⃣ Connecting wallet...');
    const selectWalletButton = page.locator('.wallet-adapter-button-trigger, button:has-text("Select Wallet")').first();

    if (await selectWalletButton.isVisible({ timeout: 3000 })) {
      await selectWalletButton.click();
      await page.waitForTimeout(500);
      console.log('   ✅ Clicked "Select Wallet" button');

      // Click wallet option in modal
      const walletOption = page.locator('button:has-text("Phantom"), button:has-text("Solflare"), [role="dialog"] button').first();
      if (await walletOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await walletOption.click();
        await page.waitForTimeout(2000);
        console.log('   ✅ Selected wallet from modal');
      }
    }

    // Check if we're now in the password manager or need to initialize
    await page.waitForTimeout(2000);

    const hasPasswordManager = await page.locator('.pm-container, .password-manager, .new-password-button')
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (hasPasswordManager) {
      console.log('5️⃣ Vault already initialized!');
      console.log('   ✅ Password manager is visible');
      console.log('\n✨ Test vault setup complete!\n');
      return true;
    }

    // Look for initialization button
    console.log('5️⃣ Initializing vault...');
    const initButton = page.locator(
      'button:has-text("Initialize Vault"), ' +
      'button:has-text("Create Vault"), ' +
      'button:has-text("Get Started"), ' +
      'button:has-text("Initialize Master Lockbox"), ' +
      'button:has-text("Initialize")'
    ).first();

    if (await initButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('   Found initialization button, clicking...');
      await initButton.click();
      await page.waitForTimeout(3000);

      // Wait for transaction to process
      console.log('   Waiting for blockchain transaction...');
      await page.waitForTimeout(5000);

      // Verify vault was initialized
      const vaultInitialized = await page.locator('.pm-container, .password-manager, .new-password-button')
        .isVisible({ timeout: 10000 })
        .catch(() => false);

      if (vaultInitialized) {
        console.log('   ✅ Vault successfully initialized!');
        console.log('\n✨ Test vault setup complete!\n');
        return true;
      } else {
        console.error('   ❌ Vault initialization may have failed');
        console.log('\n📸 Taking screenshot for debugging...');
        await page.screenshot({ path: 'e2e/test-results/vault-init-failed.png', fullPage: true });
        return false;
      }
    } else {
      console.error('   ❌ Could not find initialization button');
      console.log('\n📸 Taking screenshot for debugging...');
      await page.screenshot({ path: 'e2e/test-results/no-init-button.png', fullPage: true });
      return false;
    }

  } catch (error) {
    console.error('\n❌ Error during vault setup:', error);
    if (page) {
      await page.screenshot({ path: 'e2e/test-results/vault-setup-error.png', fullPage: true });
    }
    return false;
  } finally {
    if (browser) {
      console.log('\n6️⃣ Keeping browser open for 10 seconds so you can inspect...');
      await page?.waitForTimeout(10000);
      await browser.close();
    }
  }
}

// Run the setup
setupTestVault().then(success => {
  if (success) {
    console.log('✅ SUCCESS: Test vault is ready for CRUD tests');
    process.exit(0);
  } else {
    console.log('❌ FAILED: Could not set up test vault');
    console.log('   Check screenshots in e2e/test-results/ for debugging');
    process.exit(1);
  }
}).catch(error => {
  console.error('❌ FATAL ERROR:', error);
  process.exit(1);
});
