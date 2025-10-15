# Orphaned Chunk Recovery Guide

## Problem
When closing your master lockbox account, storage chunks were left orphaned on-chain. These orphaned chunks:
- Lock rent (~0.00878352 SOL per chunk)
- Prevent re-initialization of the master lockbox
- Show error: "Cannot initialize: 1 orphaned storage chunk(s) detected"

## Root Cause
The previous `closeMasterLockbox()` implementation only closed the master lockbox account without first closing associated storage chunks, leaving them orphaned.

## Solution Implemented

### 1. Fixed `closeMasterLockbox()` (Prevention)
The `closeMasterLockbox()` method now:
- Fetches all registered storage chunks first
- Closes each chunk sequentially before closing the master lockbox
- Throws error if any chunk fails to close (prevents partial closure)
- Returns rent for ALL accounts (master + chunks)

**Future users will NOT experience this issue.**

### 2. Added `recoverOrphanedChunks()` (Recovery)
New recovery method that:
- Verifies orphaned chunks exist
- Initializes a new master lockbox (bypassing orphan checks)
- Attempts to close the orphaned chunks
- Provides detailed logging and error reporting

## How to Recover (For Current Orphaned Chunks)

### Option 1: Browser Console (Recommended)

1. Open your application in the browser
2. Connect your wallet
3. Open browser console (F12)
4. Run the following command:

```javascript
// Get the LockboxV2Client instance from your app context
// This assumes you have access to the client instance
// Adjust based on how your app exposes the client

// If using React DevTools, you can find the client in your provider context
// Or wait for the app to initialize and access via window.lockboxClient

// Example usage (adjust based on your app structure):
const client = window.lockboxClient; // Or however you access it

// Recover orphaned chunk at index 0
const result = await client.recoverOrphanedChunks([0]);

console.log('Recovery Result:', result);
// Expected output:
// {
//   initSignature: "...",
//   closedChunks: [{ index: 0, signature: "..." }],
//   failedChunks: []
// }
```

### Option 2: Create a Recovery Script

Create a file `run-recovery.ts` in the nextjs-app directory:

```typescript
import { Connection, PublicKey } from '@solana/web3.js';
import { LockboxV2Client } from './sdk/src/client-v2';

async function recoverOrphans() {
  // This is a placeholder - you'll need to provide your wallet
  // For actual recovery, you'll need to use your wallet adapter

  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

  // You'll need to get wallet from browser
  const wallet = (window as any).solana;

  if (!wallet) {
    throw new Error('Please connect your wallet first');
  }

  await wallet.connect();

  const client = new LockboxV2Client({
    connection,
    wallet,
  });

  console.log('Connected wallet:', wallet.publicKey.toBase58());
  console.log('Starting recovery...');

  // Recover orphaned chunk at index 0
  const result = await client.recoverOrphanedChunks([0]);

  console.log('\n=== Recovery Complete ===');
  console.log('Init signature:', result.initSignature);
  console.log('Closed chunks:', result.closedChunks.length);
  console.log('Failed chunks:', result.failedChunks.length);

  if (result.closedChunks.length > 0) {
    console.log('\nRecovered rent from:');
    result.closedChunks.forEach(({ index, signature }) => {
      console.log(`  - Chunk ${index}`);
      console.log(`    Signature: ${signature}`);
    });
  }
}

// Run if in browser console
if (typeof window !== 'undefined') {
  (window as any).recoverOrphans = recoverOrphans;
  console.log('Recovery function loaded. Run: recoverOrphans()');
}
```

Then load this in the browser console or add it to your app temporarily.

### Option 3: Direct API Usage

If you have access to the LockboxProvider context:

```typescript
import { useLockbox } from '@/contexts/LockboxProvider';

function RecoveryButton() {
  const { client } = useLockbox();

  const handleRecover = async () => {
    try {
      const result = await client.recoverOrphanedChunks([0]);
      console.log('Recovery successful!', result);
      alert('Recovery complete! Check console for details.');
    } catch (error) {
      console.error('Recovery failed:', error);
      alert('Recovery failed: ' + error.message);
    }
  };

  return (
    <button onClick={handleRecover}>
      Recover Orphaned Chunks
    </button>
  );
}
```

## Expected Recovery Process

1. **Verification Phase**
   ```
   === Starting Orphaned Chunk Recovery ===

   Attempting to recover 1 orphaned chunk(s)
   Chunk indices: 0

   Verifying orphaned chunks...
   ✓ Found orphaned chunk 0 at 3HBA3mmXuUJy3VzvGKrT87pBwSp8ckiAshYfTatjz1h5
     Rent: 0.0088 SOL

   1 orphaned chunk(s) verified
   ```

2. **Initialization Phase**
   ```
   Step 1: Initializing new master lockbox...
   ✓ Master lockbox initialized: <signature>
   ```

3. **Chunk Closure Phase**
   ```
   Step 2: Attempting to close orphaned chunks...

   Closing orphaned chunk 0...
   ✓ Closed chunk 0: <signature>
   ```

4. **Summary**
   ```
   === Recovery Summary ===
   Master lockbox initialized: <signature>
   Chunks closed successfully: 1
   Chunks failed to close: 0

   Successfully closed chunks:
     - Chunk 0: <signature>

   ✅ Recovery process complete!
   You can now use your master lockbox normally.
   ```

## What If Recovery Fails?

### Possible Issues:

1. **Chunk doesn't exist anymore**
   - Error: "Storage chunk not found"
   - Solution: The chunk may have been auto-closed; try initializing normally

2. **Master lockbox already exists**
   - Error: "Master lockbox already exists"
   - Solution: Use normal `closeMasterLockbox()` instead

3. **Program ownership error**
   - Error: "Owner mismatch" or similar
   - Solution: Verify you're using the correct wallet

4. **Insufficient SOL**
   - Error: "Insufficient balance"
   - Solution: Add SOL to your wallet for transaction fees

## Prevention (Already Implemented)

The updated `closeMasterLockbox()` method now prevents this issue by:
1. Fetching the master lockbox to get all registered chunks
2. Closing each chunk individually BEFORE closing the master
3. Only closing the master after all chunks are successfully closed
4. Throwing errors if any chunk fails to close

**Code snippet from client-v2.ts:1543-1563:**
```typescript
// CRITICAL FIX: Close all storage chunks first before closing master lockbox
// This prevents orphaned chunks that would lock rent permanently
const master = await this.getMasterLockbox();

if (master.storageChunks.length > 0) {
  console.log(`[closeMasterLockbox] Closing ${master.storageChunks.length} storage chunk(s) first...`);

  for (const chunk of master.storageChunks) {
    try {
      await this.closeStorageChunk(chunk.chunkIndex);
      console.log(`[closeMasterLockbox] ✓ Closed chunk ${chunk.chunkIndex}`);
    } catch (error) {
      console.error(`[closeMasterLockbox] Failed to close chunk ${chunk.chunkIndex}:`, error);
      throw new Error(`Failed to close storage chunk ${chunk.chunkIndex}: ${error}`);
    }
  }

  console.log('[closeMasterLockbox] ✓ All storage chunks closed');
}
```

## Files Modified

1. **`sdk/src/client-v2.ts`**
   - Added `closeStorageChunk()` method (lines 1452-1508)
   - Fixed `closeMasterLockbox()` to close chunks first (lines 1519-1634)
   - Added `recoverOrphanedChunks()` recovery method (lines 1835-1987)

2. **Supporting Files**
   - `recover-orphaned-chunk.ts` - Standalone recovery script
   - `ORPHANED-CHUNK-RECOVERY-GUIDE.md` - This guide

## Technical Details

### Affected Accounts
- Wallet: `14DrkGw1UYWb542i2z1tGK7C6oV4sX7X2Z5pHhsyvfzn`
- Orphaned Chunk 0: `3HBA3mmXuUJy3VzvGKrT87pBwSp8ckiAshYfTatjz1h5`
- Rent locked: ~0.0088 SOL

### Program Details
- Program ID: `7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB`
- Network: Devnet
- Close instruction discriminator: `0x79b6fd5167d22ee9`

## Support

If recovery fails or you encounter issues:
1. Check the browser console for detailed error logs
2. Verify you're connected to the correct wallet
3. Ensure your wallet has sufficient SOL for transaction fees
4. Try the recovery multiple times if network issues occur

## Next Steps After Recovery

Once recovery is complete:
1. Your master lockbox will be initialized and ready to use
2. The orphaned chunk will be closed and rent returned
3. You can proceed with normal password manager operations
4. Future account closures will NOT create orphaned chunks

---

**Status**: ✅ Recovery method implemented and ready to use
**Build Status**: ✅ Application builds successfully
**Prevention**: ✅ Future orphaned chunks prevented
