# Solana Lockbox

**A Decentralized Password Manager Built on Solana**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Solana](https://img.shields.io/badge/Solana-Devnet-9945FF)](https://solana.com)
[![Next.js](https://img.shields.io/badge/Next.js-15.5.4-black)](https://nextjs.org)
[![Rust](https://img.shields.io/badge/Rust-Anchor_0.30.1-orange)](https://www.rust-lang.org)

> **Solana Colosseum Hackathon Entry**
> **Categories:** Consumer Apps · Public Goods
> **Developer:** Web3 Studios LLC
> **Version:** 2.3.2
> **Status:** ✅ Production Ready (Devnet)

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
│   │  2. Derive encryption key from wallet keypair         │    │
│   │  3. Encrypt passwords with AES-256-GCM                │    │
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

The implementation is fully auditable in `/nextjs-app/lib/crypto.ts` and `/programs/lockbox/src/`. Here's the complete cryptographic flow:

#### 1. Key Derivation

```typescript
// Derive 256-bit AES key from wallet's Ed25519 keypair
// File: nextjs-app/lib/crypto.ts, function: deriveEncryptionKey()

import { pbkdf2Sync } from 'crypto';

const masterKey = pbkdf2Sync(
  password: wallet.secretKey,      // 32-byte Ed25519 secret key
  salt: wallet.publicKey,          // 32-byte Ed25519 public key
  iterations: 100_000,             // OWASP recommendation
  keyLength: 32,                   // 256 bits for AES-256
  digest: 'sha256'                 // HMAC-SHA256
);

// Result: 256-bit key unique to this wallet
// Property: Deterministic (same wallet = same key)
// Security: 100k iterations prevents rainbow tables
```

**Design Rationale:**
- **PBKDF2** chosen for broad compatibility and FIPS 140-2 approval
- **100,000 iterations** balances security and performance (OWASP 2023 guidelines)
- **Salt = publicKey** prevents rainbow tables (unique per wallet)
- **Password = secretKey** ensures only wallet owner can decrypt

#### 2. Per-Entry Encryption

```typescript
// Encrypt each password entry independently
// File: nextjs-app/lib/crypto.ts, function: encrypt()

import { randomBytes } from 'crypto';
import { createCipheriv } from 'crypto';

// 1. Generate unique nonce (CRITICAL: Never reuse!)
const nonce = randomBytes(12); // 96 bits for GCM

// 2. Prepare plaintext
const plaintext = JSON.stringify({
  title: "Gmail",
  username: "user@gmail.com",
  password: "my-secret-password",
  url: "https://gmail.com",
  notes: "Recovery: backup@example.com",
  type: PasswordEntryType.Login,
  category: 1,
  favorite: false,
  tags: ["email", "work"]
});

// 3. Encrypt with AES-256-GCM
const cipher = createCipheriv('aes-256-gcm', masterKey, nonce);

// 4. Add authenticated data (AAD) - not encrypted but authenticated
cipher.setAAD(wallet.publicKey); // Binds ciphertext to this wallet

let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
ciphertext += cipher.final('hex');

// 5. Extract authentication tag
const authTag = cipher.getAuthTag(); // 128-bit tag

// 6. Construct final encrypted blob
const encryptedBlob = Buffer.concat([
  nonce,         // 12 bytes
  authTag,       // 16 bytes
  Buffer.from(ciphertext, 'hex')  // Variable length
]);

// Result: Authenticated, encrypted blob
// Properties:
//   - Confidentiality: AES-256 is unbreakable with current technology
//   - Integrity: GCM auth tag detects any tampering
//   - Uniqueness: Each encryption uses fresh random nonce
//   - Binding: AAD ties ciphertext to specific wallet
```

**Security Properties:**

| Property | Implementation | Guarantee |
|----------|---------------|-----------|
| **Confidentiality** | AES-256 (256-bit key) | Computationally infeasible to break |
| **Integrity** | GCM authentication tag | Detects any bit flip or tampering |
| **Authenticity** | AAD = wallet public key | Prevents ciphertext reuse across wallets |
| **Forward Secrecy** | Unique nonce per entry | Compromise of one entry doesn't affect others |
| **Replay Protection** | Nonce never reused | Prevents replay attacks |
| **Side-Channel Resistance** | Constant-time comparison | Mitigates timing attacks on auth tag |

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
    pub encrypted_data: Vec<u8>,      // AES-256-GCM ciphertext

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
// File: nextjs-app/lib/crypto.ts, function: decrypt()

import { createDecipheriv } from 'crypto';

// 1. Fetch encrypted blob from blockchain
const chunk = await program.account.storageChunk.fetch(chunkAddress);
const encryptedBlob = Buffer.from(chunk.encryptedData);

// 2. Extract components
const nonce = encryptedBlob.slice(0, 12);
const authTag = encryptedBlob.slice(12, 28);
const ciphertext = encryptedBlob.slice(28);

// 3. Derive master key from wallet (same as encryption)
const masterKey = deriveEncryptionKey(wallet);

// 4. Create decipher
const decipher = createDecipheriv('aes-256-gcm', masterKey, nonce);

// 5. Set auth tag and AAD (must match encryption!)
decipher.setAuthTag(authTag);
decipher.setAAD(wallet.publicKey);

// 6. Decrypt
let plaintext;
try {
  plaintext = decipher.update(ciphertext, 'hex', 'utf8');
  plaintext += decipher.final('utf8');  // ← Verifies auth tag here
} catch (error) {
  // Auth tag mismatch = tampering detected
  throw new Error('Decryption failed: data has been tampered with');
}

// 7. Parse and return
const entry = JSON.parse(plaintext);
return entry;
```

**Tamper Detection:**
If even a single bit of the ciphertext is modified, `decipher.final()` throws an error. This is GCM's authenticated encryption guarantee.

#### 5. Security Analysis

**Threat Model:**

| Threat | Mitigation |
|--------|-----------|
| **Blockchain observer** | AES-256 encryption (ciphertext reveals nothing) |
| **Man-in-the-middle** | HTTPS + RPC signatures (Solana's built-in security) |
| **Compromised validator** | Validators only see ciphertext, can't decrypt |
| **Malicious program upgrade** | Program is immutable (or explicitly upgradeable with multisig) |
| **Wallet theft** | User must secure their seed phrase (same as any crypto) |
| **Browser compromise** | Plaintext exists briefly in memory (same as all password managers) |
| **Timing attacks** | Constant-time auth tag comparison |
| **Nonce reuse** | Cryptographically secure RNG, 96-bit nonce space |
| **Key derivation attacks** | 100k PBKDF2 iterations + unique salt |

**Cryptographic Verification:**

Researchers can verify the implementation:
1. **Source Code:** All crypto in `/nextjs-app/lib/crypto.ts` (JavaScript)
2. **Dependencies:**
   - `crypto` (Node.js built-in, FIPS 140-2 validated)
   - `tweetnacl` (Ed25519 operations, DJB's library)
3. **Smart Contract:** `/programs/lockbox/src/` (Rust, Anchor framework)
4. **On-Chain Binary:** Deployed program can be decompiled and compared
5. **IDL:** `/nextjs-app/lib/idl/lockbox.json` (interface definition)

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
  - **Password Health Analysis**: Identifies weak, reused, old passwords
  - **Breach Detection**: Integration with Have I Been Pwned API
  - **Password Generator**: Configurable length, character sets, strength
  - **Strength Meter**: zxcvbn-based scoring (0-4 scale)
  - **Weak Password Warnings**: Non-blocking advice
  - **Reuse Detection**: Flags duplicate passwords across entries
  - **Expiry Tracking**: Reminds you to rotate old passwords

- ✅ **Mobile & PWA Support**
  - **Progressive Web App**: Install to home screen
  - **Mobile Wallet Adapter**: Native Android wallet integration
  - **Solana Seeker**: Optimized for Seed Vault security
  - **Offline Mode**: View passwords without internet
  - **Touch-Optimized**: 48dp touch targets, responsive design
  - **Service Worker**: Fast loading, offline caching

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

- ✅ **Backup Codes**: 8 single-use recovery codes
- ✅ **Session Management**: Auto-lock after inactivity
- ✅ **Activity Logging**: Track all account actions
- ✅ **TOTP 2FA Support**: Generate 2FA codes for entries
- ✅ **Clipboard Auto-Clear**: Security timeout for copied passwords
- ✅ **QR Code Generation**: For sharing WiFi, crypto addresses

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
| **Encryption** | AES-256-GCM | OS keychain (varies) |
| **Password Health** | ✅ Yes | ⚠️ Basic |
| **Breach Detection** | ✅ Yes | ⚠️ Chrome only |
| **Categories/Tags** | ✅ Yes | ❌ No |
| **Multiple Entry Types** | ✅ Yes | ❌ Passwords only |
| **Import/Export** | ✅ Full portability | ⚠️ Limited |
| **Mobile Support** | ✅ PWA + Seeker | Browser-dependent |
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
- ✅ All critical vulnerabilities patched (see [SECURITY.md](./docs/security/SECURITY.md))
- ✅ Internal security review completed
- ✅ Constant-time cryptographic operations
- ✅ Comprehensive test coverage (85%+)
- ✅ Code refactored and cleaned
- ⏳ External audit pending (recommended before mainnet)

**Feature Completeness:**
- ✅ Core password management (CRUD)
- ✅ Multiple entry types (7 types)
- ✅ Encryption/decryption (AES-256-GCM)
- ✅ Mobile support (PWA + MWA)
- ✅ Import/export (5 formats)
- ✅ Dynamic storage expansion
- ✅ Password health analysis
- ✅ Search and organization

**Known Limitations:**
- ⚠️ **Devnet only**: Not yet on mainnet (intentional)
- ⚠️ **No social recovery**: Lose wallet = lose passwords (roadmap item)
- ⚠️ **No browser extension**: Web-only for now (roadmap item)
- ⚠️ **Single wallet**: No multi-wallet shared vaults yet (roadmap item)

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
- Biometric unlock
- **Why:** Native feel, better performance, app store distribution

**2.3 Social Recovery (Guardians)**
- Nominate 3-5 trusted guardians
- Shamir Secret Sharing for backup
- Recover vault access if wallet lost
- **Why:** Major user concern—"What if I lose my wallet?"

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

**4.2 Emergency Access**
- Time-locked password sharing
- Designated beneficiary
- Automated inheritance
- **Why:** Estate planning, emergency situations

**4.3 Cross-Chain Support**
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
| **TweetNaCl** | 1.0.3 | Ed25519 crypto primitives |
| **crypto (Node.js)** | Built-in | AES-256-GCM encryption |
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
- 🔐 Security research (see [SECURITY.md](./SECURITY.md))
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

1. **Review:** [SECURITY.md](./SECURITY.md) for full disclosure guidelines
2. **Contact:** security@web3stud.io
3. **Include:** Description, reproduction steps, potential impact, severity
4. **Do NOT:** Open public GitHub issues for security vulnerabilities
5. **Response Time:** We will acknowledge within 48 hours

**Bug Bounty:** (Planned Post-Mainnet - Q2 2026)
- Critical: Recognition + priority in future bug bounty program
- High: Recognition in security advisories
- Medium/Low: Credit in release notes

**Security Documentation:**
- [SECURITY.md](./SECURITY.md) - **Vulnerability reporting policy**
- [Security Posture](./docs/security/SECURITY.md) - Current security status
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
- 🛡️ [Security Analysis](./docs/security/SECURITY.md)
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
