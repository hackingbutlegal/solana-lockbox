# Multi-Wallet Orphaned Chunk Recovery Guide

## Overview

Both of your development wallets have orphaned storage chunks that need recovery:

### Wallet 1: `14DrkGw1UYWb542i2z1tGK7C6oV4sX7X2Z5pHhsyvfzn`
- **Status:** ⚠️ 1 orphaned chunk
- **Orphaned Chunk 0:** `3HBA3mmXuUJy3VzvGKrT87pBwSp8ckiAshYfTatjz1h5`
- **Rent Locked:** ~0.0088 SOL
- **Recovery Script:** `recover-wallet-14Drk.ts`

### Wallet 2: `465Av5qxktim1iN9p54k41MbRGPe2nqCfyVYwB2EF84J`
- **Status:** ⚠️ 1 orphaned chunk
- **Orphaned Chunk 0:** `CJGC88t7zGeY3BTDjraGgThbSA4Mm3kdbBrKwqLYmcVy`
- **Rent Locked:** ~0.0088 SOL
- **Master Lockbox PDA:** `57m2s41uiiyHX1kqrrbgAxnqgjEwRyxNJN1dwELGbobz`
- **Recovery Script:** `recover-wallet-465Av5.ts`

**Total Rent Locked:** ~0.0176 SOL across both wallets

---

## Quick Recovery (Recommended Method)

### Option 1: Browser Console (Easiest)

#### For Wallet 1 (14Drk...)

1. Open your application at `http://localhost:3002`
2. Connect wallet `14DrkGw1UYWb542i2z1tGK7C6oV4sX7X2Z5pHhsyvfzn`
3. Open browser console (F12)
4. Run:

```javascript
// Get your LockboxV2Client from app context
// Example ways to access it:

// Option A: If you have access to the provider
const { client } = useLockbox(); // From your React component

// Option B: Direct access (adjust based on your app structure)
const client = window.__lockboxClient; // If exposed globally

// Option C: From React DevTools
// Find LockboxProvider in component tree and access client from props/state

// Once you have the client:
await client.recoverOrphanedChunks([0]);
```

#### For Wallet 2 (465Av5...)

1. Disconnect wallet 1
2. Connect wallet `465Av5qxktim1iN9p54k41MbRGPe2nqCfyVYwB2EF84J`
3. Open browser console (F12)
4. Run the same command:

```javascript
await client.recoverOrphanedChunks([0]);
```

---

## Detailed Recovery Steps

### Step 1: Check Current Status

First, let's verify the orphaned chunks for both wallets:

```bash
# From nextjs-app directory

# Check Wallet 1
npx tsx check-orphans.ts 14DrkGw1UYWb542i2z1tGK7C6oV4sX7X2Z5pHhsyvfzn

# Check Wallet 2
npx tsx check-orphans.ts 465Av5qxktim1iN9p54k41MbRGPe2nqCfyVYwB2EF84J
```

### Step 2: Recover Wallet 1

**Browser Console Method:**

1. Open your app and connect wallet `14Drk...`
2. Open browser console (F12)
3. Load the recovery script:

```javascript
// Load the recovery script
const script = document.createElement('script');
script.src = '/recover-wallet-14Drk.ts';
document.head.appendChild(script);

// Wait a moment, then run:
await window.recoverWallet14Drk();
```

**Manual Method (Using Client Directly):**

```javascript
// Assuming you have access to the LockboxV2Client instance
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
const wallet = window.solana; // or however you access the wallet

const client = new LockboxV2Client({ connection, wallet });

// Recover orphaned chunks
const result = await client.recoverOrphanedChunks([0]);

console.log('Recovery complete!', result);
```

### Step 3: Verify Wallet 1 Recovery

```bash
# Re-run the check to verify
npx tsx check-orphans.ts 14DrkGw1UYWb542i2z1tGK7C6oV4sX7X2Z5pHhsyvfzn
```

Expected output:
```
✅ No orphaned chunks found!
Your master lockbox exists and appears to be in good state.
```

### Step 4: Recover Wallet 2

Repeat the same process for wallet 2:

**Browser Console Method:**

1. Disconnect wallet 1
2. Connect wallet `465Av5...`
3. Open browser console (F12)
4. Run:

```javascript
await window.recoverWallet465Av5();
```

**Manual Method:**

```javascript
const client = new LockboxV2Client({ connection, wallet });
const result = await client.recoverOrphanedChunks([0]);
console.log('Recovery complete!', result);
```

### Step 5: Verify Wallet 2 Recovery

```bash
npx tsx check-orphans.ts 465Av5qxktim1iN9p54k41MbRGPe2nqCfyVYwB2EF84J
```

---

## Expected Recovery Output

When you run the recovery, you should see:

```
=== Starting Orphaned Chunk Recovery ===

Attempting to recover 1 orphaned chunk(s)
Chunk indices: 0

Verifying orphaned chunks...
✓ Found orphaned chunk 0 at <address>
  Rent: 0.0088 SOL

1 orphaned chunk(s) verified

Step 1: Initializing new master lockbox...
✓ Master lockbox initialized: <signature>

Step 2: Attempting to close orphaned chunks...

Closing orphaned chunk 0...
✓ Closed chunk 0: <signature>

=== Recovery Summary ===
Master lockbox initialized: <signature>
Chunks closed successfully: 1
Chunks failed to close: 0

Successfully closed chunks:
  - Chunk 0: <signature>

✅ Recovery process complete!
You can now use your master lockbox normally.
```

---

## Transaction Details

### Wallet 1 Transactions

After recovery, you'll have 2 transactions:
1. **Initialize Master Lockbox** - Creates new master lockbox account
2. **Close Chunk 0** - Closes orphaned chunk, reclaims ~0.0088 SOL

### Wallet 2 Transactions

Same as Wallet 1:
1. **Initialize Master Lockbox** - Creates new master lockbox account
2. **Close Chunk 0** - Closes orphaned chunk, reclaims ~0.0088 SOL

**Total Transactions:** 4 (2 per wallet)
**Total Rent Reclaimed:** ~0.0176 SOL
**Total Fee Cost:** ~0.00002 SOL (4 transactions × ~0.000005 SOL)

---

## Troubleshooting

### Issue: "Wrong wallet connected"

**Solution:** Make sure you've switched to the correct wallet in your browser extension.

```
Wallet 1: 14DrkGw1UYWb542i2z1tGK7C6oV4sX7X2Z5pHhsyvfzn
Wallet 2: 465Av5qxktim1iN9p54k41MbRGPe2nqCfyVYwB2EF84J
```

### Issue: "Master lockbox already exists"

**Solution:** The recovery has already been completed! Verify with:

```bash
npx tsx check-orphans.ts <your-wallet-address>
```

### Issue: "Insufficient balance"

**Solution:** Add devnet SOL to your wallet:

```bash
solana airdrop 1 <your-wallet-address> --url devnet
```

### Issue: "Chunk doesn't exist"

**Solution:** The chunk may have been closed already. Verify current state:

```bash
npx tsx check-orphans.ts <your-wallet-address>
```

---

## After Recovery

### What You Can Do Now

1. ✅ **Create new password entries** - Your lockbox is fully functional
2. ✅ **Close your account safely** - The fix prevents future orphaned chunks
3. ✅ **Re-initialize anytime** - No orphaned chunks blocking initialization

### Testing the Fix

After recovery, test that the prevention fix works:

1. Create some password entries (to create storage chunks)
2. Close your master lockbox
3. Verify NO orphaned chunks remain:

```bash
npx tsx check-orphans.ts <your-wallet-address>
```

Expected: `✅ No orphaned chunks found!`

---

## Available Scripts

### Scanning

```bash
# Check for orphaned chunks
npx tsx check-orphans.ts <wallet-address>

# Check both wallets
npx tsx check-orphans.ts 14DrkGw1UYWb542i2z1tGK7C6oV4sX7X2Z5pHhsyvfzn
npx tsx check-orphans.ts 465Av5qxktim1iN9p54k41MbRGPe2nqCfyVYwB2EF84J
```

### Recovery Scripts (Browser)

```javascript
// Wallet 1
window.recoverWallet14Drk()

// Wallet 2
window.recoverWallet465Av5()
```

### Manual Recovery (Any Wallet)

```javascript
// Generic recovery for any wallet
const client = new LockboxV2Client({ connection, wallet });
await client.recoverOrphanedChunks([0]); // Or [0, 1, 2] for multiple chunks
```

---

## Files Reference

### Recovery Scripts
- `nextjs-app/recover-wallet-14Drk.ts` - Wallet 1 recovery
- `nextjs-app/recover-wallet-465Av5.ts` - Wallet 2 recovery
- `nextjs-app/recover-orphaned-chunk.ts` - Generic recovery script

### Utilities
- `nextjs-app/check-orphans.ts` - Scan for orphaned chunks

### Core Implementation
- `nextjs-app/sdk/src/client-v2.ts` - Contains all recovery methods:
  - `closeStorageChunk()` - Close individual chunks
  - `closeMasterLockbox()` - Safe account closure (fixed)
  - `recoverOrphanedChunks()` - Orphan recovery

### Documentation
- `ORPHANED-CHUNK-RECOVERY-GUIDE.md` - General recovery guide
- `ORPHANED-CHUNK-FIX-SUMMARY.md` - Technical implementation details
- `MULTI-WALLET-RECOVERY-GUIDE.md` - This file

---

## Summary Table

| Wallet | Short Name | Orphaned Chunks | Rent Locked | Recovery Script |
|--------|------------|-----------------|-------------|-----------------|
| `14Drk...vfzn` | Wallet 1 | 1 (index 0) | 0.0088 SOL | `recover-wallet-14Drk.ts` |
| `465Av5...F84J` | Wallet 2 | 1 (index 0) | 0.0088 SOL | `recover-wallet-465Av5.ts` |
| **Total** | - | **2 chunks** | **0.0176 SOL** | - |

---

## Quick Command Reference

```bash
# Scan both wallets
npx tsx check-orphans.ts 14DrkGw1UYWb542i2z1tGK7C6oV4sX7X2Z5pHhsyvfzn
npx tsx check-orphans.ts 465Av5qxktim1iN9p54k41MbRGPe2nqCfyVYwB2EF84J

# In browser console after connecting each wallet:
await client.recoverOrphanedChunks([0]);

# Or use dedicated scripts:
window.recoverWallet14Drk()    # For wallet 1
window.recoverWallet465Av5()   # For wallet 2

# Verify after recovery:
npx tsx check-orphans.ts <wallet-address>
```

---

## Next Steps

1. ✅ **Recover Wallet 1** using steps above
2. ✅ **Verify Wallet 1** recovery completed
3. ✅ **Recover Wallet 2** using steps above
4. ✅ **Verify Wallet 2** recovery completed
5. ✅ **Test prevention** by closing an account normally

---

**Status:** Ready for recovery
**Estimated Time:** 5-10 minutes per wallet
**Difficulty:** Low (guided scripts available)

All recovery tools are implemented and ready to use!
