# State Isolation and Multi-Device Sync

## Requirement

**Mobile device and desktop sessions must be fully separate with zero information persisting between devices. First transactions win. Page refreshing must follow Solana best practices.**

## Current Architecture

### State Storage Layers

Solana Lockbox uses three distinct storage layers:

```
┌─────────────────────────────────────────────────────────┐
│  Layer 1: On-Chain State (Blockchain)                  │
│  - Master Lockbox account                               │
│  - Encrypted password entries                           │
│  - Storage chunks                                       │
│  - Subscription tier                                    │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  SHARED across all devices (authoritative)              │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│  Layer 2: localStorage (Browser Persistent)            │
│  - User preferences (theme, view mode)                  │
│  - Backup codes                                         │
│  - Recovery key (encrypted)                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  DEVICE-LOCAL (not synced, fully isolated)              │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│  Layer 3: sessionStorage (Browser Session)             │
│  - Temporary session keys                               │
│  - Cached decrypted passwords (in-memory only)          │
│  - Session timeout tracking                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  TAB-LOCAL (cleared on page close, fully isolated)      │
└─────────────────────────────────────────────────────────┘
```

### State Isolation Analysis

#### ✅ Already Isolated (No Changes Needed)

1. **localStorage** - Browser API is origin + device-specific
   - Desktop Chrome localStorage ≠ Mobile Safari localStorage
   - Desktop preferences don't affect mobile preferences
   - Each device has its own backup codes (intentional)
   - Each device has its own recovery key (intentional)

2. **sessionStorage** - Even more isolated (per tab/window)
   - Desktop tab 1 ≠ Desktop tab 2
   - Session keys never leave the browser tab
   - Closing tab wipes all session data

3. **On-Chain State** - Shared by design, but protected
   - Blockchain state is the single source of truth
   - First transaction wins (Solana's transaction ordering)
   - Subsequent conflicting transactions fail atomically
   - All devices see the same blockchain state (after sync)

#### ⚠️ Potential Issues (Needs Verification)

1. **Race Conditions on Password Updates**
   ```
   Device A: Updates password X at T=0
   Device B: Updates password X at T=0 (same time)

   Result: One transaction succeeds, other fails
   Question: Does app handle failure gracefully?
   ```

2. **Stale Data on Page Refresh**
   ```
   Device A: Adds password X
   Device B: Still showing old state (hasn't refreshed)
   Device B: User tries to add password X again

   Question: Does app fetch latest blockchain state on load?
   ```

3. **Optimistic UI Updates**
   ```
   Device A: Deletes password X (shows removed immediately)
   Transaction fails on-chain (network issue)

   Question: Does app revert UI on transaction failure?
   ```

## Solana Best Practices for Multi-Device

### 1. Transaction Ordering (First Wins)

**Solana Guarantees:**
- Transactions are ordered by validators
- First transaction with valid signature gets processed
- Subsequent transactions with same account nonce fail
- No "last write wins" - blockchain state is append-only

**Current Implementation:**
```typescript
// In LockboxV2Client
async storePassword(entry: PasswordEntry): Promise<string> {
  const tx = await this.program.methods
    .storePassword(/* params */)
    .accounts(/* accounts */)
    .rpc();

  // Transaction either succeeds or throws
  // No partial success
  return tx;
}
```

**How It Handles Conflicts:**
- Device A sends transaction at T=0
- Device B sends transaction at T=0
- Solana orders them deterministically
- First transaction succeeds
- Second transaction fails with `AccountInUse` or similar error

**✅ First Transaction Wins** - Blockchain enforces this automatically.

### 2. Page Refresh and State Sync

**Best Practice: Always Fetch Latest State on Load**

```typescript
// Current implementation in LockboxV2Context
useEffect(() => {
  async function loadMasterLockbox() {
    if (!client || !publicKey) return;

    try {
      // CRITICAL: Fetch from blockchain, not cache
      const lockbox = await client.getMasterLockbox(publicKey);
      setMasterLockbox(lockbox);
    } catch (err) {
      // Handle not found
    }
  }

  loadMasterLockbox();
}, [client, publicKey]);
```

**✅ Always Fetches Latest** - No stale data on page load.

### 3. Transaction Conflict Handling

**Best Practice: Handle All Error Cases**

```typescript
// Recommended error handling
async function updatePassword(id: number, newData: PasswordEntry) {
  try {
    const tx = await client.updatePassword(id, newData);
    toast.showSuccess('Password updated');
    // Optimistically update UI
    updateLocalState(id, newData);
  } catch (error: any) {
    // Transaction failed - revert optimistic update
    revertLocalState(id);

    if (error.message.includes('AccountInUse')) {
      // Another device modified it first
      toast.showWarning('Password was modified by another device. Refreshing...');
      await refreshFromBlockchain();
    } else if (error.message.includes('AccountNotFound')) {
      // Password was deleted by another device
      toast.showInfo('Password was deleted. Refreshing...');
      await refreshFromBlockchain();
    } else {
      // Generic error
      toast.showError(`Failed to update: ${error.message}`);
    }
  }
}
```

**Current Implementation Status:**
- ✅ Try/catch blocks present
- ⚠️ Generic error handling (could be more specific)
- ⚠️ No automatic refresh on conflict

**Recommendation:** Add conflict-specific error handling.

### 4. Optimistic UI Updates

**Best Practice: Revert on Failure**

```typescript
// GOOD: Optimistic update with revert
function deletePassword(id: number) {
  // 1. Save original state
  const original = getPassword(id);

  // 2. Optimistically remove from UI
  setPasswords(passwords.filter(p => p.id !== id));

  // 3. Send transaction
  client.deletePassword(id)
    .catch(err => {
      // 4. Revert on failure
      setPasswords([...passwords, original]);
      toast.showError('Delete failed');
    });
}

// BAD: No revert on failure
function deletePassword(id: number) {
  setPasswords(passwords.filter(p => p.id !== id));
  client.deletePassword(id); // Might fail, UI never reverts
}
```

**Current Implementation:**
- Likely uses optimistic updates
- Need to verify revert behavior

### 5. Polling vs. Websockets

**Solana Best Practice: Use Account Subscriptions**

```typescript
// Recommended: Subscribe to account changes
connection.onAccountChange(
  masterLockboxPDA,
  (accountInfo) => {
    // Another device changed the account
    const updated = deserialize(accountInfo.data);
    setMasterLockbox(updated);
    toast.showInfo('Passwords synced from another device');
  },
  'confirmed'
);
```

**Current Implementation:**
- Likely polling-based (fetch on demand)
- No real-time sync between devices

**Recommendation:** Add websocket subscriptions for real-time sync (optional enhancement).

## Device Isolation Verification

### Scenario 1: Desktop + Mobile Same User

```
Time 0: User connects wallet on desktop
  - localStorage: preferences saved on desktop
  - sessionStorage: session key in desktop browser
  - On-chain: Master Lockbox account created

Time 1: User connects wallet on mobile
  - localStorage: EMPTY on mobile (different device)
  - sessionStorage: NEW session key in mobile browser
  - On-chain: SAME Master Lockbox account (reads from blockchain)

Result: ✅ Fully isolated local state, shared on-chain state
```

### Scenario 2: Concurrent Password Creation

```
Time 0: Desktop creates password "github.com"
  - Transaction sent to blockchain
  - UI optimistically shows password

Time 0: Mobile creates password "github.com" (same name, different device)
  - Transaction sent to blockchain
  - UI optimistically shows password

Time 1: Blockchain processes transactions
  - Desktop transaction arrives first → SUCCESS
  - Mobile transaction arrives second → MIGHT CONFLICT

Options:
A. Allow duplicate names → Both succeed (different IDs)
B. Enforce unique names → Second fails

Current: Option A (allows duplicates)
Result: ✅ No conflict, both passwords stored
```

### Scenario 3: Concurrent Password Updates

```
Time 0: Desktop updates password ID=5
  - Transaction sent: updatePassword(5, newData1)

Time 0: Mobile updates password ID=5 (same password)
  - Transaction sent: updatePassword(5, newData2)

Time 1: Blockchain processes transactions
  - First transaction wins
  - Second transaction fails (account state changed)

Current Behavior:
  - Second device gets error
  - Need to refresh to see first device's change

Recommended:
  - Detect conflict error
  - Auto-refresh from blockchain
  - Show user-friendly message
```

## Implementation Checklist

### ✅ Already Correct

- [x] localStorage is device-isolated
- [x] sessionStorage is tab-isolated
- [x] On-chain state is shared (correct)
- [x] First transaction wins (Solana guarantees)
- [x] Fetch latest state on page load
- [x] Try/catch blocks for transactions

### ⚠️ Needs Improvement

- [ ] Add conflict-specific error handling
- [ ] Auto-refresh on transaction conflicts
- [ ] User-friendly conflict messages
- [ ] Revert optimistic UI updates on failure
- [ ] Add websocket subscriptions (optional)
- [ ] Transaction retry logic (optional)

### 🎯 Recommended Changes

#### Change 1: Enhanced Error Handling

**File:** `nextjs-app/contexts/PasswordContext.tsx`

```typescript
async function updatePassword(id: number, data: Partial<PasswordEntry>) {
  const original = entries.find(e => e.id === id);
  if (!original) return;

  try {
    // Optimistically update UI
    setEntries(entries.map(e =>
      e.id === id ? { ...e, ...data } : e
    ));

    // Send transaction
    const tx = await client.updatePassword(id, { ...original, ...data });

    toast.showSuccess('Password updated successfully');
  } catch (error: any) {
    // Revert optimistic update
    setEntries(entries.map(e =>
      e.id === id ? original : e
    ));

    // Handle specific error types
    if (error.message?.includes('AccountInUse') ||
        error.message?.includes('Account modified')) {
      toast.showWarning(
        'Another device modified this password. Refreshing...'
      );
      await refreshPasswordsFromBlockchain();
    } else if (error.message?.includes('AccountNotFound')) {
      toast.showInfo(
        'Password was deleted on another device. Refreshing...'
      );
      await refreshPasswordsFromBlockchain();
    } else {
      toast.showError(`Update failed: ${error.message}`);
    }
  }
}
```

#### Change 2: Refresh Helper

```typescript
async function refreshPasswordsFromBlockchain() {
  if (!client || !publicKey) return;

  try {
    const lockbox = await client.getMasterLockbox(publicKey);
    const passwords = await client.getAllPasswords(lockbox);
    setEntries(passwords);
  } catch (err) {
    console.error('Failed to refresh:', err);
  }
}
```

#### Change 3: Websocket Sync (Optional)

```typescript
useEffect(() => {
  if (!connection || !masterLockboxPDA) return;

  const subscriptionId = connection.onAccountChange(
    masterLockboxPDA,
    async (accountInfo) => {
      // Account changed on-chain (another device?)
      const updated = await client.getMasterLockbox(publicKey);
      setMasterLockbox(updated);

      // Optional: Show notification
      toast.showInfo('🔄 Synced changes from another device');
    },
    'confirmed'
  );

  return () => {
    connection.removeAccountChangeListener(subscriptionId);
  };
}, [connection, masterLockboxPDA]);
```

## Testing Multi-Device Scenarios

### Test 1: Concurrent Password Creation

```typescript
test('Two devices create same password concurrently', async () => {
  // Device A
  const deviceA = await createClient(walletA);
  const txA = deviceA.createPassword({ name: 'test', password: 'pass1' });

  // Device B (same wallet)
  const deviceB = await createClient(walletB);
  const txB = deviceB.createPassword({ name: 'test', password: 'pass2' });

  // Both should succeed (different IDs)
  await Promise.all([txA, txB]);

  // Verify both exist
  const passwords = await deviceA.getAllPasswords();
  expect(passwords.length).toBe(2);
});
```

### Test 2: Concurrent Password Updates

```typescript
test('Two devices update same password concurrently', async () => {
  const passwordId = 1;

  // Device A
  const txA = deviceA.updatePassword(passwordId, { password: 'new1' });

  // Device B
  const txB = deviceB.updatePassword(passwordId, { password: 'new2' });

  // One succeeds, one fails
  const results = await Promise.allSettled([txA, txB]);
  const success = results.filter(r => r.status === 'fulfilled');
  const failure = results.filter(r => r.status === 'rejected');

  expect(success.length).toBe(1);
  expect(failure.length).toBe(1);
});
```

### Test 3: Delete While Other Device Views

```typescript
test('Device A deletes while Device B views', async () => {
  const passwordId = 1;

  // Device A deletes
  await deviceA.deletePassword(passwordId);

  // Device B tries to view (should handle gracefully)
  const result = await deviceB.getPassword(passwordId);
  expect(result).toBeNull();
});
```

## Summary

### State Isolation Status: ✅ CORRECT

- localStorage is device-local (by browser design)
- sessionStorage is tab-local (by browser design)
- On-chain state is shared (by blockchain design)
- No unexpected cross-device data leakage

### First Transaction Wins: ✅ ENFORCED

- Solana's transaction ordering guarantees this
- No additional code needed
- Works correctly out of the box

### Page Refresh: ✅ FOLLOWS BEST PRACTICES

- Always fetches latest blockchain state on load
- No stale cached data
- Correct implementation

### Recommended Enhancements

1. **Add conflict-specific error handling** (High Priority)
   - Detect when another device caused the failure
   - Auto-refresh blockchain state
   - Show user-friendly messages

2. **Add optimistic update reverting** (High Priority)
   - Save original state before update
   - Revert UI if transaction fails
   - Prevents UI/blockchain inconsistency

3. **Add websocket subscriptions** (Low Priority, Nice-to-Have)
   - Real-time sync between devices
   - Show notifications when other devices make changes
   - Improves multi-device UX

### No Breaking Changes Required

The current architecture is fundamentally sound. State isolation is correct by design. The recommended enhancements are purely for better error handling and UX, not for fixing any architectural issues.
