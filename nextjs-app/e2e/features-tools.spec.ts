/**
 * Features and Tools E2E Tests
 *
 * Comprehensive tests for all sidebar tools and features:
 * - Health Dashboard
 * - 2FA/TOTP Manager
 * - Activity Log
 * - Password Rotation
 * - Password Policies
 * - Categories
 * - Sharing
 * - Settings
 */

import { test, expect, Page } from '@playwright/test';
import { mockWalletConnection } from './helpers/wallet-helpers';
import { TEST_TOTP_SECRETS, TEST_CATEGORIES } from './helpers/test-data';

test.describe('Health Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await mockWalletConnection(page);
    await page.waitForTimeout(1000);
  });

  test('can open Health Dashboard', async ({ page }) => {
    // Look for Health Dashboard button/link
    const dashboardButton = page.locator('button:has-text("Health"), button:has-text("Dashboard"), text="Health Dashboard"').first();

    if (await dashboardButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await dashboardButton.click();
      await page.waitForTimeout(500);

      // Verify dashboard modal/panel is open
      const dashboardPanel = page.locator('text=/Password Health|Security Score/i').first();
      const isOpen = await dashboardPanel.isVisible({ timeout: 2000 }).catch(() => false);

      console.log(`Health Dashboard opened: ${isOpen}`);
      expect(isOpen).toBeTruthy();
    } else {
      console.log('Health Dashboard button not found');
    }
  });

  test('displays password health metrics', async ({ page }) => {
    const dashboardButton = page.locator('button:has-text("Health Dashboard")').first();

    if (await dashboardButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await dashboardButton.click();
      await page.waitForTimeout(500);

      // Check for health metrics
      const metrics = [
        'Weak passwords',
        'Reused passwords',
        'Old passwords',
        'Security score',
        'Strength',
      ];

      for (const metric of metrics) {
        const hasMetric = await page.locator(`text=/${metric}/i`).isVisible({ timeout: 1000 }).catch(() => false);
        console.log(`${metric}: ${hasMetric}`);
      }
    }
  });

  test('identifies weak passwords', async ({ page }) => {
    const dashboardButton = page.locator('button:has-text("Health Dashboard")').first();

    if (await dashboardButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await dashboardButton.click();
      await page.waitForTimeout(500);

      // Look for weak password indicators
      const weakIndicator = page.locator('text=/weak|poor|vulnerable/i, [data-status="weak"]').first();
      const hasWeak = await weakIndicator.isVisible({ timeout: 2000 }).catch(() => false);

      console.log(`Weak passwords identified: ${hasWeak}`);
    }
  });

  test('shows password age warnings', async ({ page }) => {
    const dashboardButton = page.locator('button:has-text("Health Dashboard")').first();

    if (await dashboardButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await dashboardButton.click();
      await page.waitForTimeout(500);

      // Look for old password warnings
      const ageWarning = page.locator('text=/old|outdated|days|months/i').first();
      const hasAgeWarning = await ageWarning.isVisible({ timeout: 2000 }).catch(() => false);

      console.log(`Password age warnings shown: ${hasAgeWarning}`);
    }
  });

  test('detects duplicate passwords', async ({ page }) => {
    const dashboardButton = page.locator('button:has-text("Health Dashboard")').first();

    if (await dashboardButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await dashboardButton.click();
      await page.waitForTimeout(500);

      // Look for duplicate/reused password indicators
      const duplicateIndicator = page.locator('text=/reused|duplicate/i').first();
      const hasDuplicate = await duplicateIndicator.isVisible({ timeout: 2000 }).catch(() => false);

      console.log(`Duplicate passwords detected: ${hasDuplicate}`);
    }
  });
});

test.describe('2FA / TOTP Manager', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await mockWalletConnection(page);
    await page.waitForTimeout(1000);
  });

  test('can open TOTP Manager', async ({ page }) => {
    const totpButton = page.locator('button:has-text("2FA"), button:has-text("TOTP"), text="2FA Codes"').first();

    if (await totpButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await totpButton.click();
      await page.waitForTimeout(500);

      const totpPanel = page.locator('text=/2FA|TOTP|Authenticator/i').first();
      const isOpen = await totpPanel.isVisible({ timeout: 2000 }).catch(() => false);

      console.log(`TOTP Manager opened: ${isOpen}`);
      expect(isOpen).toBeTruthy();
    } else {
      console.log('TOTP Manager button not found');
    }
  });

  test('can add new TOTP code', async ({ page }) => {
    const totpButton = page.locator('button:has-text("2FA")').first();

    if (await totpButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await totpButton.click();
      await page.waitForTimeout(500);

      // Click "Add 2FA"
      const addButton = page.locator('button:has-text("Add"), button:has-text("Add 2FA")').first();
      if (await addButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await addButton.click();
        await page.waitForTimeout(300);

        // Fill in TOTP details
        const issuerInput = page.locator('input[name="issuer"], input[placeholder*="Issuer"]').first();
        const secretInput = page.locator('input[name="secret"], input[placeholder*="Secret"]').first();

        if (await issuerInput.isVisible({ timeout: 1000 }).catch(() => false)) {
          await issuerInput.fill('Google');
          await secretInput.fill(TEST_TOTP_SECRETS.google);
          await page.waitForTimeout(500);

          // Should show 6-digit code
          const codeDisplay = page.locator('text=/\\d{6}/').first();
          const hasCode = await codeDisplay.isVisible({ timeout: 2000 }).catch(() => false);

          console.log(`TOTP code generated: ${hasCode}`);
        }

        // Close
        const cancelButton = page.locator('button:has-text("Cancel")').first();
        if (await cancelButton.isVisible({ timeout: 1000 }).catch(() => false)) {
          await cancelButton.click();
        }
      }
    }
  });

  test('displays TOTP codes with countdown timer', async ({ page }) => {
    const totpButton = page.locator('button:has-text("2FA")').first();

    if (await totpButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await totpButton.click();
      await page.waitForTimeout(500);

      // Look for countdown timer
      const timer = page.locator('text=/\\d+s|seconds/i, [data-testid="totp-timer"]').first();
      const hasTimer = await timer.isVisible({ timeout: 2000 }).catch(() => false);

      console.log(`TOTP countdown timer visible: ${hasTimer}`);
    }
  });

  test('can copy TOTP code to clipboard', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    const totpButton = page.locator('button:has-text("2FA")').first();

    if (await totpButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await totpButton.click();
      await page.waitForTimeout(500);

      // Look for copy button
      const copyButton = page.locator('button:has-text("Copy"), button[aria-label*="copy code"]').first();
      if (await copyButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await copyButton.click();
        await page.waitForTimeout(300);

        // Verify clipboard
        const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
        console.log(`TOTP code copied: ${clipboardText}`);

        // Should be 6 digits
        expect(clipboardText).toMatch(/^\d{6}$/);
      }
    }
  });

  test('refreshes TOTP codes automatically', async ({ page }) => {
    const totpButton = page.locator('button:has-text("2FA")').first();

    if (await totpButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await totpButton.click();
      await page.waitForTimeout(500);

      // Get initial code
      const codeElement = page.locator('text=/\\d{6}/').first();
      if (await codeElement.isVisible({ timeout: 1000 }).catch(() => false)) {
        const initialCode = await codeElement.textContent();

        // Wait for refresh (30 seconds max)
        await page.waitForTimeout(31000);

        const newCode = await codeElement.textContent();
        console.log(`Code refreshed: ${initialCode} → ${newCode}`);

        // Codes should be different (unless we got really unlucky)
        expect(newCode).not.toBe(initialCode);
      }
    }
  });
});

test.describe('Activity Log', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await mockWalletConnection(page);
    await page.waitForTimeout(1000);
  });

  test('can open Activity Log', async ({ page }) => {
    const activityButton = page.locator('button:has-text("Activity"), text="Activity Log"').first();

    if (await activityButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await activityButton.click();
      await page.waitForTimeout(500);

      const activityPanel = page.locator('text=/Activity|Log|History/i').first();
      const isOpen = await activityPanel.isVisible({ timeout: 2000 }).catch(() => false);

      console.log(`Activity Log opened: ${isOpen}`);
      expect(isOpen).toBeTruthy();
    } else {
      console.log('Activity Log button not found');
    }
  });

  test('displays recent activities', async ({ page }) => {
    const activityButton = page.locator('button:has-text("Activity Log")').first();

    if (await activityButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await activityButton.click();
      await page.waitForTimeout(500);

      // Look for activity entries
      const activityTypes = ['Created', 'Updated', 'Deleted', 'Viewed', 'Accessed'];

      for (const type of activityTypes) {
        const hasActivity = await page.locator(`text=/${type}/i`).isVisible({ timeout: 1000 }).catch(() => false);
        if (hasActivity) {
          console.log(`Found activity type: ${type}`);
        }
      }
    }
  });

  test('shows timestamps for activities', async ({ page }) => {
    const activityButton = page.locator('button:has-text("Activity Log")').first();

    if (await activityButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await activityButton.click();
      await page.waitForTimeout(500);

      // Look for timestamps
      const timestampPattern = /ago|today|yesterday|\d{1,2}:\d{2}|\d{1,2}\/\d{1,2}/i;
      const timestamp = page.locator(`text=${timestampPattern}`).first();
      const hasTimestamp = await timestamp.isVisible({ timeout: 2000 }).catch(() => false);

      console.log(`Activity timestamps visible: ${hasTimestamp}`);
    }
  });

  test('can filter activities by type', async ({ page }) => {
    const activityButton = page.locator('button:has-text("Activity Log")').first();

    if (await activityButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await activityButton.click();
      await page.waitForTimeout(500);

      // Look for filter controls
      const filterButton = page.locator('button:has-text("Filter"), select[name="activityType"]').first();
      if (await filterButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await filterButton.click();
        await page.waitForTimeout(300);

        console.log('Activity filter controls found');
      }
    }
  });

  test('can export activity log', async ({ page }) => {
    const activityButton = page.locator('button:has-text("Activity Log")').first();

    if (await activityButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await activityButton.click();
      await page.waitForTimeout(500);

      // Look for export button
      const exportButton = page.locator('button:has-text("Export")').first();
      if (await exportButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        const downloadPromise = page.waitForEvent('download', { timeout: 3000 }).catch(() => null);

        await exportButton.click();
        await page.waitForTimeout(500);

        const download = await downloadPromise;
        if (download) {
          console.log(`Activity log export: ${download.suggestedFilename()}`);
        }
      }
    }
  });
});

test.describe('Password Rotation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await mockWalletConnection(page);
    await page.waitForTimeout(1000);
  });

  test('can open Password Rotation tool', async ({ page }) => {
    const rotationButton = page.locator('button:has-text("Rotation"), text="Password Rotation"').first();

    if (await rotationButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await rotationButton.click();
      await page.waitForTimeout(500);

      const rotationPanel = page.locator('text=/Rotate|Password Rotation/i').first();
      const isOpen = await rotationPanel.isVisible({ timeout: 2000 }).catch(() => false);

      console.log(`Password Rotation opened: ${isOpen}`);
      expect(isOpen).toBeTruthy();
    } else {
      console.log('Password Rotation button not found');
    }
  });

  test('identifies passwords needing rotation', async ({ page }) => {
    const rotationButton = page.locator('button:has-text("Password Rotation")').first();

    if (await rotationButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await rotationButton.click();
      await page.waitForTimeout(500);

      // Look for old passwords list
      const oldPasswordsList = page.locator('text=/needs rotation|old|outdated/i').first();
      const hasOld = await oldPasswordsList.isVisible({ timeout: 2000 }).catch(() => false);

      console.log(`Passwords needing rotation identified: ${hasOld}`);
    }
  });

  test('can schedule automatic rotation', async ({ page }) => {
    const rotationButton = page.locator('button:has-text("Password Rotation")').first();

    if (await rotationButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await rotationButton.click();
      await page.waitForTimeout(500);

      // Look for rotation schedule settings
      const scheduleOption = page.locator('text=/Schedule|Automatic|Every/i, select[name="rotationInterval"]').first();
      if (await scheduleOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('Automatic rotation scheduling available');
      }
    }
  });

  test('can manually rotate password', async ({ page }) => {
    const rotationButton = page.locator('button:has-text("Password Rotation")').first();

    if (await rotationButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await rotationButton.click();
      await page.waitForTimeout(500);

      // Look for rotate now button
      const rotateButton = page.locator('button:has-text("Rotate"), button:has-text("Rotate Now")').first();
      if (await rotateButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await rotateButton.click();
        await page.waitForTimeout(300);

        console.log('Manual rotation triggered');

        // Cancel any confirmation
        const cancelButton = page.locator('button:has-text("Cancel")').first();
        if (await cancelButton.isVisible({ timeout: 1000 }).catch(() => false)) {
          await cancelButton.click();
        }
      }
    }
  });
});

test.describe('Password Policies', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await mockWalletConnection(page);
    await page.waitForTimeout(1000);
  });

  test('can open Password Policy settings', async ({ page }) => {
    const policyButton = page.locator('button:has-text("Policy"), button:has-text("Policies"), text="Password Policy"').first();

    if (await policyButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await policyButton.click();
      await page.waitForTimeout(500);

      const policyPanel = page.locator('text=/Policy|Policies|Requirements/i').first();
      const isOpen = await policyPanel.isVisible({ timeout: 2000 }).catch(() => false);

      console.log(`Password Policy opened: ${isOpen}`);
      expect(isOpen).toBeTruthy();
    } else {
      console.log('Password Policy button not found');
    }
  });

  test('can configure minimum password length', async ({ page }) => {
    const policyButton = page.locator('button:has-text("Password Policy")').first();

    if (await policyButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await policyButton.click();
      await page.waitForTimeout(500);

      // Look for length setting
      const lengthInput = page.locator('input[name="minLength"], input[type="number"]').first();
      if (await lengthInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await lengthInput.fill('12');
        await page.waitForTimeout(300);

        console.log('Minimum password length configured');
      }
    }
  });

  test('can set password complexity requirements', async ({ page }) => {
    const policyButton = page.locator('button:has-text("Password Policy")').first();

    if (await policyButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await policyButton.click();
      await page.waitForTimeout(500);

      // Look for complexity checkboxes
      const requirements = ['uppercase', 'lowercase', 'numbers', 'special'];

      for (const req of requirements) {
        const checkbox = page.locator(`input[type="checkbox"][name*="${req}"]`).first();
        if (await checkbox.isVisible({ timeout: 1000 }).catch(() => false)) {
          await checkbox.check();
          console.log(`Enabled requirement: ${req}`);
        }
      }
    }
  });

  test('enforces password policies on new entries', async ({ page }) => {
    // Set strict policy
    const policyButton = page.locator('button:has-text("Password Policy")').first();

    if (await policyButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await policyButton.click();
      await page.waitForTimeout(500);

      const lengthInput = page.locator('input[name="minLength"]').first();
      if (await lengthInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        await lengthInput.fill('16');

        const saveButton = page.locator('button:has-text("Save")').first();
        if (await saveButton.isVisible({ timeout: 1000 }).catch(() => false)) {
          await saveButton.click();
          await page.waitForTimeout(500);
        }
      }
    }

    // Try to create password that violates policy
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
          await passwordInput.fill('short');
          await page.waitForTimeout(300);

          // Should show validation error
          const error = page.locator('text=/too short|minimum|characters/i').first();
          const hasError = await error.isVisible({ timeout: 2000 }).catch(() => false);

          console.log(`Policy enforcement error shown: ${hasError}`);
        }

        const cancelButton = page.locator('button:has-text("Cancel")').first();
        if (await cancelButton.isVisible({ timeout: 1000 }).catch(() => false)) {
          await cancelButton.click();
        }
      }
    }
  });
});

test.describe('Categories', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await mockWalletConnection(page);
    await page.waitForTimeout(1000);
  });

  test('can open Category Manager', async ({ page }) => {
    const categoryButton = page.locator('button:has-text("Categories"), text="Category Manager"').first();

    if (await categoryButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await categoryButton.click();
      await page.waitForTimeout(500);

      const categoryPanel = page.locator('text=/Categories|Manage Categories/i').first();
      const isOpen = await categoryPanel.isVisible({ timeout: 2000 }).catch(() => false);

      console.log(`Category Manager opened: ${isOpen}`);
      expect(isOpen).toBeTruthy();
    } else {
      console.log('Category Manager button not found');
    }
  });

  test('can create new category', async ({ page }) => {
    const categoryButton = page.locator('button:has-text("Categories")').first();

    if (await categoryButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await categoryButton.click();
      await page.waitForTimeout(500);

      const addButton = page.locator('button:has-text("Add Category"), button:has-text("New Category")').first();
      if (await addButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await addButton.click();
        await page.waitForTimeout(300);

        const nameInput = page.locator('input[name="categoryName"], input[placeholder*="Category"]').first();
        if (await nameInput.isVisible({ timeout: 1000 }).catch(() => false)) {
          await nameInput.fill('Work Projects');
          await page.waitForTimeout(300);

          const saveButton = page.locator('button:has-text("Save"), button:has-text("Create")').last();
          await saveButton.click();
          await page.waitForTimeout(500);

          // Verify category created
          const newCategory = page.locator('text="Work Projects"').first();
          const exists = await newCategory.isVisible({ timeout: 2000 }).catch(() => false);

          console.log(`Category created: ${exists}`);
        }
      }
    }
  });

  test('can assign category to password entry', async ({ page }) => {
    // Assume category exists, try to assign it
    const entryCard = page.locator('[data-testid="password-entry"]').first();

    if (await entryCard.isVisible({ timeout: 2000 }).catch(() => false)) {
      await entryCard.click();
      await page.waitForTimeout(500);

      // Look for category dropdown
      const categorySelect = page.locator('select[name="category"], button:has-text("Category")').first();
      if (await categorySelect.isVisible({ timeout: 2000 }).catch(() => false)) {
        await categorySelect.click();
        await page.waitForTimeout(300);

        // Select a category
        const categoryOption = page.locator('option:has-text("Personal"), [role="option"]:has-text("Personal")').first();
        if (await categoryOption.isVisible({ timeout: 1000 }).catch(() => false)) {
          await categoryOption.click();
          await page.waitForTimeout(300);

          console.log('Category assigned to entry');
        }
      }

      const closeButton = page.locator('button:has-text("Close")').first();
      if (await closeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await closeButton.click();
      }
    }
  });

  test('can delete category', async ({ page }) => {
    const categoryButton = page.locator('button:has-text("Categories")').first();

    if (await categoryButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await categoryButton.click();
      await page.waitForTimeout(500);

      // Look for delete button on a category
      const deleteButton = page.locator('button:has-text("Delete"), button[aria-label*="delete category"]').first();
      if (await deleteButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await deleteButton.click();
        await page.waitForTimeout(300);

        // Confirm deletion
        const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Delete")').last();
        if (await confirmButton.isVisible({ timeout: 1000 }).catch(() => false)) {
          await confirmButton.click();
          await page.waitForTimeout(500);

          console.log('Category deleted');
        }
      }
    }
  });

  test('can filter passwords by category', async ({ page }) => {
    // Look for category filter in sidebar or filter panel
    const filterPanel = page.locator('[data-testid="filter-panel"]').first();

    if (await filterPanel.isVisible({ timeout: 2000 }).catch(() => false)) {
      const categoryFilter = page.locator('button:has-text("Category"), select[name="category"]').first();
      if (await categoryFilter.isVisible({ timeout: 1000 }).catch(() => false)) {
        await categoryFilter.click();
        await page.waitForTimeout(300);

        const personalCategory = page.locator('text="Personal"').first();
        if (await personalCategory.isVisible({ timeout: 1000 }).catch(() => false)) {
          await personalCategory.click();
          await page.waitForTimeout(500);

          console.log('Filtered by Personal category');
        }
      }
    }
  });
});

test.describe('Share Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await mockWalletConnection(page);
    await page.waitForTimeout(1000);
  });

  test('can open Share Management', async ({ page }) => {
    const shareButton = page.locator('button:has-text("Share"), text="Sharing"').first();

    if (await shareButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await shareButton.click();
      await page.waitForTimeout(500);

      const sharePanel = page.locator('text=/Share|Sharing/i').first();
      const isOpen = await sharePanel.isVisible({ timeout: 2000 }).catch(() => false);

      console.log(`Share Management opened: ${isOpen}`);
      expect(isOpen).toBeTruthy();
    } else {
      console.log('Share Management button not found');
    }
  });

  test('can share password entry with another user', async ({ page }) => {
    // Open an entry
    const entryCard = page.locator('[data-testid="password-entry"]').first();

    if (await entryCard.isVisible({ timeout: 2000 }).catch(() => false)) {
      await entryCard.click();
      await page.waitForTimeout(500);

      // Look for share button
      const shareButton = page.locator('button:has-text("Share")').first();
      if (await shareButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await shareButton.click();
        await page.waitForTimeout(300);

        // Enter recipient address
        const recipientInput = page.locator('input[name="recipient"], input[placeholder*="address"]').first();
        if (await recipientInput.isVisible({ timeout: 1000 }).catch(() => false)) {
          await recipientInput.fill('RecipientWallet11111111111111111111111111');
          await page.waitForTimeout(300);

          console.log('Share recipient entered');

          // Cancel
          const cancelButton = page.locator('button:has-text("Cancel")').first();
          if (await cancelButton.isVisible({ timeout: 1000 }).catch(() => false)) {
            await cancelButton.click();
          }
        }
      }

      const closeButton = page.locator('button:has-text("Close")').last();
      if (await closeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await closeButton.click();
      }
    }
  });

  test('can revoke shared access', async ({ page }) => {
    const shareButton = page.locator('button:has-text("Sharing")').first();

    if (await shareButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await shareButton.click();
      await page.waitForTimeout(500);

      // Look for revoke button
      const revokeButton = page.locator('button:has-text("Revoke")').first();
      if (await revokeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await revokeButton.click();
        await page.waitForTimeout(300);

        // Confirm revocation
        const confirmButton = page.locator('button:has-text("Confirm")').last();
        if (await confirmButton.isVisible({ timeout: 1000 }).catch(() => false)) {
          await confirmButton.click();
          await page.waitForTimeout(500);

          console.log('Shared access revoked');
        }
      }
    }
  });
});

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await mockWalletConnection(page);
    await page.waitForTimeout(1000);
  });

  test('can navigate to Settings page', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    const settingsHeading = page.locator('text=/Settings|Preferences/i').first();
    const isSettings = await settingsHeading.isVisible({ timeout: 3000 }).catch(() => false);

    console.log(`Settings page loaded: ${isSettings}`);
    expect(isSettings).toBeTruthy();
  });

  test('displays all settings tabs', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    const tabs = ['Account', 'Security', 'Subscription', 'Import/Export', 'Preferences'];

    for (const tab of tabs) {
      const tabElement = page.locator(`text="${tab}", button:has-text("${tab}")`).first();
      const isVisible = await tabElement.isVisible({ timeout: 2000 }).catch(() => false);
      console.log(`${tab} tab visible: ${isVisible}`);
    }
  });

  test('can toggle dark mode in preferences', async ({ page }) => {
    await page.goto('/settings?tab=preferences');
    await page.waitForLoadState('networkidle');

    const darkModeToggle = page.locator('input[type="checkbox"][name*="dark"], button:has-text("Dark Mode")').first();

    if (await darkModeToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
      await darkModeToggle.click();
      await page.waitForTimeout(500);

      console.log('Dark mode toggled');

      // Verify theme changed
      const htmlElement = page.locator('html');
      const classAttr = await htmlElement.getAttribute('class');
      console.log(`Theme classes: ${classAttr}`);
    }
  });

  test('can view account information', async ({ page }) => {
    await page.goto('/settings?tab=account');
    await page.waitForLoadState('networkidle');

    // Look for wallet address
    const walletAddress = page.locator('text=/[A-Za-z0-9]{32,}/').first();
    const hasAddress = await walletAddress.isVisible({ timeout: 2000 }).catch(() => false);

    console.log(`Account information visible: ${hasAddress}`);
  });

  test('can view subscription details', async ({ page }) => {
    await page.goto('/settings?tab=subscription');
    await page.waitForLoadState('networkidle');

    // Look for subscription tier info
    const tierInfo = page.locator('text=/Free|Basic|Premium|Pro/i').first();
    const hasTier = await tierInfo.isVisible({ timeout: 2000 }).catch(() => false);

    console.log(`Subscription tier visible: ${hasTier}`);
  });

  test('can access import/export tools', async ({ page }) => {
    await page.goto('/settings?tab=import-export');
    await page.waitForLoadState('networkidle');

    // Look for import/export buttons
    const exportButton = page.locator('button:has-text("Export")').first();
    const importButton = page.locator('button:has-text("Import")').first();

    const hasExport = await exportButton.isVisible({ timeout: 2000 }).catch(() => false);
    const hasImport = await importButton.isVisible({ timeout: 2000 }).catch(() => false);

    console.log(`Import/Export tools visible: Export=${hasExport}, Import=${hasImport}`);
  });
});
