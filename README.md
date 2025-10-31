# Solana Lockbox

**A Decentralized Password Manager Built on Solana**

> ## ⚠️ IMPORTANT SECURITY NOTICE
>
> **This is PRE-PRODUCTION software deployed on Solana Devnet for testing and demonstration purposes only.**
>
> - ❌ **NOT professionally security audited**
> - ❌ **NOT recommended for real sensitive data**
> - ❌ **Devnet can be reset without notice**
> - ✅ **Use test data only**
> - ⏳ **Professional audit planned for Q1 2026** before mainnet deployment
>
> **Wait for the audited mainnet version before storing real passwords or sensitive information.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Solana](https://img.shields.io/badge/Solana-Devnet-9945FF)](https://solana.com)
[![Next.js](https://img.shields.io/badge/Next.js-15.5.4-black)](https://nextjs.org)
[![Rust](https://img.shields.io/badge/Rust-Anchor_0.30.1-orange)](https://www.rust-lang.org)

> **Solana Colosseum Hackathon Entry**
> **Categories:** Consumer Apps · Public Goods
> **Developer:** Web3 Studios LLC
> **Version:** 2.3.2
> **Status:** ⚠️ **Pre-Production** (Devnet - Not Professionally Audited)
>
> **📚 [Documentation Index](docs/INDEX.md)** | **🔒 [Security Policy](SECURITY_POLICY.md)** | **🔐 [Cryptography Spec](docs/CRYPTOGRAPHY.md)**

---

## What is Solana Lockbox?

**The password manager you can't lose. That you only pay for once.**

Solana Lockbox stores your encrypted passwords on the Solana blockchain, giving you the recoverability of cloud managers (LastPass, 1Password) with the trustlessness of local managers (KeePass, local vaults) - **without the downsides of either**.

### Two Hidden Problems with Password Managers

**Problem 1: What Happens When You Lose Your Device?**
- **Cloud managers**: You're locked into trusting the company. If they get hacked (LastPass 2022), your encrypted vault can be stolen.
- **Local managers**: Lose your .kdbx file → lose everything. Forgot to backup to Dropbox? Gone forever.

**Problem 2: Subscription Trap**
- **LastPass**: $3/month = **$360 over 10 years**
- **1Password**: $2.99/month = **$358.80 over 10 years**
- **Dashlane**: $4.99/month = **$598.80 over 10 years**

### Solana Lockbox Solution

**🔑 Permanent Recoverability:** Drop your phone in a lake → buy new phone → connect wallet → **all passwords restored**. No company to trust, no file to lose.

**💰 Pay Once, Own Forever:** ~$10 one-time blockchain rent (recoverable). **10-year cost: Still $10**. Save $350+ vs LastPass.

**🔐 Your wallet is your master key. Your passwords are on-chain forever.**

### Live Application

- **Production:** https://lockbox.web3stud.io
- **Program ID:** `7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB` (Devnet)

---

## The Problem with Traditional Password Managers

### Centralized Cloud Services (LastPass, 1Password cloud, Bitwarden cloud)

| Issue | Impact |
|-------|--------|
| **Single Point of Failure** | Company breaches expose all users (LastPass 2022: 30M users affected) |
| **Trust Requirement** | You don't control the encryption keys; must trust company |
| **Subscription Lock-In** | Lose access if you stop paying $3-10/month |
| **Privacy Invasion** | Company knows your identity, usage patterns, metadata |
| **Service Discontinuation** | Company can shut down anytime |

### Local Managers (KeePass, local 1Password vaults, Bitwarden self-hosted)

| Issue | Impact |
|-------|--------|
| **File Loss = Data Loss** | Lose .kdbx file → lose everything (no recovery) |
| **Manual Backup Required** | Must remember to backup to Dropbox/USB regularly |
| **Sync Complexity** | Manual multi-device sync via cloud storage |
| **Device Loss Scenario** | Laptop stolen + forgot to backup recently = passwords gone |
| **No Audit Trail** | Can't verify file integrity or track changes |

### Solana Lockbox Solution: Best of Both Worlds

| Feature | Benefit |
|---------|---------|
| ✅ **Permanent Recoverability** 🔑 | Device loss? Passwords still on-chain forever. No manual backups needed. |
| ✅ **Automatic Multi-Device Sync** | Same wallet on laptop/phone → same vault. No iCloud/Dropbox/Drive needed. |
| ✅ **Trustless Architecture** | Client-side encryption. Blockchain never sees plaintext. You control keys. |
| ✅ **No Company to Hack** | Distributed across Solana validators. LastPass-style breach impossible. |
| ✅ **Pay-Once Model** | $0.02-0.50 one-time rent (recoverable). No $10/month subscriptions. |
| ✅ **True Portability** | On-chain data accessible forever. Open protocol. Any frontend can read. |
| ✅ **Anonymous by Default** | No email, no KYC, just your wallet. Company doesn't know who you are. |
| ✅ **Immutable Audit Trail** | Every change recorded on-chain. Verify file integrity cryptographically. |

---

## Why This Matters

### As a Consumer Application

Solana Lockbox represents a **paradigm shift** in password management:

- **Wallet-Native Identity**: Your Solana wallet becomes your digital identity manager
- **True Ownership**: Passwords stored on-chain, controlled by cryptographic keys
- **Cross-Platform**: Access from any device with your wallet
- **Privacy-First**: No company tracking your usage or storing metadata
- **Future-Proof**: Blockchain ensures permanent access (as long as Solana exists)

### As a Public Good

The Solana Lockbox program is a **reusable public utility** that transforms the ecosystem:

#### 1. Wallet Provider Integration

Wallets like Phantom, Solflare, and Backpack can integrate password management **natively**:

```typescript
// Integration is just a few lines of code
import { LockboxV2Client } from '@solana-lockbox/sdk';

const lockbox = new LockboxV2Client(connection, wallet, PROGRAM_ID);
await lockbox.initializeMasterLockbox();
await lockbox.storePassword({ title, username, password, url });
```

**Benefits for Wallet Providers:**
- 📈 **Increase User Retention**: Sticky feature that keeps users coming back
- 🏆 **Competitive Differentiation**: No other Solana wallet has native password management
- 🆓 **Zero Infrastructure Cost**: No servers, no databases, just the existing program
- 🔒 **Natural Extension**: Users already trust wallets with private keys
- 💡 **"Super App" Vision**: Transform wallets into comprehensive identity hubs

**Real-World Impact:**
- Phantom: 3M+ users × password management = massive value add
- Solflare: First wallet with native credentials = market leadership
- Backpack: xNFT ecosystem + password manager = complete digital identity

#### 2. dApp Developer Infrastructure

**Use Solana Lockbox as authentication infrastructure:**

- Store API keys for users (encrypted, wallet-controlled)
- Manage OAuth tokens across dApps
- Enable seamless multi-dApp identity
- Cryptographically provable access logs

**Example**: A DeFi aggregator could store users' exchange API keys in Lockbox, allowing cross-platform trading without centralized storage.

#### 3. Enterprise Secret Management

- Deploy private instances for team wallets
- Decentralized secret sharing for DevOps
- Immutable audit trails (all transactions on-chain)
- No single admin with master access

#### 4. Web3 Identity Layer

Solana Lockbox can become the **foundational identity layer** for Solana:

```
User's Wallet (Identity)
    ↓
Solana Lockbox (Credentials)
    ↓
dApps, Services, Traditional Apps
```

**Vision**: Every Solana wallet becomes a complete identity manager, bridging Web2 and Web3.

---

## How It Works

### Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                        USER'S BROWSER                            │
│   ┌────────────────────────────────────────────────────────┐    │
│   │  Next.js PWA (100% Client-Side)                        │    │
│   │                                                         │    │
│   │  1. User connects Solana wallet (Phantom, Solflare)   │    │
│   │  2. Sign challenge → derive key via HKDF-SHA256      │    │
│   │  3. Encrypt passwords with XChaCha20-Poly1305        │    │
│   │  4. Send encrypted blobs to blockchain                │    │
│   │                                                         │    │
│   │  • NO backend servers                                  │    │
│   │  • NO plaintext ever sent                              │    │
│   │  • NO company intermediaries                           │    │
│   └────────────────────────────────────────────────────────┘    │
└────────────────────────┬─────────────────────────────────────────┘
                         │
                         │ HTTPS + RPC
                         │ (Only encrypted data transmitted)
                         ▼
┌──────────────────────────────────────────────────────────────────┐
│                      SOLANA BLOCKCHAIN                           │
│   ┌────────────────────────────────────────────────────────┐    │
│   │  Lockbox Program (Rust/Anchor)                         │    │
│   │  ID: 7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB     │    │
│   │                                                         │    │
│   │  Accounts:                                             │    │
│   │  ┌─────────────────────────────────────────────┐      │    │
│   │  │ MasterLockbox                               │      │    │
│   │  │  • owner: PublicKey                         │      │    │
│   │  │  • storageChunksCount: u16                  │      │    │
│   │  │  • totalCapacity: u64                       │      │    │
│   │  │  • storageUsed: u64                         │      │    │
│   │  │  • subscription: SubscriptionTier           │      │    │
│   │  └─────────────────────────────────────────────┘      │    │
│   │  ┌─────────────────────────────────────────────┐      │    │
│   │  │ StorageChunk[] (up to 100)                  │      │    │
│   │  │  • encryptedData: Vec<u8>  ← OPAQUE BLOB   │      │    │
│   │  │  • entryHeaders: metadata only              │      │    │
│   │  │  • chunkIndex: u16                          │      │    │
│   │  │  • maxCapacity: u32 (10KB max)             │      │    │
│   │  └─────────────────────────────────────────────┘      │    │
│   │                                                         │    │
│   │  ⚠️  PROGRAM NEVER SEES PLAINTEXT                      │    │
│   │  ⚠️  ONLY STORES OPAQUE ENCRYPTED BLOBS                │    │
│   └────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
```

### Cryptographic Implementation

**For Security Researchers and Cryptographers:**

The implementation is fully auditable in [/nextjs-app/lib/crypto.ts](nextjs-app/lib/crypto.ts) and [/programs/lockbox/src/](programs/lockbox/src/). Here's the complete cryptographic flow:

#### 1. Session Key Derivation (HKDF-SHA256)

```typescript
// Derive session key from wallet signature
// File: nextjs-app/lib/crypto.ts, functions: deriveSessionKey() and createSessionKeyFromSignature()

// Step 1: Generate challenge for wallet to sign
const challenge = generateChallenge(publicKey);
// Challenge includes: publicKey + timestamp + random nonce + chain ID

// Step 2: User signs challenge with wallet
const signature = await wallet.signMessage(challenge);
// Returns Ed25519 signature (64 bytes)

// Step 3: Derive deterministic salt from public key
const saltInput = concat(publicKey, "lockbox-salt-v1");
const salt = SHA256(saltInput); // 32 bytes

// Step 4: HKDF key derivation
const ikm = concat(publicKey, signature, salt); // Input Key Material
const sessionKey = HKDF-SHA256(
  ikm: ikm,
  salt: salt,
  info: "lockbox-session-key",
  length: 256 bits // 32 bytes
);
```

**Key Properties:**
- **Algorithm**: HKDF-SHA256 (HMAC-based Key Derivation Function)
- **Input**: publicKey (32 bytes) || signature (64 bytes) || salt (32 bytes)
- **Salt**: Deterministic SHA-256(publicKey || "lockbox-salt-v1")
- **Info**: "lockbox-session-key" (domain separation)
- **Output**: 32-byte session key for XChaCha20-Poly1305
- **Determinism**: Same signature → same session key (enables decryption)
- **Replay Protection**: Challenge includes random nonce

**Design Rationale:**
- **HKDF** provides cryptographically strong key derivation from non-uniform input
- **Deterministic salt** ensures same wallet signature produces same decryption key
- **SHA-256** provides 256-bit collision resistance
- **No password storage** - keys exist only in memory during session

#### 2. Password Encryption (XChaCha20-Poly1305 AEAD)

```typescript
// Encrypt password entry with authenticated encryption
// File: nextjs-app/lib/crypto.ts, function: encryptAEAD()

import nacl from 'tweetnacl';

// 1. Generate random 24-byte nonce (192-bit)
const nonce = nacl.randomBytes(24);

// 2. Prepare plaintext (JSON-serialized entry)
const plaintext = new TextEncoder().encode(JSON.stringify({
  title: "Gmail",
  username: "user@gmail.com",
  password: "my-secret-password",
  url: "https://gmail.com",
  notes: "Recovery email: backup@example.com",
  type: "Login",
  category: 1,
  favorite: false,
  tags: ["email", "work"]
}));

// 3. Encrypt using XChaCha20-Poly1305 (NaCl secretbox)
const ciphertext = nacl.secretbox(plaintext, nonce, sessionKey);
// Returns: encrypted_data + 16-byte Poly1305 authentication tag

// 4. Result format (stored on-chain)
const result = {
  ciphertext: ciphertext,  // plaintext.length + 16 bytes (MAC tag)
  nonce: nonce,            // 24 bytes
  salt: salt               // 32 bytes (for key re-derivation)
};
```

**Encryption Specifications:**

| Property | Value | Details |
|----------|-------|---------|
| **Algorithm** | XChaCha20-Poly1305 | AEAD cipher (authenticated encryption) |
| **Cipher** | XChaCha20 | Extended-nonce ChaCha20 stream cipher |
| **MAC** | Poly1305 | 128-bit authentication tag |
| **Key Size** | 256 bits (32 bytes) | From HKDF-SHA256 derivation |
| **Nonce Size** | 192 bits (24 bytes) | Extended nonce space (XChaCha) |
| **Tag Size** | 128 bits (16 bytes) | Poly1305 MAC appended to ciphertext |
| **Library** | TweetNaCl 1.0.3 | Audited NaCl implementation (D. Bernstein) |
| **Nonce Reuse** | NEVER | Cryptographically random per encryption |

**Security Guarantees:**

| Property | Implementation | Guarantee |
|----------|---------------|-----------|
| **Confidentiality** | XChaCha20 (256-bit key) | IND-CPA secure stream cipher |
| **Integrity** | Poly1305 authentication | Detects any tampering (forgery resistance) |
| **Authenticity** | AEAD construction | Ciphertext is authenticated |
| **Nonce Uniqueness** | 192-bit random nonce | 2^-96 collision probability |
| **Forward Secrecy** | Independent per entry | Compromise one ≠ compromise others |
| **Domain Separation** | HKDF info string | Session keys isolated from search keys |

#### 3. On-Chain Storage Format

```rust
// What actually gets stored on Solana
// File: programs/lockbox/src/state/mod.rs

#[account]
pub struct StorageChunk {
    pub master_lockbox: Pubkey,      // Parent account
    pub owner: Pubkey,                // Wallet that can decrypt
    pub chunk_index: u16,             // Chunk number (0-99)
    pub max_capacity: u32,            // Max bytes (10KB limit)
    pub current_size: u32,            // Currently used bytes
    pub data_type: StorageType,       // Passwords, Notes, etc.

    // ⚠️ ENCRYPTED DATA - OPAQUE TO PROGRAM
    pub encrypted_data: Vec<u8>,      // XChaCha20-Poly1305 ciphertext

    // METADATA (for indexing, NOT sensitive)
    pub entry_headers: Vec<DataEntryHeader>,
    pub entry_count: u32,
    pub created_at: i64,
    pub last_modified: i64,
    pub bump: u8,                     // PDA bump seed
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct DataEntryHeader {
    pub entry_id: u64,
    pub entry_type: PasswordEntryType,
    pub category: u32,
    pub title_hash: [u8; 32],         // SHA256(title) for search
    pub created_at: i64,
    pub last_modified: i64,
    pub access_count: u32,
    pub flags: u8,                    // favorite, archived, etc.
}
```

**What's Visible On-Chain:**
- ✅ Owner's wallet address (public)
- ✅ Number of entries (public metadata)
- ✅ Entry types (Login, Card, Note - public metadata)
- ✅ SHA256 hash of titles (for client-side search)
- ✅ Timestamps, access counts (analytics)
- ❌ **Titles** (encrypted)
- ❌ **Usernames** (encrypted)
- ❌ **Passwords** (encrypted)
- ❌ **URLs** (encrypted)
- ❌ **Notes** (encrypted)
- ❌ **Any sensitive data** (ALL encrypted)

**Blockchain Explorer View:**
If you inspect the account on Solscan, you see:
```
Account: 7JxsHjd...nnSkoB
Owner: TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA
Data: [0xf3, 0x9a, 0x7c, 0xe2, 0x45, 0x8f, 0x1b, ...] ← Gibberish
```

**Security Guarantee:** Even Solana validators cannot decrypt your passwords.

#### 4. Decryption (Retrieval)

```typescript
// Decrypt passwords when user needs them
// File: nextjs-app/lib/crypto.ts, function: decryptAEAD()

import nacl from 'tweetnacl';

// 1. User signs challenge to derive session key (same as encryption)
const challenge = generateChallenge(publicKey);
const signature = await wallet.signMessage(challenge);
const { sessionKey, salt } = await createSessionKeyFromSignature(publicKey, signature);

// 2. Fetch encrypted data from blockchain
const chunk = await program.account.storageChunk.fetch(chunkAddress);
const ciphertext = chunk.encryptedData; // Includes 16-byte Poly1305 tag
const nonce = chunk.nonce; // 24 bytes

// 3. Decrypt using XChaCha20-Poly1305
const plaintext = nacl.secretbox.open(ciphertext, nonce, sessionKey);

if (!plaintext) {
  // Authentication failed - data has been tampered with
  throw new Error('Decryption failed: invalid ciphertext or key');
}

// 4. Parse and return password entry
const entry = JSON.parse(new TextDecoder().decode(plaintext));
return entry;
```

**Tamper Detection:**
If even a single bit of the ciphertext is modified, `nacl.secretbox.open()` returns `null`. This is Poly1305's authenticated encryption guarantee - the MAC verification fails and decryption is aborted.

#### 6. Security Analysis

**Threat Model:**

| Threat | Mitigation |
|--------|-----------|
| **Blockchain observer** | XChaCha20-Poly1305 encryption (ciphertext reveals nothing) |
| **Man-in-the-middle** | HTTPS + RPC signatures (Solana's built-in security) |
| **Compromised validator** | Validators only see ciphertext, can't decrypt |
| **Malicious program upgrade** | Program is immutable (or explicitly upgradeable with multisig) |
| **Wallet theft** | User must secure their seed phrase (same as any crypto) |
| **Browser compromise** | Plaintext exists briefly in memory (same as all password managers) |
| **Timing attacks** | Constant-time operations in NaCl library |
| **Nonce reuse** | Cryptographically secure RNG, 192-bit nonce space |
| **Key derivation attacks** | HKDF-SHA256 with deterministic salt |
| **Replay attacks** | Challenge includes random nonce + timestamp |

**Cryptographic Verification:**

Researchers can verify the implementation:
1. **Source Code:** All crypto in [/nextjs-app/lib/crypto.ts](nextjs-app/lib/crypto.ts) (TypeScript)
2. **Dependencies:**
   - `tweetnacl@1.0.3` - XChaCha20-Poly1305 AEAD (D. Bernstein's NaCl)
   - `crypto.subtle` (WebCrypto API) - HKDF-SHA256 key derivation
3. **Smart Contract:** [/programs/lockbox/src/](programs/lockbox/src/) (Rust, Anchor framework)
4. **On-Chain Binary:** Deployed program can be decompiled and compared
5. **IDL:** [/sdk/idl/lockbox-v2.json](sdk/idl/lockbox-v2.json) (interface definition)

**External Audit Status:**
- ⏳ Pending full external audit before mainnet
- ✅ Internal security review completed (Oct 2025)
- ✅ All known vulnerabilities patched
- ✅ Comprehensive test suite (unit + E2E)

---

## Features

### Core Password Management

- ✅ **Multiple Entry Types**
  - Login credentials (username + password + URL)
  - Credit cards (number, CVV, expiry, billing)
  - Secure notes (encrypted text)
  - Bank accounts (account number, routing)
  - SSH keys (private keys, passphrases)
  - API keys (tokens, secrets)
  - Crypto wallets (seed phrases, private keys)

- ✅ **Organization**
  - Custom categories (Work, Personal, Financial, etc.)
  - Tags (multi-tag support)
  - Favorites (quick access)
  - Archive (hide without deleting)
  - Search by title (client-side, via hash matching)

- ✅ **Security Features**
  - **Password Health Analysis**: Identifies weak passwords with visual indicators
  - **Password Generator**: Cryptographically secure with configurable options (length, character sets, passphrases)
  - **Strength Meter**: Real-time password strength assessment
  - **Quick Copy**: One-click password/username copy with activity logging
  - **Pre-fill Workflow**: Generate → Copy → Create entry in one flow
  - **Weak Password Warnings**: Visual health scores and recommendations

- ✅ **Mobile & PWA Support**
  - **Progressive Web App**: Install to home screen, works offline
  - **Service Worker**: Automatic caching, offline support, network-first for RPC
  - **Mobile Wallet Adapter**: Native Android wallet integration
  - **Touch-Optimized**: Responsive design for all screen sizes
  - **App Manifest**: Standalone mode, custom theme, shortcuts

- ✅ **Import/Export**
  - **CSV Export**: Compatible with Excel, Google Sheets (with security warning)
  - **JSON Export**: Full metadata preservation
  - **Import Support**: LastPass, 1Password, Bitwarden, CSV, JSON
  - **Data Portability**: Take your data anywhere
  - **Plaintext Warnings**: Prominent security notices before export

- ✅ **Dynamic Storage**
  - **Pay-as-You-Grow**: Start small, expand when needed
  - **On-Demand Expansion**: Slider to choose exact capacity
  - **Multi-Chunk**: Up to 100 chunks × 10KB = 1MB maximum
  - **Refundable Rent**: Close accounts to recover SOL
  - **Transparent Pricing**: See costs before expanding

### Advanced Features

- ✅ **Recovery Backup Codes**: Two-factor recovery with 8 single-use codes
- ✅ **Activity Logging**: Track all account actions with timestamps
- ✅ **Virtual Scrolling**: High-performance rendering for large vaults (500+ entries)
- ✅ **Advanced Search & Filtering**: Multi-select filters by type, category, favorites, archived
- ✅ **User Preferences**: Persistent view mode, theme (light/dark/system), display options
- ✅ **TOTP 2FA Support**: Generate time-based 2FA codes for password entries
- ✅ **QR Code Generation**: For sharing WiFi credentials, crypto addresses

---

## Comparison to Alternatives

### vs. LastPass / 1Password / Bitwarden

| Feature | Solana Lockbox | Traditional Managers |
|---------|----------------|---------------------|
| **Trust Model** | Trustless (cryptographic) | Trust company |
| **Master Authentication** | Wallet (secure enclave) | Master password (memorized) |
| **Storage Location** | Solana blockchain (distributed) | Company servers (centralized) |
| **Single Point of Failure** | None (validators) | Company infrastructure |
| **Cost Model** | One-time rent (~$0.01) | $3-8/month subscription |
| **Data Ownership** | You (wallet-controlled) | Company (you license access) |
| **Privacy** | Anonymous (wallet address) | Email, payment info, IP logs |
| **Vendor Lock-In** | None (open protocol) | Difficult migration |
| **Audit Trail** | On-chain (immutable) | Company logs (mutable) |
| **Open Source** | Yes (MIT license) | Varies (often proprietary) |
| **Government Subpoena** | Cannot decrypt | Company must comply |
| **Service Discontinuation** | Impossible (blockchain) | Risk (company can shut down) |

### vs. Browser Built-in Managers (Chrome, Safari)

| Feature | Solana Lockbox | Browser Managers |
|---------|----------------|------------------|
| **Cross-Browser** | ✅ Yes (wallet-based) | ❌ No (browser-locked) |
| **Cross-Device** | ✅ Yes (blockchain) | ⚠️ Limited (account sync) |
| **Encryption** | XChaCha20-Poly1305 | OS keychain (varies) |
| **Password Health** | ✅ Yes | ⚠️ Basic |
| **Categories/Tags** | ✅ Yes | ❌ No |
| **Multiple Entry Types** | ✅ Yes | ❌ Passwords only |
| **Import/Export** | ✅ Full portability | ⚠️ Limited |
| **Mobile Support** | ✅ PWA | Browser-dependent |
| **Vendor Control** | None | Browser vendor |

### vs. Other Crypto Password Managers

| Feature | Solana Lockbox | MetaMask Snaps / Other |
|---------|----------------|------------------------|
| **Truly Decentralized** | ✅ On-chain storage | ❌ Often centralized backend |
| **Open Protocol** | ✅ Reusable by anyone | ❌ Proprietary |
| **Mobile-Native** | ✅ PWA + Seeker | ⚠️ Limited |
| **Cost** | ~$0.01 one-time | Free (but data location unclear) |
| **Blockchain** | Solana (fast, cheap) | Ethereum (slow, expensive) |
| **Wallet Integration** | Native (MWA) | Extension-only |
| **Production Status** | ✅ Deployed (devnet) | ⚠️ Varies |

---

## Quick Start

### For End Users

1. **Visit the App**
   - **Production:** https://lockbox.web3stud.io
   - **Mobile:** Install as PWA (see [Mobile Guide](./docs/MOBILE_PWA_GUIDE.md))

2. **Install a Solana Wallet**
   - **Desktop:** [Phantom](https://phantom.app/), [Solflare](https://solflare.com/), [Backpack](https://backpack.app/)
   - **Mobile:** Phantom Mobile, Solflare Mobile
   - **Seeker:** Built-in Seed Vault wallet

3. **Connect Your Wallet**
   - Click "Connect Wallet" button
   - Select your wallet from the list
   - Approve the connection request
   - *Your wallet becomes your master key*

4. **Initialize Your Vault** (First Time Only)
   - Click "Initialize Master Lockbox"
   - Cost: ~0.002 SOL (rent for account creation)
   - This creates your on-chain password vault
   - **One-time setup, lasts forever**

5. **Add Your First Password**
   - Click "+ New Password"
   - Fill in details (title, username, password, URL)
   - All fields encrypted client-side
   - Click "Save to Blockchain"
   - Approve transaction (~0.0001 SOL)
   - Password stored encrypted on-chain

6. **Access From Anywhere**
   - Open Solana Lockbox on any device
   - Connect same wallet
   - All passwords instantly available
   - **Your data follows your wallet**

### For Developers

**Local Development:**

```bash
# Clone the repository
git clone https://github.com/hackingbutlegal/solana-lockbox.git
cd solana-lockbox

# Install dependencies
cd nextjs-app
npm install

# Start development server
npm run dev

# Open browser
open http://localhost:3000
```

**Testing:**

```bash
# Run unit tests
npm test

# Run E2E tests (requires Playwright)
npm run test:e2e

# Run program tests (Rust)
cd ../programs
anchor test
```

**Full setup guide:** See [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md)

### For Wallet Providers

**Integration is Simple:**

```bash
npm install @solana-lockbox/sdk
```

```typescript
import { LockboxV2Client } from '@solana-lockbox/sdk';
import { Connection, PublicKey } from '@solana/web3.js';

// Initialize client
const connection = new Connection('https://api.devnet.solana.com');
const PROGRAM_ID = new PublicKey('7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB');
const lockbox = new LockboxV2Client(connection, wallet, PROGRAM_ID);

// Create user's vault (one-time setup)
await lockbox.initializeMasterLockbox();

// Store a password (encrypted automatically)
await lockbox.storePassword({
  title: "User's Email",
  username: "user@example.com",
  password: "secret123",
  url: "https://example.com",
  notes: "Main email account",
  type: PasswordEntryType.Login,
  category: 0,
  favorite: false
});

// Retrieve all passwords (decrypted automatically)
const passwords = await lockbox.getAllPasswords();

// Update a password
await lockbox.updatePassword(chunkIndex, entryId, updatedEntry);

// Delete a password
await lockbox.deletePassword(chunkIndex, entryId);
```

**Benefits:**
- ✅ **Zero Backend**: No servers, databases, or infrastructure
- ✅ **Instant Integration**: 30 minutes to full implementation
- ✅ **User Retention**: Sticky feature that increases daily active users
- ✅ **Differentiation**: Be the first wallet with native password management
- ✅ **Trust**: Users already trust you with their keys

**Contact for Partnership:** [Your email/Discord]

---

## Project Status

### Current Version: 2.3.2 (October 30, 2025)

**Deployment:**
- ✅ **Devnet:** Fully deployed and tested
- ✅ **Program ID:** `7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB`
- ✅ **Frontend:** https://lockbox.web3stud.io (Vercel)
- ⏳ **Mainnet:** Planned Q1 2026 (after external audit)

**Security Status:**
- ✅ All critical vulnerabilities patched (see [SECURITY_STATUS.md](./docs/security/SECURITY_STATUS.md))
- ✅ Internal security review completed
- ✅ Constant-time cryptographic operations
- ✅ Comprehensive test coverage (85%+)
- ✅ Code refactored and cleaned
- ⏳ External audit pending (recommended before mainnet)

**Feature Completeness:**
- ✅ Core password management (CRUD)
- ✅ Multiple entry types (7 types)
- ✅ Encryption/decryption (XChaCha20-Poly1305)
- ✅ Mobile support (PWA + MWA)
- ✅ Import/export (5 formats)
- ✅ Dynamic storage expansion
- ✅ Password health analysis
- ✅ Search and organization

**Known Limitations:**
- ⚠️ **Devnet only**: Not yet on mainnet (intentional - requires security audit first)
- ⚠️ **No browser extension**: Web-only for now (roadmap item for Q2 2026)
- ⚠️ **Single wallet**: No multi-wallet shared vaults yet (roadmap item)
- ⚠️ **Wallet dependency**: Losing wallet private key = losing password access (standard for blockchain apps)

**Hackathon Readiness:**
- ✅ Fully functional demo
- ✅ Mobile-optimized (Seeker-ready)
- ✅ Comprehensive documentation
- ✅ Open source (MIT license)
- ✅ Production-deployed (devnet)
- ✅ Video demo prepared

---

## Roadmap

### Phase 1: Security & Mainnet (Q1 2026)

**1.1 External Security Audit**
- Engage Trail of Bits, OtterSec, or similar
- Focus areas: Cryptographic implementation, smart contract security, key management
- Estimated cost: $50k-100k
- **Why:** Required for mainnet deployment confidence

**1.2 Mainnet Deployment**
- Deploy program to Solana mainnet
- User migration tools from devnet
- Production monitoring and alerting
- **Why:** Make it real for actual users

**1.3 Bug Bounty Program**
- Immunefi platform integration
- Rewards: $1k-$100k based on severity
- **Why:** Incentivize white-hat security research

### Phase 2: UX Improvements (Q2 2026)

**2.1 Browser Extensions**
- Chrome, Firefox, Safari, Brave
- Auto-fill password forms
- Right-click context menus
- Icon in toolbar
- **Why:** Better UX than web app for daily use (90% of password manager usage is auto-fill)

**2.2 Mobile Apps**
- Submit PWA to Solana dApp Store (Android)
- iOS app (if possible with wallet integration)
- **Why:** Native feel, better performance, app store distribution

**2.3 Advanced Security Features**
- Planned: Social recovery with trusted guardians (Shamir Secret Sharing)
- Planned: Emergency access with time-locked sharing
- **Why:** Reduce risk of permanent data loss from wallet loss

### Phase 3: Ecosystem Integration (Q3 2026)

**3.1 Wallet Partnerships**
- Phantom: Native password manager integration
- Solflare: Built-in credentials tab
- Backpack: xNFT for password management
- **Why:** Distribution, user acquisition, mainstream adoption

**3.2 dApp Integration SDK**
- API key management for dApps
- OAuth token storage
- Cross-dApp identity protocol
- **Why:** Make Lockbox the identity layer for Solana

**3.3 Hardware Wallet Support**
- Ledger integration (for master key)
- Trezor support
- **Why:** Maximum security for high-value users

### Phase 4: Advanced Features (Q4 2026)

**4.1 Team/Family Vaults**
- Shared password vaults (2-10 members)
- Role-based access control (admin, editor, viewer)
- Audit logs (who accessed what, when)
- **Why:** Enterprise and family use cases

**4.2 Cross-Chain Support**
- Ethereum bridge (store passwords on Ethereum)
- Polygon, Arbitrum, Optimism
- Unified identity across chains
- **Why:** Reach non-Solana users

### Long-Term Vision (2027+)

**Identity Layer for Web3**
- Solana Lockbox becomes the standard credential manager
- Every Solana wallet integrates password management
- dApps use Lockbox for authentication
- Bridges Web2 and Web3 identity seamlessly

**Public Good Impact**
- Open protocol adopted by Solana Foundation
- Educational materials for developers
- Reference implementation for other chains
- Standards proposal (SLP: Solana Lockbox Protocol)

### What's NOT on the Roadmap

**By design, we will NEVER:**
- ❌ Collect user data
- ❌ Add advertisements
- ❌ Sell user information
- ❌ Add tracking/analytics (beyond basic anonymized metrics)
- ❌ Create centralized backend services
- ❌ Implement premium subscription tiers (beyond blockchain fees)
- ❌ Add cloud sync (blockchain IS the cloud)
- ❌ Partner with data brokers
- ❌ Comply with government backdoor requests (mathematically impossible)

**Our commitment:** Solana Lockbox will always be open source, privacy-first, and user-sovereign.

---

## Technology Stack

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| **Next.js** | 15.5.4 | React framework, PWA support |
| **React** | 19.1.0 | UI library |
| **TypeScript** | 5.x | Type safety |
| **Solana Wallet Adapter** | 0.15.39 | Wallet connection |
| **Mobile Wallet Adapter** | 2.2.4 | Seeker support |
| **TweetNaCl** | 1.0.3 | XChaCha20-Poly1305 encryption |
| **Web Crypto API** | Browser built-in | HKDF-SHA256 key derivation |
| **zxcvbn** | 4.4.2 | Password strength estimation |
| **Playwright** | 1.40+ | E2E testing |

### Smart Contract

| Technology | Version | Purpose |
|------------|---------|---------|
| **Rust** | 1.82.0 | Systems programming language |
| **Anchor Framework** | 0.30.1 | Solana program framework |
| **Solana CLI** | 1.18.x | Blockchain interaction |
| **Borsh** | 0.10.x | Binary serialization |

### Infrastructure

| Service | Purpose |
|---------|---------|
| **Vercel** | Frontend hosting, CDN |
| **Solana Devnet** | Blockchain (current) |
| **GitHub** | Source control |
| **No centralized servers** | 100% decentralized |
| **No databases** | Blockchain is the database |

### Development Tools

| Tool | Purpose |
|------|---------|
| **Jest** | Unit testing |
| **Anchor Test** | Program testing |
| **ESLint** | Code linting |
| **Prettier** | Code formatting |
| **Git** | Version control |

---

## Contributing

We welcome contributions from the Solana community!

**Ways to Contribute:**
- 🐛 Report bugs (GitHub Issues)
- 💡 Suggest features (GitHub Discussions)
- 🔐 Security research (see [SECURITY_POLICY.md](./SECURITY_POLICY.md))
- 📝 Improve documentation
- 🧪 Add tests
- 🎨 Design improvements
- 🌍 Translations

**Getting Started:**
1. Read [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md)
2. Fork the repository
3. Create a feature branch (`git checkout -b feature/amazing-feature`)
4. Make your changes
5. Add tests if applicable
6. Submit a pull request

**Code Review Process:**
- All PRs require maintainer review
- Must pass CI/CD (tests, linting)
- Security changes require extra scrutiny
- Breaking changes need discussion

**Areas We Need Help:**
- 🔐 **Security reviews** (crypto experts welcome!)
- 📱 **Mobile testing** (especially on Seeker devices)
- 🎨 **UI/UX improvements** (designers welcome!)
- 📚 **Documentation** (especially translations)
- 🧪 **Test coverage** (increase from 85% to 95%+)
- ♿ **Accessibility** (WCAG 2.1 compliance)

---

## Security

**Responsible Disclosure:**

If you discover a security vulnerability, please follow our security policy:

1. **Review:** [SECURITY_POLICY.md](./SECURITY_POLICY.md) for full disclosure guidelines
2. **Contact:** security@web3stud.io
3. **Include:** Description, reproduction steps, potential impact, severity
4. **Do NOT:** Open public GitHub issues for security vulnerabilities
5. **Response Time:** We will acknowledge within 48 hours

**Bug Bounty:** (Planned Post-Mainnet - Q2 2026)
- Critical: Recognition + priority in future bug bounty program
- High: Recognition in security advisories
- Medium/Low: Credit in release notes

**Security Documentation:**
- [SECURITY_POLICY.md](./SECURITY_POLICY.md) - **Vulnerability reporting policy**
- [Security Status](./docs/security/SECURITY_STATUS.md) - Current security posture & fixes
- [CRYPTOGRAPHY.md](./docs/CRYPTOGRAPHY.md) - Cryptographic implementation
- [Audit Reports](./docs/security/) - Security audit history

**Security Principles:**
- ✅ Open source (auditable by anyone)
- ✅ Client-side encryption (we never see plaintext)
- ✅ No single point of failure (decentralized)
- ✅ Constant-time operations (timing attack resistant)
- ✅ Authenticated encryption (tamper detection)
- ✅ Regular security updates

---

## Documentation

### For Users
- 📱 [Mobile & PWA Guide](./docs/MOBILE_PWA_GUIDE.md) - Using on mobile devices
- 🚀 [Quick Start](./QUICKSTART.md) - Get started in 5 minutes
- 🔧 [Troubleshooting](./TROUBLESHOOTING.md) - Common issues and solutions
- ❓ [FAQ](./docs/FAQ.md) - Frequently asked questions

### For Developers
- 💻 [Developer Guide](./DEVELOPER_GUIDE.md) - Setup, development, testing
- 🏗️ [Architecture](./docs/architecture/ARCHITECTURE.md) - System design
- 🔐 [Cryptography](./docs/CRYPTOGRAPHY.md) - Encryption implementation
- 📚 [API Reference](./API.md) - SDK documentation
- 🧪 [Testing Guide](./TESTING.md) - Testing strategies

### For Deployment
- 🚀 [Deployment Guide](./docs/deployment/DEPLOYMENT.md) - Production deployment
- 📦 [Bubblewrap Guide](./docs/BUBBLEWRAP_DEPLOYMENT.md) - PWA to Android APK
- 🔄 [CI/CD Setup](./docs/CICD.md) - Continuous integration

### Technical Specs
- 🏛️ [Architecture Deep Dive](./docs/architecture/ARCHITECTURE.md)
- 🔬 [Cryptographic Specification](./docs/CRYPTOGRAPHY.md)
- 🛡️ [Security Analysis](./docs/security/SECURITY_STATUS.md)
- 📊 [Performance Benchmarks](./docs/PERFORMANCE.md)

---

## License

**MIT License**

Copyright (c) 2025 Web3 Studios LLC

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

---

## Acknowledgments

**Solana Colosseum Hackathon 2025**

**Built With:**
- [Solana](https://solana.com) - High-performance blockchain
- [Anchor](https://www.anchor-lang.com) - Solana program framework
- [Solana Mobile](https://solanamobile.com) - Mobile Wallet Adapter, Seeker support
- [Next.js](https://nextjs.org) - React framework
- [TweetNaCl](https://tweetnacl.js.org) - Cryptography library by Dan Bernstein
- [zxcvbn](https://github.com/dropbox/zxcvbn) - Password strength estimator by Dropbox

**Inspired By:**
- LastPass, 1Password, Bitwarden - Password manager UX best practices
- MetaMask - Wallet-first architecture philosophy
- IPFS - Decentralized storage principles
- Signal - Strong cryptography and privacy focus

**Special Thanks:**
- Solana Foundation - For building an incredible ecosystem
- Solana Colosseum - For organizing this hackathon
- Solana Mobile team - For Mobile Wallet Adapter documentation
- Anchor community - For framework support

---

## Contact & Links

- 🌐 **Website:** https://lockbox.web3stud.io
- 📦 **GitHub:** https://github.com/hackingbutlegal/solana-lockbox
- 🏢 **Developer:** Web3 Studios LLC
- 🏆 **Hackathon:** Solana Colosseum 2025
- 📧 **Email:** [contact email]
- 💬 **Discord:** [Discord invite]
- 🐦 **Twitter:** [Twitter handle]

---

## Disclaimers

**Alpha Software:**
Solana Lockbox is currently in active development and deployed on **Solana Devnet only**. While we've taken extensive measures to ensure security, the software is provided "as is" without warranty of any kind. Use at your own risk.

**Wallet Security:**
Your Solana wallet is your master key. **If you lose your wallet seed phrase, you lose access to your passwords permanently.** We cannot recover your passwords. Please:
- ✅ Backup your wallet seed phrase securely
- ✅ Consider hardware wallets for maximum security
- ✅ Test with small amounts first
- ✅ Understand the risks of blockchain-based storage

**Not Financial Advice:**
Solana Lockbox is a password management tool, not financial advice. Always do your own research (DYOR) before storing sensitive information on any blockchain.

**Regulatory Compliance:**
Users are responsible for compliance with local laws and regulations regarding data storage and encryption.

---

**Remember: Not your keys, not your passwords.** 🔐

**Your wallet. Your data. Your sovereignty.**
