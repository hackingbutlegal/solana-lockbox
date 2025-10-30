# Security Audit Report: Phase 5 Social Recovery Implementation

**Audit Date**: October 17, 2025
**Auditor**: Principal Security Analyst
**Scope**: Shamir Secret Sharing + Social Recovery System
**Severity Levels**: CRITICAL | HIGH | MEDIUM | LOW | INFORMATIONAL

---

## Executive Summary

The Phase 5 implementation demonstrates strong cryptographic foundations but contains **5 CRITICAL security vulnerabilities** and **8 HIGH-severity issues** that must be addressed before deployment. The most severe issues involve:

1. **Weak randomness in Shamir polynomial generation (CRITICAL)**
2. **Share index inconsistency (CRITICAL)**
3. **Missing share validation on-chain (CRITICAL)**
4. **Replay attack vulnerability (HIGH)**
5. **Information leakage through timing (MEDIUM)**

---

## CRITICAL Vulnerabilities

### 1. [CRITICAL] Weak Randomness in Shamir Polynomial Generation

**Location**: `shamir-secret-sharing.ts:236`

**Issue**:
```typescript
for (let i = 1; i < threshold; i++) {
  coefficients[i] = Math.floor(Math.random() * 256);  // ❌ INSECURE
}
```

**Problem**:
- `Math.random()` is NOT cryptographically secure
- Uses predictable PRNG seeded from timestamp
- Attacker can predict polynomial coefficients
- Breaks information-theoretic security guarantee

**Impact**: **COMPLETE COMPROMISE** of secret sharing security. With predictable randomness, an attacker can potentially reconstruct the secret with fewer than M shares.

**Exploit Scenario**:
```typescript
// Attacker observes timing of share generation
const timestamp = Date.now();
Math.seedrandom(timestamp); // Reproduce same sequence
// Can now predict all coefficients
```

**Fix**: Use `crypto.getRandomValues()`

---

### 2. [CRITICAL] Share Index Inconsistency Between Client and On-Chain

**Location**: `recovery.rs:111` vs `shamir-secret-sharing.ts:240`

**Issue**:
```rust
// On-chain: Comment says (0 to N-1)
pub share_index: u8,  // (0 to N-1)

// Client-side: Actually uses (1 to N)
for (let shareIndex = 1; shareIndex <= totalShares; shareIndex++) {
    const shareValue = evaluatePolynomial(coefficients, shareIndex);
```

**Problem**:
- Documentation claims 0-indexed (0 to N-1)
- Implementation is 1-indexed (1 to N)
- Share index 0 would cause division by zero in Lagrange interpolation
- Confusion between specification and implementation

**Impact**: **CRITICAL** - Potential for guardian to submit share_index=0, causing reconstruction to fail or produce incorrect results.

**Fix**: Standardize on 1-indexed (1 to N) everywhere and update documentation.

---

### 3. [CRITICAL] No On-Chain Share Validation

**Location**: `recovery_management.rs:310-314`

**Issue**:
```rust
// Add approval WITHOUT validating share
recovery_request.approvals.push(RecoveryApproval {
    guardian: guardian_pubkey,
    share_index: guardian.share_index,
    share_decrypted,  // ❌ NOT VALIDATED
    approved_at: clock.unix_timestamp,
});
```

**Problem**:
- Guardian can submit ANY 32 bytes as their share
- No cryptographic proof that share is valid
- No way to verify share matches encrypted_share on-chain
- Malicious guardian can poison recovery

**Impact**: **CRITICAL** - Single malicious guardian can sabotage entire recovery by submitting invalid share.

**Exploit Scenario**:
```rust
// Malicious guardian submits garbage
approve_recovery(ctx, [0u8; 32]);  // All zeros
// Recovery fails when client tries to reconstruct
```

**Fix Options**:
1. Store hash of each share in RecoveryConfig (breaks share secrecy)
2. Require client-side share verification before submission
3. Use verifiable secret sharing (VSS) scheme

**Recommended**: Implement Feldman VSS or Pedersen VSS for verifiable shares.

---

### 4. [CRITICAL] Missing Share Uniqueness Check

**Location**: `recovery_management.rs:310`

**Issue**:
```rust
// Check if guardian already approved
require!(
    !recovery_request.has_guardian_approved(&guardian_pubkey),
    LockboxError::GuardianAlreadyApproved
);

// But doesn't check if share_index is unique
```

**Problem**:
- Two guardians could have same share_index
- Lagrange interpolation assumes unique x-coordinates
- Duplicate share_index causes division by zero

**Impact**: **CRITICAL** - DoS attack on recovery, potential incorrect reconstruction.

**Fix**: Add share_index uniqueness validation in `add_guardian` and `approve_recovery`.

---

### 5. [CRITICAL] No Protection Against Share Reuse Across Different Secrets

**Location**: `shamir-secret-sharing.ts:240`

**Issue**:
```typescript
// Each byte of secret uses same share indices (1, 2, 3, ...)
for (let shareIndex = 1; shareIndex <= totalShares; shareIndex++) {
    const shareValue = evaluatePolynomial(coefficients, shareIndex);
```

**Problem**:
- If user creates multiple recovery configs with same guardians
- Same share index used for different secrets
- Enables cross-secret attacks

**Impact**: **CRITICAL** - Information leakage across multiple secrets.

**Fix**: Include secret-specific context in share generation (e.g., hash of public key).

---

## HIGH Severity Issues

### 6. [HIGH] Replay Attack on Recovery Requests

**Location**: `recovery_management.rs:228-268`

**Issue**:
```rust
pub fn initiate_recovery_handler(
    ctx: Context<InitiateRecovery>,
    request_id: u64,  // ❌ Client-provided, not enforced unique
```

**Problem**:
- `request_id` is client-provided
- No on-chain enforcement that it's monotonic or unique
- Attacker can initiate recovery with duplicate request_id

**Impact**: **HIGH** - Replay attacks, potential for recovery request confusion.

**Fix**: Store last_request_id in RecoveryConfig and enforce monotonic increment.

---

### 7. [HIGH] Missing Threshold Validation After Guardian Removal

**Location**: `recovery_management.rs:210`

**Issue**:
```rust
recovery_config.guardians.remove(guardian_index);
// ❌ Doesn't check if remaining guardians >= threshold
```

**Problem**:
- Owner can remove guardians below threshold
- Recovery becomes impossible (need 3 of 2 guardians)
- No warning or prevention

**Impact**: **HIGH** - User accidentally bricks their recovery.

**Fix**:
```rust
require!(
    (recovery_config.guardians.len() - 1) as u8 >= recovery_config.threshold,
    LockboxError::InsufficientGuardians
);
```

---

### 8. [HIGH] Race Condition in approval_recovery

**Location**: `recovery_management.rs:318-324`

**Issue**:
```rust
// Check if we have enough approvals
if recovery_request.has_sufficient_approvals(recovery_config.threshold) {
    recovery_request.status = RecoveryStatus::ReadyForReconstruction;
```

**Problem**:
- Multiple guardians can submit approvals simultaneously
- Race condition on status transition
- Potential for double-spend style attacks

**Impact**: **HIGH** - Unexpected state transitions, potential for exploitation.

**Fix**: Use atomic status transitions with locks or versioning.

---

### 9. [HIGH] No Expiration on Recovery Requests

**Location**: `recovery.rs:159-188`

**Issue**:
```rust
pub struct RecoveryRequest {
    pub ready_at: i64,
    // ❌ No expiration_at field
```

**Problem**:
- Recovery requests never expire
- Old requests can be completed years later
- Stale guardian shares remain valid indefinitely

**Impact**: **HIGH** - Compromised guardian share can be used indefinitely.

**Fix**: Add expiration field and enforce it in approve_recovery.

---

### 10. [HIGH] Unencrypted Shares Stored On-Chain

**Location**: `recovery.rs:204`

**Issue**:
```rust
/// Guardian's decrypted share (verified before storage)
/// 32 bytes for standard Shamir share
pub share_decrypted: [u8; 32],  // ❌ PLAINTEXT ON-CHAIN
```

**Problem**:
- After guardian submits share, it's stored in plaintext on-chain
- Anyone can read RecoveryRequest account
- With M shares visible, secret is exposed

**Impact**: **HIGH** - **COMPLETE LOSS OF SECRECY** after M guardians approve.

**Exploit**:
```rust
// Attacker reads RecoveryRequest account
let shares = recovery_request.approvals.map(|a| a.share_decrypted);
if shares.len() >= threshold {
    let secret = reconstruct_secret(shares);  // ❌ Secret stolen
}
```

**Fix**: **CRITICAL REDESIGN NEEDED**
- Shares should NEVER be stored unencrypted on-chain
- Options:
  1. Reconstruct client-side, submit proof (zkSNARK)
  2. Use threshold encryption instead of Shamir
  3. Multi-party computation for reconstruction

---

### 11. [HIGH] Missing Rate Limiting on Recovery Initiation

**Location**: `recovery_management.rs:228`

**Issue**:
- No rate limiting on `initiate_recovery`
- Guardian can spam recovery requests
- DoS attack on owner (spam notifications)

**Impact**: **HIGH** - DoS, notification spam.

**Fix**: Add cooldown period between recovery attempts.

---

### 12. [HIGH] No Guardian Revocation During Active Recovery

**Location**: `recovery_management.rs:190-216`

**Issue**:
```rust
pub fn remove_guardian_handler(
    // ❌ Doesn't check for active recovery requests
```

**Problem**:
- Guardian can be removed while recovery is in progress
- Already-submitted share from revoked guardian remains valid
- Inconsistent state

**Impact**: **HIGH** - State inconsistency, potential for exploitation.

**Fix**: Prevent guardian removal if active recovery exists.

---

### 13. [HIGH] Insufficient Validation in complete_recovery

**Location**: `recovery_management.rs:345-378`

**Issue**:
```rust
pub fn complete_recovery_handler(ctx: Context<CompleteRecovery>) -> Result<()> {
    // ❌ Doesn't validate that reconstruction was successful
    // ❌ Doesn't require proof of secret knowledge
```

**Problem**:
- Transfers ownership without proof client reconstructed secret
- Client could fail reconstruction but ownership still transfers
- New owner might not have access to encrypted data

**Impact**: **HIGH** - Loss of access to encrypted passwords.

**Fix**: Require proof of secret knowledge (e.g., decrypt challenge).

---

## MEDIUM Severity Issues

### 14. [MEDIUM] Timing Attack on GF Arithmetic

**Location**: `shamir-secret-sharing.ts:93-99`

**Issue**:
```typescript
function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;  // ❌ Early return leaks information
```

**Problem**:
- Early return for zero creates timing difference
- Attacker measuring timing can infer zero values
- Potential information leakage

**Impact**: **MEDIUM** - Side-channel leakage.

**Fix**: Use constant-time operations.

---

### 15. [MEDIUM] No Integrity Check on Serialized Shares

**Location**: `shamir-secret-sharing.ts:377-381`

**Issue**:
```typescript
export function serializeShare(share: Share): string {
  const buffer = new Uint8Array(1 + share.data.length);
  buffer[0] = share.index;
  buffer.set(share.data, 1);
  return btoa(String.fromCharCode(...buffer));  // ❌ No MAC/signature
}
```

**Problem**:
- No authentication tag
- Serialized shares can be tampered with
- No way to detect corruption

**Impact**: **MEDIUM** - Data integrity risk.

**Fix**: Add HMAC or signature to serialized shares.

---

### 16. [MEDIUM] Integer Overflow in Share Index

**Location**: `shamir-secret-sharing.ts:293`

**Issue**:
```typescript
if (share.index < 1 || share.index > 255) {
    throw new Error(`Invalid share index: ${share.index}`);
}
// But share.index is typed as `number` (can be > 255)
```

**Problem**:
- TypeScript `number` can exceed u8 range
- Modular arithmetic in GF(2^8) wraps silently
- Share index 256 becomes 0 (division by zero)

**Impact**: **MEDIUM** - Potential for unexpected behavior.

**Fix**: Enforce u8 range with type guards.

---

### 17. [MEDIUM] Missing Input Sanitization in Guardian Nickname

**Location**: `recovery_management.rs:101`

**Issue**:
```rust
nickname_encrypted: Vec<u8>,  // No validation beyond size
```

**Problem**:
- Encrypted nickname not validated
- Could contain malicious data
- XSS risk if decrypted and displayed in UI

**Impact**: **MEDIUM** - XSS potential in UI.

**Fix**: Validate decrypted nickname format.

---

### 18. [MEDIUM] Unbounded Gas Cost for Lagrange Interpolation

**Location**: `shamir-secret-sharing.ts:147-166`

**Issue**:
```typescript
function lagrangeInterpolate(shares: Array<{ x: number; y: number }>): number {
    // O(n²) complexity where n = shares.length
    for (let i = 0; i < shares.length; i++) {
        for (let j = 0; j < shares.length; j++) {
```

**Problem**:
- With 10 guardians, this is 100 operations per byte
- For 32-byte secret: 3,200 operations
- No upper bound on computation

**Impact**: **MEDIUM** - DoS through excessive computation.

**Fix**: Enforce max shares limit (already done: 255).

---

### 19. [MEDIUM] Missing Events for Security-Critical Operations

**Location**: `recovery_management.rs:152, 180, 216`

**Issue**:
- `add_guardian` - no event
- `accept_guardianship` - no event
- `remove_guardian` - no event

**Problem**:
- No way to monitor guardian changes off-chain
- Difficult to detect unauthorized modifications
- Poor audit trail

**Impact**: **MEDIUM** - Reduced observability.

**Fix**: Emit events for all security-critical operations.

---

### 20. [MEDIUM] No Protection Against Share Index Collision

**Location**: `recovery_management.rs:96-151`

**Issue**:
```rust
pub fn add_guardian_handler(
    share_index: u8,  // ❌ Not validated for uniqueness
```

**Problem**:
- Multiple guardians can have same share_index
- Causes Lagrange interpolation to fail
- DoS attack on recovery

**Impact**: **MEDIUM** - Recovery failure.

**Fix**: Validate share_index uniqueness in add_guardian.

---

### 21. [MEDIUM] Lack of Share Refresh Mechanism

**Location**: Recovery system design

**Issue**:
- No way to refresh shares without changing secret
- If guardian loses their share, must recreate entire recovery
- No proactive security updates

**Impact**: **MEDIUM** - Operational difficulty.

**Recommendation**: Implement share refresh protocol (future enhancement).

---

## LOW Severity Issues

### 22. [LOW] Inefficient btoa/atob for Large Shares

**Location**: `shamir-secret-sharing.ts:381`

**Issue**:
```typescript
return btoa(String.fromCharCode(...buffer));  // Spreads entire array
```

**Problem**:
- Spreads entire Uint8Array in memory
- Stack overflow for large shares
- Performance issue

**Impact**: **LOW** - Performance degradation.

**Fix**: Use chunked conversion.

---

### 23. [LOW] Missing Documentation for X25519 Encryption Format

**Location**: `recovery.rs:100-105`

**Issue**:
```rust
/// Format: [ephemeral_pubkey(32) | nonce(24) | encrypted_share(~32) | tag(16)]
```

**Problem**:
- Format not implemented yet (only documented)
- No validation of format
- Future implementation risk

**Impact**: **LOW** - Future maintenance issue.

**Recommendation**: Implement and validate format.

---

## INFORMATIONAL

### 24. [INFO] Hardcoded Magic Numbers

**Location**: Multiple

**Issue**:
```typescript
if (threshold < 2 || threshold > 255) {
```

**Recommendation**: Extract to named constants.

---

### 25. [INFO] Missing Unit Tests

**Location**: `shamir-secret-sharing.ts`

**Issue**: No test file exists yet.

**Recommendation**: Create comprehensive test suite.

---

## Prioritized Remediation Plan

### Phase 1: CRITICAL Fixes (Must Fix Before Any Deployment)

1. **Fix #1**: Replace `Math.random()` with `crypto.getRandomValues()`
2. **Fix #2**: Standardize share indexing (1 to N)
3. **Fix #10**: Redesign to avoid plaintext shares on-chain
4. **Fix #3**: Implement share validation mechanism
5. **Fix #4**: Add share_index uniqueness check
6. **Fix #5**: Add secret-specific context to share generation

### Phase 2: HIGH Priority Fixes (Before Beta)

7. **Fix #6**: Enforce monotonic request_id
8. **Fix #7**: Validate guardian count after removal
9. **Fix #9**: Add recovery request expiration
10. **Fix #11**: Implement rate limiting
11. **Fix #12**: Prevent guardian removal during active recovery
12. **Fix #13**: Require proof of secret in complete_recovery

### Phase 3: MEDIUM Priority Fixes (Before Mainnet)

13. **Fix #14-21**: Address timing attacks, integrity checks, events, etc.

### Phase 4: LOW Priority Enhancements

14. **Fix #22-25**: Performance and documentation improvements

---

## Conclusion

The implementation demonstrates solid understanding of Shamir Secret Sharing and blockchain security, but contains critical vulnerabilities that MUST be addressed. The most severe issue (#10) requires architectural redesign to prevent plaintext shares on-chain.

**Recommendation**: **DO NOT DEPLOY** until at least Phase 1 fixes are complete.

---

**Auditor**: Principal Security Analyst
**Next Review**: After Phase 1 remediation
