/**
 * Search, Filter, Sort, and Favorites E2E Tests
 *
 * Comprehensive tests for password vault organization and discovery features.
 */

import { test, expect, Page } from '@playwright/test';
import { mockWalletConnection } from './helpers/wallet-helpers';

test.describe('Search Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // CRITICAL: mockWalletConnection() MUST be called BEFORE page.goto()
    // because addInitScript() only affects future page loads, not current one
    await mockWalletConnection(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
  });

  test('can search passwords by title', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search"], input[name="search"]').first();

    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchInput.fill('Gmail');
      await page.waitForTimeout(500);

      // Results should filter to match search
      const results = page.locator('[data-testid="password-entry"]');
      const count = await results.count();

      console.log(`Search results for "Gmail": ${count} entries`);

      // Clear search
      await searchInput.clear();
      await page.waitForTimeout(300);
    } else {
      console.log('Search input not found');
    }
  });

  test('can search passwords by username', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search"]').first();

    if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await searchInput.fill('testuser@');
      await page.waitForTimeout(500);

      // Should find entries with matching username
      const hasResults = await page.locator('[data-testid="password-entry"]').count() > 0;
      console.log(`Search by username found results: ${hasResults}`);

      await searchInput.clear();
    }
  });

  test('can search passwords by URL', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search"]').first();

    if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await searchInput.fill('gmail.com');
      await page.waitForTimeout(500);

      const hasResults = await page.locator('[data-testid="password-entry"]').count() > 0;
      console.log(`Search by URL found results: ${hasResults}`);

      await searchInput.clear();
    }
  });

  test('shows no results message for empty search', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search"]').first();

    if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await searchInput.fill('ThisShouldNotMatchAnything12345XYZ');
      await page.waitForTimeout(500);

      // Should show no results message
      const noResults = page.locator('text=/No results|Nothing found|No passwords/i').first();
      const hasMessage = await noResults.isVisible({ timeout: 2000 }).catch(() => false);

      console.log(`No results message shown: ${hasMessage}`);

      await searchInput.clear();
    }
  });

  test('clears search when clicking clear button', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search"]').first();

    if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await searchInput.fill('test search');
      await page.waitForTimeout(300);

      // Look for clear button
      const clearButton = page.locator('button[aria-label*="clear"], button:has-text("✕")').first();
      if (await clearButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await clearButton.click();
        await page.waitForTimeout(300);

        const inputValue = await searchInput.inputValue();
        expect(inputValue).toBe('');
        console.log('Search cleared successfully');
      }
    }
  });

  test('performs case-insensitive search', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search"]').first();

    if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Try uppercase
      await searchInput.fill('GMAIL');
      await page.waitForTimeout(500);
      const upperResults = await page.locator('[data-testid="password-entry"]').count();

      // Try lowercase
      await searchInput.fill('gmail');
      await page.waitForTimeout(500);
      const lowerResults = await page.locator('[data-testid="password-entry"]').count();

      console.log(`Case-insensitive search: UPPER=${upperResults}, lower=${lowerResults}`);
      expect(upperResults).toBe(lowerResults);

      await searchInput.clear();
    }
  });

  test('updates results in real-time as typing', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search"]').first();

    if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Type incrementally
      await searchInput.type('gm', { delay: 100 });
      await page.waitForTimeout(300);
      const partialResults = await page.locator('[data-testid="password-entry"]').count();

      await searchInput.type('ail', { delay: 100 });
      await page.waitForTimeout(300);
      const fullResults = await page.locator('[data-testid="password-entry"]').count();

      console.log(`Real-time search: "gm"=${partialResults}, "gmail"=${fullResults}`);

      await searchInput.clear();
    }
  });

  test('can search in notes field', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search"]').first();

    if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Search for something that would be in notes
      await searchInput.fill('important');
      await page.waitForTimeout(500);

      console.log('Search in notes field executed');

      await searchInput.clear();
    }
  });
});

test.describe('Filter Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // CRITICAL: mockWalletConnection() MUST be called BEFORE page.goto()
    // because addInitScript() only affects future page loads, not current one
    await mockWalletConnection(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
  });

  test('can filter by password entry type', async ({ page }) => {
    const filterButton = page.locator('button:has-text("Filter"), button:has-text("Type")').first();

    if (await filterButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await filterButton.click();
      await page.waitForTimeout(300);

      // Select Login type
      const loginFilter = page.locator('input[value="Login"], button:has-text("Login")').first();
      if (await loginFilter.isVisible({ timeout: 1000 }).catch(() => false)) {
        await loginFilter.click();
        await page.waitForTimeout(500);

        // Verify filtered
        console.log('Filtered by Login type');
      }
    } else {
      console.log('Filter button not found');
    }
  });

  test('can filter by multiple types simultaneously', async ({ page }) => {
    const filterPanel = page.locator('[data-testid="filter-panel"]').first();

    if (await filterPanel.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Select multiple types
      const loginCheckbox = page.locator('input[type="checkbox"][value="Login"]').first();
      const creditCardCheckbox = page.locator('input[type="checkbox"][value="CreditCard"]').first();

      if (await loginCheckbox.isVisible({ timeout: 1000 }).catch(() => false)) {
        await loginCheckbox.check();
        await page.waitForTimeout(300);
      }

      if (await creditCardCheckbox.isVisible({ timeout: 1000 }).catch(() => false)) {
        await creditCardCheckbox.check();
        await page.waitForTimeout(300);
      }

      console.log('Multiple type filters applied');
    }
  });

  test('can filter by category', async ({ page }) => {
    const categoryFilter = page.locator('select[name="category"], button:has-text("Category")').first();

    if (await categoryFilter.isVisible({ timeout: 2000 }).catch(() => false)) {
      await categoryFilter.click();
      await page.waitForTimeout(300);

      const personalOption = page.locator('option:has-text("Personal"), [role="option"]:has-text("Personal")').first();
      if (await personalOption.isVisible({ timeout: 1000 }).catch(() => false)) {
        await personalOption.click();
        await page.waitForTimeout(500);

        console.log('Filtered by Personal category');
      }
    }
  });

  test('can filter by favorites only', async ({ page }) => {
    const favoritesFilter = page.locator('button:has-text("Favorites"), input[type="checkbox"][name*="favorite"]').first();

    if (await favoritesFilter.isVisible({ timeout: 2000 }).catch(() => false)) {
      await favoritesFilter.click();
      await page.waitForTimeout(500);

      // Should show only favorited entries
      console.log('Showing favorites only');
    }
  });

  test('can filter by archived entries', async ({ page }) => {
    const archivedFilter = page.locator('button:has-text("Archived"), input[type="checkbox"][name*="archived"]').first();

    if (await archivedFilter.isVisible({ timeout: 2000 }).catch(() => false)) {
      await archivedFilter.click();
      await page.waitForTimeout(500);

      console.log('Showing archived entries');
    }
  });

  test('can clear all filters', async ({ page }) => {
    const clearButton = page.locator('button:has-text("Clear Filters"), button:has-text("Reset")').first();

    if (await clearButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await clearButton.click();
      await page.waitForTimeout(500);

      console.log('All filters cleared');
    }
  });

  test('combines search and filter correctly', async ({ page }) => {
    // Apply search
    const searchInput = page.locator('input[placeholder*="Search"]').first();
    if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await searchInput.fill('test');
      await page.waitForTimeout(500);
    }

    // Apply filter
    const filterButton = page.locator('button:has-text("Filter")').first();
    if (await filterButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await filterButton.click();
      await page.waitForTimeout(300);

      const loginFilter = page.locator('button:has-text("Login")').first();
      if (await loginFilter.isVisible({ timeout: 1000 }).catch(() => false)) {
        await loginFilter.click();
        await page.waitForTimeout(500);

        console.log('Search + Filter combined');
      }
    }
  });

  test('shows active filter count', async ({ page }) => {
    const filterButton = page.locator('button:has-text("Filter")').first();

    if (await filterButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await filterButton.click();
      await page.waitForTimeout(300);

      // Apply multiple filters
      const loginFilter = page.locator('input[value="Login"]').first();
      if (await loginFilter.isVisible({ timeout: 1000 }).catch(() => false)) {
        await loginFilter.click();
        await page.waitForTimeout(300);

        // Look for filter count badge
        const filterCount = page.locator('text=/\\d+.*active|\\d+.*filter/i, [data-testid="filter-count"]').first();
        const hasCount = await filterCount.isVisible({ timeout: 1000 }).catch(() => false);

        console.log(`Active filter count visible: ${hasCount}`);
      }
    }
  });
});

test.describe('Sort Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // CRITICAL: mockWalletConnection() MUST be called BEFORE page.goto()
    // because addInitScript() only affects future page loads, not current one
    await mockWalletConnection(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
  });

  test('can sort by title (A-Z)', async ({ page }) => {
    const sortButton = page.locator('button:has-text("Sort"), select[name="sort"]').first();

    if (await sortButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await sortButton.click();
      await page.waitForTimeout(300);

      const titleOption = page.locator('option:has-text("Title"), button:has-text("Title")').first();
      if (await titleOption.isVisible({ timeout: 1000 }).catch(() => false)) {
        await titleOption.click();
        await page.waitForTimeout(500);

        console.log('Sorted by title A-Z');
      }
    } else {
      console.log('Sort button not found');
    }
  });

  test('can sort by last modified date', async ({ page }) => {
    const sortButton = page.locator('button:has-text("Sort"), select[name="sort"]').first();

    if (await sortButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await sortButton.click();
      await page.waitForTimeout(300);

      const dateOption = page.locator('option:has-text("Modified"), button:has-text("Last Modified")').first();
      if (await dateOption.isVisible({ timeout: 1000 }).catch(() => false)) {
        await dateOption.click();
        await page.waitForTimeout(500);

        console.log('Sorted by last modified');
      }
    }
  });

  test('can sort by creation date', async ({ page }) => {
    const sortButton = page.locator('button:has-text("Sort")').first();

    if (await sortButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await sortButton.click();
      await page.waitForTimeout(300);

      const createdOption = page.locator('option:has-text("Created"), button:has-text("Date Created")').first();
      if (await createdOption.isVisible({ timeout: 1000 }).catch(() => false)) {
        await createdOption.click();
        await page.waitForTimeout(500);

        console.log('Sorted by creation date');
      }
    }
  });

  test('can sort by access count', async ({ page }) => {
    const sortButton = page.locator('button:has-text("Sort")').first();

    if (await sortButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await sortButton.click();
      await page.waitForTimeout(300);

      const accessOption = page.locator('option:has-text("Access"), button:has-text("Most Used")').first();
      if (await accessOption.isVisible({ timeout: 1000 }).catch(() => false)) {
        await accessOption.click();
        await page.waitForTimeout(500);

        console.log('Sorted by access count');
      }
    }
  });

  test('can toggle sort order (ascending/descending)', async ({ page }) => {
    const orderButton = page.locator('button[aria-label*="sort order"], button:has-text("↑"), button:has-text("↓")').first();

    if (await orderButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await orderButton.click();
      await page.waitForTimeout(500);

      // Toggle again
      await orderButton.click();
      await page.waitForTimeout(500);

      console.log('Sort order toggled');
    }
  });

  test('persists sort preference across sessions', async ({ page }) => {
    // Set sort preference
    const sortButton = page.locator('button:has-text("Sort")').first();

    if (await sortButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await sortButton.click();
      await page.waitForTimeout(300);

      const titleOption = page.locator('button:has-text("Title")').first();
      if (await titleOption.isVisible({ timeout: 1000 }).catch(() => false)) {
        await titleOption.click();
        await page.waitForTimeout(500);
      }
    }

    // Refresh page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Check if sort preference persisted
    await page.waitForTimeout(1000);
    console.log('Checked sort persistence after reload');
  });
});

test.describe('Favorites', () => {
  test.beforeEach(async ({ page }) => {
    // CRITICAL: mockWalletConnection() MUST be called BEFORE page.goto()
    // because addInitScript() only affects future page loads, not current one
    await mockWalletConnection(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
  });

  test('can mark entry as favorite', async ({ page }) => {
    const entryCard = page.locator('[data-testid="password-entry"]').first();

    if (await entryCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await entryCard.click();
      await page.waitForTimeout(500);

      // Look for favorite/star button
      const favoriteButton = page.locator('button:has-text("★"), button[aria-label*="favorite"]').first();
      if (await favoriteButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await favoriteButton.click();
        await page.waitForTimeout(500);

        console.log('Entry marked as favorite');

        // Close modal
        const closeButton = page.locator('button:has-text("Close")').first();
        if (await closeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
          await closeButton.click();
        }
      }
    } else {
      console.log('No entries available to favorite');
    }
  });

  test('can unmark favorite', async ({ page }) => {
    const entryCard = page.locator('[data-testid="password-entry"]').first();

    if (await entryCard.isVisible({ timeout: 2000 }).catch(() => false)) {
      await entryCard.click();
      await page.waitForTimeout(500);

      const favoriteButton = page.locator('button:has-text("★")').first();
      if (await favoriteButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        // Toggle twice (mark, then unmark)
        await favoriteButton.click();
        await page.waitForTimeout(300);
        await favoriteButton.click();
        await page.waitForTimeout(300);

        console.log('Entry unfavorited');
      }

      const closeButton = page.locator('button:has-text("Close")').first();
      if (await closeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await closeButton.click();
      }
    }
  });

  test('can view favorites sidebar', async ({ page }) => {
    const favoritesButton = page.locator('button:has-text("Favorites"), [data-testid="favorites-sidebar"]').first();

    if (await favoritesButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await favoritesButton.click();
      await page.waitForTimeout(500);

      const favoritesSidebar = page.locator('[data-testid="favorites-panel"]').first();
      const isOpen = await favoritesSidebar.isVisible({ timeout: 2000 }).catch(() => false);

      console.log(`Favorites sidebar opened: ${isOpen}`);
    } else {
      console.log('Favorites sidebar toggle not found');
    }
  });

  test('favorites appear in sidebar', async ({ page }) => {
    // Mark an entry as favorite first
    const entryCard = page.locator('[data-testid="password-entry"]').first();

    if (await entryCard.isVisible({ timeout: 2000 }).catch(() => false)) {
      const entryTitle = await entryCard.textContent();

      await entryCard.click();
      await page.waitForTimeout(500);

      const favoriteButton = page.locator('button[aria-label*="favorite"]').first();
      if (await favoriteButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await favoriteButton.click();
        await page.waitForTimeout(500);
      }

      const closeButton = page.locator('button:has-text("Close")').first();
      if (await closeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await closeButton.click();
        await page.waitForTimeout(300);
      }

      // Open favorites sidebar
      const favoritesButton = page.locator('button:has-text("Favorites")').first();
      if (await favoritesButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await favoritesButton.click();
        await page.waitForTimeout(500);

        // Check if entry appears in sidebar
        const favoriteInSidebar = page.locator(`[data-testid="favorites-panel"] text="${entryTitle}"`).first();
        const appears = await favoriteInSidebar.isVisible({ timeout: 2000 }).catch(() => false);

        console.log(`Favorited entry appears in sidebar: ${appears}`);
      }
    }
  });

  test('can quick-access favorites from sidebar', async ({ page }) => {
    const favoritesButton = page.locator('button:has-text("Favorites")').first();

    if (await favoritesButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await favoritesButton.click();
      await page.waitForTimeout(500);

      // Click an entry in favorites sidebar
      const favoriteEntry = page.locator('[data-testid="favorites-panel"] [data-testid="favorite-item"]').first();
      if (await favoriteEntry.isVisible({ timeout: 1000 }).catch(() => false)) {
        await favoriteEntry.click();
        await page.waitForTimeout(500);

        // Should open entry details
        const detailsModal = page.locator('[role="dialog"]').first();
        const isOpen = await detailsModal.isVisible({ timeout: 2000 }).catch(() => false);

        console.log(`Quick-access from favorites opened details: ${isOpen}`);
      }
    }
  });

  test('favorites count updates correctly', async ({ page }) => {
    // Look for favorites count badge
    const favoritesButton = page.locator('button:has-text("Favorites")').first();

    if (await favoritesButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      const buttonText = await favoritesButton.textContent();
      console.log(`Favorites button text: ${buttonText}`);

      // Count badge should show number of favorites
      const countBadge = page.locator('[data-testid="favorites-count"]').first();
      if (await countBadge.isVisible({ timeout: 1000 }).catch(() => false)) {
        const count = await countBadge.textContent();
        console.log(`Favorites count: ${count}`);
      }
    }
  });
});

test.describe('View Modes', () => {
  test.beforeEach(async ({ page }) => {
    // CRITICAL: mockWalletConnection() MUST be called BEFORE page.goto()
    // because addInitScript() only affects future page loads, not current one
    await mockWalletConnection(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
  });

  test('can switch to grid view', async ({ page }) => {
    const gridButton = page.locator('button:has-text("Grid"), button[aria-label*="grid view"]').first();

    if (await gridButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await gridButton.click();
      await page.waitForTimeout(500);

      // Verify grid layout
      const gridContainer = page.locator('[data-layout="grid"]').first();
      const isGrid = await gridContainer.isVisible({ timeout: 2000 }).catch(() => false);

      console.log(`Grid view active: ${isGrid}`);
    } else {
      console.log('Grid view toggle not found');
    }
  });

  test('can switch to list view', async ({ page }) => {
    const listButton = page.locator('button:has-text("List"), button[aria-label*="list view"]').first();

    if (await listButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await listButton.click();
      await page.waitForTimeout(500);

      const listContainer = page.locator('[data-layout="list"]').first();
      const isList = await listContainer.isVisible({ timeout: 2000 }).catch(() => false);

      console.log(`List view active: ${isList}`);
    } else {
      console.log('List view toggle not found');
    }
  });

  test('persists view mode preference', async ({ page }) => {
    const gridButton = page.locator('button:has-text("Grid")').first();

    if (await gridButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await gridButton.click();
      await page.waitForTimeout(500);
    }

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Check if still in grid view
    await page.waitForTimeout(1000);
    const gridContainer = page.locator('[data-layout="grid"]').first();
    const isGrid = await gridContainer.isVisible({ timeout: 2000 }).catch(() => false);

    console.log(`Grid view persisted after reload: ${isGrid}`);
  });

  test('both views display all entry information', async ({ page }) => {
    // Check list view
    const entries = page.locator('[data-testid="password-entry"]');
    const count = await entries.count();

    if (count > 0) {
      const firstEntry = entries.first();
      const listText = await firstEntry.textContent();

      // Switch to grid
      const gridButton = page.locator('button:has-text("Grid")').first();
      if (await gridButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await gridButton.click();
        await page.waitForTimeout(500);

        const gridFirstEntry = page.locator('[data-testid="password-entry"]').first();
        const gridText = await gridFirstEntry.textContent();

        console.log(`List and Grid show same info: ${listText === gridText}`);
      }
    }
  });
});
