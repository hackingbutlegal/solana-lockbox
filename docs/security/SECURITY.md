# Security Architecture

This document describes the security architecture, threat model, and security measures implemented in Solana Lockbox.

## Table of Contents

1. [Security Overview](#security-overview)
2. [Threat Model](#threat-model)
3. [Cryptographic Implementation](#cryptographic-implementation)
4. [Input Validation & Sanitization](#input-validation--sanitization)
5. [Rate Limiting & DoS Protection](#rate-limiting--dos-protection)
6. [Memory Security](#memory-security)
7. [On-Chain Security](#on-chain-security)
8. [Known Limitations](#known-limitations)
9. [Security Checklist](#security-checklist)
10. [Responsible Disclosure](#responsible-disclosure)

## Security Overview

Solana Lockbox implements a **zero-knowledge password manager** where:

- All encryption happens client-side
- Private keys never leave the user's wallet
- The blockchain only stores encrypted ciphertext
- No backend server has access to plaintext data
- PDA-based access control ensures user isolation

### Core Security Principles

1. **Zero-Knowledge Architecture**: Server/blockchain cannot read user data
2. **Wallet-Tied Encryption**: Only the owner's wallet can decrypt data
3. **Defense in Depth**: Multiple layers of validation and protection
4. **Fail-Secure Defaults**: Operations fail closed on errors
5. **Minimal Trust Surface**: No reliance on backend servers

## Threat Model

### In Scope

| Threat | Mitigation |
|--------|-----------|
| **Unauthorized access to encrypted data** | PDA-based access control, wallet signatures required |
| **Man-in-the-middle attacks** | HTTPS/WSS for RPC, signature verification |
| **Data tampering** | AEAD authentication (Poly1305 MAC) |
| **Memory scraping attacks** | 4-pass secure memory wiping |
| **DoS attacks (spam operations)** | On-chain rate limiting (1s between writes) |
| **Integer overflow vulnerabilities** | Checked arithmetic in Rust |
| **XSS/injection attacks** | Comprehensive input sanitization |
| **Malformed ciphertext** | AEAD format validation (min 40 bytes) |
| **Replay attacks** | Nonce uniqueness (192-bit collision resistance) |
| **Weak passwords** | Client-side password strength validation |

### Out of Scope

| Threat | Reason |
|--------|--------|
| **Compromised user wallet** | Cannot protect against stolen private keys |
| **Malicious browser extensions** | Cannot protect against local keyloggers |
| **Physical access to unlocked device** | Requires OS-level security (screen lock, etc.) |
| **Quantum computing attacks** | XChaCha20-Poly1305 not post-quantum secure |
| **Side-channel attacks (timing)** | Constant-time operations not guaranteed in JavaScript |

### Trust Assumptions

- User's wallet is secure and not compromised
- User's device is free from malware
- Solana RPC endpoint is honest (data availability)
- JavaScript runtime is not compromised

## Cryptographic Implementation

### Encryption: XChaCha20-Poly1305 AEAD

**Algorithm**: XChaCha20-Poly1305 (NaCl secretbox)

**Properties**:
- **Confidentiality**: XChaCha20 stream cipher (256-bit key)
- **Authenticity**: Poly1305 MAC (128-bit tag)
- **Nonce Space**: 192 bits (24 bytes)
- **Collision Resistance**: ~2^-96 after 2^96 messages

**Implementation**:
```typescript
// Generate random nonce (24 bytes)
const nonce = nacl.randomBytes(24);

// Encrypt with authenticated encryption
const ciphertext = nacl.secretbox(plaintext, nonce, sessionKey);

// Result: ciphertext = encrypted_data || poly1305_tag (16 bytes)
```

**Validation**:
- ✅ Input validation (plaintext size, key length)
- ✅ Output validation (expected ciphertext length)
- ✅ Format validation before on-chain storage (minimum 40 bytes)

### Key Derivation: HKDF-SHA256

**Input Key Material (IKM)**:
```
IKM = wallet_public_key || wallet_signature || random_salt
```

**Derivation**:
```typescript
// Use SubtleCrypto HKDF with SHA-256
const sessionKey = await crypto.subtle.deriveBits(
  {
    name: 'HKDF',
    hash: 'SHA-256',
    salt: salt,              // 32-byte random salt
    info: 'lockbox-session-key',
  },
  ikm,
  256  // 32 bytes
);
```

**Properties**:
- **Deterministic**: Same signature + salt → same session key
- **Collision Resistant**: SHA-256 hash function
- **Forward Secrecy**: Fresh salt per session
- **Domain Separation**: Info parameter prevents cross-protocol attacks

### Signature-Based Authentication

**Challenge Generation**:
```typescript
const challenge = `Lockbox Session Key Derivation

Public Key: ${publicKey.toBase58()}
Timestamp: ${Date.now()}

Sign this message to derive an encryption key for this session.`;
```

**Properties**:
- **Domain Separation**: Prevents signature reuse attacks
- **Timestamp**: Freshness indicator (not enforced on-chain)
- **User Visibility**: Clear message shown in wallet UI

### Deprecated: Ed25519→Curve25519 Conversion

**Status**: ⚠️ **DEPRECATED** - Do not use

**Issue**: TweetNaCl does not provide proper Ed25519→Curve25519 conversion. The previous implementation incorrectly returned the input unchanged.

**Recommendation**: Use signature-based key derivation (HKDF) instead of X25519 key agreement.

**Alternative Libraries** (if X25519 is required):
- `@stablelib/ed25519` - Proper curve conversion
- `crypto.subtle.deriveKey` with ECDH - Native browser API

## Input Validation & Sanitization

All user-provided data is validated and sanitized before encryption, storage, or display.

### Maximum Lengths (Defense in Depth)

```typescript
const MAX_LENGTHS = {
  TITLE: 255,
  USERNAME: 255,
  PASSWORD: 1000,
  URL: 2048,
  NOTES: 10000,
  TAG: 50,
  CATEGORY_NAME: 100,
  CARD_NUMBER: 19,
  CVV: 4,
  EMAIL: 320,      // RFC 5321
  PHONE: 20,
  API_KEY: 500,
};
```

### String Sanitization

**Removes**:
- Null bytes (`\x00`)
- Control characters (`\x01-\x1F`, `\x7F`)
- Preserves newlines/tabs in notes field

**Implementation**:
```typescript
function sanitizeString(input: string, maxLength?: number): string {
  // Remove dangerous control characters
  let sanitized = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Trim whitespace
  sanitized = sanitized.trim();

  // Enforce maximum length
  if (maxLength && sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
}
```

### Field-Specific Validation

| Field | Validation |
|-------|-----------|
| **Title** | Required, 1-255 chars, sanitized |
| **Username** | Optional, max 255 chars, sanitized |
| **Password** | Optional, max 1000 chars, all characters preserved |
| **URL** | Optional, URL format validation, http/https only |
| **Notes** | Optional, max 10000 chars, newlines allowed |
| **Tags** | Alphanumeric + hyphens/underscores, max 20 tags, deduplicated |
| **Email** | RFC 5322 regex validation, max 320 chars |
| **Phone** | Digits and `+` only, max 20 chars |
| **Credit Card** | Luhn algorithm validation, 13-19 digits |
| **CVV** | 3-4 digits only |

### Luhn Algorithm (Credit Card Validation)

```typescript
function luhnCheck(cardNumber: string): boolean {
  let sum = 0;
  let isEven = false;

  for (let i = cardNumber.length - 1; i >= 0; i--) {
    let digit = parseInt(cardNumber[i], 10);

    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    isEven = !isEven;
  }

  return sum % 10 === 0;
}
```

### JSON Sanitization

```typescript
function sanitizeJSON(input: string): string {
  try {
    // Parse and re-stringify to remove injection attempts
    const parsed = JSON.parse(input);
    return JSON.stringify(parsed);
  } catch {
    throw new Error('Invalid JSON format');
  }
}
```

## Rate Limiting & DoS Protection

### On-Chain Rate Limiting

**Location**: `programs/lockbox/src/state/master_lockbox.rs`

**Implementation**:
```rust
/// Check rate limiting (prevent DoS attacks)
///
/// SECURITY: Enforces minimum time between operations to prevent spam
/// - Minimum 1 second between write operations
/// - Read operations are not rate-limited
pub fn check_rate_limit(&self, current_timestamp: i64, min_interval_seconds: i64) -> bool {
    if self.last_accessed == 0 {
        return true; // First operation
    }
    current_timestamp >= self.last_accessed + min_interval_seconds
}
```

**Applied to**:
- ✅ `store_password_entry` (1 second minimum)
- ✅ `update_password_entry` (1 second minimum)
- ✅ `delete_password_entry` (1 second minimum)

**Error**: `RateLimitExceeded` - "Rate limit exceeded: please wait before retrying"

### Client-Side Rate Limiting

**Location**: `nextjs-app/lib/input-sanitization.ts`

**Implementation**:
```typescript
class RateLimiter {
  private attempts: Map<string, number[]> = new Map();
  private readonly maxAttempts: number;  // Default: 5
  private readonly windowMs: number;     // Default: 60000ms (1 minute)

  check(key: string): boolean {
    const now = Date.now();
    const attempts = this.attempts.get(key) || [];

    // Remove old attempts outside the window
    const recentAttempts = attempts.filter(time => now - time < this.windowMs);

    if (recentAttempts.length >= this.maxAttempts) {
      return false; // Rate limit exceeded
    }

    recentAttempts.push(now);
    this.attempts.set(key, recentAttempts);
    return true;
  }
}
```

**Purpose**:
- Prevents client-side spam before sending transactions
- Reduces wasted transaction fees
- Improves UX with client-side feedback

## Memory Security

### Secure Memory Wiping

**Implementation**: 4-pass overwrite with random data

```typescript
function wipeSensitiveData(data: Uint8Array): void {
  if (data.length === 0) return;

  // Pass 1: Random data
  crypto.getRandomValues(data);

  // Pass 2: All 0xFF
  for (let i = 0; i < data.length; i++) {
    data[i] = 0xFF;
  }

  // Pass 3: Random data again
  crypto.getRandomValues(data);

  // Pass 4: All zeros (final pass)
  for (let i = 0; i < data.length; i++) {
    data[i] = 0;
  }
}
```

**Properties**:
- **Multiple Passes**: 4-pass overwrite (random → 0xFF → random → zeros)
- **Increased Security**: Harder to recover from memory dumps
- **JavaScript Limitation**: GC may still leave copies in memory

**Recommendation**: Minimize lifetime of sensitive data in memory.

### Session Key Lifecycle

1. **Derivation**: User signs challenge → HKDF generates session key
2. **Usage**: Encrypt/decrypt operations
3. **Cleanup**: `wipeSensitiveData()` called when session ends
4. **Re-derivation**: Fresh signature required for new session

## On-Chain Security

### PDA-Based Access Control

**Seeds**: `["master_lockbox", owner_pubkey]`

**Properties**:
- **User Isolation**: Each user has unique PDA
- **Signer Validation**: Only owner can sign transactions
- **Deterministic**: Same owner → same PDA address

**Implementation**:
```rust
#[account(
    mut,
    seeds = [MasterLockbox::SEEDS_PREFIX, owner.key().as_ref()],
    bump = master_lockbox.bump,
    constraint = master_lockbox.owner == owner.key() @ LockboxError::Unauthorized
)]
pub master_lockbox: Account<'info, MasterLockbox>,
```

### Integer Overflow Protection

**Location**: `programs/lockbox/src/state/storage_chunk.rs`

**Implementation**:
```rust
// SECURITY: Use checked_add to prevent integer overflow
let data_len = encrypted_data.len() as u32;
let new_size = self.current_size
    .checked_add(data_len)
    .ok_or(LockboxError::InvalidDataSize)?;

require!(
    new_size <= self.max_capacity,
    LockboxError::InsufficientChunkCapacity
);
```

**Properties**:
- **Checked Arithmetic**: Returns `None` on overflow
- **Explicit Error Handling**: Fails with `InvalidDataSize`
- **Defense Against**: Malicious inputs causing wrapping behavior

### AEAD Format Validation

**Client-Side** (`crypto.ts`):
```typescript
// XChaCha20-Poly1305 format:
// - 16-byte Poly1305 authentication tag
// - Encrypted plaintext
const MIN_CIPHERTEXT_SIZE = 16;

function validateAEADFormat(ciphertext: Uint8Array, nonce: Uint8Array): boolean {
  return (
    ciphertext.length >= MIN_CIPHERTEXT_SIZE &&
    ciphertext.length <= MAX_ENCRYPTED_SIZE &&
    nonce.length === 24  // XChaCha20 nonce size
  );
}
```

**On-Chain** (`password_entry.rs`):
```rust
// SECURITY: Validate AEAD ciphertext format
// XChaCha20-Poly1305 (NaCl secretbox) format:
// - First 24 bytes: nonce
// - Remaining bytes: ciphertext + 16-byte Poly1305 tag
// Minimum valid size: 24 (nonce) + 16 (tag) = 40 bytes
const MIN_AEAD_SIZE: usize = 40;
require!(
    encrypted_data.len() >= MIN_AEAD_SIZE,
    LockboxError::InvalidDataSize
);
```

### Subscription Validation

**Implementation**:
```rust
// Check subscription is active
require!(
    master_lockbox.is_subscription_active(current_timestamp),
    LockboxError::SubscriptionExpired
);
```

**Properties**:
- **Time-Based**: Validates `current_timestamp < subscription_expires`
- **Free Tier**: Always active (no expiration)
- **Paid Tiers**: Checked on every write operation

## Known Limitations

### 1. JavaScript Garbage Collection

**Issue**: JavaScript GC may leave copies of sensitive data in memory.

**Mitigation**: 4-pass secure wiping (reduces risk, but not eliminated).

**Recommendation**: Use browser isolation (dedicated profile) for password management.

### 2. Browser Extension Access

**Issue**: Malicious browser extensions can access page memory.

**Mitigation**: None (requires user to audit installed extensions).

**Recommendation**: Disable extensions when using password manager.

### 3. Side-Channel Attacks (Timing)

**Issue**: JavaScript does not guarantee constant-time operations.

**Mitigation**: None (inherent JavaScript limitation).

**Impact**: Low (attacker needs local execution and precise timing measurements).

### 4. Post-Quantum Cryptography

**Issue**: XChaCha20-Poly1305 is not quantum-resistant.

**Mitigation**: None (requires algorithmic change).

**Timeline**: Not an immediate threat (large-scale quantum computers don't exist yet).

**Future**: Monitor NIST PQC standardization, consider migration path.

### 5. Solana RPC Trust

**Issue**: Relies on RPC endpoint for data availability.

**Mitigation**: Users can run their own RPC node.

**Recommendation**: Use trusted RPC providers (Helius, Triton, GenesysGo).

### 6. Frontend Security

**Issue**: Compromised frontend can steal session keys.

**Mitigation**: Open-source code, verifiable builds, self-hosting option.

**Recommendation**: Verify frontend integrity (subresource integrity, IPFS pinning).

### 7. Rate Limiting Bypass

**Issue**: Client-side rate limiting can be bypassed.

**Mitigation**: On-chain rate limiting enforced by Solana program.

**Impact**: Low (on-chain enforcement is final authority).

## Security Checklist

### Before Encryption

- [ ] Input sanitized (removed control characters)
- [ ] Length validated (within maximum limits)
- [ ] Field-specific validation passed
- [ ] Session key derived from fresh signature
- [ ] Salt generated with cryptographically secure RNG

### During Encryption

- [ ] Plaintext validated (non-empty, within size limits)
- [ ] Session key validated (exactly 32 bytes)
- [ ] Nonce generated with cryptographically secure RNG (24 bytes)
- [ ] AEAD ciphertext produced (plaintext + 16-byte tag)
- [ ] Output format validated

### Before On-Chain Storage

- [ ] AEAD format validated (minimum 40 bytes)
- [ ] Rate limit checked (1 second since last write)
- [ ] Subscription validated (active)
- [ ] Capacity checked (sufficient storage available)
- [ ] PDA ownership verified

### After Decryption

- [ ] Poly1305 MAC verified (automatic in `secretbox.open`)
- [ ] Plaintext sanitized before display
- [ ] Session key wiped after use
- [ ] Plaintext wiped after processing

### Operational Security

- [ ] HTTPS/WSS for all RPC connections
- [ ] No plaintext logging (ever)
- [ ] No session keys in browser storage
- [ ] Regular security audits
- [ ] Responsible disclosure policy

## Responsible Disclosure

If you discover a security vulnerability in Solana Lockbox, please follow responsible disclosure practices:

### Reporting Process

1. **Do NOT** create a public GitHub issue
2. **Do** email security reports to: security@solana-lockbox.dev (replace with actual email)
3. **Include**:
   - Detailed description of the vulnerability
   - Steps to reproduce
   - Proof of concept (if available)
   - Affected versions
   - Suggested fix (if you have one)

### Response Timeline

- **24 hours**: Acknowledgment of report
- **7 days**: Initial assessment and severity classification
- **30 days**: Patch development and testing
- **90 days**: Public disclosure (coordinated with reporter)

### Severity Classification

| Severity | Impact | Example |
|----------|--------|---------|
| **Critical** | Total loss of confidentiality | Private key extraction |
| **High** | Unauthorized data access | PDA bypass |
| **Medium** | Partial data leak | Timing attack on encryption |
| **Low** | Minor information disclosure | Version fingerprinting |

### Recognition

- Security researchers will be credited in SECURITY.md (if desired)
- Critical vulnerabilities may be eligible for a bug bounty (TBD)
- Responsible disclosure is appreciated and encouraged

### Out of Scope

- DoS attacks requiring significant resources (Solana network-level)
- Social engineering attacks
- Physical access to unlocked devices
- Issues in third-party dependencies (report upstream)

## Security Contact

- **Email**: security@solana-lockbox.dev (replace with actual)
- **PGP Key**: [Link to public key] (optional)
- **Encrypted Reporting**: [Keybase/Signal] (optional)

---

**Last Updated**: 2025-10-12
**Version**: 2.0.0
**Maintainer**: Solana Lockbox Security Team
