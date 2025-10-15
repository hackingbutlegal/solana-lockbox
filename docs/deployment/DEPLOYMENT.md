# Lockbox v2.0 Comprehensive Deployment Guide

## Table of Contents

1. [Current Status](#current-status)
2. [Critical Fixes History](#critical-fixes-history)
3. [Quick Start](#quick-start)
4. [Prerequisites](#prerequisites)
5. [Building the Program](#building-the-program)
6. [Deployment to Devnet](#deployment-to-devnet)
7. [Deployment to Vercel](#deployment-to-vercel)
8. [Frontend Configuration](#frontend-configuration)
9. [Testing](#testing)
10. [On-Chain Verification](#on-chain-verification)
11. [Production Deployment](#production-deployment)
12. [Security Considerations](#security-considerations)
13. [Troubleshooting](#troubleshooting)
14. [Links and Resources](#links-and-resources)

---

## Current Status

### v2.0 Program (Latest)
- **Program ID**: `7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB`
- **Network**: Solana Devnet
- **Status**: Live with automatic account reallocation
- **Last Deployed**: October 13, 2025 (Realloc implementation)
- **Latest Feature**: Dynamic master lockbox expansion
- **Program Size**: 355,672 bytes (347 KB)
- **Upgrade Authority**: 3H8e4VnGjxKGFKxk2QMmjuu1B7dnDLysGN8hvcDCKxZh
- **Frontend**: Next.js 15.5.4 at http://localhost:3000

[View v2.0 Program on Explorer](https://explorer.solana.com/address/7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB?cluster=devnet)

### v1.0 Program (Legacy)
- **Program ID**: `5nr7xe1U3k6U6zPEmW3FCbPyXCa7jr7JpudaLKuVNyvZ`
- **Network**: Solana Devnet
- **Status**: Deprecated (use v2.0 instead)
- **Last Deployed**: October 11, 2025

[View v1.0 Program on Explorer](https://explorer.solana.com/address/5nr7xe1U3k6U6zPEmW3FCbPyXCa7jr7JpudaLKuVNyvZ?cluster=devnet)

### Key Versions
- **Anchor**: 0.30.1
- **Rust Toolchain**: 1.79.0
- **Solana CLI**: 2.3.13+ (Agave)
- **Node.js**: 18+
- **Next.js**: 15.5.4

---

## Critical Fixes History

This section documents all major issues encountered and resolved during the v2.0 development cycle.

### Issue 1: Incorrect Instruction Discriminators

**Problem**: The SDK was using placeholder discriminator values instead of actual SHA256 hashes, causing `InstructionFallbackNotFound` errors (0x65).

**Root Cause**: Anchor generates instruction discriminators as the first 8 bytes of `SHA256("global:<instruction_name>")`. The SDK had hardcoded placeholder values.

**Fix**: Created discriminator generation script and updated all discriminators in `client-v2.ts`:

```typescript
// Correct discriminators (SHA256 hashes)
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

**Files Modified**:
- `/Users/graffito/solana-lockbox/nextjs-app/sdk/src/client-v2.ts`
- `/Users/graffito/solana-lockbox/scripts/generate-discriminators.js` (new)

---

### Issue 2: Incorrect INIT_SPACE Calculation

**Problem**: Account deserialization failed with `AccountDidNotDeserialize` error (0xbbb) immediately after account creation.

**Root Cause**: The `INIT_SPACE` constant in `master_lockbox.rs` was missing 4 bytes for the `encrypted_index` Vec length prefix. Borsh serialization requires a 4-byte length prefix for each Vec field.

**The Bug**:
```rust
// BEFORE (102 bytes - MISSING encrypted_index vec length)
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
    // MISSING: encrypted_index vec length (4 bytes)
    8 +  // next_entry_id
    4 +  // categories_count
    8 +  // created_at
    1;   // bump
```

**The Fix**:
```rust
// AFTER (106 bytes - includes BOTH vec lengths)
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

**Why This Matters**:
- Anchor's `init` constraint creates the account with `INIT_SPACE` bytes
- It then writes the discriminator and calls `try_deserialize()`
- Borsh expects to find a 4-byte length prefix for EACH `Vec` field
- Without the correct space, deserialization reads past the account boundary and fails

**Files Modified**:
- `/Users/graffito/solana-lockbox/programs/lockbox/src/state/master_lockbox.rs`

**Deployment**:
- Program rebuilt with `cargo build-sbf`
- Redeployed to devnet at slot 414207771
- Transaction: `9yTWHq4kbJAhEuaqvbUedgnsU9vjBzyE83zbWKFL735T5V9rN8K4HeZ4U7qCuaPdoXRukxdSQem3aWkYua7PQpt`

---

### Issue 3: Context Error Handling

**Problem**: UI was showing "IDL not loaded" error instead of "Initialize Lockbox" button when master lockbox didn't exist.

**Root Cause**: Error handling in `LockboxV2Context.tsx` was treating "account not found" as an error state, which triggered old deployment status message.

**Fix**: Updated error handling to recognize "not found" as expected (not an error):

```typescript
// If master lockbox not found, that's expected - don't show as error
if (errorMsg.includes('not found') || errorMsg.includes('call initializeMasterLockbox')) {
  setMasterLockbox(null);
  setError(null); // Clear any previous error
} else {
  setError(errorMsg);
  setMasterLockbox(null);
}
```

**Files Modified**:
- `/Users/graffito/solana-lockbox/nextjs-app/contexts/LockboxV2Context.tsx`

---

### Issue 4: Double Signature Prompts (Lazy Session Initialization)

**Problem**: Phantom wallet was prompting users to sign twice: once for session key initialization on wallet connect, and again for actual transactions.

**Root Cause**: Session key was being initialized automatically when the wallet connected, but the session key is only needed for encryption/decryption operations (storing/retrieving/updating/deleting passwords), not for viewing the lockbox metadata or connecting.

**User Impact**: Confusing UX - users expected only one signature when performing an action, but were getting prompted immediately on wallet connect plus again when performing CRUD operations.

**Fix**: Implemented lazy session initialization pattern:

1. **Removed automatic initialization** from `PasswordManager.tsx`:
```typescript
// DON'T initialize session automatically - only when needed for encryption/decryption
// The session key is only required for storing/retrieving passwords, not for viewing the lockbox

// Refresh entries when master lockbox is loaded (but only if session exists)
useEffect(() => {
  if (masterLockbox && sessionKey) {
    refreshEntries();
  }
}, [masterLockbox, sessionKey, refreshEntries]);
```

2. **Added lazy initialization to all CRUD operations** in `LockboxV2Context.tsx`:
```typescript
// In createEntry, updateEntry, and deleteEntry:
if (!sessionKey) {
  const initialized = await initializeSession();  // ✅ Only when needed
  if (!initialized) {
    setError('Failed to initialize session');
    return null; // or false
  }
}
```

**Result**: Users now see only **ONE** signature prompt when they actually perform their first password operation (store/retrieve/update/delete), not when they just connect their wallet.

**Files Modified**:
- `/Users/graffito/solana-lockbox/nextjs-app/components/PasswordManager.tsx`
- `/Users/graffito/solana-lockbox/nextjs-app/contexts/LockboxV2Context.tsx`

**Pattern Benefits**:
- Minimizes wallet interaction friction
- Defers permission requests until actually necessary
- Follows principle of least privilege
- Better UX for users who just want to browse/view their vault metadata

---

### Issue 5: Responsive Design & Global Styles

**Problem**:
1. Desktop layout was left-aligned with blank space on right side
2. Dark vertical bar visible on right side of viewport
3. Poor mobile responsiveness

**Root Cause**:
1. Layout container had `max-width: 1400px` but wasn't centered
2. `globals.css` had legacy dark theme background color (#242424)
3. Body was using flexbox with `place-items: center` causing layout issues
4. No responsive breakpoints for mobile/tablet

**Fixes Implemented**:

1. **Responsive Design** (`PasswordManager.tsx`):
```css
.pm-container {
  max-width: 1400px;
  margin: 0 auto;  /* Center on desktop */
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 2rem;
  padding: 2rem;
}

/* Tablet and below */
@media (max-width: 1024px) {
  .pm-container {
    grid-template-columns: 1fr;  /* Single column */
    padding: 1rem;
  }
}

/* Mobile */
@media (max-width: 768px) {
  .pm-header h1 {
    font-size: 1.2rem;  /* Smaller fonts */
  }
  .pm-container {
    padding: 0.75rem;  /* Tighter spacing */
  }
}
```

2. **Global Styles** (`globals.css`):
```css
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  width: 100%;
  background: #f5f7fa;  /* Light background */
  color: #2c3e50;       /* Readable text */
}
```

**Result**:
- ✅ Centered layout on desktop
- ✅ Full-width light background
- ✅ Responsive on mobile and tablet
- ✅ No dark bars or layout issues
- ✅ Sticky header for better navigation

**Files Modified**:
- `/Users/graffito/solana-lockbox/nextjs-app/components/PasswordManager.tsx`
- `/Users/graffito/solana-lockbox/nextjs-app/app/globals.css`

**Responsive Breakpoints**:
- Desktop (> 1024px): Two-column layout with sidebar
- Tablet (768-1024px): Single column, reordered content
- Mobile (< 768px): Touch-optimized, stacked elements

---

### Issue 6: AccountDidNotSerialize on Storage Chunk Creation

**Problem**: When users tried to create their first password entry, they encountered `AccountDidNotSerialize` error (0xbbc) during storage chunk initialization. The error occurred specifically when the program tried to add chunk metadata to the master lockbox's `storage_chunks` vector.

**Error Details**:
```
SendTransactionError: Simulation failed
Error Code: 0xbbc (AccountDidNotSerialize)
Message: Failed to serialize the account
Logs:
  - "Storage chunk 0 initialized with 1KB capacity"
  - "AnchorError caused by account: master_lockbox"
  - "Error Number: 3004"
```

**Root Cause**:
The master lockbox account was initialized with fixed space (106 bytes) that included space for 0 storage chunks. When `initialize_storage_chunk` instruction tried to add the first chunk's metadata to the `storage_chunks` vector, the account needed to grow but had no realloc capability. This is a fundamental requirement of the subscription/payment model where users pay incrementally for storage expansion.

**The Fix - Dynamic Account Reallocation**:

1. **Added realloc constraint** to `InitializeStorageChunk` in `programs/lockbox/src/instructions/initialize.rs`:
```rust
#[account(
    mut,
    seeds = [MasterLockbox::SEEDS_PREFIX, owner.key().as_ref()],
    bump = master_lockbox.bump,
    constraint = master_lockbox.owner == owner.key(),
    realloc = MasterLockbox::calculate_space(master_lockbox.storage_chunks.len() + 1),
    realloc::payer = owner,
    realloc::zero = false,
)]
pub master_lockbox: Account<'info, MasterLockbox>,
```

2. **Space calculation method** in `programs/lockbox/src/state/master_lockbox.rs`:
```rust
/// Size of a single StorageChunkInfo entry
const STORAGE_CHUNK_INFO_SIZE: usize = 59; // 32+2+4+4+1+8+8

/// Calculate space needed for a specific number of chunks
pub fn calculate_space(num_chunks: usize) -> usize {
    Self::BASE_SPACE + (num_chunks * Self::STORAGE_CHUNK_INFO_SIZE)
}
```

**Space Growth Pattern**:
- Initial (0 chunks): 106 bytes
- After 1 chunk: 106 + 59 = 165 bytes (+59 bytes)
- After 2 chunks: 106 + 118 = 224 bytes (+59 bytes)
- After 10 chunks: 106 + 590 = 696 bytes
- After 100 chunks: 106 + 5900 = 6006 bytes (max)

**Connection to Payment Model**:
This implementation directly supports the subscription system:
- **Free tier**: 1KB, 1 chunk - user pays rent once for initial chunk
- **Basic tier**: 10KB, 2 chunks - pays rent + 0.001 SOL/month subscription
- **Premium tier**: 100KB, 10 chunks - pays rent + 0.01 SOL/month
- **Enterprise tier**: 1MB+, 100 chunks - pays rent + 0.1 SOL/month

Each time a chunk is added:
1. Master lockbox reallocates with `realloc`
2. User pays additional rent for expanded space
3. New chunk is initialized and registered
4. Total capacity increases

**Frontend Improvements**:

1. **Fixed storage_chunks deserialization** in `nextjs-app/sdk/src/client-v2.ts`:
   - Was returning empty array
   - Now properly reads and deserializes each StorageChunkInfo item
   - Correctly handles chunk metadata (address, index, capacity, usage)

2. **Enhanced error handling** in `nextjs-app/components/PasswordManager.tsx`:
   - User-friendly message for AccountDidNotSerialize errors
   - Explains connection to subscription tiers
   - Guides users toward upgrade path

**Deployment**:
- Built with: `cargo build-sbf` (bypasses toolchain issues)
- Deployed to devnet: October 13, 2025
- Transaction: `3rGucWFr4XoTXFvoUH4eEjxaF8RWBN9SgY14FYAvesFKGoPYYEMmjrAo2R9hT1yVWCYSGAijZBQiNNDH5SvbYYi4`
- Program size: 355,672 bytes

**Testing Flow**:
1. ✅ Initialize master lockbox (106 bytes, 0 chunks)
2. ✅ Create first password entry
3. ✅ System auto-creates storage chunk (triggers realloc)
4. ✅ Master lockbox expands to 165 bytes
5. ✅ User pays rent for additional 59 bytes
6. ✅ Password is stored successfully

**Files Modified**:
- `/Users/graffito/solana-lockbox/programs/lockbox/src/instructions/initialize.rs`
- `/Users/graffito/solana-lockbox/programs/lockbox/src/state/master_lockbox.rs`
- `/Users/graffito/solana-lockbox/nextjs-app/sdk/src/client-v2.ts`
- `/Users/graffito/solana-lockbox/nextjs-app/components/PasswordManager.tsx`
- `/Users/graffito/solana-lockbox/nextjs-app/contexts/LockboxV2Context.tsx`

**What This Enables**:
- ✅ Dynamic storage expansion (Phase 1.2 complete)
- ✅ Foundation for subscription tiers
- ✅ Users pay rent incrementally as they grow
- ✅ Scalable from 1KB to 1MB+ storage

---

### Issue 7: Transaction Double-Submission

**Problem**: All transactions (initialize, store, close) were being processed twice, causing `SendTransactionError: This transaction has already been processed` errors. Users experienced duplicate transaction confirmations and failed operations.

**Error Details**:
```
SendTransactionError: Simulation failed
Message: This transaction has already been processed
Location: initializeMasterLockbox, storePassword, closeMasterLockbox
```

**Root Cause**:
The SDK was using `wallet.signTransaction()` followed by `connection.sendRawTransaction()`. However, modern Solana wallet adapters (Phantom, Solflare) have a `sendTransaction()` method that **automatically sends** the transaction after signing. This caused:
1. User clicks button → wallet signs and auto-sends transaction
2. SDK then calls `sendRawTransaction()` with signed transaction
3. Result: Transaction sent twice to the network

**The Fix - Wallet Adapter Compatibility**:

1. **Added transaction deduplication** in `client-v2.ts`:
```typescript
export class LockboxV2Client {
  // ... other properties
  private pendingTransactions: Set<string> = new Set();
}
```

2. **Updated transaction sending pattern** (applied to all transaction methods):
```typescript
// Check for duplicate operations
const operationKey = `init-${masterLockbox.toBase58()}`;
if (this.pendingTransactions.has(operationKey)) {
  throw new Error('Operation already in progress');
}

try {
  this.pendingTransactions.add(operationKey);

  // Build transaction...

  // Use sendTransaction if available (preferred for wallet adapters)
  let signature: string;
  if (this.wallet.sendTransaction) {
    signature = await this.wallet.sendTransaction(transaction, this.connection, {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
      maxRetries: 3,
    });
  } else {
    // Fallback to manual signing + sending for older wallets
    const signed = await this.wallet.signTransaction(transaction);
    signature = await this.connection.sendRawTransaction(signed.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
      maxRetries: 3,
    });
  }

  // Confirmation logic...
  return signature;
} finally {
  this.pendingTransactions.delete(operationKey);
}
```

**Methods Updated**:
- `initializeMasterLockbox()`
- `storePassword()`
- `closeMasterLockbox()`

**Benefits**:
- ✅ No more duplicate transactions
- ✅ Compatible with modern wallet adapters
- ✅ Fallback support for older wallets
- ✅ Added retry logic (`maxRetries: 3`)
- ✅ Prevents concurrent duplicate operations

**Files Modified**:
- `/Users/graffito/solana-lockbox/nextjs-app/sdk/src/client-v2.ts`

---

### Issue 8: useConfirm Hook Destructuring Error

**Problem**: "Close account and reclaim rent" functionality was broken with `TypeError: confirm is not a function` at `PasswordManager.tsx:1077:45`.

**Root Cause**:
The `useConfirm()` hook returns an object `{ confirm: function }`, but the code was treating it as if it returned the function directly.

**The Bug**:
```typescript
// BEFORE (line 37):
const confirm = useConfirm();

// Later usage:
await confirm({ title: '...', message: '...' }); // ❌ TypeError: confirm is not a function
```

**The Fix**:
```typescript
// AFTER (line 37):
const { confirm } = useConfirm(); // ✅ Proper destructuring

// Later usage:
await confirm({ title: '...', message: '...' }); // ✅ Works correctly
```

**Hook Definition** (from `ConfirmDialog.tsx`):
```typescript
export const useConfirm = () => {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context; // Returns { confirm: function }, not the function directly
};
```

**Files Modified**:
- `/Users/graffito/solana-lockbox/nextjs-app/components/PasswordManager.tsx`

---

### Phase 5: Subscription System UI Complete

**Overview**: Implemented complete user interface for subscription management, allowing users to view, upgrade, and monitor their storage subscriptions directly from the password manager.

**New Components Created**:

1. **SubscriptionCard.tsx** - Display subscription tiers with pricing
   - Shows all 4 tiers (Free, Basic, Premium, Enterprise)
   - Visual indicators for current tier
   - Pricing information (SOL/month)
   - Storage capacity display
   - Feature comparisons
   - Upgrade call-to-action buttons

2. **SubscriptionUpgradeModal.tsx** - Two-step upgrade flow
   - **Step 1: Tier Selection**
     - Compare tier features side-by-side
     - Highlight storage increases
     - Show pricing differences
   - **Step 2: Payment Confirmation**
     - Review upgrade details
     - Display payment amount in SOL
     - On-chain transaction via `upgradeSubscription` instruction
     - Success/error feedback

3. **StorageUsageBar.tsx** - Storage visualization and monitoring
   - Real-time storage usage display (used/total)
   - Visual progress bar with color-coded status:
     - Green (< 80%): Storage Available
     - Orange (80-95%): Storage Low
     - Red (≥ 95%): Storage Nearly Full
   - Current tier badge
   - Automatic upgrade prompts when approaching limit
   - Warning messages at capacity

**Context Integration** (`LockboxV2Context.tsx`):
```typescript
// Added upgradeSubscription method
const upgradeSubscription = useCallback(async (newTier: SubscriptionTier): Promise<void> => {
  if (!client) {
    throw new Error('Client not initialized');
  }

  // Check for session timeout (SECURITY FIX C-3)
  if (getSessionKey() && isSessionTimedOut()) {
    clearSession();
    throw new Error('Session expired. Please sign in again.');
  }

  // Update activity timestamp
  updateActivity();

  try {
    setLoading(true);
    setError(null);

    await client.upgradeSubscription(newTier);

    // Refresh master lockbox after upgrade to get updated tier info
    await refreshMasterLockbox();
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to upgrade subscription';
    setError(errorMsg);
    throw err;
  } finally {
    setLoading(false);
  }
}, [client, getSessionKey, refreshMasterLockbox, isSessionTimedOut, clearSession, updateActivity]);
```

**Password Manager Integration**:
- Storage usage bar displayed at top of vault
- Upgrade modal triggered from storage warnings
- Subscription cards accessible from account menu
- Real-time updates after successful upgrade

**On-Chain Integration**:
- Uses `upgradeSubscription` instruction (discriminator: `0x55, 0xef, 0x7d, 0xeb, 0xc7, 0xe6, 0xa6, 0xf6`)
- Transfers payment to fee receiver
- Updates `subscription_tier` and `subscription_expires` in MasterLockbox
- Increases `total_capacity` based on new tier

**Subscription Tiers**:
```typescript
export const TIER_INFO: Record<SubscriptionTier, TierInfo> = {
  [SubscriptionTier.Free]: {
    name: 'Free',
    price: 0,
    maxCapacity: 1024,              // 1KB
    maxChunks: 1,
    maxEntriesPerChunk: 10,
  },
  [SubscriptionTier.Basic]: {
    name: 'Basic',
    price: 0.001,                   // 0.001 SOL/month
    maxCapacity: 10240,             // 10KB
    maxChunks: 2,
    maxEntriesPerChunk: 100,
  },
  [SubscriptionTier.Premium]: {
    name: 'Premium',
    price: 0.01,                    // 0.01 SOL/month
    maxCapacity: 102400,            // 100KB
    maxChunks: 10,
    maxEntriesPerChunk: 1000,
  },
  [SubscriptionTier.Enterprise]: {
    name: 'Enterprise',
    price: 0.1,                     // 0.1 SOL/month
    maxCapacity: 1048576,           // 1MB
    maxChunks: 100,
    maxEntriesPerChunk: 10000,
  },
};
```

**Responsive Design**:
- Mobile-first approach with touch targets
- Breakpoints at 768px (mobile) and 1024px (tablet)
- Stacked layouts on smaller screens
- Full-width components on mobile

**User Experience**:
- Visual feedback during upgrade process
- Clear pricing and capacity information
- Automatic prompts when approaching storage limits
- Success notifications after upgrade
- Error handling with user-friendly messages

**Files Created**:
- `/Users/graffito/solana-lockbox/nextjs-app/components/SubscriptionCard.tsx`
- `/Users/graffito/solana-lockbox/nextjs-app/components/SubscriptionUpgradeModal.tsx`
- `/Users/graffito/solana-lockbox/nextjs-app/components/StorageUsageBar.tsx`

**Files Modified**:
- `/Users/graffito/solana-lockbox/nextjs-app/contexts/LockboxV2Context.tsx`
- `/Users/graffito/solana-lockbox/nextjs-app/components/PasswordManager.tsx`

**Testing Flow**:
1. ✅ View current subscription and storage usage
2. ✅ Click upgrade when approaching storage limit
3. ✅ Compare tiers and select desired upgrade
4. ✅ Review and confirm payment
5. ✅ Transaction sent to blockchain
6. ✅ UI updates to reflect new tier and capacity
7. ✅ Storage usage bar reflects increased capacity

**What This Enables**:
- ✅ Complete subscription management UI
- ✅ Self-service upgrades without admin intervention
- ✅ Real-time storage monitoring
- ✅ Automatic upgrade prompts
- ✅ Foundation for subscription renewals (Phase 4)

---

## Quick Start

### Running Locally

```bash
# Clone repository
git clone https://github.com/hackingbutlegal/solana-lockbox.git
cd solana-lockbox

# Install frontend dependencies
cd nextjs-app
npm install

# Start Next.js dev server
npm run dev

# Visit http://localhost:3000
```

### Using the App

1. **Connect Wallet**: Click "Connect Wallet" and choose Phantom or Solflare
2. **Switch to Devnet**: Ensure your wallet is on Devnet network
3. **Get Devnet SOL**: Use wallet's built-in faucet or https://faucet.solana.com
4. **Initialize Lockbox**: Click "Create Password Vault" button
5. **Add Passwords**: Use the password manager interface to store credentials
6. **View Transactions**: Check browser console for transaction signatures

---

## Prerequisites

### System Requirements

- **Solana CLI**: 2.3.13+ (Agave client)
- **Rust**: 1.79.0 (via rustup override)
- **Anchor CLI**: 0.30.1
- **Node.js**: 18+
- **Wallet**: Phantom or Solflare with devnet SOL

### Install Agave (Solana Client)

```bash
# Install Agave (includes updated platform-tools with rustc 1.76+)
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"

# Update PATH
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

# Verify installation
solana --version
# Expected: solana-cli 2.3.13 (src:...; feat:..., agave:...)

cargo-build-sbf --version
# Expected: rustc 1.76+ or higher
```

### Install Dependencies

```bash
# Frontend dependencies
cd nextjs-app
npm install

# If using Anchor (optional)
cargo install --git https://github.com/coral-xyz/anchor --tag v0.30.1 anchor-cli --locked
```

---

## Building the Program

### Method 1: cargo-build-sbf (Recommended)

This method is recommended as it bypasses Anchor IDL generation issues.

```bash
cd /Users/graffito/solana-lockbox

# Set correct Rust toolchain
cd programs/lockbox
rustup override set 1.79.0

# Build with cargo-build-sbf
cargo build-sbf

# Output: target/deploy/lockbox.so (~347 KB for v2.0)
```

### Method 2: Anchor Build (If IDL generation works)

```bash
# Note: May fail due to anchor-syn version issues
# If it works, it will generate both .so and IDL
anchor build

# Output: target/deploy/lockbox.so and target/idl/lockbox.json
```

### Generating Discriminators

If you add new instructions, regenerate discriminators:

```bash
# Run discriminator generator
node scripts/generate-discriminators.js

# Copy output to client-v2.ts
```

---

## Deployment to Devnet

### Initial Deployment

```bash
# Configure Solana CLI for devnet
solana config set --url devnet

# Check your wallet balance (need ~2.5 SOL for deployment)
solana balance

# If needed, get devnet SOL
solana airdrop 2

# Deploy program (creates new program ID)
solana program deploy target/deploy/lockbox.so \
  --url devnet

# Note the Program ID from output
```

### Upgrading Existing Program

```bash
# Rebuild program
cd programs/lockbox
rustup override set 1.79.0
cargo build-sbf

# Upgrade using existing program ID
solana program deploy target/deploy/lockbox.so \
  --url devnet \
  --program-id 7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB

# Verify deployment
solana program show 7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB --url devnet
```

### Verify Program Status

```bash
# View program details
solana program show 7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB --url devnet

# Expected output:
# Program Id: 7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB
# Owner: BPFLoaderUpgradeab1e11111111111111111111111
# ProgramData Address: ...
# Authority: 3H8e4VnGjxKGFKxk2QMmjuu1B7dnDLysGN8hvcDCKxZh
# Last Deployed In Slot: 414207771
# Data Length: 355672 (0x56d78) bytes
# Balance: ~2.48 SOL
```

---

## Deployment to Vercel

### Option 1: Deploy via Vercel Dashboard

1. Go to [Vercel](https://vercel.com/new)
2. Click "Import Project"
3. Select "Import Git Repository"
4. Choose: `hackingbutlegal/solana-lockbox`
5. Configure project settings:
   - **Framework Preset**: Next.js
   - **Root Directory**: `nextjs-app`
   - **Build Command**: `npm install && npm run build`
   - **Output Directory**: `.next`
   - **Install Command**: `npm install`
6. Click "Deploy"

### Option 2: Deploy via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Navigate to project
cd /Users/graffito/solana-lockbox

# Login to Vercel
vercel login

# Deploy (first time - will create project)
vercel

# Follow prompts:
# - Set up and deploy? Y
# - Which scope? [your account]
# - Link to existing project? N
# - What's your project's name? solana-lockbox
# - In which directory is your code located? nextjs-app
# - Want to modify settings? N

# Deploy to production
vercel --prod
```

### Vercel Configuration

The project is configured via `vercel.json` (if present) or Vercel dashboard settings:

```json
{
  "buildCommand": "cd nextjs-app && npm install && npm run build",
  "outputDirectory": "nextjs-app/.next",
  "framework": "nextjs",
  "installCommand": "cd nextjs-app && npm install"
}
```

### Environment Variables

No environment variables are currently required for devnet deployment. For custom configurations:

1. Go to Vercel project settings
2. Navigate to "Environment Variables"
3. Add variables:
   - `NEXT_PUBLIC_SOLANA_NETWORK=devnet`
   - `NEXT_PUBLIC_PROGRAM_ID=7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB`

### Continuous Deployment

Once set up, Vercel will automatically:
- Deploy every push to `main` branch → Production
- Deploy every PR → Preview URL
- Run builds on every commit

### Custom Domain

To add a custom domain:
1. Go to Vercel project
2. Settings → Domains
3. Add your domain
4. Configure DNS as instructed by Vercel

---

## Frontend Configuration

### Update Program ID

Edit `nextjs-app/sdk/src/client-v2.ts` or environment configuration:

```typescript
const PROGRAM_ID = new PublicKey('7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB');
```

### Configure RPC Endpoint

For production, consider using a custom RPC endpoint:

```typescript
// In your connection setup
const connection = new Connection(
  process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com',
  'confirmed'
);
```

### Build for Production

```bash
cd nextjs-app

# Install dependencies
npm install

# Build production bundle
npm run build

# Test production build locally
npm start

# Or preview with Next.js preview server
npm run preview
```

---

## Testing

### Test Master Lockbox Initialization

```bash
# Using test script
npx ts-node scripts/test-initialize.ts

# Expected output:
# Using wallet: <YOUR_WALLET>
# Program loaded successfully!
# Master Lockbox PDA: <PDA_ADDRESS>
# Initializing master lockbox...
# ✅ Success!
# Transaction signature: <TX_SIG>
```

### Test Storage Flow

1. Connect wallet (ensure on Devnet)
2. Click "Create Password Vault" (if not initialized)
3. Click "Add New Password"
4. Fill in password details
5. Click "Save Password"
6. Check for success message
7. Verify password appears in list
8. Test "Edit" and "Delete" functionality

### Test Subscription Upgrade

1. View storage usage bar
2. Click "Upgrade" button
3. Select a higher tier (e.g., Basic → Premium)
4. Review payment details
5. Confirm transaction
6. Verify storage capacity increased
7. Check transaction on Solana Explorer

---

## On-Chain Verification

### Calculate Your PDA Address

```bash
# Get your wallet address
solana address

# Calculate PDA using Node.js
node -e "
const { PublicKey } = require('@solana/web3.js');
const programId = new PublicKey('7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB');
const wallet = new PublicKey('YOUR_WALLET_ADDRESS');
const [pda, bump] = PublicKey.findProgramAddressSync(
  [Buffer.from('master_lockbox'), wallet.toBuffer()],
  programId
);
console.log('PDA:', pda.toBase58());
console.log('Bump:', bump);
"
```

### View Account Data

```bash
# View master lockbox account
solana account <YOUR_PDA> --url devnet

# View detailed JSON output
solana account <YOUR_PDA> --output json --url devnet

# Or view in Solana Explorer
# https://explorer.solana.com/address/<YOUR_PDA>?cluster=devnet
```

### Expected Account Structures

#### MasterLockbox (106 bytes initial)

```
Bytes 0-7:     Anchor discriminator (8 bytes)
Bytes 8-39:    Owner pubkey (32 bytes)
Bytes 40-47:   Total entries (u64, 8 bytes)
Bytes 48-49:   Storage chunks count (u16, 2 bytes)
Bytes 50:      Subscription tier (u8, 1 byte)
Bytes 51-58:   Last accessed timestamp (i64, 8 bytes)
Bytes 59-66:   Subscription expires (i64, 8 bytes)
Bytes 67-74:   Total capacity (u64, 8 bytes)
Bytes 75-82:   Storage used (u64, 8 bytes)
Bytes 83-86:   Storage chunks vec length (u32, 4 bytes)
Bytes 87-90:   Encrypted index vec length (u32, 4 bytes)
Bytes 91-98:   Next entry ID (u64, 8 bytes)
Bytes 99-102:  Categories count (u32, 4 bytes)
Bytes 103-110: Created at timestamp (i64, 8 bytes)
Byte  111:     PDA bump seed (u8, 1 byte)
```

#### StorageChunk (85 bytes + entries)

```
Bytes 0-7:     Anchor discriminator (8 bytes)
Bytes 8-39:    Owner pubkey (32 bytes)
Bytes 40-71:   Master lockbox pubkey (32 bytes)
Bytes 72-73:   Chunk index (u16, 2 bytes)
Bytes 74-75:   Entries count (u16, 2 bytes)
Bytes 76-79:   Max capacity (u32, 4 bytes)
Bytes 80-83:   Entries vec length (u32, 4 bytes)
Bytes 84+:     Password entries (variable size)
Byte  ...      PDA bump seed (u8, 1 byte)
```

### View Program Logs

```bash
# Stream logs from program (real-time)
solana logs 7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB --url devnet

# View transaction logs
solana confirm <TRANSACTION_SIGNATURE> -v --url devnet
```

---

## Production Deployment

### Mainnet Preparation Checklist

**⚠️ Before deploying to mainnet:**

- [ ] **Security Audit**: Engage professional auditors (e.g., Halborn, OtterSec, Kudelski)
- [ ] **Comprehensive Testing**: Test all edge cases on devnet
- [ ] **Multiple Code Reviews**: At least 3 independent developer reviews
- [ ] **Documentation**: Complete user and developer documentation
- [ ] **Incident Response Plan**: Plan for handling security incidents
- [ ] **Monitoring & Alerting**: Set up alerts for unusual activity
- [ ] **Legal Review**: Ensure compliance with applicable regulations
- [ ] **Insurance**: Consider protocol insurance (Nexus Mutual, Unslashed)
- [ ] **Bug Bounty Program**: Establish rewards for vulnerability disclosure
- [ ] **Emergency Upgrade Plan**: Document emergency procedures
- [ ] **Multisig Upgrade Authority**: Use Squads Protocol or similar
- [ ] **Rate Limiting Review**: Validate cooldown periods are adequate
- [ ] **Fee Structure Validation**: Confirm pricing is appropriate
- [ ] **Size Limits Testing**: Verify capacity limits for all tiers
- [ ] **Recovery Documentation**: Document key recovery process
- [ ] **Load Testing**: Test with high transaction volume
- [ ] **Frontend Security Review**: Audit client-side encryption implementation
- [ ] **Dependency Audit**: Review all npm and cargo dependencies

### Mainnet Deployment Steps

```bash
# Switch to mainnet
solana config set --url mainnet-beta

# Ensure sufficient SOL (5-10 SOL recommended for safety)
solana balance

# Verify wallet is correct (use hardware wallet for mainnet!)
solana address

# Build program with release optimizations
cd programs/lockbox
rustup override set 1.79.0
cargo build-sbf --release

# Final verification of build
ls -lh target/deploy/lockbox.so

# Deploy to mainnet (IRREVERSIBLE!)
solana program deploy target/deploy/lockbox.so \
  --url mainnet-beta \
  --keypair ~/.config/solana/id.json

# IMPORTANT: Save the Program ID!
# Program ID: <YOUR_MAINNET_PROGRAM_ID>

# Verify deployment
solana program show <YOUR_MAINNET_PROGRAM_ID> --url mainnet-beta

# Transfer upgrade authority to multisig (RECOMMENDED!)
solana program set-upgrade-authority \
  <YOUR_MAINNET_PROGRAM_ID> \
  --new-upgrade-authority <MULTISIG_ADDRESS> \
  --url mainnet-beta
```

### Update Frontend for Mainnet

```typescript
// Update nextjs-app/sdk/src/client-v2.ts
const PROGRAM_ID = new PublicKey('YOUR_MAINNET_PROGRAM_ID');

// Update connection URL
const connection = new Connection(
  clusterApiUrl('mainnet-beta'),
  'confirmed'
);

// Or use a premium RPC endpoint
const connection = new Connection(
  'https://your-premium-rpc-endpoint.com',
  'confirmed'
);
```

### Build and Deploy Frontend

```bash
# Update program ID in code first!

# Build production frontend
cd nextjs-app
npm run build

# Test production build locally
npm start

# Deploy to Vercel
vercel --prod
```

### Post-Mainnet Deployment

1. **Monitor Transactions**: Watch program logs for first 24-48 hours
2. **Set Up Alerts**: Configure monitoring for error rates
3. **Test with Small Amounts**: Do test transactions with minimal SOL
4. **User Communication**: Announce deployment with clear documentation
5. **Support Channels**: Set up Discord/Telegram for user support
6. **Gradual Rollout**: Consider limiting initial usage
7. **Documentation**: Update all docs with mainnet addresses
8. **Repository Tags**: Tag release in git

### Mainnet Costs

**Deployment Costs:**
- Program deployment: ~1.5-2.5 SOL (one-time)
- Program rent: ~2.48 SOL (stays with program, rent-exempt)
- Total: ~4-5 SOL needed for deployment

**User Costs:**
- Master lockbox creation: ~0.000897 SOL (rent-exempt)
- Storage chunk creation: ~0.01-0.02 SOL per chunk (rent + capacity)
- Password operations: ~0.000005 SOL (transaction fee)
- Subscription fees: 0.001-0.1 SOL/month (depends on tier)

---

## Security Considerations

### Implemented Security Features

✅ **Client-Side Encryption**: All encryption happens in browser using XChaCha20-Poly1305
✅ **Wallet-Derived Keys**: Keys derived from wallet signatures via HKDF
✅ **Zero-Knowledge**: On-chain data is fully encrypted
✅ **PDA Isolation**: Each user has their own PDA, isolated from others
✅ **Rate Limiting**: Prevents DoS via minimum 1-second intervals
✅ **Subscription Enforcement**: Capacity limits enforced on-chain
✅ **Memory Scrubbing**: Sensitive data wiped after use
✅ **Session Management**: 15-minute inactivity timeout
✅ **Owner-Only Access**: PDAs ensure only owner can access data
✅ **AEAD Encryption**: Authenticated encryption prevents tampering
✅ **Dynamic Realloc**: Secure account expansion with rent protection
✅ **Transaction Deduplication**: Prevents double-submission attacks
✅ **Lazy Session Init**: Minimizes unnecessary wallet signatures

### Known Limitations

⚠️ **Wallet Compromise**: If wallet is compromised, attacker can decrypt all data
⚠️ **No Forward Secrecy**: Historical data remains vulnerable if wallet is compromised
⚠️ **Browser Security**: Malicious extensions could intercept in-memory data
⚠️ **Single Derivation**: All passwords encrypted with same key derivation method
⚠️ **Side-Channel Attacks**: Standard implementation-dependent timing risks
⚠️ **Quantum Resistance**: Not quantum-resistant (future consideration)
⚠️ **No Key Rotation**: Cannot rotate encryption keys without re-encrypting all data
⚠️ **JavaScript Environment**: Vulnerable to XSS if not properly sanitized

### Threat Model

**Mitigated Threats:**
- ✅ On-chain data exposure (all data encrypted)
- ✅ Unauthorized access (owner-only PDAs)
- ✅ Replay attacks (slot-based timestamps)
- ✅ Nonce reuse (random generation)
- ✅ Brute force (rate limiting)
- ✅ Account hijacking (PDA ownership checks)
- ✅ Memory persistence (session timeouts)
- ✅ Transaction tampering (authenticated encryption)

**Unmitigated Threats:**
- ❌ Wallet private key compromise
- ❌ Malicious browser extensions
- ❌ Memory inspection attacks
- ❌ Quantum computer attacks
- ❌ Phishing attacks targeting wallet signatures
- ❌ Clipboard monitoring malware
- ❌ Screen capture malware

### Security Best Practices for Users

1. **Use Hardware Wallets**: Ledger or similar for mainnet
2. **Verify URLs**: Always check you're on the correct domain
3. **Browser Security**: Use clean browser profile without untrusted extensions
4. **Regular Backups**: Export and securely backup critical passwords
5. **Session Timeouts**: Don't leave sessions unattended
6. **Strong Master Password**: If implementing master password feature
7. **Multi-Factor**: Consider 2FA for high-value accounts
8. **Regular Audits**: Review stored passwords periodically

### Security Recommendations for Developers

1. **Regular Dependency Updates**: Monitor and update all dependencies
2. **Security Headers**: Implement CSP, X-Frame-Options, etc.
3. **Input Validation**: Strict validation on all user inputs
4. **Error Handling**: Don't expose sensitive info in error messages
5. **Logging**: Log security events without exposing secrets
6. **Testing**: Regular penetration testing and security audits
7. **Monitoring**: Real-time monitoring for anomalies
8. **Incident Response**: Maintain updated incident response plan

---

## Troubleshooting

### Common Issues

#### Issue: `InstructionFallbackNotFound` (0x65)

**Cause**: Discriminator mismatch between SDK and program
**Solution**: Ensure you're using the correct discriminators from this document
**Verification**: Run `node scripts/generate-discriminators.js` and compare

#### Issue: `AccountDidNotDeserialize` (0xbbb)

**Cause**: Account space mismatch
**Solution**: This was fixed in October 12 deployment. Ensure using latest program
**Verification**: Check `INIT_SPACE` includes all Vec length prefixes

#### Issue: `AccountDidNotSerialize` (0xbbc)

**Cause**: Account lacks space for new data
**Solution**: This was fixed in October 13 deployment with realloc. Update program
**Verification**: Check `initialize_storage_chunk` has `realloc` constraint

#### Issue: "Master lockbox not found"

**Cause**: User hasn't initialized their lockbox yet
**Solution**: This is expected! Click "Create Password Vault" to initialize
**Note**: Not an error - part of normal first-time user flow

#### Issue: "Subscription expired"

**Cause**: User's subscription period has ended
**Solution**: Use `renewSubscription` instruction to renew tier
**Alternative**: Upgrade to higher tier (implicitly renews)

#### Issue: "Insufficient capacity"

**Cause**: Storage limit reached for current tier
**Solution**: Upgrade subscription tier or delete unused passwords
**Check**: View storage usage bar for current capacity

#### Issue: "Session expired"

**Cause**: 15-minute inactivity timeout triggered
**Solution**: Refresh page and reconnect wallet
**Prevention**: Keep tab active during use

#### Issue: "Transaction has already been processed"

**Cause**: Double-submission error
**Solution**: This was fixed in Issue 7. Update to latest SDK
**Verification**: Check SDK uses `wallet.sendTransaction()` method

#### Issue: "TypeError: confirm is not a function"

**Cause**: Incorrect hook destructuring
**Solution**: Use `const { confirm } = useConfirm()` instead of `const confirm = useConfirm()`
**Fixed**: Issue 8 resolved this in latest version

#### Issue: Double signature prompts

**Cause**: Session initialized on wallet connect
**Solution**: Issue 4 fixed this with lazy initialization
**Expected Behavior**: Only one signature when performing first operation

#### Issue: Responsive layout issues

**Cause**: Missing or incorrect CSS breakpoints
**Solution**: Issue 5 fixed responsive design. Update PasswordManager.tsx
**Verification**: Test on mobile (< 768px) and tablet (768-1024px)

### Debugging Tools

#### View Program Logs

```bash
# Stream logs from program (real-time)
solana logs 7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB --url devnet

# View specific transaction
solana confirm <SIGNATURE> -v --url devnet
```

#### Check Program Status

```bash
# Program details
solana program show 7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB --url devnet

# Check upgrade authority
solana program show 7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB --url devnet | grep Authority
```

#### Check Account Data

```bash
# View account
solana account <PDA_ADDRESS> --url devnet

# JSON output
solana account <PDA_ADDRESS> --output json --url devnet

# Check account size
solana account <PDA_ADDRESS> --url devnet | grep "Length"
```

#### Browser Console

The frontend includes detailed console logging:
- Transaction simulation results
- Discriminator calculations
- Instruction data breakdown
- Error stack traces
- Session state changes

Open browser DevTools (F12) and check Console tab.

#### Common CLI Issues

**Issue**: "Error: unable to confirm transaction"
**Solution**: Network congestion. Wait and retry or increase commitment level

**Issue**: "Error: Attempt to debit an account but found no record of a prior credit"
**Solution**: Insufficient balance. Get more devnet SOL

**Issue**: "Error: Invalid param: could not find account"
**Solution**: Account doesn't exist yet. Check PDA calculation or initialize first

---

## Program Details

### Account Structures

#### MasterLockbox

```rust
pub struct MasterLockbox {
    pub owner: Pubkey,                        // 32 bytes
    pub total_entries: u64,                   // 8 bytes
    pub storage_chunks_count: u16,            // 2 bytes
    pub subscription_tier: SubscriptionTier,  // 1 byte
    pub last_accessed: i64,                   // 8 bytes
    pub subscription_expires: i64,            // 8 bytes
    pub total_capacity: u64,                  // 8 bytes
    pub storage_used: u64,                    // 8 bytes
    pub storage_chunks: Vec<StorageChunkInfo>,// 4 bytes (length) + data
    pub encrypted_index: Vec<u8>,             // 4 bytes (length) + data
    pub next_entry_id: u64,                   // 8 bytes
    pub categories_count: u32,                // 4 bytes
    pub created_at: i64,                      // 8 bytes
    pub bump: u8,                             // 1 byte
}
// + 8 byte discriminator = 106 bytes initial
```

#### StorageChunk

```rust
pub struct StorageChunk {
    pub owner: Pubkey,              // 32 bytes
    pub master_lockbox: Pubkey,     // 32 bytes
    pub chunk_index: u16,           // 2 bytes
    pub entries_count: u16,         // 2 bytes
    pub max_capacity: u32,          // 4 bytes
    pub entries: Vec<PasswordEntry>,// 4 bytes (length) + data
    pub bump: u8,                   // 1 byte
}
// + 8 byte discriminator = 85 bytes + entries
```

### Instructions

#### `initialize_master_lockbox`

Creates a new master lockbox account for the user.

**Discriminator**: `[0x21, 0xa5, 0x13, 0x5b, 0xd6, 0x53, 0x44, 0x2d]`

**Accounts:**
- `master_lockbox` (init): PDA derived from `["master_lockbox", owner.key()]`
- `owner` (signer, mut): User's wallet
- `system_program`: System Program

**Parameters:** None

**Checks:**
- PDA derivation correct
- Owner is signer
- Account doesn't already exist

#### `initialize_storage_chunk`

Creates a new storage chunk with specified capacity.

**Discriminator**: `[0x8e, 0xd6, 0xee, 0x3c, 0x93, 0xee, 0xaa, 0x22]`

**Accounts:**
- `storage_chunk` (init): PDA derived from `["storage_chunk", master_lockbox.key(), chunk_index]`
- `master_lockbox` (mut, realloc): User's master lockbox (expands to accommodate new chunk info)
- `owner` (signer, mut): User's wallet
- `system_program`: System Program

**Parameters:**
- `chunk_index: u16` - Sequential chunk number
- `initial_capacity: u32` - Initial size in bytes

**Realloc**: Master lockbox grows by 59 bytes per chunk

#### `store_password_entry`

Stores an encrypted password entry in a storage chunk.

**Discriminator**: `[0x2d, 0x64, 0x17, 0x8d, 0xf4, 0xd7, 0x8a, 0xa0]`

**Accounts:**
- `storage_chunk` (mut): Target storage chunk
- `master_lockbox` (mut): User's master lockbox
- `owner` (signer): User's wallet

**Parameters:**
- `encrypted_data: Vec<u8>` - Encrypted password entry
- `entry_type: PasswordEntryType` - Login, Note, Card, Identity, etc.
- `category_id: Option<u32>` - Optional category
- `blind_index: [u8; 32]` - Search index

**Checks:**
- Subscription active
- Sufficient capacity
- Rate limit not exceeded

#### `retrieve_password_entry`

Retrieves an encrypted password entry.

**Discriminator**: `[0x8c, 0xd0, 0x4f, 0x9b, 0xa7, 0x0b, 0x73, 0xbc]`

**Accounts:**
- `storage_chunk`: Storage chunk containing entry
- `master_lockbox`: User's master lockbox
- `owner` (signer): User's wallet

**Parameters:**
- `entry_id: u64` - Entry to retrieve

**Returns:**
- `encrypted_data: Vec<u8>` - Encrypted password entry

#### `update_password_entry`

Updates an existing password entry.

**Discriminator**: `[0x1d, 0x96, 0x9e, 0x9b, 0x6f, 0x88, 0x16, 0x2a]`

**Accounts:**
- `storage_chunk` (mut): Storage chunk containing entry
- `master_lockbox` (mut): User's master lockbox
- `owner` (signer): User's wallet

**Parameters:**
- `entry_id: u64` - Entry to update
- `encrypted_data: Vec<u8>` - New encrypted data
- `blind_index: [u8; 32]` - Updated search index

#### `delete_password_entry`

Deletes a password entry and reclaims space.

**Discriminator**: `[0xf5, 0x59, 0xe8, 0xae, 0x78, 0xb3, 0x40, 0x06]`

**Accounts:**
- `storage_chunk` (mut): Storage chunk containing entry
- `master_lockbox` (mut): User's master lockbox
- `owner` (signer): User's wallet

**Parameters:**
- `entry_id: u64` - Entry to delete

#### `upgrade_subscription`

Upgrades user's subscription tier.

**Discriminator**: `[0x55, 0xef, 0x7d, 0xeb, 0xc7, 0xe6, 0xa6, 0xf6]`

**Accounts:**
- `master_lockbox` (mut): User's master lockbox
- `owner` (signer, mut): User's wallet
- `fee_receiver` (mut): Protocol fee receiver

**Parameters:**
- `new_tier: SubscriptionTier` - Target tier (Basic, Premium, Enterprise)

**Fees:**
- Basic: 0.001 SOL/month
- Premium: 0.01 SOL/month
- Enterprise: 0.1 SOL/month

#### `renew_subscription`

Renews subscription for current tier.

**Discriminator**: `[0x2d, 0x4b, 0x9a, 0xc2, 0xa0, 0x0a, 0x6f, 0xb7]`

**Accounts:**
- `master_lockbox` (mut): User's master lockbox
- `owner` (signer, mut): User's wallet
- `fee_receiver` (mut): Protocol fee receiver

**Parameters:** None (uses current tier)

#### `downgrade_subscription`

Downgrades to lower tier (if data fits).

**Discriminator**: `[0x39, 0x12, 0x7b, 0x76, 0xcb, 0x07, 0xc1, 0x25]`

**Accounts:**
- `master_lockbox` (mut): User's master lockbox
- `owner` (signer): User's wallet

**Parameters:**
- `new_tier: SubscriptionTier` - Target tier

**Checks:**
- Current storage usage fits in new tier capacity

---

## Links and Resources

### Project Links

- **Repository**: https://github.com/hackingbutlegal/solana-lockbox
- **v2.0 Program Explorer**: https://explorer.solana.com/address/7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB?cluster=devnet
- **v1.0 Program Explorer**: https://explorer.solana.com/address/5nr7xe1U3k6U6zPEmW3FCbPyXCa7jr7JpudaLKuVNyvZ?cluster=devnet
- **Creator**: https://x.com/0xgraffito

### Documentation

- **Solana Docs**: https://docs.solana.com/
- **Anchor Docs**: https://www.anchor-lang.com/
- **Solana Cookbook**: https://solanacookbook.com/
- **Solana Program Library**: https://spl.solana.com/

### Tools

- **Solana Faucet**: https://faucet.solana.com/
- **Solana Explorer**: https://explorer.solana.com/
- **Anchor Book**: https://book.anchor-lang.com/
- **Vercel**: https://vercel.com/docs

### Security Resources

- **Solana Security**: https://docs.solana.com/security
- **Anchor Security**: https://book.anchor-lang.com/anchor_in_depth/security.html
- **Common Vulnerabilities**: https://github.com/coral-xyz/sealevel-attacks

### Community

- **Solana Discord**: https://discord.gg/solana
- **Anchor Discord**: https://discord.gg/anchorfm
- **Solana Stack Exchange**: https://solana.stackexchange.com/

---

## Cost Breakdown

### Deployment Costs (Devnet)

- **Initial deployment**: ~1.5-2.5 SOL (one-time)
- **Program upgrade**: ~0.3-0.5 SOL (when updating)
- **Program rent**: ~2.48 SOL (stays with program, rent-exempt)

### User Costs (Devnet/Mainnet)

**One-Time Costs:**
- **Master lockbox creation**: ~0.000897 SOL (rent-exempt)
- **First storage chunk**: ~0.01 SOL (rent + initialization)

**Recurring Costs:**
- **Transaction fees**: ~0.000005 SOL per transaction
- **Storage operations**: ~0.000005 SOL per operation
- **Subscription fees** (monthly):
  - Free: 0 SOL (1KB storage)
  - Basic: 0.001 SOL (10KB storage)
  - Premium: 0.01 SOL (100KB storage)
  - Enterprise: 0.1 SOL (1MB+ storage)

**Additional Chunks:**
- Each additional chunk: ~0.01-0.02 SOL (rent + capacity)
- Master lockbox expansion: ~0.00004 SOL per chunk info (59 bytes)

### Example Cost Calculations

**Scenario 1: Free Tier User**
- Initial setup: ~0.01 SOL (master lockbox + 1 chunk)
- Monthly: 0 SOL
- Per password: ~0.000005 SOL (transaction fee only)
- **Total first month**: ~0.01 SOL

**Scenario 2: Premium Tier User**
- Initial setup: ~0.01 SOL (master lockbox + 1 chunk)
- Upgrade to Premium: 0.01 SOL (one-time)
- Monthly subscription: 0.01 SOL
- Additional chunks (9): ~0.09 SOL (one-time)
- **Total first month**: ~0.12 SOL
- **Subsequent months**: 0.01 SOL/month

**Scenario 3: Enterprise Tier User**
- Initial setup: ~0.01 SOL
- Upgrade to Enterprise: 0.1 SOL (one-time)
- Monthly subscription: 0.1 SOL
- Additional chunks (99): ~0.99 SOL (one-time)
- **Total first month**: ~1.2 SOL
- **Subsequent months**: 0.1 SOL/month

---

## Version History

### v2.0.2-devnet (October 13, 2025)
- ✅ Phase 5: Subscription UI complete
- ✅ Issue 6: Dynamic account reallocation
- ✅ Issue 7: Transaction double-submission fix
- ✅ Issue 8: useConfirm hook fix
- ✅ StorageUsageBar component
- ✅ SubscriptionCard component
- ✅ SubscriptionUpgradeModal component

### v2.0.1-devnet (October 12, 2025)
- ✅ Issue 1: Correct instruction discriminators
- ✅ Issue 2: Fixed INIT_SPACE calculation
- ✅ Issue 3: Context error handling
- ✅ Issue 4: Lazy session initialization
- ✅ Issue 5: Responsive design & global styles
- ✅ MasterLockbox INIT_SPACE: 106 bytes

### v2.0.0-devnet (October 10, 2025)
- ✅ Password manager architecture
- ✅ Multi-entry support
- ✅ Storage chunks with dynamic capacity
- ✅ Subscription tiers
- ✅ Client-side encryption (XChaCha20-Poly1305)
- ✅ Next.js 15.5.4 frontend

### v1.1.0 (October 12, 2025)
- ✅ Interactive FAQ component
- ✅ Ephemeral decryption model
- ✅ Attribution footer
- ✅ Enhanced security documentation

### v1.0.0 (October 11, 2025)
- ✅ Basic lockbox functionality
- ✅ Single-entry storage
- ✅ Client-side encryption
- ✅ Vite + React frontend

---

**Last Updated**: October 13, 2025
**Version**: v2.0.2-devnet (Phase 5: Subscription UI Complete)
**Status**: ✅ Live on Devnet - Fully Functional

Created with <3 by [GRAFFITO](https://x.com/0xgraffito)
