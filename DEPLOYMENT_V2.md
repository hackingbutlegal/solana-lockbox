# Lockbox v2.0 Deployment Guide

## ✅ Current Status

1. **Program**: ✅ Deployed to Solana Devnet with Dynamic Storage
2. **Program ID**: `7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB`
3. **Frontend**: ✅ Next.js 15.5.4 at http://localhost:3000
4. **Network**: Devnet
5. **Status**: Live with automatic account reallocation
6. **Last Deployed**: October 13, 2025 (Realloc implementation)
7. **Latest Feature**: Dynamic master lockbox expansion

[View Program on Explorer](https://explorer.solana.com/address/7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB?cluster=devnet)

---

## Recent Critical Fixes (October 12, 2025)

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

## Program Details

### Deployment Info

- **Program ID**: `7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB`
- **Network**: Solana Devnet
- **Last Deployed**: October 12, 2025, Slot 414207771
- **Size**: 355,672 bytes (347 KB)
- **Upgrade Authority**: 3H8e4VnGjxKGFKxk2QMmjuu1B7dnDLysGN8hvcDCKxZh
- **Anchor Version**: 0.30.1
- **Rust Toolchain**: 1.79.0

### Account Structure

#### MasterLockbox (106 bytes initial)
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
// + 8 byte discriminator = 106 bytes total
```

#### StorageChunk (expandable via realloc)
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

**Accounts:**
- `master_lockbox` (init): PDA derived from `["master_lockbox", owner.key()]`
- `owner` (signer, mut): User's wallet
- `system_program`: System Program

**Parameters:** None

**Discriminator:** `[0x21, 0xa5, 0x13, 0x5b, 0xd6, 0x53, 0x44, 0x2d]`

**Checks:**
- PDA derivation correct
- Owner is signer
- Account doesn't already exist

#### `initialize_storage_chunk`
Creates a new storage chunk with specified capacity.

**Accounts:**
- `storage_chunk` (init): PDA derived from `["storage_chunk", master_lockbox.key(), chunk_index]`
- `master_lockbox` (mut): User's master lockbox
- `owner` (signer, mut): User's wallet
- `system_program`: System Program

**Parameters:**
- `chunk_index: u16` - Sequential chunk number
- `initial_capacity: u32` - Initial size in bytes

**Discriminator:** `[0x8e, 0xd6, 0xee, 0x3c, 0x93, 0xee, 0xaa, 0x22]`

#### `store_password_entry`
Stores an encrypted password entry in a storage chunk.

**Accounts:**
- `storage_chunk` (mut): Target storage chunk
- `master_lockbox` (mut): User's master lockbox
- `owner` (signer): User's wallet

**Parameters:**
- `encrypted_data: Vec<u8>` - Encrypted password entry
- `entry_type: PasswordEntryType` - Login, Note, Card, Identity, etc.
- `category_id: Option<u32>` - Optional category
- `blind_index: [u8; 32]` - Search index

**Discriminator:** `[0x2d, 0x64, 0x17, 0x8d, 0xf4, 0xd7, 0x8a, 0xa0]`

**Checks:**
- Subscription active
- Sufficient capacity
- Rate limit not exceeded

#### `retrieve_password_entry`
Retrieves an encrypted password entry.

**Accounts:**
- `storage_chunk`: Storage chunk containing entry
- `master_lockbox`: User's master lockbox
- `owner` (signer): User's wallet

**Parameters:**
- `entry_id: u64` - Entry to retrieve

**Discriminator:** `[0x8c, 0xd0, 0x4f, 0x9b, 0xa7, 0x0b, 0x73, 0xbc]`

**Returns:**
- `encrypted_data: Vec<u8>` - Encrypted password entry

#### `update_password_entry`
Updates an existing password entry.

**Accounts:**
- `storage_chunk` (mut): Storage chunk containing entry
- `master_lockbox` (mut): User's master lockbox
- `owner` (signer): User's wallet

**Parameters:**
- `entry_id: u64` - Entry to update
- `encrypted_data: Vec<u8>` - New encrypted data
- `blind_index: [u8; 32]` - Updated search index

**Discriminator:** `[0x1d, 0x96, 0x9e, 0x9b, 0x6f, 0x88, 0x16, 0x2a]`

#### `delete_password_entry`
Deletes a password entry and reclaims space.

**Accounts:**
- `storage_chunk` (mut): Storage chunk containing entry
- `master_lockbox` (mut): User's master lockbox
- `owner` (signer): User's wallet

**Parameters:**
- `entry_id: u64` - Entry to delete

**Discriminator:** `[0xf5, 0x59, 0xe8, 0xae, 0x78, 0xb3, 0x40, 0x06]`

#### `upgrade_subscription`
Upgrades user's subscription tier.

**Accounts:**
- `master_lockbox` (mut): User's master lockbox
- `owner` (signer, mut): User's wallet
- `fee_receiver` (mut): Protocol fee receiver

**Parameters:**
- `new_tier: SubscriptionTier` - Target tier (Basic, Premium, Enterprise)

**Discriminator:** `[0x55, 0xef, 0x7d, 0xeb, 0xc7, 0xe6, 0xa6, 0xf6]`

**Fees:**
- Basic: 0.001 SOL/month
- Premium: 0.01 SOL/month
- Enterprise: 0.1 SOL/month

---

## Development

### Prerequisites

- **Node.js**: 18+
- **Solana CLI**: 2.3.13+ (Agave)
- **Rust**: 1.79.0 (via rustup override)
- **Anchor CLI**: 0.30.1
- **Wallet**: Phantom or Solflare with devnet SOL

### Building the Program

```bash
# Set correct Rust toolchain
cd programs/lockbox
rustup override set 1.79.0

# Build with cargo-build-sbf
cargo build-sbf

# Output: target/deploy/lockbox.so
```

### Deploying Program

```bash
# Configure for devnet
solana config set --url devnet

# Check balance (need ~2.5 SOL)
solana balance

# Deploy/upgrade program
solana program deploy target/deploy/lockbox.so \
  --url devnet \
  --program-id 7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB

# Verify deployment
solana program show 7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB --url devnet
```

### Frontend Development

```bash
cd nextjs-app

# Install dependencies
npm install

# Development server with hot reload
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

### Generating Discriminators

If you add new instructions, regenerate discriminators:

```bash
# Run discriminator generator
node scripts/generate-discriminators.js

# Copy output to client-v2.ts
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

### Verify On-Chain Data

```bash
# Get your wallet address
solana address

# Calculate PDA
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

# View account data
solana account <YOUR_PDA> --output json

# Or view in Explorer
# https://explorer.solana.com/address/<YOUR_PDA>?cluster=devnet
```

### Expected Master Lockbox Structure

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

### Known Limitations

⚠️ **Wallet Compromise**: If wallet is compromised, attacker can decrypt all data
⚠️ **No Forward Secrecy**: Historical data remains vulnerable if wallet is compromised
⚠️ **Browser Security**: Malicious extensions could intercept in-memory data
⚠️ **Single Derivation**: All passwords encrypted with same key derivation method

---

## Troubleshooting

### Common Issues

**Issue**: `InstructionFallbackNotFound` (0x65)
**Solution**: Discriminator mismatch - ensure you're using the correct discriminators from this document

**Issue**: `AccountDidNotDeserialize` (0xbbb)
**Solution**: Account space mismatch - this was fixed in the October 12 deployment

**Issue**: "Master lockbox not found"
**Solution**: This is expected - click "Create Password Vault" to initialize

**Issue**: "Subscription expired"
**Solution**: Use `renew_subscription` instruction to renew your tier

**Issue**: "Insufficient capacity"
**Solution**: Upgrade subscription tier or delete unused passwords

### Debugging Tools

```bash
# View program logs
solana logs 7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB --url devnet

# Check program status
solana program show 7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB --url devnet

# View transaction details
solana confirm <SIGNATURE> -v --url devnet

# Check account data
solana account <PDA_ADDRESS> --url devnet
```

---

## Production Deployment

### Mainnet Preparation Checklist

**⚠️ Before deploying to mainnet:**

- [ ] Security audit by professional auditors
- [ ] Comprehensive test coverage on devnet
- [ ] Multiple developer code reviews
- [ ] Documentation complete and reviewed
- [ ] Incident response plan in place
- [ ] Monitoring and alerting configured
- [ ] Legal and compliance review
- [ ] Insurance (if applicable)
- [ ] Bug bounty program established
- [ ] Emergency upgrade plan documented

### Mainnet Deployment Steps

```bash
# Switch to mainnet
solana config set --url mainnet-beta

# Ensure sufficient SOL (5+ SOL recommended)
solana balance

# Build program
cd programs/lockbox
cargo build-sbf

# Deploy to mainnet
solana program deploy target/deploy/lockbox.so --url mainnet-beta

# Update frontend environment
# Change NEXT_PUBLIC_PROGRAM_ID and RPC endpoint to mainnet

# Build production frontend
cd nextjs-app
npm run build

# Deploy to hosting (Vercel, Netlify, etc.)
```

---

## Links

- **GitHub**: https://github.com/hackingbutlegal/solana-lockbox
- **v2 Program Explorer**: https://explorer.solana.com/address/7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB?cluster=devnet
- **v1 Program Explorer**: https://explorer.solana.com/address/5nr7xe1U3k6U6zPEmW3FCbPyXCa7jr7JpudaLKuVNyvZ?cluster=devnet
- **Solana Docs**: https://docs.solana.com/
- **Anchor Docs**: https://www.anchor-lang.com/

---

### Issue 6: AccountDidNotSerialize on Storage Chunk Creation (October 13, 2025)

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
This implementation directly supports the subscription system described in PASSWORD_MANAGER_EXPANSION.md:
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

1. **Fixed storage_chunks deserialization** in `nextjs-app/sdk/src/client-v2.ts` (lines 913-957):
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
- 🔜 Subscription upgrade UI (Phase 5 next)

---

**Last Updated**: October 13, 2025
**Version**: v2.0.1-devnet (Realloc Implementation)
**Status**: ✅ Live on Devnet with Dynamic Storage

Created with <3 by [GRAFFITO](https://x.com/0xgraffito)
