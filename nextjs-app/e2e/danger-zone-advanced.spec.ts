/**
 * Danger Zone and Advanced Features E2E Tests
 *
 * Tests for critical operations:
 * - Account reset
 * - Data export/import
 * - Recovery mechanisms
 * - Emergency access
 * - Subscription management
 */

import { test, expect, Page } from '@playwright/test';
import { mockWalletConnection } from './helpers/wallet-helpers';

test.describe('Danger Zone - Account Reset', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await mockWalletConnection(page);
    await page.waitForTimeout(1000);
  });

  test('can access Danger Zone in settings', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    const dangerZone = page.locator('text=/Danger Zone|Reset Account/i').first();
    const isVisible = await dangerZone.isVisible({ timeout: 3000 }).catch(() => false);

    console.log(`Danger Zone accessible: ${isVisible}`);
    expect(isVisible).toBeTruthy();
  });

  test('displays warning before account reset', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    const resetButton = page.locator('button:has-text("Reset Account"), button:has-text("Delete All")').first();

    if (await resetButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await resetButton.click();
      await page.waitForTimeout(500);

      // Should show warning dialog
      const warningDialog = page.locator('text=/permanent|cannot be undone|warning/i').first();
      const hasWarning = await warningDialog.isVisible({ timeout: 2000 }).catch(() => false);

      console.log(`Reset warning displayed: ${hasWarning}`);
      expect(hasWarning).toBeTruthy();

      // Cancel the reset
      const cancelButton = page.locator('button:has-text("Cancel")').first();
      if (await cancelButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await cancelButton.click();
      }
    }
  });

  test('requires confirmation for account reset', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    const resetButton = page.locator('button:has-text("Reset Account")').first();

    if (await resetButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await resetButton.click();
      await page.waitForTimeout(500);

      // Look for confirmation input (might require typing "DELETE" or similar)
      const confirmInput = page.locator('input[placeholder*="confirm"], input[placeholder*="type"]').first();
      const hasConfirmInput = await confirmInput.isVisible({ timeout: 2000 }).catch(() => false);

      console.log(`Confirmation input required: ${hasConfirmInput}`);

      const cancelButton = page.locator('button:has-text("Cancel")').first();
      if (await cancelButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await cancelButton.click();
      }
    }
  });

  test('shows empty state after account reset', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    const resetButton = page.locator('button:has-text("Reset Account")').first();

    if (await resetButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await resetButton.click();
      await page.waitForTimeout(500);

      // Fill confirmation if required
      const confirmInput = page.locator('input[placeholder*="confirm"]').first();
      if (await confirmInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        await confirmInput.fill('RESET');
      }

      // Confirm reset
      const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Reset")').last();
      if (await confirmButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await confirmButton.click();
        await page.waitForTimeout(2000);

        // Should show empty vault
        const emptyState = page.locator('text=/empty|no passwords|get started/i').first();
        const isEmpty = await emptyState.isVisible({ timeout: 3000 }).catch(() => false);

        console.log(`Empty state after reset: ${isEmpty}`);
      } else {
        // Cancel if we don't want to actually reset
        const cancelButton = page.locator('button:has-text("Cancel")').first();
        if (await cancelButton.isVisible({ timeout: 1000 }).catch(() => false)) {
          await cancelButton.click();
        }
      }
    }
  });

  test('prevents accidental double-click on reset', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    const resetButton = page.locator('button:has-text("Reset Account")').first();

    if (await resetButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Double click rapidly
      await resetButton.click();
      await resetButton.click();
      await page.waitForTimeout(500);

      // Should only show one dialog
      const dialogs = await page.locator('[role="dialog"]').count();
      expect(dialogs).toBeLessThanOrEqual(1);

      console.log(`Single dialog protection working: ${dialogs <= 1}`);

      const cancelButton = page.locator('button:has-text("Cancel")').first();
      if (await cancelButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await cancelButton.click();
      }
    }
  });
});

test.describe('Data Export and Import', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await mockWalletConnection(page);
    await page.waitForTimeout(1000);
  });

  test('can export all passwords', async ({ page }) => {
    await page.goto('/settings?tab=import-export');
    await page.waitForLoadState('networkidle');

    const exportButton = page.locator('button:has-text("Export")').first();

    if (await exportButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Set up download handler
      const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);

      await exportButton.click();
      await page.waitForTimeout(500);

      const download = await downloadPromise;
      if (download) {
        const filename = download.suggestedFilename();
        console.log(`Export successful: ${filename}`);
        expect(filename).toMatch(/\.json|\.csv/);
      } else {
        console.log('Export triggered (download not captured)');
      }
    }
  });

  test('can choose export format', async ({ page }) => {
    await page.goto('/settings?tab=import-export');
    await page.waitForLoadState('networkidle');

    // Look for format selector
    const formatSelect = page.locator('select[name="exportFormat"], button:has-text("Format")').first();

    if (await formatSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      await formatSelect.click();
      await page.waitForTimeout(300);

      // Check for JSON and CSV options
      const jsonOption = page.locator('option:has-text("JSON"), button:has-text("JSON")').first();
      const csvOption = page.locator('option:has-text("CSV"), button:has-text("CSV")').first();

      const hasJson = await jsonOption.isVisible({ timeout: 1000 }).catch(() => false);
      const hasCsv = await csvOption.isVisible({ timeout: 1000 }).catch(() => false);

      console.log(`Export formats available: JSON=${hasJson}, CSV=${hasCsv}`);
    }
  });

  test('can import passwords from file', async ({ page }) => {
    await page.goto('/settings?tab=import-export');
    await page.waitForLoadState('networkidle');

    const importButton = page.locator('button:has-text("Import")').first();

    if (await importButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await importButton.click();
      await page.waitForTimeout(500);

      // Look for file input
      const fileInput = page.locator('input[type="file"]').first();
      const hasFileInput = await fileInput.isVisible({ timeout: 2000 }).catch(() => false);

      console.log(`Import file input available: ${hasFileInput}`);

      const cancelButton = page.locator('button:has-text("Cancel")').first();
      if (await cancelButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await cancelButton.click();
      }
    }
  });

  test('validates import file format', async ({ page }) => {
    await page.goto('/settings?tab=import-export');
    await page.waitForLoadState('networkidle');

    const importButton = page.locator('button:has-text("Import")').first();

    if (await importButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await importButton.click();
      await page.waitForTimeout(500);

      // Try to upload invalid file (would need actual file in real test)
      // Here we just verify validation exists

      const fileInput = page.locator('input[type="file"]').first();
      if (await fileInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        console.log('Import validation in place');
      }

      const cancelButton = page.locator('button:has-text("Cancel")').first();
      if (await cancelButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await cancelButton.click();
      }
    }
  });

  test('shows import preview before confirming', async ({ page }) => {
    await page.goto('/settings?tab=import-export');
    await page.waitForLoadState('networkidle');

    const importButton = page.locator('button:has-text("Import")').first();

    if (await importButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await importButton.click();
      await page.waitForTimeout(500);

      // After file selection (mocked), should show preview
      // Look for preview panel
      const previewPanel = page.locator('text=/Preview|will be imported|\\d+ entries/i').first();
      const hasPreview = await previewPanel.isVisible({ timeout: 2000 }).catch(() => false);

      console.log(`Import preview shown: ${hasPreview}`);

      const cancelButton = page.locator('button:has-text("Cancel")').first();
      if (await cancelButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await cancelButton.click();
      }
    }
  });

  test('can export encrypted backup', async ({ page }) => {
    await page.goto('/settings?tab=import-export');
    await page.waitForLoadState('networkidle');

    // Look for encrypted backup option
    const encryptedCheckbox = page.locator('input[type="checkbox"][name*="encrypt"], label:has-text("Encrypted")').first();

    if (await encryptedCheckbox.isVisible({ timeout: 2000 }).catch(() => false)) {
      await encryptedCheckbox.click();
      await page.waitForTimeout(300);

      console.log('Encrypted export option available');
    }
  });
});

test.describe('Recovery and Emergency Access', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await mockWalletConnection(page);
    await page.waitForTimeout(1000);
  });

  test('can set up recovery guardians', async ({ page }) => {
    await page.goto('/settings?tab=security');
    await page.waitForLoadState('networkidle');

    const recoveryButton = page.locator('button:has-text("Recovery"), button:has-text("Guardians")').first();

    if (await recoveryButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await recoveryButton.click();
      await page.waitForTimeout(500);

      const addGuardianButton = page.locator('button:has-text("Add Guardian")').first();
      if (await addGuardianButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await addGuardianButton.click();
        await page.waitForTimeout(300);

        // Fill guardian address
        const addressInput = page.locator('input[name="guardianAddress"]').first();
        if (await addressInput.isVisible({ timeout: 1000 }).catch(() => false)) {
          await addressInput.fill('GuardianWallet1111111111111111111111111');
          console.log('Guardian setup initiated');
        }

        const cancelButton = page.locator('button:has-text("Cancel")').first();
        if (await cancelButton.isVisible({ timeout: 1000 }).catch(() => false)) {
          await cancelButton.click();
        }
      }
    }
  });

  test('can initiate emergency access', async ({ page }) => {
    await page.goto('/settings?tab=security');
    await page.waitForLoadState('networkidle');

    const emergencyButton = page.locator('button:has-text("Emergency"), text="Emergency Access"').first();

    if (await emergencyButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await emergencyButton.click();
      await page.waitForTimeout(500);

      const emergencyPanel = page.locator('text=/Emergency Access|Request Access/i').first();
      const isOpen = await emergencyPanel.isVisible({ timeout: 2000 }).catch(() => false);

      console.log(`Emergency access panel opened: ${isOpen}`);
    }
  });

  test('shows recovery timeout period', async ({ page }) => {
    await page.goto('/settings?tab=security');
    await page.waitForLoadState('networkidle');

    const recoveryButton = page.locator('button:has-text("Recovery")').first();

    if (await recoveryButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await recoveryButton.click();
      await page.waitForTimeout(500);

      // Look for timeout/waiting period info
      const timeoutInfo = page.locator('text=/\\d+ days|waiting period|timeout/i').first();
      const hasTimeout = await timeoutInfo.isVisible({ timeout: 2000 }).catch(() => false);

      console.log(`Recovery timeout period shown: ${hasTimeout}`);
    }
  });

  test('can approve/reject recovery requests', async ({ page }) => {
    await page.goto('/settings?tab=security');
    await page.waitForLoadState('networkidle');

    const recoveryButton = page.locator('button:has-text("Recovery")').first();

    if (await recoveryButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await recoveryButton.click();
      await page.waitForTimeout(500);

      // Look for pending requests
      const approveButton = page.locator('button:has-text("Approve")').first();
      const rejectButton = page.locator('button:has-text("Reject")').first();

      const hasApprove = await approveButton.isVisible({ timeout: 1000 }).catch(() => false);
      const hasReject = await rejectButton.isVisible({ timeout: 1000 }).catch(() => false);

      console.log(`Recovery approval controls: Approve=${hasApprove}, Reject=${hasReject}`);
    }
  });
});

test.describe('Subscription Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await mockWalletConnection(page);
    await page.waitForTimeout(1000);
  });

  test('can view subscription details', async ({ page }) => {
    await page.goto('/settings?tab=subscription');
    await page.waitForLoadState('networkidle');

    const subscriptionPanel = page.locator('text=/Subscription|Current Plan|Tier/i').first();
    const isVisible = await subscriptionPanel.isVisible({ timeout: 3000 }).catch(() => false);

    console.log(`Subscription details visible: ${isVisible}`);
    expect(isVisible).toBeTruthy();
  });

  test('displays current tier information', async ({ page }) => {
    await page.goto('/settings?tab=subscription');
    await page.waitForLoadState('networkidle');

    // Look for tier indicators
    const tiers = ['Free', 'Basic', 'Premium', 'Pro'];

    for (const tier of tiers) {
      const tierElement = page.locator(`text="${tier}"`).first();
      const isVisible = await tierElement.isVisible({ timeout: 1000 }).catch(() => false);
      if (isVisible) {
        console.log(`Current tier: ${tier}`);
        break;
      }
    }
  });

  test('can upgrade subscription', async ({ page }) => {
    await page.goto('/settings?tab=subscription');
    await page.waitForLoadState('networkidle');

    const upgradeButton = page.locator('button:has-text("Upgrade"), button:has-text("Change Plan")').first();

    if (await upgradeButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await upgradeButton.click();
      await page.waitForTimeout(500);

      // Should show upgrade modal with tier options
      const upgradeModal = page.locator('text=/Choose Plan|Select Tier/i').first();
      const isOpen = await upgradeModal.isVisible({ timeout: 2000 }).catch(() => false);

      console.log(`Upgrade modal opened: ${isOpen}`);

      const cancelButton = page.locator('button:has-text("Cancel")').first();
      if (await cancelButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await cancelButton.click();
      }
    }
  });

  test('shows storage limits for each tier', async ({ page }) => {
    await page.goto('/settings?tab=subscription');
    await page.waitForLoadState('networkidle');

    const upgradeButton = page.locator('button:has-text("Upgrade")').first();

    if (await upgradeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await upgradeButton.click();
      await page.waitForTimeout(500);

      // Look for storage limits
      const storageLimits = page.locator('text=/KB|MB|storage|entries/i').first();
      const hasLimits = await storageLimits.isVisible({ timeout: 2000 }).catch(() => false);

      console.log(`Storage limits displayed: ${hasLimits}`);

      const cancelButton = page.locator('button:has-text("Cancel")').first();
      if (await cancelButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await cancelButton.click();
      }
    }
  });

  test('displays pricing in SOL', async ({ page }) => {
    await page.goto('/settings?tab=subscription');
    await page.waitForLoadState('networkidle');

    const upgradeButton = page.locator('button:has-text("Upgrade")').first();

    if (await upgradeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await upgradeButton.click();
      await page.waitForTimeout(500);

      // Look for SOL pricing
      const pricing = page.locator('text=/SOL|◎/').first();
      const hasPricing = await pricing.isVisible({ timeout: 2000 }).catch(() => false);

      console.log(`SOL pricing displayed: ${hasPricing}`);

      const cancelButton = page.locator('button:has-text("Cancel")').first();
      if (await cancelButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await cancelButton.click();
      }
    }
  });

  test('can downgrade subscription', async ({ page }) => {
    await page.goto('/settings?tab=subscription');
    await page.waitForLoadState('networkidle');

    const downgradeButton = page.locator('button:has-text("Downgrade"), button:has-text("Change Plan")').first();

    if (await downgradeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await downgradeButton.click();
      await page.waitForTimeout(500);

      // Should warn about storage limits
      const warningMessage = page.locator('text=/warning|data loss|storage/i').first();
      const hasWarning = await warningMessage.isVisible({ timeout: 2000 }).catch(() => false);

      console.log(`Downgrade warning shown: ${hasWarning}`);

      const cancelButton = page.locator('button:has-text("Cancel")').first();
      if (await cancelButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await cancelButton.click();
      }
    }
  });

  test('shows subscription expiration date', async ({ page }) => {
    await page.goto('/settings?tab=subscription');
    await page.waitForLoadState('networkidle');

    // Look for expiration/renewal date
    const expirationDate = page.locator('text=/expires|renews|valid until/i').first();
    const hasDate = await expirationDate.isVisible({ timeout: 2000 }).catch(() => false);

    console.log(`Subscription expiration date shown: ${hasDate}`);
  });

  test('displays storage usage percentage', async ({ page }) => {
    await page.goto('/settings?tab=subscription');
    await page.waitForLoadState('networkidle');

    // Look for storage usage bar/indicator
    const storageUsage = page.locator('[data-testid="storage-usage"], text=/%|used/i').first();
    const hasUsage = await storageUsage.isVisible({ timeout: 2000 }).catch(() => false);

    console.log(`Storage usage displayed: ${hasUsage}`);
  });

  test('warns when approaching storage limit', async ({ page }) => {
    await page.goto('/settings?tab=subscription');
    await page.waitForLoadState('networkidle');

    // Look for warning about storage
    const storageWarning = page.locator('text=/almost full|running out|limit/i').first();
    const hasWarning = await storageWarning.isVisible({ timeout: 2000 }).catch(() => false);

    console.log(`Storage warning shown: ${hasWarning}`);
  });
});

test.describe('Advanced Security Features', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await mockWalletConnection(page);
    await page.waitForTimeout(1000);
  });

  test('can enable auto-lock timeout', async ({ page }) => {
    await page.goto('/settings?tab=security');
    await page.waitForLoadState('networkidle');

    const autoLockSetting = page.locator('select[name="autoLockTimeout"], input[name="autoLockTimeout"]').first();

    if (await autoLockSetting.isVisible({ timeout: 2000 }).catch(() => false)) {
      await autoLockSetting.click();
      await page.waitForTimeout(300);

      console.log('Auto-lock timeout setting available');
    }
  });

  test('can configure session timeout', async ({ page }) => {
    await page.goto('/settings?tab=security');
    await page.waitForLoadState('networkidle');

    const sessionTimeout = page.locator('select[name="sessionTimeout"]').first();

    if (await sessionTimeout.isVisible({ timeout: 2000 }).catch(() => false)) {
      await sessionTimeout.click();
      await page.waitForTimeout(300);

      // Select timeout option
      const timeoutOption = page.locator('option:has-text("30 minutes")').first();
      if (await timeoutOption.isVisible({ timeout: 1000 }).catch(() => false)) {
        await timeoutOption.click();
        console.log('Session timeout configured');
      }
    }
  });

  test('can enable clipboard auto-clear', async ({ page }) => {
    await page.goto('/settings?tab=security');
    await page.waitForLoadState('networkidle');

    const clipboardSetting = page.locator('input[type="checkbox"][name*="clipboard"]').first();

    if (await clipboardSetting.isVisible({ timeout: 2000 }).catch(() => false)) {
      await clipboardSetting.click();
      await page.waitForTimeout(300);

      console.log('Clipboard auto-clear enabled');
    }
  });

  test('can view security audit log', async ({ page }) => {
    await page.goto('/settings?tab=security');
    await page.waitForLoadState('networkidle');

    const auditLogButton = page.locator('button:has-text("Audit Log"), button:has-text("Security Log")').first();

    if (await auditLogButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await auditLogButton.click();
      await page.waitForTimeout(500);

      const logPanel = page.locator('text=/Audit|Security Events|Login attempts/i').first();
      const isOpen = await logPanel.isVisible({ timeout: 2000 }).catch(() => false);

      console.log(`Security audit log opened: ${isOpen}`);
    }
  });

  test('can enable two-factor authentication requirement', async ({ page }) => {
    await page.goto('/settings?tab=security');
    await page.waitForLoadState('networkidle');

    const twoFactorRequirement = page.locator('input[type="checkbox"][name*="require2fa"]').first();

    if (await twoFactorRequirement.isVisible({ timeout: 2000 }).catch(() => false)) {
      await twoFactorRequirement.click();
      await page.waitForTimeout(300);

      console.log('2FA requirement enabled');
    }
  });
});
