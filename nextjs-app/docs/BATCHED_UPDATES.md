# Batched Updates System

## Overview

The batched updates system allows users to make multiple changes to their password entries locally before syncing all changes to the blockchain in a single transaction (or batch of transactions). This improves UX and reduces transaction costs.

## Features

- ✅ **Queue updates locally** - Changes applied immediately to UI
- ✅ **Optimistic updates** - Instant feedback without waiting for blockchain
- ✅ **Batch syncing** - Send all changes in one go
- ✅ **Change tracking** - View pending changes before syncing
- ✅ **Rollback support** - Discard all local changes
- ✅ **Conflict detection** - Validates changes before syncing
- ⏳ **True transaction batching** - Multiple instructions in one transaction (TODO)

## Quick Start

### For End Users

1. **Make changes** - Edit password entries as normal
2. **Review pending** - Yellow bar shows unsaved changes
3. **Sync** - Click "Sync to Blockchain" to save all changes
4. **Or discard** - Click "Discard" to revert local changes

### For Developers

```typescript
import { usePassword } from '../contexts/PasswordContext';
import { PendingChangesBar } from '../components/ui/PendingChangesBar';

function MyComponent() {
  const { queueUpdate, syncPendingChanges } = usePassword();

  // Queue update (instant UI, no blockchain call yet)
  queueUpdate(chunkIndex, entryId, updatedEntry);

  // Later: sync all changes
  await syncPendingChanges();

  return (
    <div>
      {/* ... your component ... */}
      <PendingChangesBar position="bottom" />
    </div>
  );
}
```

## API Reference

See full documentation in the implementation files.

**Key Methods:**
- `queueUpdate()` - Queue local update
- `queueDelete()` - Queue local delete  
- `syncPendingChanges()` - Sync to blockchain
- `discardPendingChanges()` - Revert all changes

## Architecture

1. **PendingChangesManager** - Tracks changes in memory
2. **PasswordContext** - Manages sync lifecycle
3. **PendingChangesBar** - UI notification component

---

**Version**: 1.0  
**Date**: 2025-10-15
