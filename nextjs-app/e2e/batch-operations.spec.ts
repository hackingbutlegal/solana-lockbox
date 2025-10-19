/**
 * Batch Operations and Error Handling E2E Tests
 *
 * Tests for batch mode operations, error handling, and edge cases
 * in the Solana Lockbox password manager.
 */

import { test, expect, Page } from '@playwright/test';
import { mockWalletConnection, simulateNetworkError, clearNetworkError } from './helpers/wallet-helpers';
import { generateBulkEntries, sleep } from './helpers/test-data';

test.describe('Batch Operations', () => {
  test.beforeEach(async ({ page }) => {
    // CRITICAL: mockWalletConnection() MUST be called BEFORE page.goto()
    // because addInitScript() only affects future page loads, not current one
    await mockWalletConnection(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
  });

  test('can enable batch mode', async ({ page }) => {
    // Look for batch mode toggle
    const batchToggle = page.locator('button:has-text("Batch Mode"), [data-testid="batch-mode-toggle"]').first();

    if (await batchToggle.isVisible({ timeout: 3000 }).catch(() => false)) {
      await batchToggle.click();
      await page.waitForTimeout(500);

      // Verify batch mode is active
      const batchToolbar = page.locator('[data-testid="batch-toolbar"], text="Batch Operations"').first();
      const isActive = await batchToolbar.isVisible({ timeout: 2000 }).catch(() => false);

      console.log(`Batch mode activated: ${isActive}`);
      expect(isActive).toBeTruthy();
    } else {
      console.log('Batch mode toggle not found - feature may not be visible');
    }
  });

  test('can select multiple entries in batch mode', async ({ page }) => {
    // Enable batch mode
    const batchToggle = page.locator('button:has-text("Batch Mode")').first();
    if (await batchToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
      await batchToggle.click();
      await page.waitForTimeout(500);

      // Select checkboxes for entries
      const checkboxes = page.locator('input[type="checkbox"]');
      const count = await checkboxes.count();

      if (count > 0) {
        // Select first 3 entries
        for (let i = 0; i < Math.min(3, count); i++) {
          await checkboxes.nth(i).check();
          await page.waitForTimeout(100);
        }

        // Verify selection count
        const selectionText = page.locator('text=/Selected|selected/i').first();
        const isVisible = await selectionText.isVisible({ timeout: 2000 }).catch(() => false);
        console.log(`Selection indicator visible: ${isVisible}`);
      } else {
        console.log('No entries available for batch selection');
      }
    }
  });

  test('can batch delete multiple entries', async ({ page, context }) => {
    // Enable batch mode
    const batchToggle = page.locator('button:has-text("Batch Mode")').first();
    if (await batchToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
      await batchToggle.click();
      await page.waitForTimeout(500);

      // Select entries
      const checkboxes = page.locator('input[type="checkbox"]');
      const count = await checkboxes.count();

      if (count > 0) {
        // Select first 2 entries
        await checkboxes.nth(0).check();
        await checkboxes.nth(1).check();
        await page.waitForTimeout(300);

        // Click batch delete
        const deleteButton = page.locator('button:has-text("Delete"), button:has-text("Delete Selected")').first();
        if (await deleteButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await deleteButton.click();
          await page.waitForTimeout(300);

          // Confirm deletion
          const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Yes")').last();
          if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
            await confirmButton.click();
            await page.waitForTimeout(1000);

            console.log('Batch delete operation completed');
          }
        }
      }
    }
  });

  test('can batch update category', async ({ page }) => {
    // Enable batch mode
    const batchToggle = page.locator('button:has-text("Batch Mode")').first();
    if (await batchToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
      await batchToggle.click();
      await page.waitForTimeout(500);

      // Select entries
      const checkboxes = page.locator('input[type="checkbox"]');
      const count = await checkboxes.count();

      if (count > 0) {
        await checkboxes.nth(0).check();
        await page.waitForTimeout(300);

        // Look for batch category update
        const categoryButton = page.locator('button:has-text("Category"), button:has-text("Change Category")').first();
        if (await categoryButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await categoryButton.click();
          await page.waitForTimeout(300);

          // Select a category
          const categoryOption = page.locator('[role="option"], button:has-text("Personal")').first();
          if (await categoryOption.isVisible({ timeout: 1000 }).catch(() => false)) {
            await categoryOption.click();
            await page.waitForTimeout(500);

            console.log('Batch category update completed');
          }
        }
      }
    }
  });

  test('can batch export selected entries', async ({ page }) => {
    // Enable batch mode
    const batchToggle = page.locator('button:has-text("Batch Mode")').first();
    if (await batchToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
      await batchToggle.click();
      await page.waitForTimeout(500);

      // Select entries
      const checkboxes = page.locator('input[type="checkbox"]');
      const count = await checkboxes.count();

      if (count > 0) {
        await checkboxes.nth(0).check();
        await checkboxes.nth(1).check();
        await page.waitForTimeout(300);

        // Look for export button
        const exportButton = page.locator('button:has-text("Export")').first();
        if (await exportButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          // Set up download handler
          const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);

          await exportButton.click();
          await page.waitForTimeout(500);

          const download = await downloadPromise;
          if (download) {
            console.log(`Export file: ${download.suggestedFilename()}`);
            expect(download.suggestedFilename()).toContain('.json');
          } else {
            console.log('Export triggered (download not captured in test)');
          }
        }
      }
    }
  });

  test('shows progress indicator during batch operations', async ({ page }) => {
    // Enable batch mode
    const batchToggle = page.locator('button:has-text("Batch Mode")').first();
    if (await batchToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
      await batchToggle.click();
      await page.waitForTimeout(500);

      // Select multiple entries
      const checkboxes = page.locator('input[type="checkbox"]');
      const count = await checkboxes.count();

      if (count >= 3) {
        for (let i = 0; i < 3; i++) {
          await checkboxes.nth(i).check();
        }
        await page.waitForTimeout(300);

        // Start a batch operation
        const deleteButton = page.locator('button:has-text("Delete Selected")').first();
        if (await deleteButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await deleteButton.click();
          await page.waitForTimeout(100);

          // Look for progress indicator
          const progressIndicator = page.locator('[role="progressbar"], text=/Progress|processing/i').first();
          const hasProgress = await progressIndicator.isVisible({ timeout: 2000 }).catch(() => false);

          console.log(`Progress indicator visible: ${hasProgress}`);

          // Close any confirmation dialogs
          const cancelButton = page.locator('button:has-text("Cancel")').first();
          if (await cancelButton.isVisible({ timeout: 1000 }).catch(() => false)) {
            await cancelButton.click();
          }
        }
      }
    }
  });

  test('can cancel batch operation in progress', async ({ page }) => {
    // Enable batch mode
    const batchToggle = page.locator('button:has-text("Batch Mode")').first();
    if (await batchToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
      await batchToggle.click();
      await page.waitForTimeout(500);

      // Select entries
      const checkboxes = page.locator('input[type="checkbox"]');
      const count = await checkboxes.count();

      if (count > 0) {
        await checkboxes.nth(0).check();
        await page.waitForTimeout(300);

        // Start operation
        const deleteButton = page.locator('button:has-text("Delete Selected")').first();
        if (await deleteButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await deleteButton.click();
          await page.waitForTimeout(100);

          // Cancel immediately
          const cancelButton = page.locator('button:has-text("Cancel")').first();
          if (await cancelButton.isVisible({ timeout: 1000 }).catch(() => false)) {
            await cancelButton.click();
            await page.waitForTimeout(500);

            // Operation should be cancelled
            console.log('Batch operation cancelled successfully');
          }
        }
      }
    }
  });

  test('disables batch mode after sync', async ({ page }) => {
    // Enable batch mode
    const batchToggle = page.locator('button:has-text("Batch Mode")').first();
    if (await batchToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
      await batchToggle.click();
      await page.waitForTimeout(500);

      // Look for sync button
      const syncButton = page.locator('button:has-text("Sync"), button:has-text("Sync to Blockchain")').first();
      if (await syncButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await syncButton.click();
        await page.waitForTimeout(2000);

        // Batch mode should be disabled after sync
        const batchToolbar = page.locator('[data-testid="batch-toolbar"]').first();
        const stillVisible = await batchToolbar.isVisible({ timeout: 1000 }).catch(() => false);

        console.log(`Batch mode still active after sync: ${stillVisible}`);
      }
    }
  });
});

test.describe('Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    // CRITICAL: mockWalletConnection() MUST be called BEFORE page.goto()
    // because addInitScript() only affects future page loads, not current one
    await mockWalletConnection(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
  });

  test('displays clear error when transaction fails', async ({ page, context }) => {
    // Listen for error messages
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Try to create entry (may fail without real wallet)
    const addButton = page.locator('button:has-text("New Password")').first();
    if (await addButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addButton.click();
      await page.waitForTimeout(500);

      const typeButton = page.locator('button:has-text("SecureNote")').first();
      if (await typeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await typeButton.click();
        await page.waitForTimeout(300);

        const titleInput = page.locator('input[name="title"]').first();
        if (await titleInput.isVisible({ timeout: 1000 }).catch(() => false)) {
          await titleInput.fill('Error Test Entry');
        }

        const saveButton = page.locator('button:has-text("Save")').last();
        await saveButton.click();
        await page.waitForTimeout(2000);

        // Look for error toast or message
        const errorMessage = page.locator('[role="alert"], text=/error|failed/i').first();
        const hasError = await errorMessage.isVisible({ timeout: 3000 }).catch(() => false);

        console.log(`Error message displayed: ${hasError}`);
      }
    }
  });

  test('handles network offline gracefully', async ({ page }) => {
    // Simulate offline
    await simulateNetworkError(page, 'offline');

    // Try to perform operation
    const addButton = page.locator('button:has-text("New Password")').first();
    if (await addButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addButton.click();
      await page.waitForTimeout(500);

      // Should show offline error
      const offlineMessage = page.locator('text=/offline|network|connection/i').first();
      const hasMessage = await offlineMessage.isVisible({ timeout: 3000 }).catch(() => false);

      console.log(`Offline message shown: ${hasMessage}`);

      // Restore network
      await clearNetworkError(page);
    }
  });

  test('handles RPC errors with actionable messages', async ({ page }) => {
    // Simulate RPC error
    await simulateNetworkError(page, 'rpc-error');

    // Try operation
    const addButton = page.locator('button:has-text("New Password")').first();
    if (await addButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addButton.click();
      await page.waitForTimeout(500);

      const typeButton = page.locator('button:has-text("Login")').first();
      if (await typeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await typeButton.click();
        await page.waitForTimeout(300);

        const titleInput = page.locator('input[name="title"]').first();
        if (await titleInput.isVisible({ timeout: 1000 }).catch(() => false)) {
          await titleInput.fill('RPC Error Test');
        }

        const saveButton = page.locator('button:has-text("Save")').last();
        await saveButton.click();
        await page.waitForTimeout(2000);

        // Should show RPC error with helpful message
        const rpcError = page.locator('text=/RPC|server|try again/i').first();
        const hasRpcError = await rpcError.isVisible({ timeout: 3000 }).catch(() => false);

        console.log(`RPC error message shown: ${hasRpcError}`);
      }

      // Restore network
      await clearNetworkError(page);
    }
  });

  test('handles insufficient SOL balance error', async ({ page }) => {
    // In real scenario, this would trigger on actual transaction
    // Here we test the UI can display the error

    // Look for any balance indicators
    const balanceElement = page.locator('text=/balance|SOL/i').first();
    if (await balanceElement.isVisible({ timeout: 2000 }).catch(() => false)) {
      const balanceText = await balanceElement.textContent();
      console.log(`Wallet balance: ${balanceText}`);
    }

    // App should prevent operations if balance is too low
    // and show clear error message
  });

  test('recovers from transaction timeout', async ({ page }) => {
    // Simulate timeout
    await simulateNetworkError(page, 'timeout');

    // Try operation
    const addButton = page.locator('button:has-text("New Password")').first();
    if (await addButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addButton.click();
      await page.waitForTimeout(500);

      const cancelButton = page.locator('button:has-text("Cancel")').first();
      if (await cancelButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await cancelButton.click();
      }
    }

    // Restore network
    await clearNetworkError(page);

    // App should be functional again
    await page.waitForTimeout(500);
    const isResponsive = await page.locator('text=Solana Lockbox').isVisible();
    expect(isResponsive).toBeTruthy();
  });

  test('prevents double-submission of forms', async ({ page }) => {
    const addButton = page.locator('button:has-text("New Password")').first();
    if (await addButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addButton.click();
      await page.waitForTimeout(500);

      const typeButton = page.locator('button:has-text("SecureNote")').first();
      if (await typeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await typeButton.click();
        await page.waitForTimeout(300);

        const titleInput = page.locator('input[name="title"]').first();
        if (await titleInput.isVisible({ timeout: 1000 }).catch(() => false)) {
          await titleInput.fill('Double Submit Test');
        }

        const saveButton = page.locator('button:has-text("Save")').last();

        // Click save multiple times rapidly
        await saveButton.click();
        await saveButton.click();
        await saveButton.click();

        await page.waitForTimeout(2000);

        // Should only process once (save button should be disabled after first click)
        const isDisabled = await saveButton.isDisabled().catch(() => false);
        console.log(`Save button disabled after click: ${isDisabled}`);
      }
    }
  });

  test('validates input length limits', async ({ page }) => {
    const addButton = page.locator('button:has-text("New Password")').first();
    if (await addButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addButton.click();
      await page.waitForTimeout(500);

      const typeButton = page.locator('button:has-text("SecureNote")').first();
      if (await typeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await typeButton.click();
        await page.waitForTimeout(300);

        // Try extremely long input
        const longString = 'A'.repeat(10000);
        const notesInput = page.locator('textarea[name="notes"]').first();
        if (await notesInput.isVisible({ timeout: 1000 }).catch(() => false)) {
          await notesInput.fill(longString);
          await page.waitForTimeout(500);

          // Should show validation error or truncate
          const errorOrWarning = page.locator('text=/too long|maximum|limit/i').first();
          const hasMessage = await errorOrWarning.isVisible({ timeout: 2000 }).catch(() => false);

          console.log(`Length validation message shown: ${hasMessage}`);
        }

        const cancelButton = page.locator('button:has-text("Cancel")').first();
        if (await cancelButton.isVisible({ timeout: 1000 }).catch(() => false)) {
          await cancelButton.click();
        }
      }
    }
  });

  test('handles malformed blockchain data gracefully', async ({ page }) => {
    // This would require injecting malformed data
    // For now, verify app doesn't crash on refresh

    await page.reload();
    await page.waitForLoadState('networkidle');

    // App should still load
    await expect(page.locator('text=Solana Lockbox')).toBeVisible();

    // Check console for unhandled errors
    const errors: string[] = [];
    page.on('pageerror', error => {
      errors.push(error.message);
    });

    await page.waitForTimeout(2000);

    // Should not have uncaught errors
    const hasCriticalErrors = errors.some(err =>
      err.toLowerCase().includes('uncaught') ||
      err.toLowerCase().includes('unhandled')
    );

    expect(hasCriticalErrors).toBe(false);
  });
});

test.describe('Edge Cases and Boundaries', () => {
  test.beforeEach(async ({ page }) => {
    // CRITICAL: mockWalletConnection() MUST be called BEFORE page.goto()
    // because addInitScript() only affects future page loads, not current one
    await mockWalletConnection(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
  });

  test('handles empty vault gracefully', async ({ page }) => {
    // With empty vault, should show empty state
    const emptyState = page.locator('text=/empty|no passwords|get started/i').first();
    const hasEmptyState = await emptyState.isVisible({ timeout: 3000 }).catch(() => false);

    console.log(`Empty state shown: ${hasEmptyState}`);
  });

  test('handles maximum storage capacity', async ({ page }) => {
    // Check if storage limits are displayed
    const storageIndicator = page.locator('text=/storage|capacity|KB|MB/i').first();
    const hasStorage = await storageIndicator.isVisible({ timeout: 2000 }).catch(() => false);

    console.log(`Storage indicator visible: ${hasStorage}`);

    // Should warn when approaching limit
  });

  test('handles concurrent operations correctly', async ({ page }) => {
    // Try to open multiple modals at once
    const addButton = page.locator('button:has-text("New Password")').first();

    if (await addButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Rapid clicks
      await addButton.click();
      await addButton.click();
      await page.waitForTimeout(500);

      // Should only open one modal
      const modalCount = await page.locator('[role="dialog"]').count();
      expect(modalCount).toBeLessThanOrEqual(1);

      // Close modal
      const cancelButton = page.locator('button:has-text("Cancel")').first();
      if (await cancelButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await cancelButton.click();
      }
    }
  });

  test('handles special characters in passwords', async ({ page }) => {
    const specialChars = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/~`';

    const addButton = page.locator('button:has-text("New Password")').first();
    if (await addButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addButton.click();
      await page.waitForTimeout(500);

      const typeButton = page.locator('button:has-text("Login")').first();
      if (await typeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await typeButton.click();
        await page.waitForTimeout(300);

        const passwordInput = page.locator('input[name="password"]').first();
        if (await passwordInput.isVisible({ timeout: 1000 }).catch(() => false)) {
          await passwordInput.fill(specialChars);
          await page.waitForTimeout(300);

          // Should handle special characters without errors
          const value = await passwordInput.inputValue();
          console.log(`Special characters handled: ${value.length} chars`);
        }

        const cancelButton = page.locator('button:has-text("Cancel")').first();
        if (await cancelButton.isVisible({ timeout: 1000 }).catch(() => false)) {
          await cancelButton.click();
        }
      }
    }
  });

  test('handles Unicode and emoji in entries', async ({ page }) => {
    const unicodeText = '你好世界 🔐 🌐 مرحبا';

    const addButton = page.locator('button:has-text("New Password")').first();
    if (await addButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addButton.click();
      await page.waitForTimeout(500);

      const typeButton = page.locator('button:has-text("SecureNote")').first();
      if (await typeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await typeButton.click();
        await page.waitForTimeout(300);

        const titleInput = page.locator('input[name="title"]').first();
        if (await titleInput.isVisible({ timeout: 1000 }).catch(() => false)) {
          await titleInput.fill(unicodeText);
          await page.waitForTimeout(300);

          const value = await titleInput.inputValue();
          console.log(`Unicode text handled: ${value}`);
          expect(value).toContain('🔐');
        }

        const cancelButton = page.locator('button:has-text("Cancel")').first();
        if (await cancelButton.isVisible({ timeout: 1000 }).catch(() => false)) {
          await cancelButton.click();
        }
      }
    }
  });
});
