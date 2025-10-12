# Lockbox v2 Testing Guide

This document provides comprehensive instructions for testing the Lockbox v2 password manager on Solana.

## Overview

Lockbox v2 includes two complementary test suites:
1. **Anchor Test Suite** - Low-level program instruction testing
2. **SDK Test Suite** - High-level TypeScript client testing

## Prerequisites

### Required Software
- Node.js 18+ and npm
- Rust 1.75+ and Cargo
- Solana CLI 1.18+
- Anchor CLI 0.30+

### Required Accounts
- Solana devnet wallet with SOL for testing
- Wallet configured in `~/.config/solana/id.json`

### Environment Setup
```bash
# Check Solana CLI configuration
solana config get

# Ensure you're on devnet
solana config set --url devnet

# Airdrop SOL for testing (if needed)
solana airdrop 2

# Check balance
solana balance
```

## Test Suites

### 1. Anchor Test Suite

Located at: `tests/lockbox-v2.ts`

This suite tests all program instructions directly using the Anchor framework.

#### What It Tests
- ✅ Master lockbox initialization
- ✅ Storage chunk creation
- ✅ Password entry storage (with encryption)
- ✅ Password entry retrieval
- ✅ Password entry updates
- ✅ Password entry deletion
- ✅ Subscription tier upgrades
- ✅ Subscription renewals
- ✅ Subscription downgrades
- ✅ Storage statistics
- ✅ Error handling

#### Running Anchor Tests

```bash
# From project root
anchor test

# Or connect to devnet
anchor test --provider.cluster devnet

# Run with verbose output
anchor test --skip-local-validator -- --verbose
```

#### Expected Output
```
Lockbox v2 - Password Manager
  Account Initialization
    ✓ Initializes master lockbox (2345ms)
    ✓ Initializes storage chunk (1892ms)
  Password Entry Operations
    ✓ Stores a password entry (2103ms)
    ✓ Retrieves a password entry (1567ms)
    ✓ Updates a password entry (2034ms)
    ✓ Deletes a password entry (1823ms)
  Subscription Management
    ✓ Checks initial subscription tier (234ms)
    ...
```

### 2. SDK Integration Test Suite

Located at: `sdk/tests/integration.test.ts`

This suite tests the TypeScript SDK client that developers will use.

#### What It Tests
- ✅ Account existence checks
- ✅ PDA address derivation
- ✅ SDK initialization
- ✅ Password CRUD operations
- ✅ Listing all passwords
- ✅ Storage statistics
- ✅ Subscription information
- ✅ Session management

#### Running SDK Tests

```bash
# From sdk directory
cd sdk
npm install
npm test

# Run specific test file
npm test integration.test.ts

# Run with coverage
npm test -- --coverage
```

#### Expected Output
```
PASS  tests/integration.test.ts
  Lockbox v2 SDK Integration Tests
    Account Status
      ✓ Check if master lockbox exists (234ms)
      ✓ Get master lockbox address (12ms)
      ✓ Get storage chunk address (8ms)
    Storage Operations
      ✓ Store password entry (2341ms)
      ✓ Retrieve password entry (1567ms)
      ...
```

## Testing Strategies

### 1. Unit Testing
Test individual SDK methods in isolation:

```typescript
import { LockboxV2Client } from './sdk/src/client-v2';

test('derives correct PDA', () => {
  const [pda, bump] = client.getMasterLockboxAddress();
  expect(pda).toBeInstanceOf(PublicKey);
});
```

### 2. Integration Testing
Test complete workflows end-to-end:

```typescript
test('full password lifecycle', async () => {
  // 1. Initialize
  await client.initializeMasterLockbox();

  // 2. Store
  const { entryId } = await client.storePassword(entry);

  // 3. Retrieve
  const retrieved = await client.retrievePassword(0, entryId);

  // 4. Update
  await client.updatePassword(0, entryId, updatedEntry);

  // 5. Delete
  await client.deletePassword(0, entryId);
});
```

### 3. Error Case Testing
Verify proper error handling:

```typescript
test('handles invalid entry ID', async () => {
  await expect(
    client.retrievePassword(0, 999999)
  ).rejects.toThrow('EntryNotFound');
});
```

## Manual Testing

### Using the Next.js App

1. Start the development server:
```bash
cd nextjs-app
npm install
npm run dev
```

2. Open http://localhost:3000
3. Connect your Solana wallet (Phantom, Solflare, etc.)
4. Test the UI:
   - Create a new password entry
   - View all entries
   - Edit an entry
   - Delete an entry
   - Check subscription tier
   - View storage statistics

### Using Solana Explorer

Monitor transactions and account state:

1. Visit https://explorer.solana.com/?cluster=devnet
2. Search for program: `7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB`
3. Check recent transactions
4. Inspect account data

### Using Solana CLI

Direct program interaction:

```bash
# Get program info
solana program show 7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB

# Get account info
solana account <MASTER_LOCKBOX_PDA>

# Monitor program logs
solana logs 7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB
```

## Test Data Guidelines

### Safe Test Data
✅ Use fake passwords and usernames
✅ Use example.com domains
✅ Use test credit cards (4111 1111 1111 1111)

### Unsafe Test Data
❌ Never use real passwords
❌ Never use real credit card numbers
❌ Never use production credentials
❌ Never commit test private keys to git

## Continuous Integration

### GitHub Actions Workflow

Create `.github/workflows/test.yml`:

```yaml
name: Test Lockbox v2

on:
  push:
    branches: [main]
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
          node-version: '18'

      - name: Install dependencies
        run: |
          npm install
          cd sdk && npm install

      - name: Run SDK tests
        run: cd sdk && npm test

      - name: Build Next.js app
        run: cd nextjs-app && npm install && npm run build
```

## Troubleshooting

### Common Issues

#### 1. "Master lockbox already initialized"
**Cause**: Account already exists for your wallet
**Solution**: Use a different test wallet or reset devnet

#### 2. "Transaction simulation failed"
**Cause**: Insufficient SOL balance
**Solution**: Run `solana airdrop 2`

#### 3. "Program not found"
**Cause**: Wrong cluster or program not deployed
**Solution**: Check `solana config get` and verify program ID

#### 4. "IDL not found"
**Cause**: IDL not generated or wrong path
**Solution**: Check `sdk/idl/lockbox-v2.json` exists

#### 5. "Type not found: dataType"
**Cause**: IDL format incompatibility
**Solution**: Ensure IDL uses `{"defined": {"name": "TypeName"}}` format

### Debug Mode

Enable detailed logging:

```typescript
// In tests
console.log('Program ID:', program.programId.toBase58());
console.log('Master Lockbox PDA:', masterLockboxPda.toBase58());

// In SDK client
this.program.addEventListener('logs', (logs) => {
  console.log('Program logs:', logs);
});
```

## Performance Testing

### Load Testing
Test with multiple entries:

```bash
# Store 100 entries
for i in {1..100}; do
  anchor test --skip-local-validator
done
```

### Stress Testing
Test storage limits:

```typescript
test('handles max entries per chunk', async () => {
  const MAX_ENTRIES = 1000;
  for (let i = 0; i < MAX_ENTRIES; i++) {
    await client.storePassword(generateTestEntry(i));
  }
});
```

## Test Coverage Goals

- [ ] 80%+ code coverage on SDK
- [ ] 100% instruction coverage on program
- [ ] All error codes tested
- [ ] All subscription tiers tested
- [ ] All entry types tested
- [ ] Edge cases covered (max size, empty data, etc.)

## Next Steps

After testing:
1. Review test coverage report
2. Add missing test cases
3. Document any bugs found
4. Update error handling
5. Optimize performance bottlenecks
6. Prepare for mainnet deployment

## Resources

- [Anchor Testing Guide](https://www.anchor-lang.com/docs/testing)
- [Solana Test Validator](https://docs.solana.com/developing/test-validator)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Solana Explorer (Devnet)](https://explorer.solana.com/?cluster=devnet)

## Support

For issues or questions:
- Open an issue on GitHub
- Check existing test failures
- Review program logs on explorer
- Consult Solana/Anchor documentation
