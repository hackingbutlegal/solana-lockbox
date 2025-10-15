# Close Storage Chunk Fix - October 2025

## Issue
When attempting to close storage chunks and master lockbox accounts, users encountered a generic "Unexpected error" from the wallet:

```
WalletSendTransactionError: Unexpected error
    at StandardWalletAdapter.sendTransaction
    at async LockboxV2Client.closeStorageChunk
```

This prevented proper account closure and rent reclamation, leading to orphaned chunks.

## Root Cause
**Incorrect account ordering in the `closeStorageChunk` transaction instruction.**

The TypeScript client was passing accounts in the wrong order compared to what the Solana program expected:

### Client (Incorrect Order)
```typescript
keys: [
  { pubkey: masterLockbox, ... },  // ❌ First
  { pubkey: storageChunk, ... },   // ❌ Second
  { pubkey: owner, ... },
]
```

### Program (Expected Order)
```rust
pub struct CloseStorageChunk<'info> {
    pub storage_chunk: Account<'info, StorageChunk>,   // ✅ First
    pub master_lockbox: Account<'info, MasterLockbox>, // ✅ Second
    pub owner: Signer<'info>,
}
```

The mismatch caused the program to fail validation, resulting in the cryptic "Unexpected error" from the wallet.

## Solution
Updated `nextjs-app/sdk/src/client-v2.ts` to pass accounts in the correct order:

```typescript
const instruction = new TransactionInstruction({
  programId: PROGRAM_ID,
  keys: [
    { pubkey: storageChunk, isSigner: false, isWritable: true },      // ✅ Correct
    { pubkey: masterLockbox, isSigner: false, isWritable: false },    // ✅ Correct
    { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
  ],
  data: instructionData,
});
```

**Key changes:**
1. Swapped `storageChunk` and `masterLockbox` order
2. Set `masterLockbox.isWritable = false` (it's only read during chunk closure)

## Files Changed
- `nextjs-app/sdk/src/client-v2.ts` - Fixed account order in `closeStorageChunk()` method
- `nextjs-app/components/ui/OrphanedChunkRecovery.tsx` - Fixed ESLint quote escaping errors

## Testing
Verified successful closure flow:
1. ✅ Storage chunk closes successfully
2. ✅ Master lockbox closes successfully
3. ✅ Rent reclaimed to owner wallet
4. ✅ No orphaned chunks created

## Impact
This fix resolves the orphaned chunks issue completely by ensuring:
- Proper account closure and rent reclamation
- No leftover orphaned chunks blocking future initialization
- Clean account lifecycle management

## Prevention
The account ordering is now correct and matches the Rust program's expectations. Future changes to account structures should always verify:
1. Account order matches between client and program
2. `isWritable` flags are correctly set
3. Transaction simulation passes before wallet signing
