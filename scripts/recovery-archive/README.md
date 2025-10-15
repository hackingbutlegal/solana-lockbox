# Recovery Scripts Archive

## Overview

This directory contains recovery scripts that were created to fix orphaned storage chunks during development. These scripts are **archived for reference only** and should not be needed for production use, as the underlying issues have been fixed in the core SDK.

## What Was Fixed

### Problem
During early development, the `closeMasterLockbox()` method only closed the master lockbox account without closing associated storage chunks first. This left "orphaned" chunks that locked rent and prevented re-initialization.

### Solution Implemented
The core fix is in `sdk/src/client-v2.ts`:

1. **`closeStorageChunk()`** - Method to close individual storage chunks
2. **`closeMasterLockbox()`** - Updated to close all chunks first, then the master lockbox
3. **`recoverOrphanedChunks()`** - Recovery method for existing orphaned chunks

## Archived Scripts

### `check-orphans.ts`
Scans a wallet address for orphaned storage chunks.

**Usage:**
```bash
npx tsx scripts/recovery-archive/check-orphans.ts <wallet-address>
```

**Output:**
- Lists any orphaned chunks found
- Shows rent locked in each chunk
- Provides recovery instructions

### `recover-orphaned-chunk.ts`
Generic recovery script for any wallet with orphaned chunks.

**Usage:**
```bash
npx tsx scripts/recovery-archive/recover-orphaned-chunk.ts
```

**Features:**
- Connects to wallet
- Identifies orphaned chunks
- Recovers rent by closing chunks
- Can be loaded in browser console

### `recover-wallet-14Drk.ts`
Specific recovery script for wallet `14DrkGw1UYWb542i2z1tGK7C6oV4sX7X2Z5pHhsyvfzn`.

**Usage:**
```javascript
// In browser console with wallet connected
window.recoverWallet14Drk()
```

### `recover-wallet-465Av5.ts`
Specific recovery script for wallet `465Av5qxktim1iN9p54k41MbRGPe2nqCfyVYwB2EF84J`.

**Usage:**
```javascript
// In browser console with wallet connected
window.recoverWallet465Av5()
```

## Why These Are Archived

1. **Core Fix Implemented**: The SDK now prevents orphaned chunks automatically
2. **No Longer Needed**: New users won't encounter this issue
3. **Historical Reference**: Kept for documentation and learning purposes
4. **Development-Only Issue**: Occurred during development, not in production

## Modern Recovery (If Needed)

If you somehow encounter orphaned chunks, use the built-in SDK method instead:

```typescript
import { LockboxV2Client } from '@/sdk';

const client = new LockboxV2Client({ connection, wallet });

// Recover orphaned chunks at indices 0, 1, 2
const result = await client.recoverOrphanedChunks([0, 1, 2]);

console.log('Closed chunks:', result.closedChunks);
console.log('Failed chunks:', result.failedChunks);
```

## Related Documentation

- `docs/technical/ORPHANED-CHUNK-FIX-SUMMARY.md` - Comprehensive fix documentation
- `docs/technical/CLOSE-CHUNK-FIX.md` - Account ordering fix
- `docs/technical/MULTI-WALLET-RECOVERY-GUIDE.md` - Multi-wallet recovery guide

## Status

**Archived**: October 15, 2025
**Reason**: Core SDK fix implemented, scripts no longer needed
**Kept For**: Historical reference and documentation
