# E2E Test Scripts

This directory contains utility scripts for E2E testing.

## Setup Test Vault

The `setup-test-vault.ts` script manually initializes a vault for the test wallet before running CRUD tests.

### Prerequisites

1. Make sure the Next.js dev server is running:
   ```bash
   npm run dev
   ```

2. Ensure you have `tsx` installed (for running TypeScript files):
   ```bash
   npm install -D tsx
   ```

### Usage

Run the script to initialize a test vault:

```bash
npx tsx e2e/scripts/setup-test-vault.ts
```

### What It Does

1. ✅ Launches a browser (non-headless so you can see what's happening)
2. ✅ Injects the mock wallet (same as tests use)
3. ✅ Navigates to http://localhost:3000
4. ✅ Connects the mock wallet
5. ✅ Handles the wallet selection modal
6. ✅ Initializes the vault if needed
7. ✅ Verifies the password manager is visible
8. ✅ Takes screenshots if there are errors

### Output

**Success:**
```
🚀 Starting test vault setup...

1️⃣ Launching browser...
2️⃣ Injecting mock wallet...
3️⃣ Navigating to app...
   ✅ Mock wallet injected successfully
4️⃣ Connecting wallet...
   ✅ Clicked "Select Wallet" button
   ✅ Selected wallet from modal
5️⃣ Initializing vault...
   Found initialization button, clicking...
   Waiting for blockchain transaction...
   ✅ Vault successfully initialized!

✨ Test vault setup complete!

6️⃣ Keeping browser open for 10 seconds so you can inspect...
✅ SUCCESS: Test vault is ready for CRUD tests
```

**Failure:**
If the script fails, it will:
- Save screenshots to `e2e/test-results/` for debugging
- Exit with error code 1
- Print detailed error messages

### Troubleshooting

**Issue: "Mock wallet was not injected properly!"**
- Solution: Make sure you're using the latest version of the wallet-helpers.ts

**Issue: "Could not find initialization button"**
- Solution: Check the screenshot in `e2e/test-results/no-init-button.png`
- The app might already have an initialized vault, or the UI has changed

**Issue: "Vault initialization may have failed"**
- Solution: Check `e2e/test-results/vault-init-failed.png`
- This could be a blockchain/devnet issue
- Try running the script again

### Using in Tests

The password-crud.spec.ts file now automatically uses the vault initialization helper:

```typescript
import { initializeTestVault, waitForVaultReady } from './helpers/initialize-test-vault';

test.beforeEach(async ({ page }) => {
  // ... wallet connection code ...

  // Initialize vault if not already initialized
  const vaultInitialized = await initializeTestVault(page);

  // Wait for vault to be ready
  await waitForVaultReady(page, 10000);
});
```

### Manual Testing

You can also use this script for manual testing:

1. Run the script to set up a test vault
2. Keep the browser window open (it stays open for 10 seconds)
3. Manually test features in the app
4. The mock wallet will persist for the session

## Available Helper Functions

### `initializeTestVault(page: Page): Promise<boolean>`
Initializes a vault for the test wallet. Returns true if successful.

### `isVaultInitialized(page: Page): Promise<boolean>`
Checks if a vault is already initialized. Returns true if the password manager is visible.

### `waitForVaultReady(page: Page, timeout?: number): Promise<boolean>`
Waits for the vault to be fully initialized and loaded. Returns true if ready before timeout.

### `resetTestVault(page: Page): Promise<void>`
Resets the vault by disconnecting the wallet and navigating back to the landing page.

## Integration with CI/CD

To run this script in CI/CD:

```bash
# Start dev server in background
npm run dev &
DEV_SERVER_PID=$!

# Wait for server to be ready
sleep 5

# Run vault setup
npx tsx e2e/scripts/setup-test-vault.ts

# Run tests
npm run test:e2e

# Clean up
kill $DEV_SERVER_PID
```

## Notes

- The script uses the same mock wallet as the tests (TestWallet1111111111111111111111111111111)
- Vault initialization requires a blockchain transaction (on devnet)
- The script keeps the browser open for 10 seconds so you can inspect the result
- Screenshots are saved to `e2e/test-results/` if there are errors
