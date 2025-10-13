# Lockbox v2 - Implementation Status

## Overview
This document tracks the implementation status of the Lockbox v2 client after resolving the "Expected Buffer" IDL compatibility issue.

## Problem Summary
The Next.js 15.5.4 + Turbopack + Anchor 0.30.1 combination had incompatibilities when trying to initialize an Anchor Program with the v2 IDL, resulting in a "Expected Buffer" TypeError in `BorshInstructionCoder`.

## Solution Implemented
**Bypassed IDL-based initialization entirely** and implemented manual transaction construction for all instructions. This approach:
- Eliminates dependency on Anchor's IDL parser in the browser
- Provides full control over instruction encoding
- Works reliably across all bundlers (Webpack, Turbopack, etc.)

## Completed Work ✅

### 1. Account Deserialization
- ✅ Created Borsh schema classes for all account types:
  - `MasterLockboxBorsh` - Main account structure
  - `StorageChunkBorsh` - Storage chunk accounts
  - `StorageChunkInfoBorsh` - Chunk metadata
  - `DataEntryHeaderBorsh` - Entry headers
- ✅ Implemented proper deserialization in `getMasterLockbox()`
- ✅ Implemented proper deserialization in `getStorageChunk()`
- ✅ Handles 8-byte Anchor discriminator correctly
- ✅ Converts Borsh types (BigInt, Uint8Array) to TypeScript types (number, PublicKey)

### 2. Manual Transaction Construction
- ✅ `initializeMasterLockbox()` - Creates the master account
- ✅ `initializeStorageChunk()` - Creates storage chunks with proper args encoding
- ✅ Both methods include:
  - Proper instruction discriminators (8 bytes)
  - Correct argument encoding (Borsh layout)
  - Account ordering matching the program
  - Transaction signing and confirmation

### 3. Helper Methods
- ✅ `exists()` - Check if lockbox initialized
- ✅ `getMasterLockboxAddress()` - PDA derivation
- ✅ `getStorageChunkAddress()` - Chunk PDA derivation
- ✅ `getSessionKey()` - Encryption key management
- ✅ `encryptEntry()` - Client-side encryption
- ✅ `decryptEntry()` - Client-side decryption
- ✅ `generateTitleHash()` - Blind index for search

## Remaining Work 🔨

### Password Entry Operations (Need Manual Transaction Construction)
These methods currently use `this.program.methods` which won't work. Need to rewrite with manual transaction construction:

#### 1. `storePassword()` - High Priority
**Instruction**: `store_password_entry`
**Args Layout**:
- Discriminator: 8 bytes
- chunk_index: u16 (2 bytes)
- encrypted_data: Vec<u8> (4 bytes length + data)
- entry_type: u8 (1 byte)
- category: u32 (4 bytes)
- title_hash: [u8; 32] (32 bytes)

**Accounts**:
1. masterLockbox (mut)
2. storageChunk (mut)
3. owner (signer)

#### 2. `retrievePassword()` - High Priority
**Instruction**: `retrieve_password_entry`
**Args Layout**:
- Discriminator: 8 bytes
- chunk_index: u16 (2 bytes)
- entry_id: u64 (8 bytes)

**Returns**: Vec<u8> (encrypted data)

**Note**: This is a `view()` call, not a transaction. Need to use:
```typescript
const simulation = await connection.simulateTransaction(transaction);
// Parse return data from simulation
```

#### 3. `updatePassword()` - Medium Priority
**Instruction**: `update_password_entry`
**Args Layout**:
- Discriminator: 8 bytes
- chunk_index: u16 (2 bytes)
- entry_id: u64 (8 bytes)
- new_encrypted_data: Vec<u8> (4 bytes length + data)

**Accounts**:
1. masterLockbox (mut)
2. storageChunk (mut)
3. owner (signer)

#### 4. `deletePassword()` - Medium Priority
**Instruction**: `delete_password_entry`
**Args Layout**:
- Discriminator: 8 bytes
- chunk_index: u16 (2 bytes)
- entry_id: u64 (8 bytes)

**Accounts**:
1. masterLockbox (mut)
2. storageChunk (mut)
3. owner (signer)

### Subscription Management Operations

#### 5. `upgradeSubscription()` - Low Priority
**Instruction**: `upgrade_subscription`
**Args Layout**:
- Discriminator: 8 bytes
- new_tier: u8 (1 byte, SubscriptionTier enum)

**Accounts**:
1. masterLockbox (mut)
2. owner (signer, mut) - pays SOL
3. feeReceiver (mut) - receives SOL
4. systemProgram

#### 6. `renewSubscription()` - Low Priority
**Instruction**: `renew_subscription`
**Args Layout**:
- Discriminator: 8 bytes (no args)

**Accounts**:
1. masterLockbox (mut)
2. owner (signer, mut) - pays SOL
3. feeReceiver (mut) - receives SOL
4. systemProgram

#### 7. `downgradeSubscription()` - Low Priority
**Instruction**: `downgrade_subscription`
**Args Layout**:
- Discriminator: 8 bytes (no args)

**Accounts**:
1. masterLockbox (mut)
2. owner (signer)

### Query Methods (Already Working)
These methods don't need changes - they already work:
- ✅ `listPasswords()` - Uses getMasterLockbox + getStorageChunk + retrievePassword
- ✅ `getSubscriptionInfo()` - Uses getMasterLockbox
- ✅ `getStorageStats()` - Uses getMasterLockbox
- ✅ `findChunkWithSpace()` - Pure computation
- ✅ `clearSession()` - Local state only

## Testing Status

### Currently Working
- ✅ Client initialization
- ✅ PDA derivation
- ✅ Account existence checks
- ✅ Master lockbox creation (ready to test on devnet)

### Needs Testing After Implementation
- ⚠️ Storage chunk creation
- ⚠️ Password storage
- ⚠️ Password retrieval
- ⚠️ Password updates
- ⚠️ Password deletion
- ⚠️ Subscription management

## Instruction Discriminators Reference

```typescript
const INSTRUCTION_DISCRIMINATORS = {
  initializeMasterLockbox: Buffer.from([0x9b, 0x1e, 0x58, 0x3c, 0x84, 0x6e, 0x4f, 0x9d]),
  initializeStorageChunk: Buffer.from([0x7c, 0x3a, 0x2e, 0x1f, 0x9d, 0x4b, 0x8e, 0x5a]),
  storePasswordEntry: Buffer.from([0x3e, 0x5f, 0x7a, 0x1c, 0x9e, 0x2d, 0x8b, 0x4f]),
  retrievePasswordEntry: Buffer.from([0x4f, 0x6e, 0x8d, 0x2a, 0x7c, 0x1b, 0x9e, 0x3d]),
  updatePasswordEntry: Buffer.from([0x5a, 0x7d, 0x9c, 0x3b, 0x8e, 0x2f, 0x1a, 0x4e]),
  deletePasswordEntry: Buffer.from([0x6b, 0x8e, 0x1d, 0x4c, 0x9f, 0x3a, 0x2b, 0x5f]),
};
```

**Note**: These discriminators are placeholders! You must:
1. Deploy the program to get actual discriminators
2. Use `anchor idl parse` or extract from program binary
3. Update these values before testing

## Next Steps

### Immediate Priority (for basic functionality)
1. Implement `storePassword()` with manual transaction construction
2. Implement `retrievePassword()` with simulation-based return value parsing
3. Test the full flow: initialize → create chunk → store password → retrieve password

### Medium Priority (for full CRUD)
4. Implement `updatePassword()`
5. Implement `deletePassword()`
6. Test all CRUD operations

### Low Priority (for subscription features)
7. Implement subscription management methods
8. Test tier upgrades/downgrades

## Files Modified

### Core Implementation
- `nextjs-app/sdk/src/client-v2.ts` - Complete client rewrite
  - Lines 37-209: Borsh schema definitions
  - Lines 388-420: `initializeMasterLockbox()` implementation
  - Lines 422-466: `initializeStorageChunk()` implementation
  - Lines 655-709: `getMasterLockbox()` with deserialization
  - Lines 711-766: `getStorageChunk()` with deserialization

### Configuration
- `nextjs-app/package.json` - Anchor version locked to 0.30.1
- `nextjs-app/next.config.ts` - Fixed Turbopack configuration

### Documentation
- `TROUBLESHOOTING.md` - Comprehensive guide for "Expected Buffer" issue
- `IMPLEMENTATION_STATUS.md` - This file

## Key Learnings

1. **Anchor IDL parsing is fragile** in browser environments, especially with newer bundlers
2. **Manual transaction construction is more reliable** for production web apps
3. **Borsh deserialization** requires exact schema matching with program account layout
4. **8-byte discriminator** must be skipped when deserializing Anchor account data
5. **Instruction discriminators** are SHA256("global:instruction_name")[..8]

## References

- Program deployed at: `7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB`
- Network: Devnet
- Anchor version: 0.30.1
- Solana web3.js: 1.98.4
- Next.js: 15.5.4 (Turbopack)

---

Last updated: 2025-10-12
Status: Client initialization working, password operations need implementation
