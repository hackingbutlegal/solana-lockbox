# Solana Lockbox - System Architecture

**Version 2.0 - Production Architecture**

Last Updated: December 29, 2024

---

## Table of Contents

1. [Overview](#overview)
2. [Core Design Principles](#core-design-principles)
3. [System Architecture](#system-architecture)
4. [Component Details](#component-details)
5. [Data Flow](#data-flow)
6. [Security Model](#security-model)
7. [Storage Architecture](#storage-architecture)
8. [Frontend-Agnostic Design](#frontend-agnostic-design)
9. [Deployment Architecture](#deployment-architecture)
10. [Scalability & Performance](#scalability--performance)

---

## Overview

**Solana Lockbox** is a decentralized password manager built on the Solana blockchain. It provides:

- **Client-side encryption**: All passwords encrypted in browser before blockchain storage
- **Wallet-based authentication**: Your Solana wallet IS your identity
- **Zero backend**: No centralized servers, direct RPC communication
- **Data ownership**: Users fully own their encrypted vaults
- **Open source**: Auditable, forkable, transparent

### Key Statistics

| Metric | Value |
|--------|-------|
| **Blockchain** | Solana Devnet |
| **Program ID** | `7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB` |
| **Frontend** | https://lockbox.web3stud.io |
| **Max Storage** | 1 MB per vault (expandable) |
| **Max Entries** | ~250 passwords (4 KB average) |
| **Encryption** | XChaCha20-Poly1305 (AEAD) |
| **Key Derivation** | HKDF-SHA256 (from wallet signatures) |

---

## Core Design Principles

### 1. Zero-Knowledge Architecture

```
┌─────────────────┐
│   User Browser  │
│                 │
│  ┌───────────┐  │
│  │ Plaintext │  │  ← Only exists in browser memory
│  └─────┬─────┘  │
│        │        │
│  ┌─────▼──────┐ │
│  │  Encrypt   │ │  ← XChaCha20-Poly1305 with wallet-derived key
│  └─────┬──────┘ │
│        │        │
│  ┌─────▼──────┐ │
│  │ Ciphertext │ │  ← Safe to transmit/store
│  └─────┬──────┘ │
└────────┼────────┘
         │
         ▼
┌────────────────┐
│ Solana Network │  ← Only sees encrypted data
│  (Validators)  │
└────────────────┘
```

**Guarantee**: Blockchain never sees plaintext passwords, usernames, or URLs.

### 2. Wallet-Based Identity

```
User's Solana Wallet
    ↓
Ed25519 Keypair (256-bit secret key)
    ↓
PDA Derivation: seeds = ["master_lockbox", publicKey]
    ↓
Unique Vault Address (deterministic, collision-resistant)
```

**No separate accounts needed** - Your wallet IS your Lockbox account.

### 3. Frontend-Agnostic

```
┌──────────────┐
│  Next.js PWA │───┐
└──────────────┘   │
                   │    ┌──────────────┐
┌──────────────┐   ├───►│  Lockbox SDK │
│  CLI Tool    │───┤    └──────┬───────┘
└──────────────┘   │           │
                   │           ▼
┌──────────────┐   │    ┌──────────────┐
│  Mobile App  │───┘    │    Solana    │
└──────────────┘        │   Program    │
                        └──────────────┘
```

**Any frontend can access user's vault** - No vendor lock-in.

### 4. No Backend Dependencies

Traditional architecture (❌):
```
Client → Backend API → Database → Blockchain
```

Solana Lockbox architecture (✅):
```
Client → RPC Provider → Solana Blockchain
```

**Benefits**:
- No single point of failure
- No server maintenance costs
- No trust in third parties
- Globally available (21+ RPC providers)

---

## System Architecture

### High-Level Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    User Browser (Client)                │
│                                                          │
│  ┌────────────────┐  ┌─────────────────────────────┐  │
│  │ Next.js PWA    │  │   Wallet Adapter            │  │
│  │                │  │   (Phantom/Solflare/etc)    │  │
│  └───────┬────────┘  └──────────┬──────────────────┘  │
│          │                       │                      │
│          ▼                       ▼                      │
│  ┌────────────────┐  ┌─────────────────────────────┐  │
│  │  Lockbox SDK   │  │   Crypto Libraries          │  │
│  │  (TypeScript)  │  │   (HKDF, XChaCha20-Poly1305)│  │
│  └───────┬────────┘  └──────────┬──────────────────┘  │
│          │                       │                      │
└──────────┼───────────────────────┼──────────────────────┘
           │                       │
           │    Encryption Keys    │
           │◄──────────────────────┘
           │
           │  @solana/web3.js (Transactions)
           │
           ▼
┌─────────────────────────────────────────────────────────┐
│                   Solana RPC Provider                    │
│             (Helius, Triton, GenesysGo, etc)             │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│                   Solana Blockchain                      │
│                                                          │
│  ┌───────────────────────────────────────────────────┐ │
│  │  Lockbox Program (Rust/Anchor 0.30.1)            │ │
│  │  Program ID: 7JxsHj...nSkoB                      │ │
│  └───────────────────┬───────────────────────────────┘ │
│                      │                                  │
│                      ▼                                  │
│  ┌───────────────────────────────────────────────────┐ │
│  │           Account Storage (PDAs)                  │ │
│  │                                                    │ │
│  │  ┌────────────────┐  ┌───────────────────────┐  │ │
│  │  │ MasterLockbox  │  │  StorageChunk (0..99) │  │ │
│  │  │  (metadata)    │  │   (encrypted data)    │  │ │
│  │  └────────────────┘  └───────────────────────┘  │ │
│  └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## Component Details

### 1. Client-Side (Next.js PWA)

**Technology Stack:**
- Next.js 15.5.4 (React 19, App Router)
- TypeScript 5.7.3
- @solana/wallet-adapter-react 0.15.x
- @solana/web3.js 1.95.8
- Tailwind CSS 3.4.x

**Key Features:**
- Progressive Web App (installable, offline-capable)
- Mobile Wallet Adapter (Solana Seeker integration)
- Service Worker (caching static assets)
- Responsive UI (mobile-first design)

**File Structure:**
```
nextjs-app/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # Root layout (metadata, viewport)
│   └── page.tsx           # Home page
├── components/
│   ├── features/          # Password manager components
│   │   ├── PasswordManager.tsx
│   │   ├── PasswordEntryModal.tsx
│   │   └── SubscriptionBillingPanel.tsx
│   ├── layout/            # Layout components
│   │   └── Providers.tsx  # Wallet/RPC providers
│   └── ui/                # Reusable UI components
├── lib/
│   ├── encryption.ts      # Crypto operations
│   ├── validation.ts      # Input validation
│   └── logger.ts          # Conditional logging
├── public/
│   ├── manifest.json      # PWA manifest
│   └── sw.js              # Service worker
└── sdk/                   # Copy of main SDK
    └── src/
        └── client-v2.ts   # Lockbox client
```

### 2. SDK (TypeScript)

**Location:** `sdk/src/` (and `nextjs-app/sdk/src/`)

**Core Files:**
- `client-v2.ts` - Main LockboxClient class
- `types-v2.ts` - TypeScript interfaces and enums
- `utils.ts` - Helper functions

**Key Methods:**
```typescript
class LockboxClient {
  // Initialization
  async initializeMasterLockbox(tier: SubscriptionTier): Promise<string>
  async initializeStorageChunk(index: number, capacity: number): Promise<string>

  // Password Operations
  async storePasswordEntry(chunkIndex: number, entry: PasswordEntry): Promise<string>
  async retrievePasswordEntries(chunkIndex: number): Promise<PasswordEntry[]>
  async updatePasswordEntry(chunkIndex: number, entryId: string, entry: PasswordEntry): Promise<string>
  async deletePasswordEntry(chunkIndex: number, entryId: string): Promise<string>

  // Storage Management
  async expandStorageChunk(chunkIndex: number, additionalBytes: number): Promise<string>
  async expandStorageToCapacity(targetCapacity: number): Promise<string[]>

  // Account Queries
  async getMasterLockbox(): Promise<MasterLockbox>
  async getStorageChunk(index: number): Promise<StorageChunk>

  // Subscription Management
  async upgradeSubscription(tier: SubscriptionTier): Promise<string>
  async renewSubscription(months: number): Promise<string>
  async downgradeSubscription(tier: SubscriptionTier): Promise<string>
}
```

### 3. Solana Program (Rust/Anchor)

**Location:** `programs/lockbox/src/`

**Entry Points:**
- `lib.rs` - Program entry point, instruction declarations
- `state/` - Account structures (MasterLockbox, StorageChunk, etc.)
- `instructions/` - Instruction implementations

**Key Instructions:**
```rust
// Initialization
pub fn initialize_master_lockbox(ctx: Context<InitializeMasterLockbox>) -> Result<()>
pub fn initialize_storage_chunk(ctx: Context<InitializeStorageChunk>, chunk_index: u8, initial_capacity: u32) -> Result<()>

// Password Operations
pub fn store_password_entry(ctx: Context<StorePasswordEntry>, chunk_index: u8, entry_data: Vec<u8>) -> Result<()>
pub fn update_password_entry(ctx: Context<UpdatePasswordEntry>, chunk_index: u8, entry_id: String, entry_data: Vec<u8>) -> Result<()>
pub fn delete_password_entry(ctx: Context<DeletePasswordEntry>, chunk_index: u8, entry_id: String) -> Result<()>

// Storage Management
pub fn expand_chunk(ctx: Context<ExpandChunk>, additional_size: u32) -> Result<()>

// Subscription Management
pub fn upgrade_subscription(ctx: Context<UpgradeSubscription>, new_tier: SubscriptionTier) -> Result<()>
pub fn renew_subscription(ctx: Context<RenewSubscription>, months: u16) -> Result<()>
pub fn downgrade_subscription(ctx: Context<DowngradeSubscription>, new_tier: SubscriptionTier) -> Result<()>
```

**Security Features:**
- PDA-based access control (wallet ownership enforced)
- Input validation (entry size limits, storage quotas)
- Checked arithmetic (prevents integer overflow)
- Rate limiting (recovery attempts)

---

## Data Flow

### Storing a Password

```
1. User enters password in browser
   ↓
2. SDK derives session key
   - wallet.signMessage(challenge)
   - HKDF-SHA256(signature, salt, info)
   - Output: 32-byte encryption key
   ↓
3. SDK encrypts entry
   - Plaintext: JSON.stringify(entry)
   - Nonce: crypto.randomBytes(24) // 192-bit nonce
   - Algorithm: XChaCha20-Poly1305 (AEAD)
   - Output: ciphertext || authTag (16 bytes)
   ↓
4. SDK builds transaction
   - Instruction: store_password_entry
   - Accounts:
     * master_lockbox (mut, PDA)
     * storage_chunk (mut, PDA)
     * owner (signer, mut)
     * system_program
   - Data: discriminator (8 bytes) || chunk_index (1 byte) || ciphertext
   ↓
5. Wallet signs transaction
   - Ed25519 signature with wallet private key
   - User approves in wallet UI
   ↓
6. Transaction sent to RPC
   - sendAndConfirmTransaction() via @solana/web3.js
   ↓
7. Solana validators execute
   - Verify signature (Ed25519)
   - Check PDA ownership (seeds match)
   - Validate storage quota
   - Write ciphertext to chunk account
   - Update metadata (timestamps, usage counters)
   ↓
8. Confirmation returned
   - Transaction signature (base58)
   - User sees success toast
```

### Retrieving a Password

```
1. User requests password list
   ↓
2. SDK fetches account data
   - connection.getAccountInfo(storageChunkPDA)
   - Returns: account data (raw bytes)
   ↓
3. SDK deserializes chunk
   - Parse StorageChunk struct (Anchor format)
   - Extract encrypted_data field (Vec<u8>)
   ↓
4. SDK decrypts entry
   - Derive session key (same HKDF-SHA256 process)
   - Parse ciphertext structure:
     * Nonce (24 bytes)
     * Ciphertext (variable)
     * Auth tag (16 bytes)
   - XChaCha20-Poly1305 decrypt with authentication
   - Output: plaintext JSON
   ↓
5. SDK parses entry
   - JSON.parse(plaintext)
   - Validate schema (PasswordEntry interface)
   - Return to frontend
   ↓
6. UI displays entry
   - Show in password list
   - Mask password (*****)
   - Copy button for credentials
```

---

## Security Model

### Defense in Depth

**Layer 1: Client-Side Encryption**
- XChaCha20-Poly1305 (AEAD encryption via TweetNaCl)
- HKDF-SHA256 key derivation (from wallet signatures)
- Unique 192-bit nonces (collision-resistant)
- Authenticated encryption (prevents tampering)

**Layer 2: Wallet-Based Authentication**
- Ed25519 signatures (Solana consensus requirement)
- PDA ownership (enforced by program)
- Signer constraints (Anchor type checking)

**Layer 3: On-Chain Validation**
- Entry size limits (4 KB max)
- Storage quotas (tier-based)
- Checked arithmetic (no overflows)
- Rate limiting (recovery attempts)

**Layer 4: Application Security**
- Input sanitization (control characters removed)
- Output validation (data size checks)
- Secure memory wiping (4-pass overwrite)
- Production logging disabled (conditional logger)

### Threat Model

**Protected Against:**
- ✅ Passive network observers (encrypted data)
- ✅ Active tampering (GCM authentication)
- ✅ Unauthorized access (wallet signatures)
- ✅ Storage exhaustion (quota enforcement)
- ✅ Integer overflows (checked arithmetic)
- ✅ Brute-force recovery (rate limiting)

**Not Protected Against (Out of Scope):**
- ❌ Compromised user device (keyloggers, malware)
- ❌ Stolen wallet keypair (user responsibility)
- ❌ Browser extensions with malicious access
- ❌ Quantum computing attacks (not post-quantum secure)

### Cryptographic Guarantees

**Confidentiality:**
- Adversary's advantage in distinguishing ciphertext from random: ≤ 2^-256
- Proof: AES-256 is a pseudorandom permutation under standard assumptions

**Integrity:**
- Adversary's probability of forging valid ciphertext: ≤ 2^-128
- Proof: GMAC produces 128-bit authentication tags, collision-resistant under GMAC security assumptions

**Authenticity:**
- Adversary cannot reuse ciphertext across wallets
- Proof: AAD = wallet public key; tag verification fails if AAD differs

---

## Storage Architecture

### Account Hierarchy

```
MasterLockbox (PDA)
├── Metadata
│   ├── owner: Pubkey
│   ├── subscription_tier: SubscriptionTier
│   ├── subscription_expires: i64
│   ├── storage_chunks_count: u8
│   ├── total_capacity: u64
│   ├── current_usage: u64
│   └── last_accessed: i64
│
└── StorageChunks (0..99)
    ├── StorageChunk[0] (PDA)
    │   ├── owner: Pubkey
    │   ├── chunk_index: u8
    │   ├── max_capacity: u32
    │   ├── current_size: u32
    │   └── encrypted_data: Vec<u8>
    │
    ├── StorageChunk[1] (PDA)
    │   └── ...
    │
    └── StorageChunk[n] (PDA)
        └── ...
```

### PDA Derivation

```rust
// MasterLockbox PDA
let (master_lockbox_pda, bump) = Pubkey::find_program_address(
    &[
        b"master_lockbox",
        owner.key().as_ref()
    ],
    program_id
);

// StorageChunk PDA
let (storage_chunk_pda, bump) = Pubkey::find_program_address(
    &[
        b"storage_chunk",
        master_lockbox_pda.as_ref(),
        &chunk_index.to_le_bytes()
    ],
    program_id
);
```

**Properties:**
- **Deterministic**: Same inputs → same PDA
- **Collision-resistant**: Probability ≈ 2^-256
- **Owner-specific**: Each wallet has unique vault

### Storage Expansion

**Initial Allocation:**
```rust
// Free tier: 10 KB
SubscriptionTier::Free => 10_240 bytes

// Basic tier: 100 KB
SubscriptionTier::Basic => 102_400 bytes

// Premium tier: 1 MB
SubscriptionTier::Premium => 1_048_576 bytes

// Enterprise tier: 10 MB
SubscriptionTier::Enterprise => 10_485_760 bytes
```

**Dynamic Expansion:**
```typescript
// Expand existing chunk by N bytes
await client.expandStorageChunk(chunkIndex, additionalBytes);

// Smart expansion to target capacity
await client.expandStorageToCapacity(targetCapacity);
// - Expands existing chunks first (up to 10 KB each)
// - Creates new chunks if needed
// - Returns all transaction signatures
```

**Cost Model:**
```
Rent = storage_bytes × rent_per_byte × rent_exempt_multiplier

Example (10 KB chunk):
- Storage: 10,240 bytes
- Rent per byte: ~0.00000348 SOL
- Rent exempt (2 years): ~0.071 SOL (~$10 @ $140/SOL)
```

---

## Frontend-Agnostic Design

### Interoperability Guarantees

**1. Deterministic PDAs**
```typescript
// Any frontend can derive the same addresses
const [masterPDA] = client.getMasterLockboxAddress();
const [chunkPDA] = client.getStorageChunkAddress(0);
```

**2. Standard Encryption**
```typescript
// Same key derivation across all frontends
const masterKey = pbkdf2Sync(
  wallet.secretKey + masterPassword,
  wallet.publicKey,
  100_000,
  32,
  'sha256'
);
```

**3. Common Data Format**
```typescript
interface PasswordEntry {
  id: string;
  type: PasswordEntryType;
  title: string;
  username?: string;
  password?: string;
  url?: string;
  notes?: string;
  category?: string;
  tags: string[];
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
}
```

### Example: Multiple Frontends

```typescript
// Frontend A (Next.js PWA)
const clientA = new LockboxClient(connection, wallet);
await clientA.storePasswordEntry(0, {
  title: "GitHub",
  username: "alice",
  password: "secret123"
});

// Frontend B (CLI Tool)
const clientB = new LockboxClient(connection, wallet);
const entries = await clientB.retrievePasswordEntries(0);
// Sees "GitHub" entry created by Frontend A

// Frontend C (Mobile App)
const clientC = new LockboxClient(connection, wallet);
const entry = await clientC.retrievePasswordEntry(0, "github-id");
// Decrypts "GitHub" entry with correct password
```

**All frontends work together** because they:
1. Derive same PDAs
2. Use same encryption keys
3. Read from same on-chain accounts
4. Follow same data schema

---

## Deployment Architecture

### Production Environment

**Blockchain:**
- Network: Solana Devnet
- Program ID: `7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB`
- RPC Endpoint: https://api.devnet.solana.com

**Frontend:**
- Hosting: Vercel (Edge Network)
- Domain: https://lockbox.web3stud.io
- SSL: Automatic (Vercel managed)
- CDN: Global (Vercel Edge)

**PWA:**
- Service Worker: Caches static assets
- Manifest: Installable app
- Offline Mode: Read-only access to cached data

### Infrastructure Diagram

```
┌─────────────────────────────────────────────────────┐
│             Vercel Edge Network                     │
│  (Global CDN, 100+ Edge Locations)                  │
│                                                      │
│  ┌────────────────────────────────────────────┐    │
│  │  Next.js App (Static + Server Components) │    │
│  │  - HTML/CSS/JS (cached)                    │    │
│  │  - Service Worker (offline support)        │    │
│  │  - PWA Manifest (installable)              │    │
│  └────────────────────────────────────────────┘    │
└──────────────────────┬──────────────────────────────┘
                       │
                       │ HTTPS
                       │
                       ▼
          ┌─────────────────────────┐
          │   User Browser          │
          │   (Chrome/Safari/etc)   │
          └────────┬────────────────┘
                   │
                   │ WebSocket (WSS)
                   │
                   ▼
          ┌─────────────────────────┐
          │   Solana RPC Provider   │
          │   (Helius/Triton/etc)   │
          └────────┬────────────────┘
                   │
                   │ Gossip Protocol
                   │
                   ▼
          ┌─────────────────────────┐
          │   Solana Validators     │
          │   (21+ nodes, PoS)      │
          └─────────────────────────┘
```

### Deployment Workflow

```bash
# 1. Build and test locally
npm run build
npm run test

# 2. Deploy frontend to Vercel
vercel --prod

# 3. Program already deployed (immutable)
# Program ID: 7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB

# 4. Verify deployment
curl https://lockbox.web3stud.io
```

---

## Scalability & Performance

### Performance Characteristics

| Operation | Latency | Cost |
|-----------|---------|------|
| **Password Retrieval** | ~300-500ms | FREE (RPC read) |
| **Password Save** | ~1-2s | ~0.000005 SOL (transaction fee) |
| **Vault Initialization** | ~2-3s | ~0.07 SOL (account rent) |
| **Storage Expansion** | ~2-3s | ~0.007 SOL per KB (rent) |

### Scalability Limits

**Per-Vault Limits:**
- Max chunks: 100
- Max chunk size: 10 KB
- Max total storage: 1 MB
- Est. max entries: ~250 (@ 4 KB average)

**Network Limits:**
- Solana TPS: ~65,000 (current)
- Account writes: Unlimited concurrent (different PDAs)
- Same-account writes: Sequential (Solana constraint)

### Optimization Strategies

**Client-Side:**
- ✅ Service worker caching (instant UI load)
- ✅ Lazy loading components
- ✅ Batch RPC requests (getMultipleAccounts)
- ✅ Local state management (reduce RPC calls)

**On-Chain:**
- ✅ Dynamic account sizing (pay only for used space)
- ✅ Chunked storage (parallelize reads/writes)
- ✅ Efficient serialization (Borsh format)
- ✅ Zero-copy deserialization (where possible)

**Future Optimizations:**
- ⏳ Compression (gzip encrypted data)
- ⏳ Merkle proofs (verify without downloading all)
- ⏳ L2 solutions (Shadow, Neon, etc.)

---

## Summary

Solana Lockbox is architected as a **decentralized, frontend-agnostic, zero-knowledge password manager** that leverages Solana's high-performance blockchain for secure, permanent data storage.

### Key Architectural Decisions

1. **Client-Side Encryption**
   - Blockchain never sees plaintext
   - Users maintain complete privacy
   - No trust required in infrastructure

2. **Wallet-Based Identity**
   - No separate account creation
   - PDA-based access control
   - Interoperable across frontends

3. **Zero Backend Dependencies**
   - Direct RPC communication
   - No single point of failure
   - Globally distributed (validators)

4. **Open and Auditable**
   - Open-source code (MIT license)
   - Reproducible builds
   - Comprehensive documentation

5. **Production-Ready**
   - All critical vulnerabilities fixed
   - Comprehensive testing (unit + E2E)
   - Mobile-ready PWA

---

**Version**: 2.0.0
**Last Updated**: December 29, 2024
**Maintained By**: Web3 Studios LLC
**Program ID**: `7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB`
