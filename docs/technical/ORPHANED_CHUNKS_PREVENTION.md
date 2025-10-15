# Orphaned Storage Chunks - Prevention & Recovery Guide

## What are Orphaned Chunks?

An "orphaned storage chunk" occurs when a storage chunk account exists on the Solana blockchain but is not registered in the master lockbox metadata. This can happen due to:

- **Transaction Lag**: Storage chunk is created but the transaction updating the master lockbox fails
- **RPC Data Lag**: RPC node hasn't synced the latest state, causing partial reads
- **Network Interruptions**: Connection drops during multi-instruction transaction
- **Transaction Failures**: Program execution fails partway through chunk creation

When this happens, the chunk account exists and locks rent (~0.0088 SOL), but the password manager cannot access it because it's not tracked in the master lockbox.

## Impact

### User Impact
- Cannot store passwords until issue is resolved
- Rent (SOL) is locked in inaccessible account
- May receive confusing error messages
- Wallet appears "stuck" for this program

### Technical Impact
- Account exists at expected PDA address
- Creating new chunk fails with "account already in use"
- Master lockbox shows `storage_chunks_count: 0`
- Chunk has valid discriminator but orphaned state

## Prevention Strategy

The Lockbox v2 SDK implements **four layers of prevention** to ensure orphaned chunks never occur:

### Layer 1: Pre-Initialization Checks ✓

**When**: Before creating master lockbox
**What**: Scans for existing chunk accounts at indices 0-4
**Why**: Detects orphaned chunks from previous failed attempts
**Result**: Blocks initialization with clear error message

```typescript
// Example error:
"Cannot initialize: 1 orphaned storage chunk(s) detected (indices: 0).
These chunks exist from previous failed transactions and are locking approximately 0.0088 SOL.
To recover, you have two options:
1. Use a different wallet address (recommended)
2. Wait for a program upgrade that includes recovery functionality"
```

### Layer 2: Duplicate Prevention ✓

**When**: Before creating any storage chunk
**What**: Checks if chunk account already exists
**Why**: Prevents creating duplicate accounts
**Result**: Detects orphaned chunks and provides recovery instructions

```typescript
// Checks both:
// 1. Does chunk account exist on-chain?
// 2. Is chunk registered in master lockbox?

const existingChunk = await connection.getAccountInfo(storageChunk);
if (existingChunk && !isRegisteredInMasterLockbox) {
  throw new Error("Orphaned storage chunk detected...");
}
```

### Layer 3: Confirmation Retries ✓

**When**: After creating new storage chunk
**What**: Retries verification up to 5 times with exponential backoff
**Why**: Allows RPC nodes to catch up and confirm registration
**Result**: Ensures chunk is properly registered before proceeding

```typescript
// Retry logic:
// Attempt 1: 0ms delay
// Attempt 2: 500ms delay
// Attempt 3: 1000ms delay
// Attempt 4: 2000ms delay
// Attempt 5: 2000ms delay

let retries = 0;
const maxRetries = 5;
while (!chunkRegistered && retries < maxRetries) {
  const delay = Math.min(500 * Math.pow(2, retries - 1), 2000);
  await sleep(delay);

  const refreshedMaster = await getMasterLockbox();
  chunkRegistered = refreshedMaster.storageChunks.some(c => c.chunkIndex === newChunkIndex);

  retries++;
}
```

### Layer 4: Pending Transaction Tracking ✓

**When**: Throughout all operations
**What**: Tracks in-flight operations to prevent double-submission
**Why**: Ensures operations aren't retried while still pending
**Result**: Prevents race conditions and duplicate transactions

```typescript
private pendingTransactions: Set<string> = new Set();

// Before starting operation:
const operationKey = `init-${masterLockbox.toBase58()}`;
if (this.pendingTransactions.has(operationKey)) {
  throw new Error('Operation already in progress');
}
this.pendingTransactions.add(operationKey);

// After completion (in finally block):
this.pendingTransactions.delete(operationKey);
```

## Recovery Options

### Option 1: Use Different Wallet (Recommended) ⭐

**Best for**: All users, especially non-technical users

**Steps**:
1. Create a new Solana wallet in Phantom
2. Transfer some SOL for transaction fees (~0.01 SOL)
3. Initialize master lockbox with new wallet
4. Start using password manager immediately

**Pros**:
- Immediate access
- No waiting for program upgrades
- Clean state, no legacy issues

**Cons**:
- Need to manage multiple wallets
- Original wallet's rent remains locked (~0.0088 SOL)

### Option 2: Wait for Program Upgrade

**Best for**: Users who want to recover rent from original wallet

**Status**: Planned but not yet deployed

The program has a `force_close_orphaned_chunk` instruction that would allow recovery:

```rust
pub fn force_close_orphaned_chunk(
    ctx: Context<ForceCloseOrphanedChunk>,
    chunk_index: u16,
) -> Result<()>
```

This instruction:
- Uses `AccountInfo` instead of `Account<StorageChunk>`
- Bypasses discriminator validation
- Transfers all lamports (rent) back to owner
- Validates PDA derivation for security

**When Available**: Future program upgrade (requires redeployment)

### Option 3: Manual Recovery (Advanced)

**Best for**: Developers or users comfortable with Solana CLI

**Requirements**:
- Solana CLI installed
- Keypair file for affected wallet
- Understanding of PDA derivation

**Process**:
1. Contact support with wallet address
2. Provide transaction signature of failed operation
3. Support team analyzes on-chain state
4. Custom recovery transaction may be constructed

## Error Messages Guide

### "Cannot initialize: N orphaned storage chunk(s) detected"

**Cause**: Orphaned chunks exist from previous failed initialization
**Solution**: Use different wallet or wait for program upgrade
**Location**: `initializeMasterLockbox()`

### "Orphaned storage chunk detected at index N"

**Cause**: Chunk exists but not registered in master lockbox
**Solution**: SDK automatically detects this before operations
**Location**: `initializeStorageChunk()`, `storePassword()`

### "Storage chunk N was not properly registered"

**Cause**: Chunk creation completed but verification failed
**Solution**: Retry operation or contact support
**Location**: `storePassword()` after chunk creation

## Developer Guide

### Testing Orphaned Chunk Scenarios

To test the prevention logic:

```typescript
// 1. Create a storage chunk manually (bypassing SDK)
const [storageChunk] = client.getStorageChunkAddress(0);
const tx = await connection.sendTransaction(/* raw chunk creation */);

// 2. Try to initialize master lockbox
await client.initializeMasterLockbox();
// Should throw: "Cannot initialize: 1 orphaned storage chunk(s) detected"

// 3. Verify error message includes recovery instructions
```

### Adding Custom Prevention Logic

If you're building on top of this SDK:

```typescript
class CustomLockboxClient extends LockboxV2Client {
  async detectOrphanedChunks(): Promise<number[]> {
    const orphaned: number[] = [];

    // Check more indices if needed
    for (let i = 0; i < 10; i++) {
      const [chunkPDA] = this.getStorageChunkAddress(i);
      const account = await this.connection.getAccountInfo(chunkPDA);

      if (account) {
        const master = await this.getMasterLockbox();
        const isRegistered = master.storageChunks.some(c => c.chunkIndex === i);

        if (!isRegistered) {
          orphaned.push(i);
        }
      }
    }

    return orphaned;
  }
}
```

### Monitoring for Orphaned Chunks

Set up monitoring to detect orphaned chunks in production:

```typescript
// Periodic check (e.g., every hour)
async function monitorOrphanedChunks() {
  const affectedWallets: string[] = [];

  // Query all master lockbox accounts
  const accounts = await connection.getProgramAccounts(PROGRAM_ID);

  for (const account of accounts) {
    try {
      const master = await client.getMasterLockbox();
      const orphaned = await detectOrphanedChunks(master);

      if (orphaned.length > 0) {
        affectedWallets.push(master.owner.toBase58());
      }
    } catch (error) {
      // Log error
    }
  }

  if (affectedWallets.length > 0) {
    // Alert support team
    console.error(`${affectedWallets.length} wallets have orphaned chunks`);
  }
}
```

## Future Improvements

### 1. Automatic Recovery UI

Add a "Recover Orphaned Chunks" button to the UI that:
- Detects orphaned chunks for current wallet
- Shows recovery options
- Guides user through recovery process

### 2. Program Upgrade with Recovery Instruction

Deploy updated program with `force_close_orphaned_chunk`:
- Allows users to recover rent without switching wallets
- SDK automatically detects and offers recovery
- One-click recovery in UI

### 3. Transaction Batching

Combine chunk creation + registration into single transaction:
- Reduces chance of partial failures
- Atomic operation ensures consistency
- Falls back to separate transactions if batch is too large

### 4. Optimistic UI Updates

Update UI optimistically while waiting for confirmation:
- Show "Creating storage..." state
- Poll for confirmation in background
- Revert UI if transaction fails

## Support

If you encounter orphaned chunks:

1. **Check Error Message**: Read the full error - it includes recovery steps
2. **Try Different Wallet**: Fastest solution (recommended)
3. **Contact Support**: Provide wallet address and transaction signature
4. **Wait for Update**: Program upgrade will enable self-service recovery

For questions or issues:
- GitHub Issues: [github.com/yourrepo/issues](https://github.com/yourrepo/issues)
- Email: support@yourproject.com
- Discord: [Your Discord Link]

## Changelog

### v2.2.0 - Orphaned Chunk Prevention (Current)
- ✅ Pre-initialization checks
- ✅ Duplicate prevention
- ✅ Confirmation retries with exponential backoff
- ✅ Pending transaction tracking
- ✅ Comprehensive error messages
- ✅ Recovery instructions in errors

### v2.3.0 - Recovery Instruction (Planned)
- 🔜 `force_close_orphaned_chunk` instruction
- 🔜 SDK auto-recovery methods
- 🔜 UI recovery button
- 🔜 Automatic orphaned chunk detection on load

---

**Last Updated**: 2025-10-13
**Version**: 2.2.0
**Status**: Active Prevention, Recovery Planned
