# Cryptography Implementation - Solana Lockbox

**Technical Specification for Security Researchers and Cryptographers**

This document provides a complete, proof-level description of the cryptographic implementation in Solana Lockbox. All claims are verifiable by examining the source code referenced below.

---

## Table of Contents

1. [Overview](#overview)
2. [Threat Model](#threat-model)
3. [Key Derivation](#key-derivation)
4. [Password Entry Encryption](#password-entry-encryption)
5. [Data Integrity](#data-integrity)
6. [Authentication](#authentication)
7. [Security Properties](#security-properties)
8. [Attack Resistance](#attack-resistance)
9. [Formal Security Analysis](#formal-security-analysis)
10. [Implementation Details](#implementation-details)
11. [Audit Trail](#audit-trail)

---

## Overview

### Architecture
Solana Lockbox implements a **client-side encryption** architecture where:
1. All cryptographic operations occur in the user's browser
2. Only **ciphertext** is stored on-chain
3. The blockchain acts as an immutable, replicated storage layer
4. Decryption keys never leave the client environment

### Cryptographic Primitives

| Primitive | Algorithm | Standard | Purpose |
|-----------|-----------|----------|---------|
| **Key Derivation** | PBKDF2-HMAC-SHA256 | RFC 8018 | Derive encryption key from wallet keypair |
| **Symmetric Encryption** | AES-256-GCM | NIST SP 800-38D | Encrypt password entries |
| **Authentication** | GCM Auth Tag (128-bit) | NIST SP 800-38D | Authenticate ciphertext integrity |
| **Nonce Generation** | crypto.getRandomValues() | Web Crypto API | Generate unique IVs |
| **Wallet Signing** | Ed25519 | RFC 8032 | Authorize blockchain transactions |

### Trust Assumptions

**What We Trust:**
- ✅ Browser's Web Crypto API implementation (provided by OS/browser vendor)
- ✅ User's Solana wallet implementation (Phantom, Solflare, etc.)
- ✅ Solana blockchain consensus (validator honesty assumed ≥66.67%)

**What We Don't Trust:**
- ❌ The blockchain network (assumes adversarial observers)
- ❌ RPC providers (can see encrypted data, but not plaintext)
- ❌ Web server hosting the application (code is open-source and verifiable)
- ❌ Third-party services (none used)

---

## Threat Model

### Adversaries

**Adversary A1: Passive Network Observer**
- **Capabilities:** Can read all blockchain data, observe RPC calls
- **Goal:** Decrypt password entries
- **Mitigation:** All entries encrypted with AES-256-GCM, computationally infeasible to break

**Adversary A2: Active Blockchain Manipulator**
- **Capabilities:** Can modify blockchain state (if controlling ≥33.33% of validators)
- **Goal:** Substitute ciphertext, cause decryption to different plaintext
- **Mitigation:** GCM authentication tags detect any tampering, AAD binds ciphertext to wallet

**Adversary A3: Malicious RPC Provider**
- **Capabilities:** Can return fake account data
- **Goal:** Cause user to decrypt wrong data or leak keys
- **Mitigation:** All ciphertext is authenticated; fake data fails authentication check

**Adversary A4: Stolen Wallet (Without Master Password)**
- **Capabilities:** Has wallet keypair but not master password
- **Goal:** Decrypt password vault
- **Result:** **CANNOT decrypt** (requires both wallet keypair AND master password)

**Adversary A5: Compromised Client Environment**
- **Capabilities:** Can execute JavaScript in user's browser
- **Goal:** Extract decryption keys or plaintext passwords
- **Result:** **ATTACK SUCCEEDS** (this is out-of-scope; similar to keylogger on desktop)

### Out-of-Scope Threats

1. **Browser/OS Compromise:** If attacker controls execution environment, all client-side encryption is defeated
2. **Side-Channel Attacks:** Timing attacks, power analysis (not applicable to browser environment)
3. **Social Engineering:** Phishing, credential theft (user education required)

---

## Key Derivation

### Overview
Solana Lockbox derives a **256-bit master encryption key** from the user's Solana wallet keypair using PBKDF2-HMAC-SHA256.

### Algorithm

```typescript
// Inputs:
const walletSecretKey: Uint8Array = wallet.secretKey; // 64 bytes (Ed25519 secret key)
const walletPublicKey: Uint8Array = wallet.publicKey.toBytes(); // 32 bytes
const userMasterPassword: string = "<user_chosen_password>"; // 12+ chars

// Step 1: Combine wallet secret with master password
const combinedSecret = new Uint8Array([
  ...walletSecretKey,           // 64 bytes
  ...new TextEncoder().encode(userMasterPassword) // variable length
]);

// Step 2: Derive master key using PBKDF2
const masterKey: Uint8Array = pbkdf2Sync(
  password: combinedSecret,     // Combined secret (64+ bytes)
  salt: walletPublicKey,        // 32-byte public key (globally unique)
  iterations: 100_000,          // OWASP 2023 recommendation
  keyLength: 32,                // 256 bits for AES-256
  digest: 'sha256'              // HMAC-SHA256
);
```

**Implementation Reference:** [`nextjs-app/lib/encryption.ts:15-45`](../nextjs-app/lib/encryption.ts)

### Security Properties

| Property | Value | Rationale |
|----------|-------|-----------|
| **Iteration Count** | 100,000 | OWASP 2023 recommendation for PBKDF2-SHA256 |
| **Salt** | Wallet Public Key (32 bytes) | Globally unique per wallet (collision probability ≈ 2^-256) |
| **Key Length** | 256 bits | Matches AES-256 key size |
| **Entropy Source** | Ed25519 secret key (256 bits) + user password | High entropy even with weak password |

### Security Analysis

**Claim 1:** *The derived master key has ≥256 bits of entropy.*

**Proof:**
- Ed25519 secret keys are uniformly random 256-bit values
- Even with zero-entropy password, total entropy ≥ 256 bits
- User password adds additional entropy (≥40 bits for typical 12-char password)
- PBKDF2 is a PRF (pseudorandom function); output is computationally indistinguishable from uniform random
- ∴ master key has full 256 bits of security

**Claim 2:** *PBKDF2 with 100k iterations resists brute-force attacks.*

**Analysis:**
- Attacker needs wallet secret key to attempt password guessing
- If attacker has wallet secret, they can already sign transactions (vault is already compromised)
- Master password serves as **second factor** defense-in-depth
- 100k iterations makes each password attempt cost ~100ms (rate limiting at cryptographic level)

**Claim 3:** *Each wallet derives a unique master key (no collisions).*

**Proof:**
- Salt is the wallet public key (32 bytes)
- Ed25519 public keys are generated from secret keys via point multiplication on Curve25519
- Probability of two wallets sharing the same public key: P(collision) ≈ 2^-256
- For 2^80 wallets, collision probability ≈ 2^-96 (negligible)
- ∴ Each wallet has a unique salt → unique master key

---

## Password Entry Encryption

### Overview
Each password entry is encrypted independently using **AES-256-GCM** with a unique nonce.

### Algorithm

```typescript
// Inputs:
const masterKey: Buffer = /* derived from wallet keypair (32 bytes) */;
const plaintext: string = JSON.stringify({
  id: "entry_001",
  title: "GitHub",
  username: "alice",
  password: "supersecret123",
  url: "https://github.com",
  notes: "Primary account",
  category: "Development",
  favorite: false,
  tags: ["work"],
  createdAt: 1704067200000,
  updatedAt: 1704067200000
});
const walletPublicKey: Buffer = /* 32-byte Ed25519 public key */;

// Step 1: Generate unique nonce (12 bytes for GCM)
const nonce: Buffer = crypto.randomBytes(12);

// Step 2: Create AES-256-GCM cipher
const cipher: crypto.Cipher = crypto.createCipheriv('aes-256-gcm', masterKey, nonce);

// Step 3: Set Additional Authenticated Data (AAD)
cipher.setAAD(walletPublicKey);

// Step 4: Encrypt plaintext
let ciphertext: string = cipher.update(plaintext, 'utf8', 'hex');
ciphertext += cipher.final('hex');

// Step 5: Extract authentication tag (16 bytes)
const authTag: Buffer = cipher.getAuthTag(); // 128-bit authentication tag

// Output (stored on-chain):
const encryptedEntry = {
  ciphertext: ciphertext,     // Variable length (hex-encoded)
  nonce: nonce.toString('hex'), // 24 hex characters (12 bytes)
  authTag: authTag.toString('hex') // 32 hex characters (16 bytes)
};
```

**Implementation Reference:** [`nextjs-app/lib/encryption.ts:78-145`](../nextjs-app/lib/encryption.ts)

### Decryption

```typescript
// Inputs (from blockchain):
const encryptedEntry = {
  ciphertext: "a1b2c3d4...",
  nonce: "f4e5d6c7b8a9...",
  authTag: "1a2b3c4d5e6f..."
};

// Step 1: Create decipher
const decipher: crypto.Decipher = crypto.createDecipheriv(
  'aes-256-gcm',
  masterKey,
  Buffer.from(encryptedEntry.nonce, 'hex')
);

// Step 2: Set AAD (must match encryption)
decipher.setAAD(walletPublicKey);

// Step 3: Set authentication tag
decipher.setAuthTag(Buffer.from(encryptedEntry.authTag, 'hex'));

// Step 4: Decrypt and authenticate
try {
  let plaintext = decipher.update(encryptedEntry.ciphertext, 'hex', 'utf8');
  plaintext += decipher.final('utf8'); // Throws if authentication fails

  const entry = JSON.parse(plaintext);
  return entry; // Successfully decrypted and authenticated
} catch (error) {
  // Authentication failure: ciphertext was tampered with
  throw new Error('Decryption failed: data integrity check failed');
}
```

**Implementation Reference:** [`nextjs-app/lib/encryption.ts:147-210`](../nextjs-app/lib/encryption.ts)

### Security Properties

| Property | Implementation | Security Level |
|----------|---------------|----------------|
| **Confidentiality** | AES-256-GCM | 256-bit security (computationally infeasible) |
| **Integrity** | GCM Auth Tag (128-bit) | 128-bit security (2^128 forgery attempts) |
| **Authenticity** | AAD = Wallet Public Key | Binds ciphertext to specific wallet |
| **Nonce Uniqueness** | crypto.randomBytes(12) | Collision probability ≈ 2^-96 per 2^32 entries |

---

## Data Integrity

### GCM Authentication Tag

**How It Works:**
1. During encryption, GCM computes a **polynomial MAC** (Message Authentication Code) over:
   - The ciphertext
   - The AAD (Additional Authenticated Data = wallet public key)
   - The lengths of both
2. This produces a 128-bit authentication tag
3. During decryption, GCM recomputes the tag and compares:
   - **If tags match:** Data is authentic and unmodified
   - **If tags differ:** Decryption aborts (throws error)

**Security Guarantee:**
- Attacker cannot modify even 1 bit of ciphertext without detection
- Attacker cannot substitute ciphertext from another wallet (AAD mismatch)
- Forgery probability: ≤ 2^-128 (negligible)

### Additional Authenticated Data (AAD)

**Purpose:** Binds the ciphertext to a specific wallet public key.

**Attack Prevented:**
- Suppose Alice encrypts password "alice123" for her wallet
- Attacker copies Alice's ciphertext to Bob's vault
- When Bob tries to decrypt:
  1. AAD = Bob's public key (set during decryption)
  2. But ciphertext was encrypted with AAD = Alice's public key
  3. **Authentication tag verification fails**
  4. Decryption aborts

**Result:** Ciphertext cannot be reused across wallets.

---

## Authentication

### Wallet-Based Authentication

**Claim:** *Only the wallet owner can decrypt their password vault.*

**Proof:**
1. Decryption requires the master key
2. Master key is derived from wallet secret key + master password
3. Wallet secret key is:
   - Stored in wallet software (Phantom, Solflare)
   - Protected by OS-level keychain or hardware wallet
   - Never transmitted over network
4. Attacker without wallet secret key cannot derive master key
5. Attacker without master key cannot decrypt ciphertext (AES-256 is IND-CPA secure)
6. ∴ Only wallet owner can decrypt

### Transaction Authorization

**Blockchain-Level Authentication:**
1. All write operations (store, update, delete) require on-chain transactions
2. Solana transactions require Ed25519 signature from wallet
3. Signature verification is done by Solana validators
4. Invalid signatures are rejected by consensus

**Result:** Attacker cannot modify vault contents without wallet private key.

---

## Security Properties

### Confidentiality

**Theorem:** *Assuming AES-256 is a secure block cipher, password entries are computationally indistinguishable from random bitstrings to any polynomial-time adversary.*

**Proof Sketch:**
1. AES-256 is assumed to be a pseudorandom permutation (PRP) under the standard model
2. GCM mode (CTR + GMAC) provides IND-CPA security when nonces are unique
3. Nonces are generated using crypto.randomBytes(12), which outputs uniform random bits
4. Collision probability for 2^32 entries: ≈ 2^-64 (negligible)
5. Given ciphertext C = Enc(K, N, P), adversary's advantage in distinguishing C from random is negligible
6. ∴ Ciphertext reveals no information about plaintext

### Integrity

**Theorem:** *Assuming GMAC is a secure MAC, the probability an adversary can modify ciphertext without detection is negligible.*

**Proof Sketch:**
1. GMAC is a polynomial-based MAC with 128-bit tags
2. Forgery probability for single query: ≤ 2^-128
3. For Q queries, probability ≤ Q · 2^-128 (still negligible for Q ≪ 2^64)
4. Adversary must either:
   - Break AES-256 (computationally infeasible)
   - Forge authentication tag (probability ≤ 2^-128)
5. ∴ Integrity holds with overwhelming probability

### Authenticity

**Theorem:** *Ciphertext cannot be reused across different wallets.*

**Proof:**
1. AAD is set to wallet public key during encryption
2. AAD is checked during decryption (part of authentication tag computation)
3. If AAD differs between encryption and decryption, tag verification fails
4. Each wallet has a unique public key (collision probability ≈ 2^-256)
5. ∴ Ciphertext is bound to the wallet that created it

---

## Attack Resistance

### Brute Force Key Search

**Attack:** Try all possible 256-bit keys to decrypt ciphertext.

**Cost:** 2^256 AES decryptions ≈ 2^256 × 10^-9 seconds ≈ 10^68 years (infeasible)

**Conclusion:** Computationally infeasible with current or foreseeable technology.

### Password Guessing (With Stolen Wallet)

**Attack:** Attacker steals wallet keypair, attempts to guess master password.

**Cost per guess:** ~100ms (100k PBKDF2 iterations)

**Maximum rate:** 10 guesses/second (single CPU core)

**For 8-char random password (52^8 ≈ 2^45.6 entropy):**
- Time to crack: 2^45.6 guesses × 0.1 seconds ≈ 111,000 years

**Mitigation:**
- Master password enforced to be ≥12 characters
- Strong password recommendations (≥16 chars with symbols)
- Future: Add rate limiting via on-chain counter

### Replay Attacks

**Attack:** Copy old ciphertext and submit to blockchain.

**Result:**
- Old ciphertext is validly encrypted
- Decryption succeeds (produces old password)
- **This is a feature, not a bug** (blockchain is immutable history)

**User Protection:**
- Password manager UI always shows latest version
- Update operations create new ciphertext (old one remains on-chain but ignored)
- Delete operations mark entry as deleted (tombstone)

### Ciphertext Substitution

**Attack:** Replace Alice's ciphertext with Bob's ciphertext.

**Result:**
1. Alice's vault now contains Bob's ciphertext
2. Alice attempts decryption:
   - AAD = Alice's public key
   - But ciphertext was encrypted with AAD = Bob's public key
   - **Authentication tag verification fails**
3. Decryption aborts with error

**Conclusion:** Cross-wallet ciphertext substitution is detected and prevented.

### Nonce Reuse Attack

**Attack:** Encrypt two different plaintexts with the same nonce.

**Consequence:**
- Attacker can XOR the two ciphertexts to get XOR of plaintexts
- This leaks information (violates confidentiality)

**Mitigation:**
- Nonces generated using crypto.randomBytes(12)
- 12 bytes = 96 bits of randomness
- Birthday paradox: collision probability ≈ Q^2 / 2^97 where Q = number of entries
- For Q = 2^32 entries: collision probability ≈ 2^-33 (negligible)

**Formal Guarantee:** Nonce collision probability is negligible for realistic vault sizes.

---

## Formal Security Analysis

### IND-CPA Security

**Definition:** An encryption scheme is IND-CPA (Indistinguishable under Chosen Plaintext Attack) if no polynomial-time adversary can distinguish encryptions of two messages of their choice.

**Theorem:** *AES-256-GCM with unique nonces is IND-CPA secure under the assumption that AES is a pseudorandom permutation.*

**Proof:** See [NIST SP 800-38D, Section 7](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38d.pdf)

**Application to Solana Lockbox:**
- AES-256-GCM is used with unique nonces (high probability)
- ∴ Encrypted password entries are IND-CPA secure

### INT-CTXT Security

**Definition:** An authenticated encryption scheme is INT-CTXT (Integrity of Ciphertext) secure if no polynomial-time adversary can produce a valid ciphertext not generated by the encryption oracle.

**Theorem:** *AES-256-GCM is INT-CTXT secure under the assumption that GMAC is a secure MAC.*

**Proof:** See [An Interface and Algorithms for Authenticated Encryption (Rogaway, 2002)](https://eprint.iacr.org/2002/172.pdf)

**Application to Solana Lockbox:**
- GMAC produces 128-bit authentication tags
- Forgery probability ≤ 2^-128 per attempt
- ∴ Ciphertext modifications are detected with overwhelming probability

---

## Implementation Details

### Source Code References

| Component | File | Lines |
|-----------|------|-------|
| Key Derivation | `nextjs-app/lib/encryption.ts` | 15-45 |
| Entry Encryption | `nextjs-app/lib/encryption.ts` | 78-145 |
| Entry Decryption | `nextjs-app/lib/encryption.ts` | 147-210 |
| Password Validation | `nextjs-app/lib/validation.ts` | 30-80 |
| On-Chain Storage | `programs/lockbox/src/instructions/store_password_entry.rs` | 10-120 |
| Storage Retrieval | `sdk/src/client-v2.ts` | 280-350 |

### Critical Constants

```rust
// programs/lockbox/src/state/storage_chunk.rs
pub const MAX_CHUNK_SIZE: usize = 10_240; // 10 KB per chunk
pub const MAX_CHUNKS: u8 = 100;            // 100 chunks max
pub const MAX_STORAGE: usize = 1_024_000;  // ~1 MB total

// nextjs-app/lib/encryption.ts
const PBKDF2_ITERATIONS = 100_000;
const NONCE_SIZE = 12;      // 96 bits
const AUTH_TAG_SIZE = 16;   // 128 bits
const KEY_SIZE = 32;        // 256 bits
```

### Entropy Sources

| Component | Source | Entropy (bits) |
|-----------|--------|----------------|
| Wallet Secret Key | OS/Hardware RNG | 256 |
| Master Password | User input | ≥40 (for 12-char) |
| GCM Nonce | `crypto.randomBytes(12)` | 96 |
| Entry ID | UUID v4 | 122 |

### Dependencies

**Node.js Crypto Module:**
- `crypto.pbkdf2Sync()` - PBKDF2 key derivation
- `crypto.createCipheriv()` - AES-GCM encryption
- `crypto.randomBytes()` - CSPRNG (cryptographically secure PRNG)

**Audited Implementations:**
- OpenSSL (used by Node.js crypto module)
- BoringSSL (used by Chromium-based browsers)
- WebKit Crypto (used by Safari)

---

## Audit Trail

### Security Reviews

**Internal Review:** December 2024
- Reviewed by: Web3 Studios LLC engineering team
- Focus: Cryptographic implementation, key management
- Result: No critical vulnerabilities found

**Third-Party Audit:** *Pending*
- Recommended auditors: Kudelski Security, NCC Group, OtterSec
- Scope: Smart contracts + cryptographic implementation

### Known Limitations

1. **No Hardware Security Module (HSM) Support**
   - Encryption keys exist in JavaScript memory (can be extracted via debugger)
   - Mitigation: This is inherent to browser-based encryption
   - Future: Explore WebAuthn for key storage

2. **No Forward Secrecy**
   - If wallet keypair is compromised, all historical ciphertext can be decrypted
   - Mitigation: Master password provides second factor
   - Future: Implement key rotation mechanism

3. **No Multi-Party Computation (MPC)**
   - Single point of failure (wallet keypair)
   - Mitigation: Backup codes for account recovery
   - Future: Shamir Secret Sharing for key distribution

4. **Nonce Management**
   - Relies on CSPRNG quality
   - No deterministic nonce generation
   - Risk: If CSPRNG is weak, nonce collisions possible
   - Mitigation: Use browser-provided crypto.getRandomValues() (audited by vendors)

### Changelog

**Version 2.0 (Current):**
- ✅ Implemented PBKDF2 key derivation (100k iterations)
- ✅ Added master password requirement
- ✅ Implemented AES-256-GCM encryption
- ✅ Added AAD binding to wallet public key
- ✅ Security audit: CRITICAL and HIGH vulnerabilities fixed

**Version 1.0 (Deprecated):**
- ❌ Direct wallet secret key as master key (INSECURE)
- ❌ No master password (single factor authentication)
- ❌ No iteration count (vulnerable to rainbow tables)

---

## References

### Standards

1. **NIST SP 800-38D** - "Recommendation for Block Cipher Modes of Operation: Galois/Counter Mode (GCM) and GMAC"
   - https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38d.pdf

2. **RFC 8018** - "PKCS #5: Password-Based Cryptography Specification Version 2.1"
   - https://datatracker.ietf.org/doc/html/rfc8018

3. **RFC 8032** - "Edwards-Curve Digital Signature Algorithm (EdDSA)"
   - https://datatracker.ietf.org/doc/html/rfc8032

4. **OWASP Password Storage Cheat Sheet**
   - https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html

### Academic Papers

1. **Rogaway, P. (2002)** - "Authenticated-Encryption with Associated-Data"
   - https://eprint.iacr.org/2002/098.pdf

2. **Bellare, M. & Namprempre, C. (2008)** - "Authenticated Encryption: Relations among Notions and Analysis of the Generic Composition Paradigm"
   - https://eprint.iacr.org/2000/025.pdf

3. **McGrew, D. & Viega, J. (2004)** - "The Galois/Counter Mode of Operation (GCM)"
   - https://csrc.nist.rip/groups/ST/toolkit/BCM/documents/proposedmodes/gcm/gcm-spec.pdf

### Implementation Guides

1. **Solana Cookbook** - "How to Use Wallet Keypairs"
   - https://solanacookbook.com/references/keypairs-and-wallets.html

2. **MDN Web Docs** - "SubtleCrypto API"
   - https://developer.mozilla.org/en-US/Web/API/SubtleCrypto

---

## Verification Checklist

For security researchers and auditors reviewing this implementation:

- [ ] Key derivation uses PBKDF2 with ≥100k iterations
- [ ] Master key derived from wallet secret + master password
- [ ] Each password entry encrypted with unique nonce
- [ ] Nonces are 96 bits (12 bytes) for GCM
- [ ] Authentication tags are 128 bits (16 bytes)
- [ ] AAD set to wallet public key for all entries
- [ ] Decryption failures abort (no silent corruption)
- [ ] No key material logged or stored persistently
- [ ] Ciphertext stored on-chain, keys stay client-side
- [ ] Blockchain transactions require wallet signature

---

**Document Status:** Living Document
**Last Updated:** December 29, 2024
**Maintainer:** Web3 Studios LLC
**Contact:** support@web3stud.io

---

**Disclaimer:** This document describes the cryptographic design as implemented. While we have made every effort to follow best practices, formal verification and third-party audits are recommended before production use with high-value assets.
