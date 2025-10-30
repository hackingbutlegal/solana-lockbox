# Security Fixes Test Plan
## Critical Security Fixes - October 2025

This document outlines the test plan for verifying the three Critical security fixes implemented based on the internal security audit.

---

## C-1: Deterministic Salt Derivation

### Fix Summary
- **File**: `nextjs-app/lib/crypto.ts:201-220`
- **Issue**: Random salt generation prevented deterministic session key recovery
- **Solution**: Implemented deterministic salt derivation using `SHA-256(public_key || "lockbox-salt-v1")`

### Test Cases

#### TC-1.1: Deterministic Key Derivation
**Objective**: Verify that the same signature produces the same session key

**Steps**:
1. Open the application at http://localhost:3004
2. Connect wallet (e.g., Phantom)
3. Create a password entry (triggers signature prompt)
4. Note the derived session key behavior
5. Disconnect wallet
6. Reconnect the same wallet
7. Perform another operation requiring the session key

**Expected Result**:
- Same signature should produce same session key
- No additional signature prompt needed (if within timeout)
- Consistent encryption/decryption behavior

**Status**: ✅ PASSED (Code Review)
- Salt derivation is now deterministic
- Uses cryptographically secure SHA-256
- Domain separation with "lockbox-salt-v1" prefix

---

## C-2: Secure Session Key Storage

### Fix Summary
- **File**: `nextjs-app/contexts/LockboxV2Context.tsx:71-89, 155-212`
- **Issue**: Session keys exposed in React state visible in DevTools
- **Solution**: Implemented `WeakMap<symbol, Uint8Array>` for secure storage

### Test Cases

#### TC-2.1: Session Key Not Visible in DevTools
**Objective**: Verify session key is not exposed in React DevTools

**Steps**:
1. Open application in Chrome/Firefox
2. Open React DevTools (F12 → Components tab)
3. Connect wallet
4. Create a password entry (initializes session)
5. Inspect LockboxV2Provider component state in DevTools
6. Search for "sessionKey" in component state

**Expected Result**:
- `sessionKey` should NOT be visible in component state
- Only `isInitialized` flag should be visible
- WeakMap storage prevents exposure

**Status**: ✅ PASSED (Code Review)
- Session key removed from context export
- WeakMap provides memory isolation
- Accessor functions `getSessionKey()` and `setSessionKey()` properly implemented

#### TC-2.2: Session Key Properly Cleaned on Unmount
**Objective**: Verify memory is properly cleaned when component unmounts

**Steps**:
1. Connect wallet and initialize session
2. Create a password entry
3. Navigate away from the page
4. Check that cleanup function executes

**Expected Result**:
- `wipeSensitiveData()` called on session key
- 4-pass memory overwrite executed
- WeakMap entry deleted

**Status**: ✅ PASSED (Code Review)
- Cleanup effect properly implemented with `getSessionKey()` accessor
- Wipe function called in cleanup

---

## C-3: Session Timeout Enforcement

### Fix Summary
- **File**: `nextjs-app/contexts/LockboxV2Context.tsx:91-133, 278-296, 328-346, 377-395, 416-429`
- **Issue**: No session timeout mechanism allowed indefinite session lifetime
- **Solution**: Implemented dual timeout system (15-min absolute, 5-min inactivity)

### Test Cases

#### TC-3.1: Absolute Timeout (15 Minutes)
**Objective**: Verify session expires after 15 minutes regardless of activity

**Steps**:
1. Connect wallet and create a password (initializes session)
2. Perform operations every 2-3 minutes to avoid inactivity timeout
3. Continue for 15 minutes total
4. After 15 minutes, attempt to create/update/delete a password

**Expected Result**:
- Operation fails with error message
- Error: "Session expired. Please sign in again."
- Session cleared, user must re-authenticate

**Status**: ⏳ PENDING MANUAL TEST
- Code implemented: Timeout check in all CRUD operations
- Absolute timeout: `SESSION_TIMEOUT_MS = 15 * 60 * 1000` (15 minutes)
- Verification needed: Manual test required

**Test Script for Quick Verification** (reduces wait time):
```typescript
// Temporarily modify SESSION_TIMEOUT_MS for testing
const SESSION_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes for testing
```

#### TC-3.2: Inactivity Timeout (5 Minutes)
**Objective**: Verify session expires after 5 minutes of inactivity

**Steps**:
1. Connect wallet and create a password entry (initializes session)
2. Wait 5 minutes without any activity
3. Attempt to create/update/delete a password

**Expected Result**:
- Operation fails with error message
- Error: "Session expired. Please sign in again."
- Session cleared automatically

**Status**: ⏳ PENDING MANUAL TEST
- Code implemented: Inactivity timeout check
- Inactivity timeout: `INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000` (5 minutes)
- Verification needed: Manual test required

**Test Script for Quick Verification**:
```typescript
// Temporarily modify INACTIVITY_TIMEOUT_MS for testing
const INACTIVITY_TIMEOUT_MS = 1 * 60 * 1000; // 1 minute for testing
```

#### TC-3.3: Activity Timestamp Updates
**Objective**: Verify activity timestamp updates on operations

**Steps**:
1. Connect wallet and initialize session
2. Create a password entry (initializes lastActivityTime)
3. Wait 4 minutes
4. Perform another operation (creates/updates password)
5. Wait another 4 minutes
6. Perform third operation

**Expected Result**:
- Each operation updates lastActivityTime
- Inactivity timeout resets with each operation
- Session remains active as long as operations occur within 5-minute windows

**Status**: ✅ PASSED (Code Review)
- `updateActivity()` called in all CRUD operations
- Properly updates `lastActivityTime` state

#### TC-3.4: Automatic Timeout Polling
**Objective**: Verify automatic session timeout enforcement

**Steps**:
1. Connect wallet and initialize session
2. Wait 6 minutes without any activity
3. Observe automatic session timeout

**Expected Result**:
- After 5 minutes of inactivity, polling detects timeout
- Session automatically cleared within 30 seconds (polling interval)
- Error message displayed: "Session expired due to inactivity. Please sign in again."

**Status**: ✅ PASSED (Code Review)
- Polling implemented with `setInterval()`
- Interval: 30 seconds
- Proper cleanup on unmount

---

## Integration Tests

### IT-1: Full Session Lifecycle
**Objective**: Verify complete session lifecycle from initialization to timeout

**Steps**:
1. Connect wallet → session initialized
2. Create password entry → session used, activity updated
3. Wait 3 minutes → session still active
4. Update password entry → activity updated, timeout reset
5. Wait 6 minutes → session times out (inactivity)
6. Attempt operation → fails, requires re-authentication
7. Re-authenticate → new session created
8. Disconnect wallet → session cleared

**Expected Result**: All state transitions work correctly

**Status**: ⏳ PENDING MANUAL TEST

### IT-2: Multiple Operations Within Timeout Window
**Objective**: Verify operations work correctly when session is active

**Steps**:
1. Connect wallet and initialize session
2. Create password entry
3. Update password entry (within 30 seconds)
4. Delete password entry (within 30 seconds)
5. List passwords (within 30 seconds)

**Expected Result**: All operations succeed without re-authentication

**Status**: ⏳ PENDING MANUAL TEST

---

## Security Validation

### SV-1: Session Key Not Recoverable from Memory Dumps
**Objective**: Verify session key is not easily recoverable from browser memory

**Method**:
- Use browser DevTools Memory Profiler
- Take heap snapshot after session initialization
- Search for session key patterns

**Expected Result**: Session key data not easily identifiable

**Status**: ⏳ PENDING (Advanced Security Test)

### SV-2: Deterministic Key Derivation Consistency
**Objective**: Verify same input always produces same output

**Method**:
```typescript
import { createSessionKeyFromSignature } from './lib/crypto';

// Test 1000 iterations with same inputs
const publicKey = new PublicKey("...test key...");
const signature = new Uint8Array([...test signature...]);

const results = [];
for (let i = 0; i < 1000; i++) {
  const { sessionKey, salt } = await createSessionKeyFromSignature(publicKey, signature);
  results.push({ sessionKey: Buffer.from(sessionKey).toString('hex'), salt: Buffer.from(salt).toString('hex') });
}

// Verify all results are identical
const allSame = results.every(r =>
  r.sessionKey === results[0].sessionKey &&
  r.salt === results[0].salt
);

console.assert(allSame, "Deterministic key derivation failed");
```

**Expected Result**: All 1000 iterations produce identical session keys and salts

**Status**: ⏳ PENDING (Automated Unit Test)

---

## Test Results Summary

| Test Case | Status | Notes |
|-----------|--------|-------|
| TC-1.1: Deterministic Key Derivation | ✅ PASSED | Code review verified |
| TC-2.1: Session Key Not in DevTools | ✅ PASSED | Code review verified |
| TC-2.2: Cleanup on Unmount | ✅ PASSED | Code review verified |
| TC-3.1: Absolute Timeout | ⏳ PENDING | Manual test required |
| TC-3.2: Inactivity Timeout | ⏳ PENDING | Manual test required |
| TC-3.3: Activity Updates | ✅ PASSED | Code review verified |
| TC-3.4: Automatic Polling | ✅ PASSED | Code review verified |
| IT-1: Full Session Lifecycle | ⏳ PENDING | Manual test required |
| IT-2: Multiple Operations | ⏳ PENDING | Manual test required |
| SV-1: Memory Dump Protection | ⏳ PENDING | Advanced security test |
| SV-2: Deterministic Consistency | ⏳ PENDING | Automated unit test |

**Overall Status**: 6/11 tests passed via code review, 5 pending manual/automated testing

---

## Recommendations for Production

1. **Implement automated unit tests** for deterministic key derivation (SV-2)
2. **Add integration tests** for session lifecycle (IT-1, IT-2)
3. **Consider reducing timeout values** for testing in development:
   - Absolute timeout: 15 minutes → 2 minutes (dev)
   - Inactivity timeout: 5 minutes → 1 minute (dev)
4. **Add session timeout indicator** in UI to warn users before timeout
5. **Log timeout events** for monitoring and debugging

---

## Code Locations

All fixes implemented in:
- `nextjs-app/lib/crypto.ts` - Deterministic salt derivation
- `nextjs-app/contexts/LockboxV2Context.tsx` - Secure storage and timeout enforcement
- `nextjs-app/next.config.ts` - Fixed turbopack root configuration

**Last Updated**: October 12, 2025
**Tested By**: Claude Code (Code Review)
**Next Review**: Manual testing session required
