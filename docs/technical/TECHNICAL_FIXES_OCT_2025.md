# Technical Fixes - October 12, 2025

This document details the critical bugs discovered and fixed during the v2.0 devnet deployment.

---

## Summary

Four critical issues were identified and resolved during v2.0 devnet deployment:

1. **Incorrect Instruction Discriminators** - Placeholder values instead of SHA256 hashes
2. **Missing INIT_SPACE Allocation** - Forgot to account for second Vec length prefix
3. **UI Error Handling** - Showing error state instead of initialization button
4. **Double Signature Prompts** - Session key initialized too early, causing poor UX

All issues have been fixed and the program has been redeployed to devnet.

---

## Issue 1: Incorrect Instruction Discriminators

### Error
```
SendTransactionError: Simulation failed.
Error processing Instruction 2: custom program error: 0x65.
Program log: AnchorError occurred. Error Code: InstructionFallbackNotFound.
Error Number: 101. Error Message: Fallback functions are not supported.
```

### Root Cause

Anchor generates instruction discriminators as the first 8 bytes of `SHA256("global:<instruction_name>")`. Our SDK (`client-v2.ts`) was using placeholder discriminator values that didn't match the deployed program:

```typescript
// WRONG - Placeholder values
const INSTRUCTION_DISCRIMINATORS = {
  initializeMasterLockbox: Buffer.from([0x9b, 0x1e, 0x58, 0x3c, 0x84, 0x6e, 0x4f, 0x9d]),
  // ... other wrong values
};
```

When the program received a transaction with the wrong discriminator, it couldn't find a matching instruction handler and returned error 0x65 (InstructionFallbackNotFound).

### Investigation Process

1. Checked that program was deployed correctly ✅
2. Verified PDA derivation was correct ✅
3. Examined discriminator calculation in SDK ❌

The discriminators were hardcoded placeholders, not actual hashes!

### Solution

Created `scripts/generate-discriminators.js` to calculate correct discriminators:

```javascript
const crypto = require('crypto');

const instructions = [
  'initialize_master_lockbox',
  'initialize_storage_chunk',
  'store_password_entry',
  'retrieve_password_entry',
  'update_password_entry',
  'delete_password_entry',
  'upgrade_subscription',
  'renew_subscription',
  'downgrade_subscription',
];

instructions.forEach(instruction => {
  const name = `global:${instruction}`;
  const hash = crypto.createHash('sha256').update(name).digest();
  const discriminator = hash.slice(0, 8);

  console.log(`${instruction}:`);
  console.log(`  Hex: ${discriminator.toString('hex')}`);
  console.log(`  Array: [${Array.from(discriminator).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(', ')}]`);
});
```

Updated `client-v2.ts` with correct discriminators:

```typescript
// CORRECT - SHA256 hashes
const INSTRUCTION_DISCRIMINATORS = {
  initializeMasterLockbox: Buffer.from([0x21, 0xa5, 0x13, 0x5b, 0xd6, 0x53, 0x44, 0x2d]),
  initializeStorageChunk: Buffer.from([0x8e, 0xd6, 0xee, 0x3c, 0x93, 0xee, 0xaa, 0x22]),
  storePasswordEntry: Buffer.from([0x2d, 0x64, 0x17, 0x8d, 0xf4, 0xd7, 0x8a, 0xa0]),
  retrievePasswordEntry: Buffer.from([0x8c, 0xd0, 0x4f, 0x9b, 0xa7, 0x0b, 0x73, 0xbc]),
  updatePasswordEntry: Buffer.from([0x1d, 0x96, 0x9e, 0x9b, 0x6f, 0x88, 0x16, 0x2a]),
  deletePasswordEntry: Buffer.from([0xf5, 0x59, 0xe8, 0xae, 0x78, 0xb3, 0x40, 0x06]),
  upgradeSubscription: Buffer.from([0x55, 0xef, 0x7d, 0xeb, 0xc7, 0xe6, 0xa6, 0xf6]),
  renewSubscription: Buffer.from([0x2d, 0x4b, 0x9a, 0xc2, 0xa0, 0x0a, 0x6f, 0xb7]),
  downgradeSubscription: Buffer.from([0x39, 0x12, 0x7b, 0x76, 0xcb, 0x07, 0xc1, 0x25]),
};
```

### Verification

```bash
# Generate discriminators
npm run generate-discriminators

# Example output for initialize_master_lockbox:
# Hex: 21a5135bd653442d
# Array: [0x21, 0xa5, 0x13, 0x5b, 0xd6, 0x53, 0x44, 0x2d]
```

### Files Modified
- `/Users/graffito/solana-lockbox/nextjs-app/sdk/src/client-v2.ts`
- `/Users/graffito/solana-lockbox/scripts/generate-discriminators.js` (new)
- `/Users/graffito/solana-lockbox/package.json` (added script)

### Lesson Learned

**Never hardcode discriminators!** Always calculate them from the instruction name using SHA256. Better yet, use Anchor's IDL-generated client which handles this automatically.

---

## Issue 2: Missing INIT_SPACE Allocation (Critical)

### Error
```
SendTransactionError: Simulation failed.
Error processing Instruction 2: custom program error: 0xbbb.
Logs:
  "Program log: Instruction: InitializeMasterLockbox",
  "Program 11111111111111111111111111111111 invoke [2]",
  "Program 11111111111111111111111111111111 success",
  "Program log: AnchorError caused by account: master_lockbox. Error Code: AccountDidNotDeserialize."
```

### Root Cause

This was the most subtle bug. The error logs showed:
1. ✅ Instruction was recognized (discriminator correct)
2. ✅ System Program successfully created the account
3. ❌ Anchor failed to deserialize the account immediately after creation

The issue was in `master_lockbox.rs` line 58-72:

```rust
#[account]
#[derive(InitSpace)]
pub struct MasterLockbox {
    pub owner: Pubkey,
    pub total_entries: u64,
    pub storage_chunks_count: u16,
    pub subscription_tier: SubscriptionTier,
    pub last_accessed: i64,
    pub subscription_expires: i64,
    pub total_capacity: u64,
    pub storage_used: u64,
    pub storage_chunks: Vec<StorageChunkInfo>,      // ← Vec #1
    pub encrypted_index: Vec<u8>,                   // ← Vec #2
    pub next_entry_id: u64,
    pub categories_count: u32,
    pub created_at: i64,
    pub bump: u8,
}
```

The `INIT_SPACE` calculation:

```rust
// WRONG (102 bytes)
pub const INIT_SPACE: usize = 8 + // discriminator
    32 + // owner
    8 +  // total_entries
    2 +  // storage_chunks_count
    1 +  // subscription_tier
    8 +  // last_accessed
    8 +  // subscription_expires
    8 +  // total_capacity
    8 +  // storage_used
    4 +  // storage_chunks vec length
    // MISSING: encrypted_index vec length (4 bytes) !!!
    8 +  // next_entry_id
    4 +  // categories_count
    8 +  // created_at
    1;   // bump
```

**The problem**: Borsh serialization requires a 4-byte `u32` length prefix for EACH `Vec` field, even when the Vec is empty. We accounted for `storage_chunks` but forgot about `encrypted_index`.

### Why This Causes AccountDidNotDeserialize

1. Anchor's `init` constraint calls `create_account()` with `INIT_SPACE` (102 bytes)
2. System Program creates account with 102 bytes
3. Anchor writes the 8-byte discriminator
4. Anchor calls `try_deserialize()` on the account
5. Borsh tries to read the account structure:
   - Reads 8 bytes discriminator ✅
   - Reads 32 bytes owner ✅
   - Reads 8 bytes total_entries ✅
   - ... (continues successfully)
   - Reads 4 bytes for storage_chunks length ✅
   - **Tries to read 4 bytes for encrypted_index length ❌**
   - **Account only has 102 bytes, needs 106 bytes!**
   - **Deserialization fails with AccountDidNotDeserialize**

### Investigation Process

Investigated multiple theories:
1. ❌ Account already exists (checked with `solana account`)
2. ❌ PDA derivation wrong (verified seeds and bump)
3. ❌ Account discriminator mismatch (discriminator is correct)
4. ❌ Wrong account order (accounts in correct order)
5. ✅ **Account size mismatch - INIT_SPACE too small!**

Counted every field in the struct:
- Found 2 Vec fields: `storage_chunks` and `encrypted_index`
- Found only 1 Vec length (4 bytes) in INIT_SPACE
- **Missing 4 bytes for second Vec!**

### Solution

Fixed `INIT_SPACE` in `/Users/graffito/solana-lockbox/programs/lockbox/src/state/master_lockbox.rs`:

```rust
// CORRECT (106 bytes)
pub const INIT_SPACE: usize = 8 + // discriminator
    32 + // owner
    8 +  // total_entries
    2 +  // storage_chunks_count
    1 +  // subscription_tier
    8 +  // last_accessed
    8 +  // subscription_expires
    8 +  // total_capacity
    8 +  // storage_used
    4 +  // storage_chunks vec length (starts at 0)
    4 +  // encrypted_index vec length (starts at 0)  // ← ADDED
    8 +  // next_entry_id
    4 +  // categories_count
    8 +  // created_at
    1;   // bump
```

### Deployment

```bash
# Rebuild program
cd programs/lockbox
cargo build-sbf

# Redeploy to devnet
solana program deploy target/deploy/lockbox.so \
  --url devnet \
  --program-id 7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB

# Transaction: 9yTWHq4kbJAhEuaqvbUedgnsU9vjBzyE83zbWKFL735T5V9rN8K4HeZ4U7qCuaPdoXRukxdSQem3aWkYua7PQpt
# Slot: 414207771
```

### Files Modified
- `/Users/graffito/solana-lockbox/programs/lockbox/src/state/master_lockbox.rs`

### Lesson Learned

**Account space must be calculated exactly!** When using Borsh serialization:
- Each `Vec<T>` needs 4 bytes for length prefix (even when empty)
- Each `String` needs 4 bytes for length prefix
- Each `Option<T>` needs 1 byte for discriminator + size of T
- Always count ALL fields including collection length prefixes

Pro tip: Use `#[derive(InitSpace)]` on the struct and `space = 8 + Account::INIT_SPACE` in the `init` constraint - this calculates space automatically! We had `InitSpace` derived but manually specified `INIT_SPACE` which had the bug.

---

## Issue 3: UI Error Handling

### Error

User reported: "There is no 'Initialize Lockbox' button"

The UI was showing an old "IDL not loaded" error message instead of the initialization button.

### Root Cause

In `LockboxV2Context.tsx` line 163-177, the error handling was treating "account not found" as an error state:

```typescript
// WRONG
} catch (err) {
  const errorMsg = err instanceof Error ? err.message : 'Failed to fetch master lockbox';
  console.error('Failed to refresh master lockbox:', errorMsg);
  setError(errorMsg); // ← Sets error for expected "not found"
  setMasterLockbox(null);
}
```

When a user hasn't initialized their lockbox yet, `getMasterLockbox()` throws "account not found" - this is **expected**, not an error!

But because `error` was set, the UI in `PasswordManager.tsx` lines 287-325 showed the old deployment status message instead of the initialization button.

### Solution

Updated error handling to recognize "not found" as expected:

```typescript
// CORRECT
} catch (err) {
  const errorMsg = err instanceof Error ? err.message : 'Failed to fetch master lockbox';
  console.error('Failed to refresh master lockbox:', errorMsg);

  // If master lockbox not found, that's expected - don't show as error
  if (errorMsg.includes('not found') || errorMsg.includes('call initializeMasterLockbox')) {
    setMasterLockbox(null);
    setError(null); // ← Clear error for expected "not found"
  } else {
    setError(errorMsg);
    setMasterLockbox(null);
  }
}
```

Now when the lockbox doesn't exist, `error` is `null` and `masterLockbox` is `null`, which correctly triggers the "Create Password Vault" button.

### Files Modified
- `/Users/graffito/solana-lockbox/nextjs-app/contexts/LockboxV2Context.tsx`

### Lesson Learned

**"Account not found" is not always an error!** For uninitialized accounts, it's expected behavior. UI state management should distinguish between:
- Account doesn't exist yet (show initialization UI)
- Account exists but failed to fetch (show error)
- Account exists and fetched successfully (show normal UI)

---

## Issue 4: Double Signature Prompts (UX Issue)

### Problem

Users reported: "Phantom wallet pops up asking me to sign twice - once when I connect, and again when I try to do something."

This created a confusing user experience where users were prompted to sign immediately upon wallet connection, even before they wanted to perform any action.

### Root Cause

In `PasswordManager.tsx` line 57-65, the session key was being initialized automatically when the wallet connected:

```typescript
// WRONG - Automatic initialization on connect
useEffect(() => {
  if (publicKey && !isInitialized && !sessionKey) {
    initializeSession();  // ❌ Prompts immediately
  }
}, [publicKey, isInitialized, sessionKey, initializeSession]);
```

However, the session key is **only needed for encryption/decryption operations** (storing, retrieving, updating, deleting passwords). It's NOT needed for:
- Viewing the password manager dashboard
- Checking if a master lockbox exists
- Reading master lockbox metadata (subscription tier, storage usage, etc.)

**User Impact:**
1. User connects wallet → Signature prompt #1 (for session key)
2. User tries to store password → Signature prompt #2 (for transaction)
3. User is confused why they had to sign twice

### Investigation Process

1. Traced signature requests in browser console
2. Identified automatic `initializeSession()` call on wallet connect
3. Analyzed which operations actually need the session key:
   - ✅ Need session key: `storePassword`, `listPasswords`, `updatePassword`, `deletePassword`
   - ❌ Don't need session key: `getMasterLockbox`, `exists`, viewing dashboard
4. Determined session key should be lazily initialized

### Solution

Implemented lazy session initialization pattern across the application.

#### 1. Removed Automatic Initialization

In `PasswordManager.tsx`:
```typescript
// CORRECT - No automatic initialization
// DON'T initialize session automatically - only when needed for encryption/decryption
// The session key is only required for storing/retrieving passwords, not for viewing the lockbox

// Refresh entries when master lockbox is loaded (but only if session exists)
useEffect(() => {
  if (masterLockbox && sessionKey) {
    refreshEntries();
  }
}, [masterLockbox, sessionKey, refreshEntries]);
```

#### 2. Added Lazy Initialization to CRUD Operations

In `LockboxV2Context.tsx`, updated all three CRUD operations:

```typescript
// In createEntry, updateEntry, and deleteEntry:
if (!sessionKey) {
  const initialized = await initializeSession();  // ✅ Only when needed
  if (!initialized) {
    setError('Failed to initialize session');
    return null; // or false
  }
}

try {
  setLoading(true);
  setError(null);

  // Perform the actual operation...
  await client.storePassword(entry);  // or updatePassword/deletePassword

  await refreshEntries();
  return result;
} catch (err) {
  // Handle error...
}
```

### Result

Users now experience **only ONE signature prompt** when they perform their first password operation:

**Before Fix:**
1. Connect wallet → Signature prompt #1 ❌
2. Click "Store Password" → Signature prompt #2 ❌
3. Total: 2 signature prompts

**After Fix:**
1. Connect wallet → No prompt ✅
2. Click "Store Password" → Signature prompt #1 (session + transaction) ✅
3. Total: 1 signature prompt

### Files Modified

- `/Users/graffito/solana-lockbox/nextjs-app/components/PasswordManager.tsx`
- `/Users/graffito/solana-lockbox/nextjs-app/contexts/LockboxV2Context.tsx`

### Pattern Benefits

1. **Minimizes Friction**: Users only sign when actually needed
2. **Defers Permissions**: Follows principle of least privilege
3. **Better UX**: Users can browse/view without signing
4. **Clear Intent**: Signature request comes when user performs action
5. **Consistent Pattern**: All CRUD operations handle initialization the same way

### Lesson Learned

**Lazy initialization for wallet signatures!** Don't request signatures until absolutely necessary. This applies to:
- Session keys for encryption
- Transaction approvals
- Message signing

Users should only be prompted when they take an action that requires it, not automatically on connect.

---

## Testing

### Verify Discriminators

```bash
# Generate and verify discriminators
npm run generate-discriminators

# Should output SHA256 hashes matching client-v2.ts
```

### Test Initialization

```bash
# Test master lockbox initialization
npm run test-initialize

# Expected output:
# ✅ Success!
# Transaction signature: <TX>
# Master Lockbox Data:
#   Owner: <YOUR_WALLET>
#   Total Entries: 0
#   Storage Chunks: 0
#   Subscription Tier: free
```

### Verify On-Chain

```bash
# View deployed program
solana program show 7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB --url devnet

# Should show:
# Last Deployed In Slot: 414207771
# Data Length: 355672 bytes
```

---

## Timeline

**October 12, 2025**

- 19:00 - User reported "Expected Buffer" error in browser
- 19:15 - Fixed context error handling, button appeared
- 19:30 - User reported InstructionFallbackNotFound (0x65)
- 20:00 - Identified discriminator issue, created generation script
- 20:15 - Updated all discriminators in client-v2.ts
- 20:30 - User reported AccountDidNotDeserialize (0xbbb)
- 20:45 - Investigated account creation, System Program succeeded
- 21:00 - **Discovered missing 4 bytes in INIT_SPACE**
- 21:05 - Fixed INIT_SPACE, added encrypted_index vec length
- 21:07 - Rebuilt program with cargo build-sbf
- 21:10 - Redeployed to devnet (slot 414207771)
- 21:15 - ✅ Master lockbox initialization working
- 21:20 - User reported double signature prompts on wallet connect
- 21:25 - Identified automatic session initialization as root cause
- 21:30 - Implemented lazy initialization pattern for session keys
- 21:35 - Updated all CRUD operations with lazy initialization
- 21:40 - ✅ All issues resolved, UX optimized

---

## Impact

**Before Fixes:**
- ❌ Master lockbox initialization failed
- ❌ No users could use the password manager
- ❌ SDK had incorrect discriminators
- ❌ Program had insufficient account space
- ❌ Users prompted to sign twice (poor UX)

**After Fixes:**
- ✅ Master lockbox initialization works
- ✅ Users can create password vaults
- ✅ SDK has correct SHA256 discriminators
- ✅ Program allocates correct account space
- ✅ UI correctly handles uninitialized state
- ✅ Users only sign once when needed (optimized UX)

---

## Prevention

### For Discriminators
1. Always use `anchor idl parse` or generate from source
2. Never hardcode discriminator values
3. Add discriminator generation to CI/CD
4. Verify discriminators match deployed program

### For Account Space
1. Use `#[derive(InitSpace)]` on structs
2. Use `space = 8 + Account::INIT_SPACE` in init
3. Remember: Each Vec needs 4 bytes for length
4. Count all fields manually as verification
5. Test account creation with zero-length Vecs

### For Error Handling
1. Distinguish between "not found" and "failed"
2. Don't treat expected states as errors
3. Test UI with uninitialized accounts
4. Add specific error handling for each case

### For Wallet UX
1. Use lazy initialization for session keys
2. Only request signatures when user takes action
3. Never auto-initialize on wallet connect
4. Clearly communicate what each signature is for
5. Minimize total number of signature requests

---

## References

- **Anchor Discriminators**: https://www.anchor-lang.com/docs/the-accounts-struct#discriminator
- **Borsh Specification**: https://borsh.io/
- **Solana Account Model**: https://docs.solana.com/developing/programming-model/accounts
- **Program Deployment**: https://docs.solana.com/cli/deploy-a-program

---

**Document Created**: October 12, 2025
**Status**: All issues resolved
**Program Version**: v2.0.0-devnet (slot 414207771)

Created by [GRAFFITO](https://x.com/0xgraffito)
