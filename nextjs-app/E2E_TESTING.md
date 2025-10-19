# End-to-End Testing with Playwright

This document describes how to run and write E2E tests for Solana Lockbox using Playwright.

## Quick Start

```bash
# Run all E2E tests (headless)
npm run test:e2e

# Run tests in UI mode (interactive)
npm run test:e2e:ui

# Run tests in headed mode (see browser)
npm run test:e2e:headed

# Run tests in debug mode
npm run test:e2e:debug

# View test report after running
npm run test:report
```

## Prerequisites

1. **Node.js 18+** installed
2. **Playwright browsers** installed:
   ```bash
   npx playwright install chromium
   ```

## Test Structure

Tests are located in the `e2e/` directory:

```
e2e/
├── smoke.spec.ts                      # Basic smoke tests (page loads, no errors)
├── navigation.spec.ts                 # Navigation and routing tests
├── wallet-authentication.spec.ts      # Wallet connection & session management
├── password-crud.spec.ts              # CRUD operations for all password types
├── batch-operations.spec.ts           # Batch mode & error handling
├── features-tools.spec.ts             # Dashboard, 2FA, Activity, Settings, etc.
├── search-filter-favorites.spec.ts    # Search, filter, sort, favorites
├── danger-zone-advanced.spec.ts       # Account reset, import/export, recovery
└── helpers/
    ├── wallet-helpers.ts              # Phantom wallet automation utilities
    └── test-data.ts                   # Test data generators and fixtures
```

**📚 For detailed test coverage and execution guide, see [E2E_COMPREHENSIVE_TEST_SUITE.md](./E2E_COMPREHENSIVE_TEST_SUITE.md)**

This comprehensive test suite includes:
- **290+ tests** covering all features
- **~95% overall coverage**
- Mock wallet integration for headless testing
- Real Phantom wallet support for integration tests
- Complete CRUD coverage for all 7 password entry types
- Batch operations, error handling, and edge cases
- All sidebar tools and advanced features

## Running Tests

### Headless Mode (CI/Local)
```bash
npm run test:e2e
```
- Runs in background without opening browser
- Fastest option
- Used in CI/CD pipelines

### UI Mode (Interactive)
```bash
npm run test:e2e:ui
```
- Opens Playwright's interactive UI
- Best for test development
- See test execution in real-time
- Time-travel debugging

### Headed Mode (Visible Browser)
```bash
npm run test:e2e:headed
```
- Opens actual browser window
- See tests run visually
- Good for debugging

### Debug Mode
```bash
npm run test:e2e:debug
```
- Opens Playwright Inspector
- Step through tests line by line
- Inspect page state at each step

## Test Coverage

### Smoke Tests (`smoke.spec.ts`)
- ✅ Homepage loads successfully
- ✅ Dashboard displays without wallet connection
- ✅ Settings page loads correctly
- ✅ FAQ section is accessible
- ✅ No critical console errors on page load
- ✅ Application is responsive (mobile, tablet, desktop)

### Navigation Tests (`navigation.spec.ts`)
- ✅ Navigate from dashboard to settings
- ✅ Navigate between settings tabs
- ✅ Back and forward navigation works
- ✅ No hydration errors during navigation
- ✅ Subscription page loads without duplicate text

## Writing Tests

### Basic Test Structure

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test('should do something', async ({ page }) => {
    // Navigate to page
    await page.goto('/');

    // Interact with page
    await page.click('button:has-text("Click Me")');

    // Assert expected outcome
    await expect(page.locator('.result')).toHaveText('Success');
  });
});
```

### Best Practices

1. **Use data-testid attributes** for stable selectors:
   ```typescript
   await page.locator('[data-testid="wallet-button"]').click();
   ```

2. **Wait for network idle** after navigation:
   ```typescript
   await page.goto('/settings');
   await page.waitForLoadState('networkidle');
   ```

3. **Handle async operations** properly:
   ```typescript
   await page.waitForSelector('.loading-spinner', { state: 'hidden' });
   ```

4. **Test error states** gracefully:
   ```typescript
   const isVisible = await element.isVisible().catch(() => false);
   ```

5. **Clean up after tests**:
   ```typescript
   test.afterEach(async ({ page }) => {
     // Clean up any test data
   });
   ```

## Configuration

The Playwright configuration is in `playwright.config.ts`:

- **Base URL**: `http://localhost:3001`
- **Timeout**: 30 seconds per test
- **Retries**: 2 on CI, 0 locally
- **Screenshots**: On failure only
- **Videos**: On failure only
- **Traces**: On first retry

### Updating Configuration

```typescript
// playwright.config.ts
export default defineConfig({
  // Add more browsers
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],

  // Change timeout
  timeout: 60 * 1000, // 60 seconds
});
```

## CI/CD Integration

Tests automatically start the dev server before running:

```typescript
webServer: {
  command: 'npm run dev',
  url: 'http://localhost:3001',
  reuseExistingServer: !process.env.CI,
}
```

On CI (GitHub Actions, etc.), set `CI=true` environment variable:
```yaml
- name: Run E2E tests
  run: npm run test:e2e
  env:
    CI: true
```

## Troubleshooting

### Tests Fail Locally But Pass in CI
- Clear browser cache: `npx playwright install --force`
- Delete `node_modules` and reinstall

### "Browser not found" Error
```bash
npx playwright install chromium
```

### Tests Timeout
- Increase timeout in `playwright.config.ts`
- Check if dev server is running on port 3001
- Check network connectivity

### Flaky Tests
- Add explicit waits: `await page.waitForLoadState('networkidle')`
- Use `test.retry()` for genuinely flaky tests
- Avoid hard-coded delays: use `waitForSelector` instead

## Useful Commands

```bash
# List all available tests
npx playwright test --list

# Run specific test file
npx playwright test e2e/smoke.spec.ts

# Run tests matching pattern
npx playwright test -g "navigation"

# Update snapshots
npx playwright test --update-snapshots

# Generate code from browser actions
npx playwright codegen http://localhost:3001
```

## Test Reports

After running tests, view the HTML report:

```bash
npm run test:report
```

This opens a browser with:
- Test results summary
- Screenshots of failures
- Videos of failed tests
- Execution traces

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Playwright API Reference](https://playwright.dev/docs/api/class-page)
- [Next.js Testing Guide](https://nextjs.org/docs/testing)
