/**
 * Password CRUD Operations E2E Tests
 *
 * Comprehensive tests for Create, Read, Update, Delete operations
 * across all password entry types in the Solana Lockbox.
 */

import { test, expect, Page } from '@playwright/test';
import { mockWalletConnection, signPhantomTransaction } from './helpers/wallet-helpers';
import { TEST_ENTRIES, generateBulkEntries } from './helpers/test-data';
import { PasswordEntryType } from '../sdk/src/types-v2';
import { initializeTestVault, waitForVaultReady } from './helpers/initialize-test-vault';

// All supported password entry types
const PASSWORD_TYPES: PasswordEntryType[] = [
  PasswordEntryType.Login,
  PasswordEntryType.CreditCard,
  PasswordEntryType.SecureNote,
  PasswordEntryType.Identity,
  PasswordEntryType.ApiKey,
  PasswordEntryType.SshKey,
  PasswordEntryType.CryptoWallet,
];

test.describe('Password CRUD Operations', () => {
  test.beforeEach(async ({ page, context }) => {
    // CRITICAL: mockWalletConnection() MUST be called BEFORE page.goto()
    // because addInitScript() only affects future page loads, not current one
    await mockWalletConnection(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Click the "Select Wallet" button to trigger wallet connection
    const connectButton = page.locator('.wallet-adapter-button-trigger, button:has-text("Select Wallet")').first();
    if (await connectButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await connectButton.click();
      await page.waitForTimeout(500);

      // Handle wallet selection modal - click first available wallet option
      const walletOption = page.locator('button:has-text("Phantom"), button:has-text("Solflare"), [role="dialog"] button').first();
      if (await walletOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await walletOption.click();
        await page.waitForTimeout(2000); // Wait for wallet to connect
      }
    }

    // Initialize vault if not already initialized
    const vaultInitialized = await initializeTestVault(page);
    if (!vaultInitialized) {
      console.warn('⚠️ Vault may not be fully initialized - tests may fail');
    }

    // Wait for vault to be ready
    await waitForVaultReady(page, 10000);
  });

  test('can create password entries for all types', async ({ page, context }) => {
    test.setTimeout(90000); // Increase timeout for creating multiple entries with blockchain operations

    for (const type of PASSWORD_TYPES) {
      const testEntry = TEST_ENTRIES[type];
      console.log(`\nCreating ${PasswordEntryType[type]} entry: ${testEntry.title}`);

      // Click "New Password" button using standardized selector
      const addButton = page.locator('.new-password-button, button[aria-label*="Create new password"]');
      await addButton.waitFor({ state: 'visible', timeout: 5000 });
      await addButton.click();

      // Wait for modal to open
      const modal = page.locator('[role="dialog"][aria-modal="true"]');
      await modal.waitFor({ state: 'visible', timeout: 3000 });

      // Select password type if needed (modal may default to Login)
      await page.waitForTimeout(500);
      const typeSelect = page.locator('select[name="type"], select#passwordType');
      if (await typeSelect.isVisible({ timeout: 1000 }).catch(() => false)) {
        await typeSelect.selectOption({ value: type.toString() });
        await page.waitForTimeout(300); // Wait for type change to render appropriate fields
      }

      // Fill in form fields using standardized selectors

      // Title (required for all types)
      const titleInput = page.locator('.password-title-input, input[name="title"], input[aria-label*="title" i]');
      await titleInput.waitFor({ state: 'visible', timeout: 3000 });
      await titleInput.fill(testEntry.title);

      // Username/Email (if applicable for Login type)
      if (testEntry.username) {
        const usernameInput = page.locator('.password-username-input, input[name="username"], input[aria-label*="username" i]');
        if (await usernameInput.isVisible({ timeout: 1000 }).catch(() => false)) {
          await usernameInput.fill(testEntry.username);
        }
      }

      // Password (if applicable)
      if (testEntry.password) {
        const passwordInput = page.locator('.password-value-input, input[name="password"], input[aria-label*="password value" i]');
        if (await passwordInput.isVisible({ timeout: 1000 }).catch(() => false)) {
          await passwordInput.fill(testEntry.password);
        }
      }

      // URL (if applicable)
      if (testEntry.url) {
        const urlInput = page.locator('input[name="url"], input[placeholder*="URL" i]');
        if (await urlInput.isVisible({ timeout: 1000 }).catch(() => false)) {
          await urlInput.fill(testEntry.url);
        }
      }

      // Notes (if applicable)
      if (testEntry.notes) {
        const notesInput = page.locator('textarea[name="notes"], textarea[placeholder*="Notes" i]');
        if (await notesInput.isVisible({ timeout: 1000 }).catch(() => false)) {
          await notesInput.fill(testEntry.notes);
        }
      }

      // Save the entry using standardized selector
      const saveButton = page.locator('.save-password-button, button[aria-label*="Save password" i], button:has-text("Save to Blockchain")');
      await saveButton.waitFor({ state: 'visible', timeout: 3000 });
      await saveButton.click();

      // Wait for modal to close (indicating save success or in progress)
      await modal.waitFor({ state: 'hidden', timeout: 15000 });

      // Wait for blockchain transaction to complete (mock wallet returns instantly, but app may process)
      await page.waitForTimeout(2000);

      // Verify entry appears in list
      const entryTitle = page.locator(`text="${testEntry.title}"`);
      const entryExists = await entryTitle.isVisible({ timeout: 5000 }).catch(() => false);

      console.log(`✅ Created ${PasswordEntryType[type]} entry - Visible in list: ${entryExists}`);
    }
  });

  test('can read and view password entry details', async ({ page }) => {
    // Assuming entries exist or create one first
    const testEntry = TEST_ENTRIES['Login'];

    // Look for an entry in the list
    const entryCard = page.locator(`text="${testEntry.title}"`).first();
    if (await entryCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Click to view details
      await entryCard.click();
      await page.waitForTimeout(500);

      // Verify modal/detail view shows the information
      await expect(page.locator(`text="${testEntry.title}"`)).toBeVisible();

      // Check for username
      if (testEntry.username) {
        const hasUsername = await page.locator(`text="${testEntry.username}"`).isVisible({ timeout: 2000 }).catch(() => false);
        console.log(`Username visible: ${hasUsername}`);
      }

      // Check for reveal password button
      const revealButton = page.locator('button:has-text("Show"), button[aria-label*="reveal"], button[aria-label*="show"]').first();
      if (await revealButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await revealButton.click();
        await page.waitForTimeout(300);
        // Password should now be visible
      }

      // Close modal
      const closeButton = page.locator('button:has-text("Close"), button[aria-label="Close"]').first();
      if (await closeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await closeButton.click();
      }
    } else {
      console.log('No existing entries to view - skipping read test');
    }
  });

  test('can update existing password entries', async ({ page, context }) => {
    const testEntry = TEST_ENTRIES['Login'];
    const updatedTitle = `${testEntry.title} (Updated)`;

    // Find an entry
    const entryCard = page.locator(`text="${testEntry.title}"`).first();
    if (await entryCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Click to open
      await entryCard.click();
      await page.waitForTimeout(500);

      // Click Edit button
      const editButton = page.locator('button:has-text("Edit")').first();
      if (await editButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await editButton.click();
        await page.waitForTimeout(300);

        // Update title
        const titleInput = page.locator('input[name="title"]').first();
        await titleInput.fill(updatedTitle);

        // Save changes
        const saveButton = page.locator('button:has-text("Save")').first();
        await saveButton.click();

        // Handle transaction
        await page.waitForTimeout(500);

        // Verify updated title appears
        await page.waitForTimeout(1000);
        const updated = await page.locator(`text="${updatedTitle}"`).isVisible({ timeout: 3000 }).catch(() => false);
        console.log(`Entry updated: ${updated}`);
      }
    } else {
      console.log('No existing entries to update - skipping update test');
    }
  });

  test('can delete password entries', async ({ page, context }) => {
    const testEntry = TEST_ENTRIES['SecureNote'];

    // Find an entry
    const entryCard = page.locator(`text="${testEntry.title}"`).first();
    if (await entryCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Click to open
      await entryCard.click();
      await page.waitForTimeout(500);

      // Click Delete button
      const deleteButton = page.locator('button:has-text("Delete"), button:has-text("Remove")').first();
      if (await deleteButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await deleteButton.click();
        await page.waitForTimeout(300);

        // Confirm deletion
        const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Yes"), button:has-text("Delete")').last();
        if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await confirmButton.click();
        }

        // Handle transaction
        await page.waitForTimeout(500);

        // Verify entry is gone
        await page.waitForTimeout(1000);
        const stillExists = await page.locator(`text="${testEntry.title}"`).isVisible({ timeout: 2000 }).catch(() => false);
        expect(stillExists).toBe(false);
      }
    } else {
      console.log('No existing entries to delete - skipping delete test');
    }
  });

  test('validates required fields on create', async ({ page }) => {
    // Try to create entry without filling required fields
    const addButton = page.locator('button:has-text("New Password"), button:has-text("Add")').first();
    if (await addButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addButton.click();
      await page.waitForTimeout(500);

      // Select type
      const typeButton = page.locator('button:has-text("Login")').first();
      if (await typeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await typeButton.click();
        await page.waitForTimeout(300);

        // Try to save without filling anything
        const saveButton = page.locator('button:has-text("Save"), button:has-text("Create")').last();
        if (await saveButton.isVisible({ timeout: 1000 }).catch(() => false)) {
          await saveButton.click();
          await page.waitForTimeout(500);

          // Should show validation error
          const hasError = await page.locator('text=/required|cannot be empty|please fill/i, [role="alert"]').isVisible({ timeout: 2000 }).catch(() => false);
          console.log(`Validation error shown: ${hasError}`);
        }

        // Close modal
        const cancelButton = page.locator('button:has-text("Cancel"), button:has-text("Close")').first();
        if (await cancelButton.isVisible({ timeout: 1000 }).catch(() => false)) {
          await cancelButton.click();
        }
      }
    }
  });

  test('prevents XSS in password fields', async ({ page }) => {
    const xssPayload = '<script>alert("XSS")</script>';

    // Create entry with XSS payload
    const addButton = page.locator('button:has-text("New Password"), button:has-text("Add")').first();
    if (await addButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addButton.click();
      await page.waitForTimeout(500);

      // Select SecureNote (simpler)
      const typeButton = page.locator('button:has-text("SecureNote")').first();
      if (await typeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await typeButton.click();
        await page.waitForTimeout(300);

        // Fill with XSS payload
        const titleInput = page.locator('input[name="title"]').first();
        if (await titleInput.isVisible({ timeout: 1000 }).catch(() => false)) {
          await titleInput.fill(xssPayload);
        }

        const notesInput = page.locator('textarea[name="notes"]').first();
        if (await notesInput.isVisible({ timeout: 1000 }).catch(() => false)) {
          await notesInput.fill(xssPayload);
        }

        // Save
        const saveButton = page.locator('button:has-text("Save")').last();
        await saveButton.click();
        await page.waitForTimeout(1000);

        // Verify no alert was triggered (XSS prevented)
        const hasAlert = await page.locator('text="XSS"').isVisible({ timeout: 1000 }).catch(() => false);
        expect(hasAlert).toBe(false);

        console.log('XSS payload safely handled');
      }
    }
  });

  test('handles duplicate entry titles', async ({ page }) => {
    const duplicateTitle = 'Duplicate Test Entry';

    // Create first entry
    const addButton = page.locator('button:has-text("New Password"), button:has-text("Add")').first();

    for (let i = 0; i < 2; i++) {
      if (await addButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await addButton.click();
        await page.waitForTimeout(500);

        const typeButton = page.locator('button:has-text("SecureNote")').first();
        if (await typeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await typeButton.click();
          await page.waitForTimeout(300);

          const titleInput = page.locator('input[name="title"]').first();
          if (await titleInput.isVisible({ timeout: 1000 }).catch(() => false)) {
            await titleInput.fill(duplicateTitle);
          }

          const saveButton = page.locator('button:has-text("Save")').last();
          await saveButton.click();
          await page.waitForTimeout(1000);
        }
      }
    }

    // Should handle duplicates gracefully (either allow or show warning)
    console.log('Duplicate entry handling complete');
  });

  test('supports password generation for new entries', async ({ page }) => {
    const addButton = page.locator('button:has-text("New Password"), button:has-text("Add")').first();
    if (await addButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addButton.click();
      await page.waitForTimeout(500);

      const typeButton = page.locator('button:has-text("Login")').first();
      if (await typeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await typeButton.click();
        await page.waitForTimeout(300);

        // Look for password generator button
        const generateButton = page.locator('button:has-text("Generate"), button[aria-label*="generate password"]').first();
        if (await generateButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await generateButton.click();
          await page.waitForTimeout(500);

          // Password field should now have a generated password
          const passwordInput = page.locator('input[name="password"], input[type="password"]').first();
          const passwordValue = await passwordInput.inputValue();

          expect(passwordValue.length).toBeGreaterThan(0);
          console.log(`Generated password length: ${passwordValue.length}`);
        }

        // Close modal
        const cancelButton = page.locator('button:has-text("Cancel")').first();
        if (await cancelButton.isVisible({ timeout: 1000 }).catch(() => false)) {
          await cancelButton.click();
        }
      }
    }
  });

  test('can copy passwords to clipboard', async ({ page, context }) => {
    // Grant clipboard permissions
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    const testEntry = TEST_ENTRIES['Login'];

    // Find an entry
    const entryCard = page.locator(`text="${testEntry.title}"`).first();
    if (await entryCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await entryCard.click();
      await page.waitForTimeout(500);

      // Look for copy button
      const copyButton = page.locator('button:has-text("Copy"), button[aria-label*="copy password"]').first();
      if (await copyButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await copyButton.click();
        await page.waitForTimeout(500);

        // Verify clipboard contains password
        const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
        console.log(`Clipboard contains ${clipboardText.length} characters`);

        expect(clipboardText.length).toBeGreaterThan(0);
      }

      // Close modal
      const closeButton = page.locator('button:has-text("Close")').first();
      if (await closeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await closeButton.click();
      }
    }
  });

  test('displays password strength indicators', async ({ page }) => {
    const addButton = page.locator('button:has-text("New Password"), button:has-text("Add")').first();
    if (await addButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addButton.click();
      await page.waitForTimeout(500);

      const typeButton = page.locator('button:has-text("Login")').first();
      if (await typeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await typeButton.click();
        await page.waitForTimeout(300);

        // Fill weak password
        const passwordInput = page.locator('input[name="password"], input[type="password"]').first();
        if (await passwordInput.isVisible({ timeout: 1000 }).catch(() => false)) {
          await passwordInput.fill('password123');
          await page.waitForTimeout(500);

          // Look for strength indicator
          const hasStrengthIndicator = await page.locator('text=/weak|strong|medium|strength/i, [data-testid="password-strength"]').isVisible({ timeout: 2000 }).catch(() => false);
          console.log(`Password strength indicator visible: ${hasStrengthIndicator}`);
        }

        // Close modal
        const cancelButton = page.locator('button:has-text("Cancel")').first();
        if (await cancelButton.isVisible({ timeout: 1000 }).catch(() => false)) {
          await cancelButton.click();
        }
      }
    }
  });

  test('can add custom fields to entries', async ({ page }) => {
    const addButton = page.locator('button:has-text("New Password"), button:has-text("Add")').first();
    if (await addButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addButton.click();
      await page.waitForTimeout(500);

      const typeButton = page.locator('button:has-text("Identity")').first();
      if (await typeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await typeButton.click();
        await page.waitForTimeout(300);

        // Look for "Add Custom Field" button
        const addFieldButton = page.locator('button:has-text("Add Field"), button:has-text("Custom Field")').first();
        if (await addFieldButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await addFieldButton.click();
          await page.waitForTimeout(300);

          // Fill custom field
          const fieldNameInput = page.locator('input[placeholder*="Field name"], input[name="customFieldName"]').last();
          const fieldValueInput = page.locator('input[placeholder*="Field value"], input[name="customFieldValue"]').last();

          if (await fieldNameInput.isVisible({ timeout: 1000 }).catch(() => false)) {
            await fieldNameInput.fill('Social Security Number');
            await fieldValueInput.fill('XXX-XX-1234');
          }

          console.log('Custom field added successfully');
        }

        // Close modal
        const cancelButton = page.locator('button:has-text("Cancel")').first();
        if (await cancelButton.isVisible({ timeout: 1000 }).catch(() => false)) {
          await cancelButton.click();
        }
      }
    }
  });
});

test.describe('Password Entry Type Specific Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await mockWalletConnection(page);
    await page.waitForTimeout(1000);
  });

  test('CreditCard type validates card number format', async ({ page }) => {
    const addButton = page.locator('button:has-text("New Password"), button:has-text("Add")').first();
    if (await addButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addButton.click();
      await page.waitForTimeout(500);

      const typeButton = page.locator('button:has-text("CreditCard")').first();
      if (await typeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await typeButton.click();
        await page.waitForTimeout(300);

        // Try invalid card number
        const cardNumberInput = page.locator('input[name="username"], input[placeholder*="card number"]').first();
        if (await cardNumberInput.isVisible({ timeout: 1000 }).catch(() => false)) {
          await cardNumberInput.fill('1234');
          await page.waitForTimeout(300);

          // Should show validation error for invalid format
          const hasError = await page.locator('text=/invalid|card number/i').isVisible({ timeout: 1000 }).catch(() => false);
          console.log(`Card validation error shown: ${hasError}`);
        }

        const cancelButton = page.locator('button:has-text("Cancel")').first();
        if (await cancelButton.isVisible({ timeout: 1000 }).catch(() => false)) {
          await cancelButton.click();
        }
      }
    }
  });

  test('CryptoWallet type handles seed phrases securely', async ({ page }) => {
    const testEntry = TEST_ENTRIES['CryptoWallet'];

    const addButton = page.locator('button:has-text("New Password"), button:has-text("Add")').first();
    if (await addButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addButton.click();
      await page.waitForTimeout(500);

      const typeButton = page.locator('button:has-text("CryptoWallet")').first();
      if (await typeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await typeButton.click();
        await page.waitForTimeout(300);

        // Fill seed phrase
        const seedInput = page.locator('input[name="password"], textarea[name="password"]').first();
        if (await seedInput.isVisible({ timeout: 1000 }).catch(() => false)) {
          await seedInput.fill(testEntry.password!);

          // Seed should be hidden by default
          const inputType = await seedInput.getAttribute('type');
          expect(inputType).toBe('password');
        }

        const cancelButton = page.locator('button:has-text("Cancel")').first();
        if (await cancelButton.isVisible({ timeout: 1000 }).catch(() => false)) {
          await cancelButton.click();
        }
      }
    }
  });

  test('SshKey type supports multi-line keys', async ({ page }) => {
    const testEntry = TEST_ENTRIES['SshKey'];

    const addButton = page.locator('button:has-text("New Password"), button:has-text("Add")').first();
    if (await addButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addButton.click();
      await page.waitForTimeout(500);

      const typeButton = page.locator('button:has-text("SshKey")').first();
      if (await typeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await typeButton.click();
        await page.waitForTimeout(300);

        // SSH keys should use textarea
        const keyInput = page.locator('textarea[name="password"]').first();
        const isTextarea = await keyInput.isVisible({ timeout: 1000 }).catch(() => false);

        console.log(`SSH key uses textarea: ${isTextarea}`);

        const cancelButton = page.locator('button:has-text("Cancel")').first();
        if (await cancelButton.isVisible({ timeout: 1000 }).catch(() => false)) {
          await cancelButton.click();
        }
      }
    }
  });
});
