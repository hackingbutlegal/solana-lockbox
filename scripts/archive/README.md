# Archived Recovery Scripts

This directory contains obsolete recovery scripts that were used to address the "orphaned storage chunk" issue during early v2.0 development.

## Historical Context

During October 2025, there was a race condition where storage chunks could be created on-chain but not properly registered in the master lockbox due to RPC lag or transaction ordering issues. This resulted in "orphaned" chunks that:
- Existed on-chain and consumed rent
- Were not tracked by the master lockbox
- Could not be closed via normal `close_storage_chunk` instruction
- Blocked users from creating new chunks at the same index

## Solution

The permanent fix was implementing the `force_close_orphaned_chunk` instruction in the Solana program (`programs/lockbox/src/instructions/close_account.rs`), which allows bypassing normal validation to close orphaned chunks.

## Archived Scripts

These scripts were temporary workarounds before the permanent fix:

- **browser-console-close-chunk.js** - Browser console script for closing chunks via Phantom
- **close-orphaned-chunk.html** - Standalone HTML page for recovery
- **close-orphaned-chunk.ts** - TypeScript recovery tool
- **drain-orphaned-chunk.ts** - Alternative recovery approach
- **fix-orphaned-chunk.ts** - Another recovery variation

## Why Archived?

With the `force_close_orphaned_chunk` instruction now available in the program, these scripts are obsolete. The proper way to recover from orphaned chunks is now:

```typescript
await client.forceCloseOrphanedChunk(chunkIndex);
```

## Historical Value

These scripts are preserved for:
- Understanding the evolution of the project
- Reference for similar debugging scenarios
- Documentation of how production issues were resolved

**Last Used**: October 2025
**Archived**: January 2025 (Refactor Phase 1)
**Status**: Obsolete - DO NOT USE
