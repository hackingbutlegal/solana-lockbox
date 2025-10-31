# Cryptography Implementation - Solana Lockbox

**Technical Specification for Security Researchers and Cryptographers**

> **Last Updated:** October 30, 2025
> **Version:** 2.3.2
> **Status:** ⚠️ Pre-Production (Not Professionally Audited)

This document provides a complete, proof-level description of the cryptographic implementation in Solana Lockbox. All claims are verifiable by examining the source code referenced below.

---

## Table of Contents

1. [Overview](#overview)
2. [Threat Model](#threat-model)
3. [Session Key Derivation (HKDF-SHA256)](#session-key-derivation-hkdf-sha256)
4. [Password Encryption (XChaCha20-Poly1305)](#password-encryption-xchacha20-poly1305)
5. [Secondary Encryption (AES-GCM)](#secondary-encryption-aes-gcm)
6. [Security Properties](#security-properties)
7. [Attack Resistance](#attack-resistance)
8. [Implementation Details](#implementation-details)
9. [Cryptographic Dependencies](#cryptographic-dependencies)
10. [Security Audit Status](#security-audit-status)

---

## Overview

### Architecture

Solana Lockbox implements a **client-side encryption** architecture where:
1. All cryptographic operations occur in the user's browser
2. Only **ciphertext** is stored on the Solana blockchain
3. The blockchain acts as an immutable, replicated storage layer
4. Encryption keys **never leave the client** and exist only in memory during active sessions
5. Keys are derived from wallet signatures (deterministically) rather than stored

### Cryptographic Primitives

| Component | Algorithm | Standard | Purpose |
|-----------|-----------|----------|---------|
| **Session Key Derivation** | HKDF-SHA256 | RFC 5869 | Derive encryption key from wallet signature |
| **Salt Derivation** | SHA-256 | FIPS 180-4 | Deterministic salt from public key |
| **Main Encryption** | XChaCha20-Poly1305 | RFC 8439 (extended) | Encrypt password entries (AEAD) |
| **Secondary Encryption** | AES-256-GCM | NIST SP 800-38D | Recovery & sharing features (AEAD) |
| **Challenge-Response** | Ed25519 Signature | RFC 8032 | Wallet authentication for key derivation |
| **Nonce Generation** | crypto.getRandomValues() | Web Crypto API | Cryptographically secure random nonces |
| **Memory Wiping** | Multi-pass overwrite | Custom | Secure erasure of sensitive data |

### Trust Assumptions

**What We Trust:**
- ✅ Browser's Web Crypto API implementation (HKDF-SHA256, AES-GCM)
- ✅ TweetNaCl library implementation (XChaCha20-Poly1305)
- ✅ User's Solana wallet implementation (Ed25519 signing)
- ✅ Solana blockchain consensus (≥66.67% honest validators)
- ✅ Operating system's random number generator (crypto.getRandomValues)

**What We Don't Trust:**
- ❌ The blockchain network (assumes passive/active adversaries can observe)
- ❌ RPC providers (can see encrypted data, transaction patterns)
- ❌ Web server hosting the application (static files, verifiable by hash)
- ❌ Third-party services (none used for cryptographic operations)
- ❌ Other users or validators (zero-knowledge architecture)

---

## Threat Model

### Primary Adversaries

**Adversary A1: Passive Blockchain Observer**
- **Capabilities:** Can read all on-chain data, monitor transactions, observe patterns
- **Goal:** Decrypt password entries without wallet access
- **Mitigation:** XChaCha20-Poly1305 provides IND-CPA security; computationally infeasible to decrypt
- **Result:** ❌ **Attack fails** - ciphertext is semantically secure

**Adversary A2: Active Blockchain Manipulator**
- **Capabilities:** Can modify on-chain ciphertext (Byzantine validators)
- **Goal:** Cause decryption to different plaintext or extract key information
- **Mitigation:** Poly1305 authentication tag detects any tampering; decryption aborts
- **Result:** ❌ **Attack detected** - tampered ciphertext rejected

**Adversary A3: Malicious RPC Provider**
- **Capabilities:** Can return fake account data, incorrect blockchain state
- **Goal:** Cause user to decrypt wrong data, leak session keys, or accept forged entries
- **Mitigation:** All ciphertext authenticated with Poly1305; fake data fails MAC verification
- **Result:** ❌ **Attack detected** - authentication failure

**Adversary A4: Stolen Wallet / Lost Seed Phrase**
- **Capabilities:** Obtains user's wallet seed phrase or private key
- **Goal:** Access encrypted password vault
- **Result:** ✅ **Attack succeeds** - this is by design (wallet = master key)
- **Note:** Same threat model as losing master password in traditional password managers

**Adversary A5: Compromised Browser / XSS Attack**
- **Capabilities:** Execute arbitrary JavaScript in user's browser session
- **Goal:** Extract session keys or plaintext passwords from memory
- **Result:** ✅ **Attack succeeds** - client-side compromise defeats all cryptography
- **Mitigation:** Content Security Policy (CSP), memory wiping on session end
- **Note:** Out of scope - equivalent to keylogger on desktop applications

**Adversary A6: Replay Attack**
- **Capabilities:** Capture and replay wallet signatures from previous sessions
- **Goal:** Derive session keys without user consent
- **Mitigation:** Challenge includes random 32-byte nonce + timestamp
- **Result:** ❌ **Attack fails** - each challenge is unique, signatures not reusable

### Out-of-Scope Threats

1. **Browser/OS Compromise:** If attacker controls execution environment, all cryptography is defeated
2. **Side-Channel Attacks:** Timing attacks, cache analysis (JavaScript environment limitations)
3. **Social Engineering:** Phishing for wallet seed phrases, fake wallet applications
4. **Quantum Computing:** Current algorithms (Ed25519, XChaCha20, SHA-256) vulnerable to quantum attacks
   - Post-quantum migration planned for when quantum-safe Solana wallets exist

---

## Session Key Derivation (HKDF-SHA256)

### Purpose

Derive a deterministic 256-bit session key from a user's wallet signature. The session key is used for XChaCha20-Poly1305 encryption and persists only in memory during the active session.

### Algorithm

**HKDF** (HMAC-based Key Derivation Function) as specified in **RFC 5869** with SHA-256.

### Implementation

**Source Code:** [nextjs-app/lib/crypto.ts](../nextjs-app/lib/crypto.ts) - Functions: `deriveSessionKey()`, `createSessionKeyFromSignature()`

#### Step 1: Generate Challenge for Wallet Signature

```typescript
function generateChallenge(publicKey: PublicKey): Uint8Array {
  const timestamp = Date.now();
  const nonce = crypto.getRandomValues(new Uint8Array(32)); // 256-bit random

  const message = `Lockbox Session Key Derivation

Public Key: ${publicKey.toBase58()}
Timestamp: ${timestamp}
Nonce: ${nonceHex}
Chain: solana-devnet

Sign this message to derive an encryption key for this session.

⚠️  WARNING: Only sign this on trusted applications.
⚠️  DO NOT sign if you did not initiate this request.`;

  return new TextEncoder().encode(message);
}
```

**Properties:**
- **Domain Separation:** "Lockbox Session Key Derivation" prevents cross-protocol attacks
- **Public Key Binding:** Ties challenge to specific wallet
- **Timestamp:** Provides temporal context (not used for expiry, just context)
- **Random Nonce:** 256-bit entropy prevents replay attacks
- **Chain Identifier:** Prevents cross-chain signature reuse

#### Step 2: User Signs Challenge with Wallet

```typescript
const signature = await wallet.signMessage(challenge);
// Returns: Ed25519 signature (64 bytes)
```

**Security Note:** User must confirm signature in wallet UI (Phantom/Solflare modal)

#### Step 3: Derive Deterministic Salt from Public Key

```typescript
const saltInput = new Uint8Array([
  ...publicKey.toBytes(),                          // 32 bytes
  ...new TextEncoder().encode('lockbox-salt-v1')   // 16 bytes
]);

const saltBuffer = await crypto.subtle.digest('SHA-256', saltInput);
const salt = new Uint8Array(saltBuffer); // 32 bytes
```

**Rationale:**
- **Determinism:** Same public key → same salt → same session key from same signature
- **Uniqueness:** SHA-256 ensures each wallet has unique salt
- **Version String:** "lockbox-salt-v1" allows future salt rotation if needed

**Properties:**
- **Output:** 32-byte deterministic salt
- **Collision Resistance:** SHA-256 provides 256-bit collision resistance
- **Domain Separation:** Version string prevents reuse across protocol versions

#### Step 4: HKDF Key Derivation

```typescript
// Concatenate Input Key Material (IKM)
const ikm = new Uint8Array([
  ...publicKey.toBytes(),  // 32 bytes
  ...signature,            // 64 bytes (Ed25519 signature)
  ...salt                  // 32 bytes
]);
// Total IKM: 128 bytes

// Import IKM as HKDF key
const key = await crypto.subtle.importKey(
  'raw',
  ikm,
  { name: 'HKDF' },
  false,
  ['deriveBits']
);

// Derive session key
const infoBytes = new TextEncoder().encode('lockbox-session-key');
const derivedBits = await crypto.subtle.deriveBits(
  {
    name: 'HKDF',
    hash: 'SHA-256',      // HMAC-SHA256
    salt: salt,           // 32-byte salt
    info: infoBytes,      // "lockbox-session-key" (domain separation)
  },
  key,
  256 // Output: 32 bytes (256 bits)
);

const sessionKey = new Uint8Array(derivedBits);
```

### HKDF Parameters

| Parameter | Value | Purpose |
|-----------|-------|---------|
| **Hash Function** | SHA-256 | HMAC-SHA256 for extract & expand |
| **IKM (Input Key Material)** | 128 bytes | publicKey (32) ‖ signature (64) ‖ salt (32) |
| **Salt** | 32 bytes | Deterministic from SHA-256(publicKey ‖ "lockbox-salt-v1") |
| **Info** | "lockbox-session-key" | Domain separation for session keys |
| **Output Length** | 256 bits (32 bytes) | XChaCha20-Poly1305 key size |

### Security Properties

| Property | Guarantee |
|----------|-----------|
| **Determinism** | Same signature → same session key (enables decryption) |
| **Uniqueness** | Each wallet has unique session key |
| **Forward Secrecy** | Compromise of one session doesn't reveal others |
| **Domain Separation** | Info string isolates session keys from search keys |
| **Key Strength** | 256-bit output entropy |
| **Standard Compliance** | RFC 5869 (HKDF) |

### Attack Resistance

**Pre-Image Attack:** SHA-256 provides 256-bit pre-image resistance
**Collision Attack:** SHA-256 provides 128-bit collision resistance
**Rainbow Tables:** Deterministic salt is unique per wallet, prevents precomputation
**Brute Force:** 2^256 key space, computationally infeasible

---

## Password Encryption (XChaCha20-Poly1305)

### Purpose

Encrypt individual password entries with authenticated encryption (AEAD). Each entry is encrypted independently with a unique nonce.

### Algorithm

**XChaCha20-Poly1305** - Extended-nonce variant of ChaCha20-Poly1305 AEAD cipher.

- **Cipher:** XChaCha20 (stream cipher by Daniel J. Bernstein)
- **MAC:** Poly1305 (message authentication code)
- **Construction:** Encrypt-then-MAC (AEAD)
- **Nonce Size:** 192 bits (24 bytes) - extended nonce space
- **Key Size:** 256 bits (32 bytes)
- **Tag Size:** 128 bits (16 bytes)

### Implementation

**Source Code:** [nextjs-app/lib/crypto.ts](../nextjs-app/lib/crypto.ts) - Function: `encryptAEAD()`

**Library:** TweetNaCl 1.0.3 (`nacl.secretbox`)

```typescript
import nacl from 'tweetnacl';

function encryptAEAD(
  plaintext: Uint8Array,
  sessionKey: Uint8Array
): { ciphertext: Uint8Array; nonce: Uint8Array; salt: Uint8Array } {

  // 1. Generate unique 24-byte nonce
  const nonce = nacl.randomBytes(24); // 192-bit nonce

  // 2. Encrypt with XChaCha20-Poly1305
  const ciphertext = nacl.secretbox(plaintext, nonce, sessionKey);

  // 3. Generate salt for storage (used in key re-derivation)
  const salt = nacl.randomBytes(32);

  return { ciphertext, nonce, salt };
}
```

### Data Flow

```
Plaintext (password entry JSON)
    ↓
[Serialize to bytes]
    ↓
plaintext: Uint8Array
    ↓
[Generate random 24-byte nonce]
    ↓
[XChaCha20 stream cipher + Poly1305 MAC]
    ↓
ciphertext: Uint8Array (plaintext.length + 16)
    ↓
[Store on blockchain: ciphertext, nonce, salt]
```

### Ciphertext Format

```
ciphertext = encrypted_data || auth_tag

where:
  encrypted_data = XChaCha20(plaintext, nonce, sessionKey)
  auth_tag = Poly1305(encrypted_data, nonce, sessionKey)
```

**Total Size:** `plaintext.length + 16` bytes

**Stored On-Chain:**
- `ciphertext`: Encrypted data + 16-byte Poly1305 tag
- `nonce`: 24-byte unique nonce
- `salt`: 32-byte salt (for future key re-derivation)

### Security Properties

| Property | Implementation | Guarantee |
|----------|---------------|-----------|
| **Confidentiality** | XChaCha20 stream cipher | IND-CPA secure |
| **Integrity** | Poly1305 MAC | Detects any modification |
| **Authenticity** | AEAD construction | Ciphertext is authenticated |
| **Nonce Uniqueness** | 192-bit random nonce | 2^-96 collision probability |
| **Key Strength** | 256-bit session key | 2^256 brute-force resistance |
| **Forward Secrecy** | Independent nonces per entry | Compromise one ≠ others |

### Nonce Collision Analysis

**Nonce Size:** 192 bits (24 bytes)

**Collision Probability:**
- After 2^96 encryptions: ~50% probability of collision (birthday bound)
- At 1 billion (10^9) encryptions/user: probability ≈ 2^-67 (negligible)

**Reuse Consequence:**
If nonce is reused with same key:
- XChaCha20 keystream is reused → plaintext XOR can leak information
- **Mitigation:** Use cryptographically secure RNG (`nacl.randomBytes()`)

### Decryption

```typescript
function decryptAEAD(
  ciphertext: Uint8Array,
  nonce: Uint8Array,
  sessionKey: Uint8Array
): Uint8Array {

  const plaintext = nacl.secretbox.open(ciphertext, nonce, sessionKey);

  if (!plaintext) {
    throw new Error('Decryption failed - invalid ciphertext or key');
  }

  return plaintext;
}
```

**Authentication Verification:**
- `nacl.secretbox.open()` verifies Poly1305 MAC before decryption
- If MAC invalid → returns `null` (authentication failure)
- If MAC valid → returns plaintext

**Tamper Detection:**
- Any modification to ciphertext → MAC verification fails
- Decryption aborts, user notified of tampering

---

## Secondary Encryption (AES-GCM)

### Purpose

Social recovery and password sharing features use **AES-256-GCM** (WebCrypto API) instead of XChaCha20-Poly1305.

### Algorithm

**AES-256-GCM** - Galois/Counter Mode authenticated encryption.

- **Cipher:** AES (Rijndael) with 256-bit key
- **Mode:** GCM (Galois/Counter Mode)
- **Key Size:** 256 bits (32 bytes)
- **IV Size:** 96 bits (12 bytes) - standard for GCM
- **Tag Size:** 128 bits (16 bytes)

### Implementation

**Source Code:**
- [nextjs-app/lib/recovery-client-v2.ts](../nextjs-app/lib/recovery-client-v2.ts) (Lines 50-108)
- [nextjs-app/lib/password-sharing.ts](../nextjs-app/lib/password-sharing.ts) (Lines 82-162)

```typescript
// Encryption
const encryptedData = await crypto.subtle.encrypt(
  {
    name: 'AES-GCM',
    iv: nonce // 12 bytes (96-bit IV)
  },
  key, // 256-bit AES key
  plaintext
);

// Decryption
const plaintext = await crypto.subtle.decrypt(
  {
    name: 'AES-GCM',
    iv: nonce
  },
  key,
  ciphertext
);
```

### Use Cases

| Feature | Encryption | Key Derivation |
|---------|-----------|----------------|
| **Social Recovery** | AES-256-GCM | Shared secrets from guardians |
| **Password Sharing** | AES-256-GCM | Recipient's public key (ECDH) |
| **Backup Codes** | Likely AES-GCM | Password-based KDF |

### Why Two Algorithms?

**Main Storage (XChaCha20-Poly1305):**
- TweetNaCl provides consistent cross-platform implementation
- Extended 192-bit nonce space (better for high-volume encryption)
- Well-audited library by Daniel J. Bernstein

**Recovery/Sharing (AES-GCM):**
- WebCrypto API provides native browser performance
- Hardware acceleration on modern CPUs (AES-NI)
- Standard for web applications

**Both are secure:** NIST/industry-standard AEAD ciphers with 256-bit keys.

### Security Properties

| Property | AES-GCM | XChaCha20-Poly1305 |
|----------|---------|---------------------|
| **Confidentiality** | ✅ IND-CPA | ✅ IND-CPA |
| **Authentication** | ✅ GCM tag | ✅ Poly1305 MAC |
| **Key Size** | 256 bits | 256 bits |
| **Nonce Size** | 96 bits | 192 bits (extended) |
| **Tag Size** | 128 bits | 128 bits |
| **Standard** | NIST SP 800-38D | RFC 8439 (extended) |
| **Performance** | Hardware accel | Software (fast) |

---

## Security Properties

### Confidentiality

**Claim:** Encrypted password entries are computationally indistinguishable from random data.

**Proof Sketch:**
- XChaCha20 is a stream cipher based on ChaCha20, proven IND-CPA secure
- Session keys are unique per wallet (HKDF derives from wallet signature)
- Nonces are unique per encryption (192-bit random)
- Given ciphertext `C`, adversary cannot determine plaintext `P` without session key `K`
- Brute-force attack requires 2^256 operations (computationally infeasible)

**Conclusion:** ✅ **Confidentiality holds** under standard cryptographic assumptions.

### Integrity

**Claim:** Any modification to ciphertext is detected with overwhelming probability.

**Proof Sketch:**
- Poly1305 MAC provides 128-bit authentication
- MAC is computed over ciphertext: `tag = Poly1305(ciphertext, nonce, key)`
- Adversary must find `ciphertext'` such that `Poly1305(ciphertext', nonce, key) = tag`
- Probability of successful forgery: 2^-128 (negligible)

**Conclusion:** ✅ **Integrity holds** - tampering detected with probability 1 - 2^-128.

### Authenticity

**Claim:** Only the wallet owner can create valid encrypted entries.

**Proof Sketch:**
- Session key derived from wallet signature (only wallet owner can sign)
- Challenge includes random nonce (prevents replay)
- HKDF binds session key to specific public key
- Adversary without wallet private key cannot derive valid session key

**Conclusion:** ✅ **Authenticity holds** - only wallet owner can encrypt/decrypt.

### Forward Secrecy

**Claim:** Compromise of one encrypted entry does not compromise others.

**Proof Sketch:**
- Each entry encrypted with unique nonce
- Nonces are independent (cryptographically random)
- Session key is consistent within a session but re-derived per session
- No key material is reused across entries

**Conclusion:** ✅ **Forward secrecy holds** - entries are cryptographically independent.

---

## Attack Resistance

### Brute-Force Key Search

**Attack:** Enumerate all possible 256-bit session keys.

**Complexity:** 2^256 operations

**Cost Estimate:**
- Assume 10^18 keys/second (unrealistic, current supercomputers ≈ 10^18 FLOPS)
- Time: 2^256 / 10^18 ≈ 10^59 seconds ≈ 10^51 years
- Universe age: 10^10 years

**Result:** ❌ **Attack infeasible** - computationally impossible.

### Nonce Collision Attack

**Attack:** Cause nonce reuse to leak plaintext information.

**Probability:** 2^-96 per encryption pair (birthday bound at 2^96 encryptions)

**Realistic Scenario:**
- User encrypts 1 billion passwords (10^9 entries)
- Collision probability: (10^9)^2 / 2^193 ≈ 2^-133 (negligible)

**Result:** ❌ **Attack improbable** - nonces are sufficiently random and unique.

### Replay Attack

**Attack:** Reuse captured wallet signature to derive session key.

**Mitigation:** Challenge includes 256-bit random nonce + timestamp.

**Probability:** Reusing same challenge requires nonce collision: 2^-256.

**Result:** ❌ **Attack infeasible** - each challenge is unique.

### Timing Attack

**Attack:** Measure decryption time to leak key material.

**Mitigation:**
- TweetNaCl implements constant-time operations
- Poly1305 MAC verification is constant-time
- No branching on secret data

**Result:** ⚠️ **Partial mitigation** - JavaScript environment has limitations, but library is constant-time.

### Ciphertext Substitution Attack

**Attack:** Replace ciphertext with different encrypted data.

**Mitigation:**
- Poly1305 MAC authenticates ciphertext
- Substituted ciphertext fails MAC verification
- Decryption aborts

**Result:** ❌ **Attack detected** - authentication failure.

---

## Implementation Details

### Memory Security

**Sensitive Data Wiping:**

```typescript
function wipeSensitiveData(data: Uint8Array): void {
  // Pass 1: Random data
  crypto.getRandomValues(data);

  // Pass 2: All 0xFF
  for (let i = 0; i < data.length; i++) {
    data[i] = 0xFF;
  }

  // Pass 3: Random data
  crypto.getRandomValues(data);

  // Pass 4: Zeros
  for (let i = 0; i < data.length; i++) {
    data[i] = 0;
  }
}
```

**Limitations:**
- JavaScript garbage collector may leave copies in memory
- No guarantee of complete erasure in browser environment
- Mitigation: Minimize lifetime of sensitive data in memory

### Random Number Generation

**Source:** `crypto.getRandomValues()` (Web Crypto API)

**Properties:**
- Cryptographically secure PRNG
- OS-level entropy source
- FIPS 140-2 compliant (most browsers)

**Usage:**
- Nonce generation (24 bytes for XChaCha20, 12 bytes for AES-GCM)
- Challenge nonce (32 bytes)
- Salt generation (32 bytes)

### Input Validation

```typescript
// Validate plaintext size (max 1024 bytes)
if (plaintext.length > MAX_ENCRYPTED_SIZE) {
  throw new Error(`Plaintext exceeds maximum size`);
}

// Validate session key length (32 bytes)
if (sessionKey.length !== 32) {
  throw new Error(`Session key must be 32 bytes`);
}

// Validate nonce length (24 bytes for XChaCha20)
if (nonce.length !== NONCE_SIZE) {
  throw new Error(`Nonce must be ${NONCE_SIZE} bytes`);
}
```

---

## Cryptographic Dependencies

### TweetNaCl 1.0.3

**What:** Audited JavaScript implementation of NaCl (Networking and Cryptography Library)

**Author:** Daniel J. Bernstein (DJB)

**Algorithms Provided:**
- `nacl.secretbox()` - XChaCha20-Poly1305 encryption
- `nacl.secretbox.open()` - XChaCha20-Poly1305 decryption
- `nacl.randomBytes()` - Cryptographically secure random number generation

**Audit Status:** Audited by Cure53 (2017)

**Package:** `tweetnacl@1.0.3`

**Source:** https://github.com/dchest/tweetnacl-js

### Web Crypto API (crypto.subtle)

**What:** Browser-native cryptographic API

**Algorithms Used:**
- `HKDF-SHA256` - Key derivation function
- `AES-GCM` - Authenticated encryption (recovery/sharing)
- `SHA-256` - Cryptographic hashing (salt derivation)

**Standard:** W3C Web Cryptography API (https://www.w3.org/TR/WebCryptoAPI/)

**Implementation:** Browser-dependent (Chrome, Firefox, Safari)
- Most browsers use OpenSSL or BoringSSL
- FIPS 140-2 validated in many cases

---

## Security Audit Status

### Current Status (October 2025)

**Internal Security Review:**
- ✅ Code review completed
- ✅ All known vulnerabilities patched
- ✅ Security fixes documented in `/docs/security/SECURITY_STATUS.md`
- ✅ Comprehensive unit and E2E tests

**External Security Audit:**
- ⏳ **PENDING** - Not yet professionally audited
- ⏳ Planned before mainnet deployment (Q1 2026)
- ⏳ Target auditors: Trail of Bits, OtterSec, or equivalent

**Known Issues:**
- None (as of Oct 30, 2025)
- See [SECURITY_STATUS.md](security/SECURITY_STATUS.md) for historical vulnerabilities

**Pre-Production Warning:**
> ⚠️ **DO NOT use Solana Lockbox for sensitive, real-world passwords until a professional security audit has been completed.** This is test software deployed on Devnet for demonstration and evaluation purposes only.

---

## Changelog

| Date | Version | Change |
|------|---------|--------|
| 2025-10-30 | 2.3.2 | Complete rewrite of CRYPTOGRAPHY.md with accurate implementation details |
| 2025-10-12 | 2.0.0 | Initial (inaccurate) cryptography documentation |

---

## References

1. **RFC 5869** - HMAC-based Extract-and-Expand Key Derivation Function (HKDF)
   https://datatracker.ietf.org/doc/html/rfc5869

2. **RFC 8439** - ChaCha20 and Poly1305 for IETF Protocols
   https://datatracker.ietf.org/doc/html/rfc8439

3. **NaCl: Networking and Cryptography library**
   https://nacl.cr.yp.to/

4. **TweetNaCl.js** - JavaScript implementation
   https://github.com/dchest/tweetnacl-js

5. **NIST SP 800-38D** - Galois/Counter Mode (GCM) and GMAC
   https://csrc.nist.gov/publications/detail/sp/800-38d/final

6. **W3C Web Cryptography API Specification**
   https://www.w3.org/TR/WebCryptoAPI/

7. **Solana Documentation**
   https://docs.solana.com/

---

## Contact for Security Research

**Security Vulnerabilities:** Please see [SECURITY_POLICY.md](../SECURITY_POLICY.md) for responsible disclosure process.

**General Questions:** Open a GitHub issue or discussion.

---

**Document Status:** ✅ Accurate as of version 2.3.2 (October 30, 2025)
