# E2E Testing Framework for Solana Lockbox

Comprehensive end-to-end testing using Playwright for the Solana Lockbox password manager.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Test Suite Coverage](#test-suite-coverage)
- [Architecture](#architecture)
- [Running Tests](#running-tests)
- [Writing New Tests](#writing-new-tests)
- [CI/CD Integration](#cicd-integration)
- [Troubleshooting](#troubleshooting)

## Overview

This E2E test suite uses **Playwright 1.56.1** to test the Solana Lockbox application across different scenarios:

- ✅ Smoke tests (basic functionality without wallet)
- ✅ Wallet connection and authentication
- ✅ Password CRUD operations (all 7 entry types)
- ✅ Search, filter, and favorites
- ✅ Batch operations
- ✅ Navigation and UI components
- ✅ Security features (Danger Zone)
- ✅ Advanced tools (Health Dashboard, Password Generator, Import/Export)

### Test Statistics

- **Total Tests**: 100+ comprehensive test cases
- **Test Files**: 8 spec files
- **Browsers**: Chromium (Firefox and WebKit ready)
- **Average Duration**: ~30-70 seconds
- **Success Rate**: 100% pass on smoke tests

## Quick Start

### Prerequisites

1. **Node.js** 20+ installed
2. **npm** or **yarn** package manager
3. **Solana Devnet** connection (for blockchain tests)
4. **Local dev server** running on port 3001

### Installation

```bash
# Install dependencies (if not already done)
cd /Users/graffito/solana-lockbox/nextjs-app
npm install

# Install Playwright browsers
npx playwright install chromium
```

### Running Your First Test

```bash
# Start the dev server (in one terminal)
npm run dev

# Run smoke tests (in another terminal)
npm run test:e2e -- smoke.spec.ts

# Or run all tests
npm run test:e2e
```

## Test Suite Coverage

### 1. Smoke Tests (`smoke.spec.ts`)

Basic application health checks without requiring wallet connection.

```bash
npm run test:e2e -- smoke.spec.ts
```

**Tests:**
- ✅ Homepage loads successfully
- ✅ Dashboard displays without wallet
- ✅ Settings page loads correctly
- ✅ No console errors on page load
- ✅ Application is responsive (mobile/tablet/desktop)
- ✅ FAQ section accessibility

### 2. Wallet Authentication (`wallet-authentication.spec.ts`)

Tests wallet connection flow with mock wallet support.

```bash
npm run test:e2e -- wallet-authentication.spec.ts
```

**Tests:**
- ✅ Displays homepage with wallet connect button
- ✅ Can mock wallet connection for headless testing
- ✅ Handles wallet selection modal
- ✅ Persists connection state

### 3. Password CRUD Operations (`password-crud.spec.ts`)

Comprehensive CRUD tests for all 7 password entry types.

```bash
npm run test:e2e -- password-crud.spec.ts --timeout=90000
```

**Password Types Tested:**
- Login (username/password)
- Credit Card
- Secure Note
- Identity (SSN, passport)
- API Key
- SSH Key
- Crypto Wallet (seed phrases)

**Operations:**
- ✅ Create entries for all types
- ✅ Read/view entry details
- ✅ Update entry fields
- ✅ Delete entries
- ✅ Bulk operations

### 4. Search, Filter & Favorites (`search-filter-favorites.spec.ts`)

Advanced search and organization features.

```bash
npm run test:e2e -- search-filter-favorites.spec.ts
```

**Tests:**
- ✅ Search passwords by title
- ✅ Filter by category
- ✅ Filter by password type
- ✅ Mark/unmark favorites
- ✅ View favorites-only list
- ✅ Clear search and filters

### 5. Batch Operations (`batch-operations.spec.ts`)

Bulk operations and error handling.

```bash
npm run test:e2e -- batch-operations.spec.ts
```

**Tests:**
- ✅ Enable/disable batch mode
- ✅ Select multiple entries
- ✅ Batch delete
- ✅ Batch update category
- ✅ Batch export
- ✅ Progress indicators
- ✅ Cancel operations
- ✅ Error handling (network, RPC, insufficient SOL)
- ✅ Input validation
- ✅ Edge cases (empty vault, max capacity, Unicode)

### 6. Features & Tools (`features-tools.spec.ts`)

Advanced application features.

```bash
npm run test:e2e -- features-tools.spec.ts
```

**Tests:**
- ✅ Health Dashboard
- ✅ Password Generator
- ✅ Import/Export functionality
- ✅ Backup codes
- ✅ 2FA/TOTP

### 7. Navigation (`navigation.spec.ts`)

Page navigation and routing.

```bash
npm run test:e2e -- navigation.spec.ts
```

**Tests:**
- ✅ Dashboard to Settings navigation
- ✅ Tab switching
- ✅ Back navigation
- ✅ URL routing

### 8. Danger Zone (`danger-zone-advanced.spec.ts`)

Critical security operations.

```bash
npm run test:e2e -- danger-zone-advanced.spec.ts
```

**Tests:**
- ✅ Access Danger Zone in settings
- ✅ Warning displays before reset
- ✅ Confirmation required for account reset
- ✅ Empty state after reset

## Architecture

### Project Structure

```
e2e/
├── README.md                    # This file
├── smoke.spec.ts                # Basic health checks
├── wallet-authentication.spec.ts # Wallet connection tests
├── password-crud.spec.ts         # CRUD operations
├── search-filter-favorites.spec.ts # Search/filter tests
├── batch-operations.spec.ts      # Bulk operations
├── features-tools.spec.ts        # Advanced features
├── navigation.spec.ts            # Navigation tests
├── danger-zone-advanced.spec.ts  # Security operations
├── helpers/
│   ├── wallet-helpers.ts         # Wallet mock utilities
│   ├── test-data.ts              # Test data generators
│   └── initialize-test-vault.ts  # Vault setup helpers
└── scripts/
    ├── README.md                 # Script documentation
    └── setup-test-vault.ts       # Manual vault setup
```

### Helper Modules

#### `helpers/wallet-helpers.ts`

Utilities for mocking Phantom wallet in headless tests.

```typescript
import { mockWalletConnection, signPhantomTransaction } from './helpers/wallet-helpers';

// Mock wallet before navigation
await mockWalletConnection(page);
await page.goto('/');

// Sign transactions
await signPhantomTransaction(page, context, { approve: true });
```

#### `helpers/test-data.ts`

Consistent test data across tests.

```typescript
import { TEST_ENTRIES, generateBulkEntries, WEAK_PASSWORDS } from './helpers/test-data';

// Get test entry for specific type
const loginEntry = TEST_ENTRIES[PasswordEntryType.Login];

// Generate bulk entries
const entries = generateBulkEntries(10, PasswordEntryType.Login);
```

#### `helpers/initialize-test-vault.ts`

Vault initialization and state management.

```typescript
import { initializeTestVault, waitForVaultReady, isVaultInitialized } from './helpers/initialize-test-vault';

// Initialize vault if needed
const initialized = await initializeTestVault(page);

// Wait for vault to be ready
await waitForVaultReady(page, 10000);

// Check initialization status
const hasVault = await isVaultInitialized(page);
```

### Configuration

**[playwright.config.ts](../playwright.config.ts)**

```typescript
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  timeout: 30 * 1000,
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3001',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
```

## Running Tests

### Basic Commands

```bash
# Run all tests
npm run test:e2e

# Run specific test file
npm run test:e2e -- smoke.spec.ts

# Run with UI mode (interactive)
npm run test:e2e:ui

# Run in headed mode (see browser)
npm run test:e2e:headed

# Debug mode (step through)
npm run test:e2e:debug

# View test report
npm run test:report
```

### Advanced Options

```bash
# Run specific test by name
npm run test:e2e -- -g "can create password entries"

# Run with specific browser
npm run test:e2e -- --project=chromium

# Run with custom timeout
npm run test:e2e -- --timeout=60000

# Run in parallel
npm run test:e2e -- --workers=4

# Generate report
npm run test:e2e -- --reporter=html
```

### Filtering Tests

```bash
# Run only smoke tests
npm run test:e2e -- smoke.spec.ts

# Run CRUD tests with increased timeout
npm run test:e2e -- password-crud.spec.ts --timeout=90000

# Run multiple files
npm run test:e2e -- smoke.spec.ts navigation.spec.ts
```

## Writing New Tests

### Test Template

```typescript
import { test, expect, Page } from '@playwright/test';
import { mockWalletConnection } from './helpers/wallet-helpers';
import { TEST_ENTRIES } from './helpers/test-data';

test.describe('My New Feature', () => {
  test.beforeEach(async ({ page }) => {
    // Setup: Mock wallet and navigate
    await mockWalletConnection(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should do something', async ({ page }) => {
    // Arrange
    const button = page.locator('button:has-text("Click Me")');

    // Act
    await button.click();

    // Assert
    await expect(page.locator('.result')).toHaveText('Success!');
  });
});
```

### Best Practices

#### 1. Use Semantic Selectors

```typescript
// ✅ Good - semantic and resilient
await page.getByRole('button', { name: /connect/i }).click();
await page.getByLabel('Password').fill('secret');
await page.getByText('Welcome').waitFor();

// ❌ Bad - brittle and implementation-dependent
await page.locator('#btn-123').click();
await page.locator('div > span.class-xyz').click();
```

#### 2. Wait for State, Not Time

```typescript
// ✅ Good - wait for specific condition
await page.waitForLoadState('networkidle');
await button.waitFor({ state: 'visible' });
await expect(element).toBeVisible();

// ❌ Bad - arbitrary waits
await page.waitForTimeout(5000);
```

#### 3. Handle Async Operations

```typescript
// ✅ Good - proper async handling
test('handles transaction', async ({ page }) => {
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByText('Success')).toBeVisible({ timeout: 30000 });
});

// ❌ Bad - missing await
test('handles transaction', async ({ page }) => {
  page.getByRole('button', { name: 'Submit' }).click(); // Missing await!
  await expect(page.getByText('Success')).toBeVisible();
});
```

#### 4. Use Test Helpers

```typescript
// ✅ Good - reusable helpers
import { initializeTestVault } from './helpers/initialize-test-vault';

test.beforeEach(async ({ page }) => {
  await mockWalletConnection(page);
  await page.goto('/');
  await initializeTestVault(page);
});

// ❌ Bad - duplicated setup code
test.beforeEach(async ({ page }) => {
  // 50 lines of duplicate setup code...
});
```

#### 5. Organize with describe Blocks

```typescript
test.describe('Password Manager', () => {
  test.describe('Create Operations', () => {
    test('can create login entry', async ({ page }) => { /* ... */ });
    test('can create credit card', async ({ page }) => { /* ... */ });
  });

  test.describe('Update Operations', () => {
    test('can update title', async ({ page }) => { /* ... */ });
    test('can update password', async ({ page }) => { /* ... */ });
  });
});
```

### Debugging Tips

#### 1. Use trace viewer

```bash
npx playwright show-trace trace.zip
```

#### 2. Take screenshots on failure

```typescript
test('my test', async ({ page }, testInfo) => {
  try {
    // Test code
  } catch (error) {
    await page.screenshot({
      path: `test-results/${testInfo.title}-failure.png`,
      fullPage: true
    });
    throw error;
  }
});
```

#### 3. Use console logging

```typescript
page.on('console', msg => console.log('BROWSER:', msg.text()));
page.on('pageerror', error => console.error('PAGE ERROR:', error));
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: |
          cd nextjs-app
          npm ci
          npx playwright install --with-deps chromium

      - name: Run E2E tests
        run: |
          cd nextjs-app
          npm run test:e2e
        env:
          CI: true

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: nextjs-app/playwright-report/
          retention-days: 30
```

### Pre-commit Hook

Create `.husky/pre-push`:

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

cd nextjs-app
npm run test:e2e -- smoke.spec.ts
```

## Troubleshooting

### Common Issues

#### Issue: "Browser not found"

**Solution:**
```bash
npx playwright install chromium
```

#### Issue: "Timeout waiting for page load"

**Solution:**
```typescript
// Increase timeout in test
test.setTimeout(60000);

// Or in config
timeout: 60 * 1000
```

#### Issue: "Mock wallet not injected"

**Solution:**
```typescript
// Ensure mockWalletConnection() is called BEFORE page.goto()
await mockWalletConnection(page);  // Must be first!
await page.goto('/');
```

#### Issue: "Vault initialization fails"

**Solution:**
```bash
# Run the manual vault setup script
npx tsx e2e/scripts/setup-test-vault.ts

# Check devnet connection
curl https://api.devnet.solana.com -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}'
```

#### Issue: "Tests flaky on CI"

**Solution:**
```typescript
// Add retries in playwright.config.ts
retries: process.env.CI ? 2 : 0,

// Use waitFor with specific conditions
await element.waitFor({ state: 'visible', timeout: 10000 });

// Avoid arbitrary timeouts
// ❌ await page.waitForTimeout(5000);
// ✅ await page.waitForLoadState('networkidle');
```

### Debug Mode

Run tests in debug mode to step through execution:

```bash
npm run test:e2e:debug -- smoke.spec.ts
```

This will:
- Open browser in headed mode
- Pause before each action
- Allow inspector to step through code
- Show element selectors

### Viewing Test Reports

After test run:

```bash
npm run test:report
```

Opens HTML report with:
- Test execution timeline
- Screenshots of failures
- Video recordings
- Trace files for debugging

## Performance Optimization

### Parallel Execution

```typescript
// In playwright.config.ts
fullyParallel: true,
workers: process.env.CI ? 1 : 4, // Run 4 tests in parallel locally
```

### Shared Test Fixtures

```typescript
// Create a shared fixture for authenticated state
import { test as base } from '@playwright/test';

type MyFixtures = {
  authenticatedPage: Page;
};

export const test = base.extend<MyFixtures>({
  authenticatedPage: async ({ page }, use) => {
    await mockWalletConnection(page);
    await page.goto('/');
    await initializeTestVault(page);
    await use(page);
  },
});

// Use in tests
test('my test', async ({ authenticatedPage }) => {
  // Page is already authenticated!
});
```

## Coverage Goals

- [x] **Smoke Tests**: 100% coverage
- [x] **Wallet Authentication**: 100% coverage
- [x] **Password CRUD**: All 7 entry types
- [x] **Search & Filter**: All filter combinations
- [x] **Batch Operations**: All bulk operations
- [x] **Error Handling**: Network, RPC, validation errors
- [ ] **Security Features**: Recovery, backup codes (partial)
- [ ] **Subscription Management**: Upgrade, downgrade flows (planned)
- [ ] **Mobile Responsive**: Touch gestures, mobile UI (planned)

## Resources

- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Solana Devnet Faucet](https://faucet.solana.com/)
- [Project GitHub](https://github.com/your-org/solana-lockbox)

## Contributing

When adding new tests:

1. ✅ Follow the test template above
2. ✅ Use semantic selectors
3. ✅ Add descriptive test names
4. ✅ Document complex test scenarios
5. ✅ Run tests locally before pushing
6. ✅ Update this README if adding new test files

---

**Last Updated**: 2025-10-30
**Framework Version**: Playwright 1.56.1
**Status**: ✅ Fully Operational
