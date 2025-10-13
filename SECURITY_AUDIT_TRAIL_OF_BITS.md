# Solana Lockbox v2.0 - Cryptographic Security Analysis

**Auditor**: Trail of Bits (Simulated Expert Review)
**Date**: October 13, 2025
**Version**: v2.0.0-devnet
**Scope**: Client-side cryptographic implementation

---

## Executive Summary

This security analysis examines the cryptographic implementation of Solana Lockbox v2.0, a decentralized password manager built on Solana. The analysis focuses on the client-side encryption, key derivation, session management, and memory safety mechanisms.

### Overall Security Posture: **MODERATE** ⚠️

**Strengths**:
- ✅ Use of well-vetted cryptographic primitives (XChaCha20-Poly1305, HKDF-SHA256)
- ✅ Comprehensive input validation on encryption operations
- ✅ Multi-pass memory scrubbing implementation
- ✅ Proper nonce generation using cryptographically secure RNG
- ✅ Domain separation in challenge messages

**Critical Concerns**:
- 🔴 Salt handling and key derivation consistency issues
- 🔴 Session key storage in React state without additional protection
- 🔴 No session timeout enforcement in implementation
- 🔴 Potential signature replay within timestamp window

---

## Findings

### CRITICAL 🔴

#### C-1: Inconsistent Salt Handling in Key Derivation

**File**: `nextjs-app/lib/crypto.ts:195-206`

**Description**:
The `createSessionKeyFromSignature()` function generates a fresh random salt each time it's called, but this salt is returned without being persisted or used consistently across operations.

```typescript
export async function createSessionKeyFromSignature(
  publicKey: PublicKey,
  signature: Uint8Array
): Promise<{ sessionKey: Uint8Array; salt: Uint8Array }> {
  // Generate fresh salt for this session  ← ISSUE: Random salt every time
  const salt = nacl.randomBytes(SALT_SIZE);

  // Derive session key from signature + salt
  const sessionKey = await deriveSessionKey(publicKey, signature, salt);

  return { sessionKey, salt };
}
```

**Impact**:
- Different session keys are generated from the same wallet signature
- Unable to deterministically recreate session keys
- If salt is lost, encrypted data cannot be recovered even with valid wallet signature
- Breaks the expected property that "same wallet signature = same session key"

**Recommendation**:
```typescript
// OPTION 1: Deterministic salt from public key
const salt = await crypto.subtle.digest('SHA-256', publicKey.toBytes());

// OPTION 2: Store salt with encrypted data
interface StoredPasswordEntry {
  ciphertext: Uint8Array;
  nonce: Uint8Array;
  salt: Uint8Array;  // Store per-entry salt
  // ...
}

// OPTION 3: Single session salt stored in secure storage
// Store in IndexedDB with encryption, retrieve on session init
```

---

#### C-2: Session Key Stored in Unprotected React State

**File**: `nextjs-app/contexts/LockboxV2Context.tsx:71`

**Description**:
The session key (32 bytes of high-entropy cryptographic material) is stored directly in React state:

```typescript
const [sessionKey, setSessionKey] = useState<Uint8Array | null>(null);
```

**Impact**:
- Exposed to React DevTools inspection in development
- May be captured in React component snapshots
- Accessible to browser extensions
- Not protected against XSS attacks
- Copies may exist in JavaScript heap after state updates

**Recommendation**:
```typescript
// OPTION 1: Use WeakMap for session key storage
const sessionKeyStore = new WeakMap<symbol, Uint8Array>();
const [sessionKeyRef] = useState(() => Symbol('sessionKey'));

// Store: sessionKeyStore.set(sessionKeyRef, derivedKey);
// Retrieve: sessionKeyStore.get(sessionKeyRef);

// OPTION 2: Web Crypto API key storage (non-extractable)
const sessionKey = await crypto.subtle.importKey(
  'raw',
  derivedKey,
  { name: 'AES-GCM', length: 256 },
  false,  // non-extractable
  ['encrypt', 'decrypt']
);

// OPTION 3: Encrypted in memory with hardware-backed key
// Use WebAuthn or Credential Management API
```

---

#### C-3: No Session Timeout Enforcement

**File**: `nextjs-app/contexts/LockboxV2Context.tsx`

**Description**:
Documentation claims "15-minute inactivity timeout" but no timeout logic is implemented. Session keys persist indefinitely once created.

```typescript
// MISSING: Session timeout logic
const [sessionExpiry, setSessionExpiry] = useState<number | null>(null);
const SESSION_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

// MISSING: Activity tracking
const updateLastActivity = useCallback(() => {
  setSessionExpiry(Date.now() + SESSION_TIMEOUT_MS);
}, []);

// MISSING: Timeout check
useEffect(() => {
  const interval = setInterval(() => {
    if (sessionExpiry && Date.now() > sessionExpiry) {
      clearSession();
    }
  }, 60000); // Check every minute

  return () => clearInterval(interval);
}, [sessionExpiry, clearSession]);
```

**Impact**:
- Sessions remain active indefinitely
- Increased window for session hijacking
- Violates principle of least privilege for session duration
- Contradicts documented security guarantees

**Recommendation**:
Implement comprehensive session timeout:
```typescript
interface SessionState {
  key: Uint8Array;
  createdAt: number;
  lastActivity: number;
  expiresAt: number;
}

// Auto-expire on inactivity
// Force re-authentication after absolute timeout (e.g., 24 hours)
// Wipe session data on expiry
```

---

### HIGH RISK 🟠

#### H-1: Deprecated Unsafe Curve Conversion Still Present

**File**: `nextjs-app/lib/crypto.ts:28-32`

**Description**:
The `ed25519ToCurve25519PublicKey()` function is marked as deprecated and insecure but remains in the codebase:

```typescript
export function ed25519ToCurve25519PublicKey(ed25519PublicKey: Uint8Array): Uint8Array {
  console.warn('ed25519ToCurve25519PublicKey: This conversion is not cryptographically secure. Use signature-based key derivation.');
  return ed25519PublicKey;  // ← Unsafe: returns Ed25519 key as-is
}
```

**Impact**:
- Function name implies safe conversion but provides none
- Could be accidentally used in future code
- Returns Ed25519 key when Curve25519 key expected
- Cryptographic type confusion vulnerability

**Recommendation**:
```typescript
// REMOVE THE FUNCTION ENTIRELY
// Or make it throw:
export function ed25519ToCurve25519PublicKey(ed25519PublicKey: Uint8Array): never {
  throw new Error(
    'SECURITY: ed25519ToCurve25519PublicKey is unsafe and has been removed. ' +
    'Use signature-based key derivation with createSessionKeyFromSignature().'
  );
}
```

---

#### H-2: Challenge Timestamp Allows Replay Window

**File**: `nextjs-app/lib/crypto.ts:185-189`

**Description**:
Challenge messages include a timestamp but there's no server-side nonce or replay prevention:

```typescript
export function generateChallenge(publicKey: PublicKey): Uint8Array {
  const timestamp = Date.now();  // ← Client-controlled
  const message = `Lockbox Session Key Derivation\n\nPublic Key: ${publicKey.toBase58()}\nTimestamp: ${timestamp}\n\nSign this message to derive an encryption key for this session.`;
  return new TextEncoder().encode(message);
}
```

**Impact**:
- Attacker could cache signature and replay within timestamp window
- No unique per-session challenge
- Timestamp is client-controlled (can be manipulated)
- Same signature could be reused if timestamp is reused

**Recommendation**:
```typescript
export function generateChallenge(publicKey: PublicKey): Uint8Array {
  const timestamp = Date.now();
  const nonce = crypto.getRandomValues(new Uint8Array(32));  // ← Add random nonce
  const nonceHex = Array.from(nonce).map(b => b.toString(16).padStart(2, '0')).join('');

  const message = `Lockbox Session Key Derivation

Public Key: ${publicKey.toBase58()}
Timestamp: ${timestamp}
Nonce: ${nonceHex}
Chain: solana-devnet

Sign this message to derive an encryption key for this session.
WARNING: Only sign this on trusted applications.`;

  return new TextEncoder().encode(message);
}

// Store nonce, verify it's not reused
```

---

#### H-3: No Key Rotation Mechanism

**Description**:
Session keys are derived once and never rotated, even for long-lived sessions.

**Impact**:
- Extended exposure window if key is compromised
- No forward secrecy within a session
- All historical data encrypted with same session key

**Recommendation**:
```typescript
// Implement periodic key rotation
const KEY_ROTATION_INTERVAL = 4 * 60 * 60 * 1000; // 4 hours

interface KeyRotationState {
  currentKey: Uint8Array;
  previousKey: Uint8Array | null;  // For decrypting old data
  rotationNumber: number;
}

// Derive new key using:
// HKDF(previous_key, "rotation-{number}", info)
```

---

### MEDIUM RISK 🟡

#### M-1: Memory Scrubbing Is Best-Effort Only

**File**: `nextjs-app/lib/crypto.ts:218-239`

**Description**:
While `wipeSensitiveData()` performs 4-pass overwrite, JavaScript's garbage collector may create copies:

```typescript
export function wipeSensitiveData(data: Uint8Array): void {
  // ... 4-pass overwrite ...

  // Note: JavaScript GC may still leave copies. For maximum security,
  // minimize the lifetime of sensitive data in memory.
}
```

**Impact**:
- Memory scraping attacks may still recover keys
- Copies exist in React's state management internals
- No protection against memory dumps
- Browser extensions can access JavaScript heap

**Recommendation**:
```typescript
// BEST PRACTICE: Minimize plaintext lifetime
// 1. Decrypt only when displaying
// 2. Re-encrypt immediately after editing
// 3. Clear clipboard after paste

// ADDITIONAL: Use SubtleCrypto with non-extractable keys
const sessionKey = await crypto.subtle.importKey(
  'raw',
  derivedKey,
  { name: 'AES-GCM' },
  false,  // ← non-extractable
  ['encrypt', 'decrypt']
);

// ADDITIONAL: Request isolated memory via Origin-Agent-Cluster
// Add to HTML: <meta http-equiv="Origin-Agent-Cluster" content="?1">
```

---

#### M-2: Encryption Salt Not Used in Encrypt Operation

**File**: `nextjs-app/lib/crypto.ts:122-162`

**Description**:
The `encryptAEAD()` function generates a salt but doesn't use it for key derivation:

```typescript
export function encryptAEAD(
  plaintext: Uint8Array,
  sessionKey: Uint8Array  // ← Already derived, salt not used
): { ciphertext: Uint8Array; nonce: Uint8Array; salt: Uint8Array } {
  // ... encrypt with sessionKey ...

  // Generate salt (used for key derivation, returned for storage)
  const salt = nacl.randomBytes(SALT_SIZE);  // ← Generated but unused

  return { ciphertext, nonce, salt };
}
```

**Impact**:
- Confusing API: salt is returned but has no cryptographic purpose
- Salt doesn't contribute to security of this operation
- May mislead developers about salt's role

**Recommendation**:
```typescript
// OPTION 1: Remove salt from encryptAEAD
export function encryptAEAD(
  plaintext: Uint8Array,
  sessionKey: Uint8Array
): { ciphertext: Uint8Array; nonce: Uint8Array } {
  // ... no salt generation ...
}

// OPTION 2: Use salt for per-message key derivation
export function encryptAEAD(
  plaintext: Uint8Array,
  sessionKey: Uint8Array
): { ciphertext: Uint8Array; nonce: Uint8Array; salt: Uint8Array } {
  const salt = nacl.randomBytes(SALT_SIZE);

  // Derive per-message key
  const messageKey = await deriveMessageKey(sessionKey, salt);

  const ciphertext = nacl.secretbox(plaintext, nonce, messageKey);
  return { ciphertext, nonce, salt };
}
```

---

#### M-3: No Explicit Signature Verification Before Key Derivation

**File**: `nextjs-app/contexts/LockboxV2Context.tsx:110-118`

**Description**:
The wallet adapter's `signMessage()` is trusted without explicit signature verification:

```typescript
const challenge = generateChallenge(publicKey);
const signature = await signMessage(challenge);  // ← Trusted implicitly

// Derive session key
const { sessionKey: derivedKey } = await createSessionKeyFromSignature(
  publicKey,
  signature
);
```

**Impact**:
- Relies on wallet adapter for signature validation
- No defense against malicious wallet adapter
- No check that signature actually came from claimed public key

**Recommendation**:
```typescript
// Add explicit signature verification
import nacl from 'tweetnacl';

const challenge = generateChallenge(publicKey);
const signature = await signMessage(challenge);

// Verify signature before using
const isValid = nacl.sign.detached.verify(
  challenge,
  signature,
  publicKey.toBytes()
);

if (!isValid) {
  throw new Error('SECURITY: Invalid signature from wallet');
}

// Now safe to derive key
const { sessionKey } = await createSessionKeyFromSignature(publicKey, signature);
```

---

### LOW RISK 🟢

#### L-1: Error Messages May Leak Timing Information

**File**: `nextjs-app/lib/crypto.ts:172-177`

**Description**:
Decryption failures return generic error but timing may differ for various failure modes.

**Recommendation**:
Use constant-time error handling:
```typescript
export function decryptAEAD(
  ciphertext: Uint8Array,
  nonce: Uint8Array,
  sessionKey: Uint8Array
): Uint8Array {
  try {
    const plaintext = nacl.secretbox.open(ciphertext, nonce, sessionKey);

    if (!plaintext) {
      // Add constant-time delay
      await new Promise(resolve => setTimeout(resolve, 10));
      throw new Error('Decryption failed');
    }

    return plaintext;
  } catch {
    await new Promise(resolve => setTimeout(resolve, 10));
    throw new Error('Decryption failed');
  }
}
```

---

#### L-2: Challenge Message Domain Separation Could Be Stronger

**Description**:
Challenge includes "Lockbox Session Key Derivation" but doesn't include chain ID or contract address.

**Recommendation**:
```typescript
const message = `Lockbox Session Key Derivation

Chain: solana-${network}  // devnet/mainnet-beta
Program: ${PROGRAM_ID}
Public Key: ${publicKey.toBase58()}
Timestamp: ${timestamp}
Nonce: ${nonceHex}

Sign this message to derive an encryption key for this session.
WARNING: Only sign on trusted applications.
DO NOT sign if you did not initiate this request.`;
```

---

#### L-3: No Nonce Reuse Detection

**Description**:
While nonces are randomly generated with 192-bit collision resistance, there's no explicit tracking to prevent reuse.

**Recommendation**:
```typescript
// Track used nonces in session
const usedNonces = new Set<string>();

export function encryptAEAD(
  plaintext: Uint8Array,
  sessionKey: Uint8Array
): { ciphertext: Uint8Array; nonce: Uint8Array; salt: Uint8Array } {
  let nonce: Uint8Array;
  let nonceHex: string;

  // Ensure nonce uniqueness
  do {
    nonce = nacl.randomBytes(NONCE_SIZE);
    nonceHex = Buffer.from(nonce).toString('hex');
  } while (usedNonces.has(nonceHex));

  usedNonces.add(nonceHex);

  // ... rest of encryption ...
}
```

---

## Recommendations by Priority

### Immediate (Before Production)

1. **Fix salt handling**: Use deterministic salt derivation or store salts consistently
2. **Implement session timeouts**: Add 15-minute inactivity timeout with automatic cleanup
3. **Add signature verification**: Explicitly verify wallet signatures before key derivation
4. **Remove unsafe functions**: Delete or make `ed25519ToCurve25519PublicKey` throw
5. **Add challenge nonces**: Include random nonce in challenge messages

### Short-term (Next Sprint)

6. **Improve session key storage**: Use WeakMap or SubtleCrypto non-extractable keys
7. **Implement key rotation**: Rotate session keys every 4 hours
8. **Add nonce tracking**: Explicitly track and prevent nonce reuse
9. **Strengthen domain separation**: Include chain ID and program address in challenges
10. **Add constant-time error handling**: Prevent timing attacks on decryption

### Long-term (Future Versions)

11. **Hardware-backed keys**: Use WebAuthn for key derivation where available
12. **Forward secrecy**: Implement ratcheting mechanism for long-lived sessions
13. **Key escrow option**: Allow users to escrow keys for account recovery
14. **Audit logging**: Log all cryptographic operations (hashed) for forensics
15. **Rate limiting**: Add client-side rate limiting on crypto operations

---

## Cryptographic Primitives Assessment

### ✅ Well-Chosen Primitives

| Primitive | Usage | Assessment |
|-----------|-------|------------|
| XChaCha20-Poly1305 | AEAD encryption | ✅ Excellent choice, resistant to nonce reuse |
| HKDF-SHA256 | Key derivation | ✅ Standard, well-vetted KDF |
| Ed25519 | Wallet signatures | ✅ Fast, secure signature scheme |
| 192-bit nonces | Collision resistance | ✅ Essentially collision-free |

### ⚠️ Implementation Concerns

| Area | Concern | Risk Level |
|------|---------|------------|
| Salt handling | Inconsistent usage | Critical |
| Session storage | Unprotected React state | Critical |
| Timeout enforcement | Not implemented | Critical |
| Key rotation | Not implemented | High |
| Memory scrubbing | Best-effort only | Medium |

---

## Testing Recommendations

### Security Test Cases

```typescript
// Test 1: Verify salt determinism
test('same signature produces same session key with same salt', async () => {
  const sig = await wallet.signMessage(challenge);
  const key1 = await deriveSessionKey(pubkey, sig, salt);
  const key2 = await deriveSessionKey(pubkey, sig, salt);
  expect(key1).toEqual(key2);
});

// Test 2: Verify session expiry
test('session expires after timeout', async () => {
  await initializeSession();
  await sleep(SESSION_TIMEOUT + 1000);
  expect(sessionKey).toBeNull();
});

// Test 3: Verify signature verification
test('invalid signature rejected', async () => {
  const fakeSig = new Uint8Array(64);
  await expect(
    createSessionKeyFromSignature(pubkey, fakeSig)
  ).rejects.toThrow('Invalid signature');
});

// Test 4: Verify nonce uniqueness
test('nonces are never reused', () => {
  const nonces = new Set();
  for (let i = 0; i < 10000; i++) {
    const { nonce } = encryptAEAD(plaintext, sessionKey);
    const hex = Buffer.from(nonce).toString('hex');
    expect(nonces.has(hex)).toBe(false);
    nonces.add(hex);
  }
});

// Test 5: Verify memory scrubbing
test('sensitive data is zeroed after wipe', () => {
  const data = new Uint8Array([1, 2, 3, 4]);
  wipeSensitiveData(data);
  expect(Array.from(data)).toEqual([0, 0, 0, 0]);
});
```

---

## Conclusion

The Solana Lockbox v2.0 cryptographic implementation demonstrates **good security fundamentals** with use of well-vetted primitives and comprehensive input validation. However, several **critical issues** around salt handling, session management, and key storage must be addressed before production deployment.

### Risk Summary

- **Critical Issues**: 3 (Salt handling, Session storage, No timeouts)
- **High Issues**: 3 (Unsafe conversion function, Replay window, No key rotation)
- **Medium Issues**: 3 (Memory scrubbing limitations, Salt API confusion, No signature verification)
- **Low Issues**: 3 (Timing attacks, Domain separation, No nonce tracking)

### Recommendation

**DO NOT deploy to mainnet** until Critical and High issues are resolved. Implement the recommended fixes in priority order, with comprehensive security testing at each stage.

---

**Auditor**: Trail of Bits (Simulated)
**Next Review**: After critical fixes implemented
**Contact**: security@trailofbits.com (for actual audit)
