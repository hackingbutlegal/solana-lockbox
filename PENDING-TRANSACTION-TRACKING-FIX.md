# Pending Transaction Tracking Fix

## Issue
The error "This transaction has already been processed" occurs when the same transaction is submitted twice before the first one completes. This happened specifically with `initializeStorageChunk` but could happen with any transaction-sending function.

## Solution Applied
Added pending transaction tracking to `initializeStorageChunk` using the storage chunk PDA as the unique key. The fix prevents duplicate chunk creation attempts by:

1. Checking if the chunk creation is already in progress before starting
2. Adding the operation to `pendingTransactions` Set
3. Removing it in a finally block after completion (success or failure)

## Functions That Need Similar Protection

### Currently Protected ✅
- `initializeMasterLockbox` - Uses `init-${masterLockbox.toBase58()}`
- `initializeStorageChunk` - Uses `chunk-${storageChunk.toBase58()}`
- `closeMasterLockbox` - Uses `close-${masterLockbox.toBase58()}`
- `storePassword` - Uses `store-${entry.title}-${Date.now()}`
- `updatePassword` - Uses `update-${chunkIndex}-${entryId}`
- `deletePassword` - Uses `delete-${chunkIndex}-${entryId}`

### Not Protected (Lower Priority)
The following subscription management functions use Anchor IDL-generated methods (`.rpc()`) and are less critical:

**Functions:**
- `upgradeSubscription` - Uses `this.program.methods.upgradeSubscription().rpc()`
- `renewSubscription` - Uses `this.program.methods.renewSubscription().rpc()`
- `downgradeSubscription` - Uses `this.program.methods.downgradeSubscription().rpc()`

**Why these don't need protection:**
1. The IDL methods have their own internal retry logic
2. These are typically single-click operations in settings UI (not rapid-fire actions)
3. They use different blockhashes on each attempt (less likely to get "already processed" error)
4. Users rarely trigger these concurrently

## Recommendation
Comprehensive pending transaction tracking has been implemented for all critical user-facing operations:

1. **Account Management:** `initializeMasterLockbox`, `closeMasterLockbox`
2. **Chunk Operations:** `initializeStorageChunk`
3. **Password Operations:** `storePassword`, `updatePassword`, `deletePassword`

This protection prevents "already processed" errors in all scenarios where users might rapidly trigger the same action (double-clicks, network lag, etc.).

Subscription management functions (`upgradeSubscription`, `renewSubscription`, `downgradeSubscription`) remain unprotected since they are less critical and unlikely to be triggered concurrently.

## Testing
To verify the fix works:
1. Try to create a password entry (which triggers chunk creation)
2. The operation should succeed without "already processed" errors
3. Verify the chunk was created and registered properly
