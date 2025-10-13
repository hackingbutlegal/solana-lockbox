# Lockbox v2.0: Decentralized Password Manager
## Pre-Production Release Specification

**Status**: Pre-Production Release Candidate
**Target Launch**: Q1 2026
**Current Version**: v0.1.0 (1KB single-entry storage)
**Next Version**: v1.0.0 (Multi-tier password manager)
**Network**: Solana Devnet → Mainnet Beta

## Executive Summary

This document specifies Lockbox v1.0, a production-ready decentralized password manager built on Solana. Version 1.0 transforms the current 1KB proof-of-concept into a fully-featured password manager capable of storing thousands of encrypted entries with enterprise-grade features including categorization, encrypted search, secure sharing, and subscription-based scaling.

**Production Goals:**
- ✅ Zero-knowledge architecture (client-side encryption only)
- ✅ Scalable storage (1KB → 1MB+ via dynamic allocation)
- ✅ Competitive feature parity with 1Password/Bitwarden
- ✅ Blockchain-native security and auditability
- ✅ Sustainable business model via SOL-based subscriptions
- ✅ Mobile-first responsive design
- ✅ Open-source and auditable

## Current State Analysis

### Existing Architecture
- **Storage**: Single PDA per user with 1KB limit
- **Encryption**: XChaCha20-Poly1305 AEAD
- **Key Derivation**: HKDF from wallet signature
- **Fee Model**: 0.001 SOL per store operation
- **Network**: Solana Devnet

### Limitations
1. **Storage**: Only ~100-150 password entries possible
2. **Organization**: No categorization or tagging
3. **Search**: No encrypted search capability
4. **Sharing**: No secure sharing mechanism
5. **Recovery**: No backup/recovery options
6. **Mobile**: Limited mobile optimization

---

## Phase 1: Multi-Tier Storage Architecture

### 1.1 Hierarchical Storage Design

#### Master Lockbox Account
```rust
#[account]
#[derive(InitSpace)]
pub struct MasterLockbox {
    /// Account owner's public key
    pub owner: Pubkey,

    /// Total number of password entries
    pub total_entries: u64,

    /// Number of storage chunks allocated
    pub storage_chunks_count: u16,

    /// Current subscription tier
    pub subscription_tier: SubscriptionTier,

    /// Unix timestamp of last access
    pub last_accessed: i64,

    /// Unix timestamp of subscription expiry
    pub subscription_expires: i64,

    /// Total storage capacity in bytes
    pub total_capacity: u64,

    /// Storage currently used in bytes
    pub storage_used: u64,

    /// References to storage chunk accounts
    #[max_len(100)] // Support up to 100 chunks (1MB total)
    pub storage_chunks: Vec<StorageChunkInfo>,

    /// Encrypted index for fast lookups (stores entry metadata)
    pub encrypted_index: Vec<u8>,

    /// Bump seed for PDA derivation
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct StorageChunkInfo {
    /// Public key of the storage chunk account
    pub chunk_address: Pubkey,

    /// Chunk sequence number (0-indexed)
    pub chunk_index: u16,

    /// Maximum capacity of this chunk
    pub max_capacity: u32,

    /// Current bytes used in this chunk
    pub size_used: u32,

    /// Type of data stored in this chunk
    pub data_type: StorageType,

    /// Creation timestamp
    pub created_at: i64,

    /// Last modification timestamp
    pub last_modified: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, InitSpace)]
pub enum StorageType {
    Passwords,      // Primary password entries
    SecureNotes,    // Encrypted notes/documents
    PaymentCards,   // Credit/debit card info
    Identities,     // Personal identity documents
    Files,          // Small encrypted files
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, InitSpace)]
pub enum SubscriptionTier {
    Free,           // 1KB - ~10 passwords
    Basic,          // 10KB - ~100 passwords
    Premium,        // 100KB - ~1000 passwords
    Enterprise,     // 1MB+ - unlimited passwords
}
```

#### Storage Chunk Account
```rust
#[account]
#[derive(InitSpace)]
pub struct StorageChunk {
    /// Reference back to master lockbox
    pub master_lockbox: Pubkey,

    /// Owner of this chunk (for verification)
    pub owner: Pubkey,

    /// Chunk sequence number
    pub chunk_index: u16,

    /// Maximum capacity (can grow via realloc)
    pub max_capacity: u32,

    /// Current size used
    pub current_size: u32,

    /// Number of entries in this chunk
    pub entry_count: u16,

    /// Encrypted data payload
    #[max_len(10240)] // Start at 10KB, can expand to 10MB
    pub encrypted_data: Vec<u8>,

    /// Entry headers for quick navigation
    #[max_len(50)] // ~50 entries per chunk initially
    pub entry_headers: Vec<DataEntryHeader>,

    /// Bump seed for PDA derivation
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct DataEntryHeader {
    /// Unique entry ID (globally unique across all chunks)
    pub entry_id: u64,

    /// Offset in encrypted_data where entry starts
    pub offset: u32,

    /// Size of encrypted entry in bytes
    pub size: u32,

    /// Type of password entry
    pub entry_type: PasswordEntryType,

    /// Category assignment
    pub category: u8, // Index into category list

    /// Encrypted title hash (for search without decryption)
    pub title_hash: [u8; 32],

    /// Creation timestamp
    pub created_at: i64,

    /// Last modification timestamp
    pub last_modified: i64,

    /// Access counter
    pub access_count: u32,

    /// Flags (favorite, deleted, archived, etc.)
    pub flags: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, InitSpace)]
pub enum PasswordEntryType {
    Login,          // Username + password + URL
    SecureNote,     // Encrypted text note
    CreditCard,     // Card details
    BankAccount,    // Bank information
    Identity,       // Personal documents
    WifiPassword,   // Network credentials
    APIKey,         // API tokens/keys
    Custom,         // User-defined type
}
```

### 1.2 Dynamic Storage Allocation

#### Progressive Expansion Logic
```rust
pub fn allocate_new_chunk(
    ctx: Context<AllocateChunk>,
    chunk_size: u32,
) -> Result<()> {
    let master = &mut ctx.accounts.master_lockbox;

    // Validate subscription tier allows more chunks
    let max_chunks = master.subscription_tier.max_chunks();
    require!(
        master.storage_chunks_count < max_chunks,
        ErrorCode::StorageLimitReached
    );

    // Validate chunk size is reasonable
    require!(
        chunk_size >= MIN_CHUNK_SIZE && chunk_size <= MAX_CHUNK_SIZE,
        ErrorCode::InvalidChunkSize
    );

    // Calculate rent for new chunk
    let rent = Rent::get()?;
    let space = StorageChunk::INIT_SPACE + chunk_size as usize;
    let lamports_required = rent.minimum_balance(space);

    // Create new chunk via CPI
    let chunk_index = master.storage_chunks_count;
    let seeds = &[
        b"storage_chunk",
        master.key().as_ref(),
        &chunk_index.to_le_bytes(),
        &[ctx.bumps.storage_chunk],
    ];

    // Initialize chunk
    let chunk = &mut ctx.accounts.storage_chunk;
    chunk.master_lockbox = master.key();
    chunk.owner = master.owner;
    chunk.chunk_index = chunk_index;
    chunk.max_capacity = chunk_size;
    chunk.current_size = 0;
    chunk.entry_count = 0;
    chunk.bump = ctx.bumps.storage_chunk;

    // Register chunk in master lockbox
    master.storage_chunks.push(StorageChunkInfo {
        chunk_address: chunk.key(),
        chunk_index,
        max_capacity: chunk_size,
        size_used: 0,
        data_type: StorageType::Passwords,
        created_at: Clock::get()?.unix_timestamp,
        last_modified: Clock::get()?.unix_timestamp,
    });

    master.storage_chunks_count += 1;
    master.total_capacity += chunk_size as u64;

    msg!("Allocated new storage chunk: {} bytes", chunk_size);

    Ok(())
}

// Expand existing chunk using realloc
pub fn expand_chunk(
    ctx: Context<ExpandChunk>,
    additional_size: u32,
) -> Result<()> {
    let chunk = &mut ctx.accounts.storage_chunk;
    let master = &mut ctx.accounts.master_lockbox;

    // Validate expansion doesn't exceed limits
    let new_size = chunk.max_capacity + additional_size;
    require!(
        new_size <= MAX_CHUNK_SIZE,
        ErrorCode::ChunkTooLarge
    );

    // Validate realloc increment (max 10KB per call)
    require!(
        additional_size <= MAX_REALLOC_INCREMENT,
        ErrorCode::ReallocTooLarge
    );

    let current_len = chunk.to_account_info().data_len();
    let new_len = current_len + additional_size as usize;

    // Calculate additional rent
    let rent = Rent::get()?;
    let additional_rent = rent.minimum_balance(new_len)
        .saturating_sub(rent.minimum_balance(current_len));

    // Transfer additional rent from user
    if additional_rent > 0 {
        invoke(
            &system_instruction::transfer(
                ctx.accounts.payer.key,
                chunk.to_account_info().key,
                additional_rent,
            ),
            &[
                ctx.accounts.payer.to_account_info(),
                chunk.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;
    }

    // Perform reallocation
    chunk.to_account_info().realloc(new_len, false)?;
    chunk.max_capacity = new_size;

    // Update master lockbox tracking
    if let Some(chunk_info) = master.storage_chunks
        .iter_mut()
        .find(|c| c.chunk_address == chunk.key())
    {
        chunk_info.max_capacity = new_size;
        chunk_info.last_modified = Clock::get()?.unix_timestamp;
    }

    master.total_capacity += additional_size as u64;

    msg!("Expanded chunk by {} bytes to {} total", additional_size, new_size);

    Ok(())
}
```

### 1.3 Storage Tier Configuration

```rust
impl SubscriptionTier {
    pub const fn max_chunks(&self) -> u16 {
        match self {
            Self::Free => 1,        // 1 chunk @ 1KB = 1KB total
            Self::Basic => 2,       // 2 chunks @ 10KB = 20KB total
            Self::Premium => 10,    // 10 chunks @ 10KB = 100KB total
            Self::Enterprise => 100, // 100 chunks @ 10KB = 1MB+ total
        }
    }

    pub const fn chunk_size(&self) -> u32 {
        match self {
            Self::Free => 1024,        // 1KB
            Self::Basic => 10_240,     // 10KB
            Self::Premium => 10_240,   // 10KB
            Self::Enterprise => 10_240, // 10KB (can expand to 10MB)
        }
    }

    pub const fn monthly_fee_lamports(&self) -> u64 {
        match self {
            Self::Free => 0,
            Self::Basic => 1_000_000,      // 0.001 SOL/month
            Self::Premium => 10_000_000,   // 0.01 SOL/month
            Self::Enterprise => 100_000_000, // 0.1 SOL/month
        }
    }

    pub const fn max_entries(&self) -> u64 {
        match self {
            Self::Free => 10,
            Self::Basic => 100,
            Self::Premium => 1000,
            Self::Enterprise => u64::MAX, // Unlimited
        }
    }

    pub const fn features(&self) -> SubscriptionFeatures {
        SubscriptionFeatures {
            basic_storage: true,
            categories: matches!(self, Self::Basic | Self::Premium | Self::Enterprise),
            search: matches!(self, Self::Premium | Self::Enterprise),
            sharing: matches!(self, Self::Premium | Self::Enterprise),
            file_attachments: matches!(self, Self::Enterprise),
            priority_support: matches!(self, Self::Enterprise),
            custom_branding: matches!(self, Self::Enterprise),
            audit_logs: matches!(self, Self::Enterprise),
            api_access: matches!(self, Self::Enterprise),
        }
    }
}

#[derive(Clone, Copy)]
pub struct SubscriptionFeatures {
    pub basic_storage: bool,
    pub categories: bool,
    pub search: bool,
    pub sharing: bool,
    pub file_attachments: bool,
    pub priority_support: bool,
    pub custom_branding: bool,
    pub audit_logs: bool,
    pub api_access: bool,
}
```

---

## Phase 2: Enhanced Password Entry Structure

### 2.1 Comprehensive Password Entry Schema

```rust
/// Complete password entry with all metadata
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct PasswordEntry {
    // Identity
    pub id: u64,
    pub version: u8, // For schema evolution

    // Classification
    pub entry_type: PasswordEntryType,
    pub category_id: u8,
    pub tags: Vec<u8>, // Bit flags for tags

    // Core encrypted fields
    pub title_encrypted: Vec<u8>,
    pub username_encrypted: Vec<u8>,
    pub password_encrypted: Vec<u8>,
    pub url_encrypted: Vec<u8>,
    pub notes_encrypted: Vec<u8>,

    // Additional encrypted fields
    pub email_encrypted: Option<Vec<u8>>,
    pub phone_encrypted: Option<Vec<u8>>,
    pub totp_secret_encrypted: Option<Vec<u8>>, // For 2FA codes
    pub recovery_codes_encrypted: Option<Vec<u8>>,

    // Metadata (unencrypted for efficient operations)
    pub created_at: i64,
    pub last_modified: i64,
    pub last_accessed: i64,
    pub access_count: u32,
    pub password_changed_at: i64,

    // Security settings
    pub security_level: SecurityLevel,
    pub requires_2fa: bool,
    pub auto_delete_after: Option<i64>,
    pub password_expiry: Option<i64>,

    // Organization
    pub folder_id: Option<u16>,
    pub is_favorite: bool,
    pub is_archived: bool,
    pub color_tag: u8, // 0-15 for visual organization

    // Sharing (if enabled)
    pub shared_with: Option<Vec<SharedWith>>,
    pub share_permissions: u8, // Bit flags

    // Attachments (for Enterprise)
    pub attachment_refs: Option<Vec<AttachmentRef>>,

    // Search optimization
    pub title_hash: [u8; 32], // Encrypted searchable hash
    pub keyword_hashes: Vec<[u8; 32]>, // For encrypted search
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum SecurityLevel {
    Standard,   // Basic XChaCha20-Poly1305
    Enhanced,   // Additional HKDF rounds
    Maximum,    // Multi-layer encryption
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct SharedWith {
    pub recipient_pubkey: Pubkey,
    pub shared_at: i64,
    pub permissions: SharePermissions,
    pub encrypted_shared_key: Vec<u8>, // Re-encrypted for recipient
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq)]
pub struct SharePermissions {
    pub can_view: bool,
    pub can_edit: bool,
    pub can_share: bool,
    pub expires_at: Option<i64>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct AttachmentRef {
    pub attachment_id: u64,
    pub file_name_encrypted: Vec<u8>,
    pub file_size: u64,
    pub storage_location: StorageLocation,
    pub content_hash: [u8; 32],
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum StorageLocation {
    OnChain(Pubkey),        // Stored in Solana account
    Arweave([u8; 32]),      // Arweave transaction ID
    IPFS([u8; 32]),         // IPFS CID
    ShadowDrive([u8; 32]),  // Shadow Drive reference
}
```

### 2.2 Category Management

```rust
#[account]
pub struct CategoryRegistry {
    pub owner: Pubkey,
    pub categories: Vec<Category>,
    pub next_category_id: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct Category {
    pub id: u8,
    pub name_encrypted: Vec<u8>,
    pub icon: u8, // Icon identifier
    pub color: u8, // Color code
    pub parent_id: Option<u8>, // For hierarchical categories
    pub entry_count: u32,
    pub created_at: i64,
}

// Pre-defined default categories
impl Category {
    pub fn default_categories() -> Vec<Self> {
        vec![
            Category::new(0, "Personal", 0, 1),
            Category::new(1, "Work", 1, 2),
            Category::new(2, "Financial", 2, 3),
            Category::new(3, "Social Media", 3, 4),
            Category::new(4, "Shopping", 4, 5),
            Category::new(5, "Entertainment", 5, 6),
            Category::new(6, "Development", 6, 7),
            Category::new(7, "Education", 7, 8),
        ]
    }
}
```

---

## Phase 3: Encrypted Search & Indexing

### 3.1 Searchable Encryption with Blind Indexes

```rust
#[account]
pub struct SearchIndex {
    pub owner: Pubkey,
    pub keyword_count: u32,
    #[max_len(1000)]
    pub blind_indexes: Vec<BlindIndexEntry>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct BlindIndexEntry {
    /// HMAC of keyword with user's search key
    pub keyword_hash: [u8; 32],

    /// Entry IDs containing this keyword
    pub entry_ids: Vec<u64>,

    /// Frequency (for relevance ranking)
    pub frequency: u32,
}

// Client-side search implementation
impl SearchIndex {
    /// Generate blind index hash for search
    pub fn hash_keyword(keyword: &str, search_key: &[u8; 32]) -> [u8; 32] {
        use hmac::{Hmac, Mac};
        use sha2::Sha256;

        let mut mac = Hmac::<Sha256>::new_from_slice(search_key)
            .expect("HMAC can take key of any size");
        mac.update(keyword.to_lowercase().as_bytes());

        let result = mac.finalize();
        let bytes = result.into_bytes();

        let mut hash = [0u8; 32];
        hash.copy_from_slice(&bytes);
        hash
    }

    /// Add entry to search index
    pub fn index_entry(
        &mut self,
        entry_id: u64,
        keywords: Vec<String>,
        search_key: &[u8; 32],
    ) -> Result<()> {
        for keyword in keywords {
            let keyword_hash = Self::hash_keyword(&keyword, search_key);

            if let Some(index) = self.blind_indexes.iter_mut()
                .find(|i| i.keyword_hash == keyword_hash)
            {
                // Update existing index
                if !index.entry_ids.contains(&entry_id) {
                    index.entry_ids.push(entry_id);
                    index.frequency += 1;
                }
            } else {
                // Create new index
                self.blind_indexes.push(BlindIndexEntry {
                    keyword_hash,
                    entry_ids: vec![entry_id],
                    frequency: 1,
                });
                self.keyword_count += 1;
            }
        }

        Ok(())
    }
}
```

### 3.2 Fuzzy Search Implementation

```typescript
// Client-side TypeScript implementation
class FuzzySearchManager {
  private searchKey: Uint8Array;

  constructor(walletSignature: Uint8Array) {
    // Derive search key from wallet signature
    this.searchKey = this.deriveSearchKey(walletSignature);
  }

  private deriveSearchKey(signature: Uint8Array): Uint8Array {
    return hkdf(
      signature,
      new TextEncoder().encode('lockbox-search-key'),
      32
    );
  }

  // Generate search tokens with fuzzy matching
  async generateSearchTokens(query: string): Promise<Uint8Array[]> {
    const tokens: string[] = [];
    const normalized = query.toLowerCase().trim();

    // Exact match
    tokens.push(normalized);

    // Prefix matching (for autocomplete)
    for (let i = 1; i <= normalized.length; i++) {
      tokens.push(normalized.substring(0, i));
    }

    // Trigrams (for typo tolerance)
    for (let i = 0; i <= normalized.length - 3; i++) {
      tokens.push(normalized.substring(i, i + 3));
    }

    // Generate blind index hashes
    const hashes = await Promise.all(
      tokens.map(token => this.hashKeyword(token))
    );

    return hashes;
  }

  private async hashKeyword(keyword: string): Promise<Uint8Array> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      this.searchKey,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(keyword)
    );

    return new Uint8Array(signature);
  }

  // Search on-chain index
  async searchEntries(
    query: string,
    searchIndex: SearchIndex
  ): Promise<SearchResult[]> {
    const searchTokens = await this.generateSearchTokens(query);
    const matchedEntryIds = new Map<number, number>(); // entryId -> score

    // Find matching blind indexes
    for (const token of searchTokens) {
      const matchingIndexes = searchIndex.blind_indexes.filter(
        index => this.buffersEqual(index.keyword_hash, token)
      );

      for (const index of matchingIndexes) {
        for (const entryId of index.entry_ids) {
          const currentScore = matchedEntryIds.get(entryId) || 0;
          matchedEntryIds.set(entryId, currentScore + index.frequency);
        }
      }
    }

    // Sort by relevance score
    return Array.from(matchedEntryIds.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([entryId, score]) => ({ entryId, score }));
  }

  private buffersEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }
}

interface SearchResult {
  entryId: number;
  score: number;
}
```

---

## Phase 4: Secure Sharing & Collaboration

### 4.1 Encrypted Sharing Protocol

```rust
#[account]
pub struct SharedVault {
    pub vault_id: u64,
    pub owner: Pubkey,
    pub created_at: i64,
    pub expires_at: Option<i64>,
    pub share_count: u16,
    pub shares: Vec<VaultShare>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct VaultShare {
    pub recipient: Pubkey,
    pub permissions: SharePermissions,
    pub encrypted_vault_key: Vec<u8>, // Vault key encrypted with recipient's pubkey
    pub shared_at: i64,
    pub last_accessed: Option<i64>,
    pub access_count: u32,
}

pub fn share_entry(
    ctx: Context<ShareEntry>,
    entry_id: u64,
    recipient: Pubkey,
    permissions: SharePermissions,
    encrypted_share_key: Vec<u8>,
) -> Result<()> {
    let master = &mut ctx.accounts.master_lockbox;
    let shared_vault = &mut ctx.accounts.shared_vault;

    // Verify owner is sharing their own entry
    require!(
        master.owner == ctx.accounts.owner.key(),
        ErrorCode::Unauthorized
    );

    // Verify Premium/Enterprise subscription
    require!(
        matches!(master.subscription_tier, SubscriptionTier::Premium | SubscriptionTier::Enterprise),
        ErrorCode::FeatureNotAvailable
    );

    // Verify entry exists
    let entry_exists = master.storage_chunks.iter()
        .any(|chunk| {
            // Would need to check chunk contents
            true // Simplified for example
        });
    require!(entry_exists, ErrorCode::EntryNotFound);

    // Add share record
    shared_vault.shares.push(VaultShare {
        recipient,
        permissions,
        encrypted_vault_key: encrypted_share_key,
        shared_at: Clock::get()?.unix_timestamp,
        last_accessed: None,
        access_count: 0,
    });

    shared_vault.share_count += 1;

    emit!(EntryShared {
        entry_id,
        owner: master.owner,
        recipient,
        permissions,
    });

    Ok(())
}

// Revoke share access
pub fn revoke_share(
    ctx: Context<RevokeShare>,
    entry_id: u64,
    recipient: Pubkey,
) -> Result<()> {
    let shared_vault = &mut ctx.accounts.shared_vault;

    // Verify ownership
    require!(
        shared_vault.owner == ctx.accounts.owner.key(),
        ErrorCode::Unauthorized
    );

    // Remove share
    shared_vault.shares.retain(|share| share.recipient != recipient);
    shared_vault.share_count = shared_vault.shares.len() as u16;

    emit!(ShareRevoked {
        entry_id,
        owner: shared_vault.owner,
        recipient,
    });

    Ok(())
}
```

### 4.2 Client-Side Re-encryption for Sharing

```typescript
// Asymmetric encryption for sharing
class SharingManager {
  // Share an entry with another user
  async shareEntry(
    entry: PasswordEntry,
    recipientPublicKey: PublicKey,
    ownerKeypair: Keypair
  ): Promise<SharePackage> {
    // 1. Decrypt entry with owner's key
    const decryptedEntry = await this.decryptEntry(entry, ownerKeypair);

    // 2. Generate ephemeral shared key for this entry
    const sharedKey = nacl.randomBytes(32);

    // 3. Encrypt entry with shared key
    const encryptedForSharing = this.encryptWithSharedKey(
      decryptedEntry,
      sharedKey
    );

    // 4. Encrypt shared key with recipient's public key
    // Using X25519 key exchange
    const recipientX25519 = this.ed25519ToX25519PublicKey(
      recipientPublicKey.toBytes()
    );
    const ownerX25519Secret = this.ed25519ToX25519SecretKey(
      ownerKeypair.secretKey
    );

    const encryptedSharedKey = nacl.box(
      sharedKey,
      nacl.randomBytes(24),
      recipientX25519,
      ownerX25519Secret
    );

    return {
      encryptedEntry: encryptedForSharing,
      encryptedSharedKey,
      sender: ownerKeypair.publicKey,
      recipient: recipientPublicKey,
    };
  }

  // Retrieve shared entry
  async retrieveSharedEntry(
    sharePackage: SharePackage,
    recipientKeypair: Keypair
  ): Promise<PasswordEntry> {
    // 1. Decrypt shared key using recipient's private key
    const senderX25519 = this.ed25519ToX25519PublicKey(
      sharePackage.sender.toBytes()
    );
    const recipientX25519Secret = this.ed25519ToX25519SecretKey(
      recipientKeypair.secretKey
    );

    const sharedKey = nacl.box.open(
      sharePackage.encryptedSharedKey,
      sharePackage.nonce,
      senderX25519,
      recipientX25519Secret
    );

    if (!sharedKey) {
      throw new Error('Failed to decrypt shared key');
    }

    // 2. Decrypt entry with shared key
    return this.decryptWithSharedKey(
      sharePackage.encryptedEntry,
      sharedKey
    );
  }

  private ed25519ToX25519PublicKey(ed25519Key: Uint8Array): Uint8Array {
    // Convert Ed25519 public key to X25519 (Curve25519)
    // Implementation would use crypto library
    return ed25519Key; // Simplified
  }

  private ed25519ToX25519SecretKey(ed25519Secret: Uint8Array): Uint8Array {
    // Convert Ed25519 secret key to X25519
    return nacl.hash(ed25519Secret).slice(0, 32);
  }
}

interface SharePackage {
  encryptedEntry: Uint8Array;
  encryptedSharedKey: Uint8Array;
  nonce: Uint8Array;
  sender: PublicKey;
  recipient: PublicKey;
}
```

---

## Phase 5: Subscription & Payment System

### 5.1 Subscription Management

```rust
#[account]
pub struct SubscriptionManager {
    pub authority: Pubkey,
    pub total_subscribers: u64,
    pub total_revenue: u64,
    pub active_subscriptions: Vec<Subscription>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct Subscription {
    pub user: Pubkey,
    pub tier: SubscriptionTier,
    pub started_at: i64,
    pub expires_at: i64,
    pub auto_renew: bool,
    pub payment_history: Vec<PaymentRecord>,
    pub status: SubscriptionStatus,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum SubscriptionStatus {
    Active,
    PendingRenewal,
    Expired,
    Cancelled,
    Suspended,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct PaymentRecord {
    pub amount: u64,
    pub paid_at: i64,
    pub period_start: i64,
    pub period_end: i64,
    pub transaction_signature: String,
}

// Subscribe to a tier
pub fn subscribe(
    ctx: Context<Subscribe>,
    tier: SubscriptionTier,
    auto_renew: bool,
) -> Result<()> {
    let master = &mut ctx.accounts.master_lockbox;
    let subscription_manager = &mut ctx.accounts.subscription_manager;

    // Calculate payment amount
    let payment_amount = tier.monthly_fee_lamports();

    // Transfer payment
    invoke(
        &system_instruction::transfer(
            ctx.accounts.user.key,
            subscription_manager.key(),
            payment_amount,
        ),
        &[
            ctx.accounts.user.to_account_info(),
            subscription_manager.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        ],
    )?;

    // Calculate subscription period
    let now = Clock::get()?.unix_timestamp;
    let expires_at = now + (30 * 24 * 60 * 60); // 30 days

    // Update master lockbox
    master.subscription_tier = tier;
    master.subscription_expires = expires_at;

    // Record subscription
    let subscription = Subscription {
        user: master.owner,
        tier,
        started_at: now,
        expires_at,
        auto_renew,
        payment_history: vec![PaymentRecord {
            amount: payment_amount,
            paid_at: now,
            period_start: now,
            period_end: expires_at,
            transaction_signature: ctx.accounts.recent_blockhashes
                .clone()
                .unwrap_or_default(),
        }],
        status: SubscriptionStatus::Active,
    };

    subscription_manager.active_subscriptions.push(subscription);
    subscription_manager.total_subscribers += 1;
    subscription_manager.total_revenue += payment_amount;

    emit!(SubscriptionCreated {
        user: master.owner,
        tier,
        expires_at,
    });

    Ok(())
}

// Renew subscription
pub fn renew_subscription(
    ctx: Context<RenewSubscription>,
) -> Result<()> {
    let master = &ctx.accounts.master_lockbox;
    let subscription_manager = &mut ctx.accounts.subscription_manager;

    // Find active subscription
    let subscription = subscription_manager.active_subscriptions
        .iter_mut()
        .find(|s| s.user == master.owner && s.auto_renew)
        .ok_or(ErrorCode::SubscriptionNotFound)?;

    // Verify subscription is expiring soon
    let now = Clock::get()?.unix_timestamp;
    require!(
        now >= subscription.expires_at - (7 * 24 * 60 * 60), // 7 days before expiry
        ErrorCode::TooEarlyToRenew
    );

    // Calculate payment
    let payment_amount = subscription.tier.monthly_fee_lamports();

    // Transfer payment
    invoke(
        &system_instruction::transfer(
            ctx.accounts.user.key,
            subscription_manager.key(),
            payment_amount,
        ),
        &[
            ctx.accounts.user.to_account_info(),
            subscription_manager.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        ],
    )?;

    // Extend subscription
    let new_expires_at = subscription.expires_at + (30 * 24 * 60 * 60);
    subscription.expires_at = new_expires_at;
    subscription.status = SubscriptionStatus::Active;

    // Record payment
    subscription.payment_history.push(PaymentRecord {
        amount: payment_amount,
        paid_at: now,
        period_start: subscription.expires_at,
        period_end: new_expires_at,
        transaction_signature: String::new(),
    });

    subscription_manager.total_revenue += payment_amount;

    emit!(SubscriptionRenewed {
        user: master.owner,
        expires_at: new_expires_at,
    });

    Ok(())
}
```

### 5.2 Revenue Distribution

```rust
pub fn withdraw_revenue(
    ctx: Context<WithdrawRevenue>,
    amount: u64,
) -> Result<()> {
    let subscription_manager = &ctx.accounts.subscription_manager;

    // Verify authority
    require!(
        subscription_manager.authority == ctx.accounts.authority.key(),
        ErrorCode::Unauthorized
    );

    // Verify sufficient balance
    let balance = subscription_manager.to_account_info().lamports();
    require!(
        balance >= amount,
        ErrorCode::InsufficientFunds
    );

    // Transfer funds
    **subscription_manager.to_account_info().try_borrow_mut_lamports()? -= amount;
    **ctx.accounts.authority.to_account_info().try_borrow_mut_lamports()? += amount;

    emit!(RevenueWithdrawn {
        amount,
        authority: ctx.accounts.authority.key(),
    });

    Ok(())
}
```

---

## Phase 6: Advanced Features

### 6.1 Password Generator Integration

```typescript
class PasswordGenerator {
  static generate(options: PasswordOptions): string {
    const {
      length = 16,
      includeUppercase = true,
      includeLowercase = true,
      includeNumbers = true,
      includeSymbols = true,
      excludeAmbiguous = true,
      customCharset = '',
    } = options;

    let charset = customCharset;

    if (!customCharset) {
      if (includeLowercase) {
        charset += excludeAmbiguous
          ? 'abcdefghjkmnpqrstuvwxyz'  // Exclude i, l, o
          : 'abcdefghijklmnopqrstuvwxyz';
      }
      if (includeUppercase) {
        charset += excludeAmbiguous
          ? 'ABCDEFGHJKLMNPQRSTUVWXYZ'  // Exclude I, O
          : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      }
      if (includeNumbers) {
        charset += excludeAmbiguous
          ? '23456789'  // Exclude 0, 1
          : '0123456789';
      }
      if (includeSymbols) {
        charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';
      }
    }

    if (charset.length === 0) {
      throw new Error('Charset cannot be empty');
    }

    // Use crypto.getRandomValues for cryptographic randomness
    const randomBytes = new Uint8Array(length);
    crypto.getRandomValues(randomBytes);

    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset[randomBytes[i] % charset.length];
    }

    return password;
  }

  static assessStrength(password: string): PasswordStrength {
    let score = 0;

    // Length scoring
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    if (password.length >= 16) score += 1;

    // Character variety scoring
    if (/[a-z]/.test(password)) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^a-zA-Z0-9]/.test(password)) score += 1;

    // Common patterns penalty
    if (/(.)\1{2,}/.test(password)) score -= 1; // Repeated characters
    if (/123|abc|qwerty/i.test(password)) score -= 1; // Common sequences

    return {
      score: Math.max(0, Math.min(5, score)),
      label: this.getStrengthLabel(score),
      suggestions: this.getSuggestions(password, score),
    };
  }

  private static getStrengthLabel(score: number): string {
    if (score <= 1) return 'Very Weak';
    if (score === 2) return 'Weak';
    if (score === 3) return 'Fair';
    if (score === 4) return 'Strong';
    return 'Very Strong';
  }

  private static getSuggestions(password: string, score: number): string[] {
    const suggestions: string[] = [];

    if (password.length < 12) {
      suggestions.push('Increase length to at least 12 characters');
    }
    if (!/[a-z]/.test(password)) {
      suggestions.push('Add lowercase letters');
    }
    if (!/[A-Z]/.test(password)) {
      suggestions.push('Add uppercase letters');
    }
    if (!/[0-9]/.test(password)) {
      suggestions.push('Add numbers');
    }
    if (!/[^a-zA-Z0-9]/.test(password)) {
      suggestions.push('Add special characters');
    }

    return suggestions;
  }
}

interface PasswordOptions {
  length?: number;
  includeUppercase?: boolean;
  includeLowercase?: boolean;
  includeNumbers?: boolean;
  includeSymbols?: boolean;
  excludeAmbiguous?: boolean;
  customCharset?: string;
}

interface PasswordStrength {
  score: number;
  label: string;
  suggestions: string[];
}
```

### 6.2 TOTP (2FA) Code Generation

```typescript
class TOTPManager {
  // Generate TOTP code
  static generate(secret: string, timeStep: number = 30): string {
    const epoch = Math.floor(Date.now() / 1000);
    const counter = Math.floor(epoch / timeStep);

    // Decode base32 secret
    const key = this.base32Decode(secret);

    // Generate HMAC-SHA1
    const hmac = this.hmacSHA1(key, this.intToBytes(counter));

    // Dynamic truncation
    const offset = hmac[hmac.length - 1] & 0x0f;
    const code = (
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff)
    ) % 1000000;

    // Pad to 6 digits
    return code.toString().padStart(6, '0');
  }

  // Verify TOTP code
  static verify(
    secret: string,
    code: string,
    timeStep: number = 30,
    window: number = 1
  ): boolean {
    const epoch = Math.floor(Date.now() / 1000);
    const counter = Math.floor(epoch / timeStep);

    // Check current and adjacent time windows
    for (let i = -window; i <= window; i++) {
      const testCounter = counter + i;
      const key = this.base32Decode(secret);
      const hmac = this.hmacSHA1(key, this.intToBytes(testCounter));

      const offset = hmac[hmac.length - 1] & 0x0f;
      const testCode = (
        ((hmac[offset] & 0x7f) << 24) |
        ((hmac[offset + 1] & 0xff) << 16) |
        ((hmac[offset + 2] & 0xff) << 8) |
        (hmac[offset + 3] & 0xff)
      ) % 1000000;

      if (testCode.toString().padStart(6, '0') === code) {
        return true;
      }
    }

    return false;
  }

  private static base32Decode(encoded: string): Uint8Array {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const clean = encoded.toUpperCase().replace(/=+$/, '');
    const bits = clean.split('').map(c => alphabet.indexOf(c).toString(2).padStart(5, '0')).join('');

    const bytes: number[] = [];
    for (let i = 0; i < bits.length; i += 8) {
      if (bits.length - i >= 8) {
        bytes.push(parseInt(bits.substr(i, 8), 2));
      }
    }

    return new Uint8Array(bytes);
  }

  private static async hmacSHA1(key: Uint8Array, message: Uint8Array): Promise<Uint8Array> {
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', cryptoKey, message);
    return new Uint8Array(signature);
  }

  private static intToBytes(num: number): Uint8Array {
    const bytes = new Uint8Array(8);
    for (let i = 7; i >= 0; i--) {
      bytes[i] = num & 0xff;
      num = num >> 8;
    }
    return bytes;
  }
}
```

### 6.3 Password Health Dashboard

```typescript
interface PasswordHealth {
  totalPasswords: number;
  weakPasswords: number;
  reusedPasswords: number;
  oldPasswords: number;
  exposedPasswords: number;
  overallScore: number;
}

class PasswordHealthAnalyzer {
  analyze(entries: PasswordEntry[]): PasswordHealth {
    const decryptedPasswords = new Map<string, number>(); // password -> count
    let weakCount = 0;
    let oldCount = 0;
    const now = Date.now() / 1000;

    for (const entry of entries) {
      // Decrypt password for analysis (only on client side)
      const password = this.decryptPassword(entry.password_encrypted);

      // Check strength
      const strength = PasswordGenerator.assessStrength(password);
      if (strength.score <= 2) {
        weakCount++;
      }

      // Check age (>90 days = old)
      const age = now - entry.password_changed_at;
      if (age > 90 * 24 * 60 * 60) {
        oldCount++;
      }

      // Track reuse
      const count = decryptedPasswords.get(password) || 0;
      decryptedPasswords.set(password, count + 1);
    }

    // Count reused passwords
    const reusedCount = Array.from(decryptedPasswords.values())
      .filter(count => count > 1).length;

    // Calculate overall score (0-100)
    const totalPasswords = entries.length;
    const weakPercent = (weakCount / totalPasswords) * 100;
    const reusedPercent = (reusedCount / totalPasswords) * 100;
    const oldPercent = (oldCount / totalPasswords) * 100;

    const overallScore = Math.max(0, 100 - weakPercent - reusedPercent - (oldPercent / 2));

    return {
      totalPasswords,
      weakPasswords: weakCount,
      reusedPasswords: reusedCount,
      oldPasswords: oldCount,
      exposedPasswords: 0, // Would check against breach databases
      overallScore: Math.round(overallScore),
    };
  }

  private decryptPassword(encrypted: Uint8Array): string {
    // Implementation depends on encryption scheme
    return '';
  }
}
```

---

## Phase 7: Blockchain-Native Innovations

### 7.1 Social Recovery via Threshold Cryptography

**The Problem**: Wallet loss = permanent loss of all passwords (fatal flaw of Web3)

**The Solution**: Shamir Secret Sharing + Guardian Network

#### Guardian System Architecture

```rust
#[account]
pub struct RecoveryConfig {
    pub owner: Pubkey,
    pub threshold: u8,                    // M of N (e.g., 3 of 5)
    pub total_guardians: u8,              // N
    pub guardians: Vec<Guardian>,
    pub recovery_delay: i64,              // Mandatory delay (e.g., 7 days)
    pub created_at: i64,
    pub last_modified: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct Guardian {
    pub guardian_pubkey: Pubkey,
    pub share_index: u8,
    pub encrypted_share: Vec<u8>,         // Encrypted with guardian's public key
    pub added_at: i64,
    pub nickname_encrypted: Vec<u8>,      // "Mom", "Best Friend", etc.
    pub status: GuardianStatus,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum GuardianStatus {
    Active,
    PendingAcceptance,
    Revoked,
}

#[account]
pub struct RecoveryRequest {
    pub owner: Pubkey,
    pub requester: Pubkey,                // Guardian who initiated recovery
    pub requested_at: i64,
    pub ready_at: i64,                    // After delay period
    pub approvals: Vec<RecoveryApproval>,
    pub status: RecoveryStatus,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct RecoveryApproval {
    pub guardian: Pubkey,
    pub share_decrypted: Vec<u8>,         // Guardian's share (verified)
    pub approved_at: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum RecoveryStatus {
    Pending,
    ReadyForReconstruction,
    Completed,
    Cancelled,
}
```

#### Key Features:
1. **Shamir Secret Sharing (M-of-N)**
   - Owner chooses threshold (e.g., 3-of-5, 2-of-3)
   - Master key split into N shares
   - Any M shares can reconstruct the key
   - Individual shares reveal nothing

2. **Guardian Management**
   - Add/remove guardians at any time
   - Guardians accept invitation via on-chain transaction
   - Each guardian receives encrypted share (only they can decrypt)
   - Supports nicknames for easy identification

3. **Recovery Process with Time-Lock**
   - Guardian initiates recovery request
   - Mandatory waiting period (e.g., 7 days)
   - Owner receives notifications and can cancel
   - After delay, M guardians submit their shares
   - Shares reconstructed on-chain into master key
   - New wallet can claim ownership

4. **Security Properties**
   - Guardians never see plaintext shares
   - Shares encrypted with guardian's public key (X25519)
   - Time-lock prevents instant takeover
   - Owner can cancel recovery if wallet is recovered
   - Audit trail of all recovery attempts

**Client-Side Implementation:**

```typescript
class SocialRecoveryManager {
  // Split master key into shares
  async createRecoveryConfig(
    masterKey: Uint8Array,
    guardians: PublicKey[],
    threshold: number
  ): Promise<RecoveryConfig> {
    // Use Shamir's Secret Sharing
    const shares = shamirSplit(masterKey, threshold, guardians.length);

    const guardianShares = await Promise.all(
      guardians.map(async (guardianPubkey, index) => {
        // Encrypt share with guardian's public key
        const encryptedShare = await this.encryptForGuardian(
          shares[index],
          guardianPubkey
        );

        return {
          guardian_pubkey: guardianPubkey,
          share_index: index,
          encrypted_share: encryptedShare,
          added_at: Date.now() / 1000,
          status: GuardianStatus.PendingAcceptance,
        };
      })
    );

    // Store on-chain
    return await this.client.setupRecovery(guardianShares, threshold);
  }

  // Guardian accepts their role
  async acceptGuardianship(recoveryConfig: RecoveryConfig): Promise<void> {
    // Guardian signs acceptance
    await this.client.acceptGuardian(recoveryConfig.owner);
  }

  // Initiate recovery (called by guardian)
  async initiateRecovery(
    ownerPubkey: PublicKey,
    myShare: Uint8Array
  ): Promise<RecoveryRequest> {
    return await this.client.requestRecovery(ownerPubkey, myShare);
  }

  // Owner cancels recovery
  async cancelRecovery(request: RecoveryRequest): Promise<void> {
    await this.client.cancelRecovery(request.requester);
  }

  // Guardian approves recovery after time-lock
  async approveRecovery(
    request: RecoveryRequest,
    myShare: Uint8Array
  ): Promise<void> {
    await this.client.submitShare(request.owner, myShare);
  }

  // Reconstruct master key from M shares
  async reconstructMasterKey(
    approvals: RecoveryApproval[]
  ): Promise<Uint8Array> {
    const shares = approvals.map(a => a.share_decrypted);
    return shamirRecombine(shares);
  }

  private async encryptForGuardian(
    share: Uint8Array,
    guardianPubkey: PublicKey
  ): Promise<Uint8Array> {
    // X25519 encryption (similar to sharing protocol)
    const guardianX25519 = ed25519ToX25519PublicKey(guardianPubkey);
    const ephemeralKeypair = nacl.box.keyPair();

    const nonce = nacl.randomBytes(24);
    const encrypted = nacl.box(
      share,
      nonce,
      guardianX25519,
      ephemeralKeypair.secretKey
    );

    return Buffer.concat([ephemeralKeypair.publicKey, nonce, encrypted]);
  }
}
```

### 7.2 Time-Locked Emergency Access

**The Problem**: What happens to your passwords when you're incapacitated?

**The Solution**: Dead Man's Switch with Time-Lock

#### Emergency Access Architecture

```rust
#[account]
pub struct EmergencyAccess {
    pub owner: Pubkey,
    pub emergency_contacts: Vec<EmergencyContact>,
    pub inactivity_period: i64,           // e.g., 90 days
    pub last_activity: i64,
    pub countdown_started: Option<i64>,   // When countdown began
    pub status: EmergencyStatus,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct EmergencyContact {
    pub contact_pubkey: Pubkey,
    pub contact_name_encrypted: Vec<u8>,  // "Spouse", "Lawyer", etc.
    pub access_level: EmergencyAccessLevel,
    pub encrypted_key: Vec<u8>,           // Emergency access key
    pub added_at: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum EmergencyAccessLevel {
    ViewOnly,          // Can view specified entries
    FullAccess,        // Can view and export all entries
    TransferOwnership, // Can take full ownership
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum EmergencyStatus {
    Active,            // Normal operation
    CountdownStarted,  // No activity, countdown in progress
    EmergencyActive,   // Emergency access granted
    Cancelled,         // Owner cancelled countdown
}

pub fn check_and_activate_emergency(
    ctx: Context<CheckEmergency>,
) -> Result<()> {
    let emergency_access = &mut ctx.accounts.emergency_access;
    let now = Clock::get()?.unix_timestamp;

    // Check if enough time has passed since last activity
    if now - emergency_access.last_activity >= emergency_access.inactivity_period {
        if emergency_access.countdown_started.is_none() {
            // Start countdown
            emergency_access.countdown_started = Some(now);
            emergency_access.status = EmergencyStatus::CountdownStarted;

            emit!(EmergencyCountdownStarted {
                owner: emergency_access.owner,
                ready_at: now + EMERGENCY_GRACE_PERIOD,
            });
        } else {
            // Check if grace period has elapsed
            let countdown_start = emergency_access.countdown_started.unwrap();
            if now - countdown_start >= EMERGENCY_GRACE_PERIOD {
                // Activate emergency access
                emergency_access.status = EmergencyStatus::EmergencyActive;

                emit!(EmergencyAccessActivated {
                    owner: emergency_access.owner,
                    contacts: emergency_access.emergency_contacts.len() as u16,
                });
            }
        }
    }

    Ok(())
}

pub fn record_activity(
    ctx: Context<RecordActivity>,
) -> Result<()> {
    let emergency_access = &mut ctx.accounts.emergency_access;

    // Owner is active, reset everything
    emergency_access.last_activity = Clock::get()?.unix_timestamp;
    emergency_access.countdown_started = None;
    emergency_access.status = EmergencyStatus::Active;

    Ok(())
}
```

#### Key Features:
1. **Inactivity Detection**
   - User sets inactivity period (e.g., 90 days)
   - Every password operation updates last_activity
   - Cron job checks for inactivity

2. **Two-Stage Countdown**
   - Stage 1: Inactivity detected → countdown starts
   - Owner gets email/SMS notifications
   - Grace period (e.g., 7 days) to cancel
   - Stage 2: Grace period expires → emergency access granted

3. **Emergency Contacts**
   - Owner designates trusted contacts
   - Each contact has specific access level
   - Contacts receive encrypted emergency keys
   - Access automatically revokes when owner returns

4. **Activity Tracking**
   - Every password operation extends countdown
   - Manual "I'm alive" button in UI
   - Activity notifications to emergency contacts

### 7.3 Gasless Transactions via Subscription Pool

**The Problem**: Users need SOL for every password operation (friction)

**The Solution**: Transaction Delegation + Prepaid Pool

#### Gasless Transaction Architecture

```rust
#[account]
pub struct GaslessPool {
    pub authority: Pubkey,
    pub total_funded: u64,
    pub total_spent: u64,
    pub active_subscriptions: u32,
    pub transactions_this_month: u64,
}

#[account]
pub struct UserGaslessAccount {
    pub owner: Pubkey,
    pub subscription_tier: SubscriptionTier,
    pub transactions_used: u32,
    pub transactions_limit: u32,      // Based on tier
    pub last_reset: i64,
}

// User signs transaction, but doesn't pay gas
pub fn gasless_store_password(
    ctx: Context<GaslessStorePassword>,
    encrypted_data: Vec<u8>,
    // ... other params
) -> Result<()> {
    let gasless_account = &mut ctx.accounts.user_gasless_account;

    // Verify user has subscription
    require!(
        matches!(
            gasless_account.subscription_tier,
            SubscriptionTier::Basic | SubscriptionTier::Premium | SubscriptionTier::Enterprise
        ),
        ErrorCode::GaslessNotAvailable
    );

    // Check transaction limit
    require!(
        gasless_account.transactions_used < gasless_account.transactions_limit,
        ErrorCode::GaslessLimitExceeded
    );

    // Gas paid from pool account
    let pool = &mut ctx.accounts.gasless_pool;
    pool.total_spent += AVERAGE_TRANSACTION_COST;
    pool.transactions_this_month += 1;

    // Increment user's usage
    gasless_account.transactions_used += 1;

    // Perform actual password storage
    // ... (same logic as regular store_password)

    Ok(())
}
```

#### Key Features:
1. **Transaction Limits by Tier**
   - Free: 0 gasless transactions
   - Basic: 100 gasless transactions/month
   - Premium: 1,000 gasless transactions/month
   - Enterprise: Unlimited gasless transactions

2. **Pool Funding**
   - Protocol maintains pool of SOL
   - Funded from subscription revenue
   - Auto-refills when depleted
   - Transparent on-chain accounting

3. **UX Flow**
   - User clicks "Store Password"
   - Wallet prompts for signature (NOT payment)
   - Transaction submitted via RPC
   - Gas deducted from pool
   - User sees instant confirmation

4. **Abuse Prevention**
   - Rate limiting per user (e.g., max 10 tx/minute)
   - Monthly transaction caps
   - Automatic suspension for suspicious activity
   - Pool draining protection

---

## Implementation Roadmap (REVISED)

### Phase 1-3: Foundation & Core Features (✅ COMPLETE)
- [x] Multi-tier storage architecture
- [x] Dynamic chunk allocation and realloc
- [x] Subscription tier system with UI
- [x] Password entry schema with versioning
- [x] Category management
- [x] Client-side encryption (XChaCha20-Poly1305)
- [x] Session management with timeout
- [x] Storage usage monitoring

### Phase 4: Search & Intelligence (Q1 2026 - NEXT)
- [ ] **Blind Index Search System**
  - HMAC-based keyword hashing
  - Trigram fuzzy matching
  - Prefix search for autocomplete
- [ ] **Smart Filters**
  - Recently used entries
  - Weak passwords
  - Old passwords (>90 days)
  - Duplicate passwords
  - Favorited entries
- [ ] **Password Health Dashboard**
  - Individual security score
  - Weak/reused/old password detection
  - Password strength analyzer
  - Breach detection (HaveIBeenPwned API)
- [ ] **Batch Operations**
  - Import from CSV/JSON
  - Export encrypted vault
  - Bulk update categories
  - Bulk delete archived entries

**Timeline**: 6-8 weeks
**Priority**: HIGH - Core functionality users expect

### Phase 5: Social Recovery & Emergency Access (Q1 2026) 🔥
- [ ] **Social Recovery System**
  - Shamir Secret Sharing implementation
  - Guardian invitation and acceptance
  - Recovery request with time-lock
  - Share reconstruction on-chain
  - Multi-wallet support (same vault, different keys)
- [ ] **Emergency Access**
  - Time-locked emergency contacts
  - Inactivity detection (dead man's switch)
  - Two-stage countdown with notifications
  - Configurable access levels per contact
  - Activity tracking and "I'm alive" button
- [ ] **Recovery Testing Tools**
  - Simulate wallet loss scenarios
  - Guardian communication testing
  - Recovery time estimation
  - Backup verification

**Timeline**: 8-10 weeks
**Priority**: CRITICAL - Solves Web3's biggest UX problem

### Phase 6: Gasless Transactions & UX (Q2 2026)
- [ ] **Gasless Transaction Pool**
  - On-chain pool management
  - Per-tier transaction limits
  - Automatic pool refilling
  - Usage analytics dashboard
- [ ] **Enhanced Onboarding**
  - First-time user tutorial
  - Guardian setup wizard
  - Emergency access configuration
  - Test recovery flow
- [ ] **Performance Optimizations**
  - Lazy loading of storage chunks
  - Client-side caching layer
  - Batch transaction submission
  - Optimistic UI updates

**Timeline**: 4-6 weeks
**Priority**: MEDIUM - Dramatically improves UX

### Phase 7: Sharing & Collaboration (Q2 2026)
- [ ] **Secure Password Sharing**
  - X25519 asymmetric encryption
  - Per-entry permission management
  - Share expiration and revocation
  - Share access audit logs
- [ ] **Team Vaults** (Enterprise)
  - Role-based access control (RBAC)
  - Admin, Manager, Member roles
  - Team activity logs
  - Shared subscription billing
- [ ] **Password Health Monitoring**
  - Automatic weak password detection
  - Password expiration reminders
  - Security alerts for breached passwords

**Timeline**: 6-8 weeks
**Priority**: MEDIUM - Enables team use cases

### Phase 8: Advanced Security (Q3 2026)
- [ ] **TOTP/2FA Integration**
  - TOTP code generation
  - 2FA secret storage
  - Auto-copy to clipboard
  - Browser integration
- [ ] **Password Generator**
  - Customizable strength options
  - Memorable passphrase generation
  - Pattern-based generation
  - Password history
- [ ] **Audit Logs**
  - On-chain activity tracking
  - Exportable audit reports
  - Access pattern analysis
  - Anomaly detection

**Timeline**: 4-6 weeks
**Priority**: MEDIUM - Security enthusiast features

### Phase 9: Platform Expansion (Q3-Q4 2026)
- [ ] **Mobile PWA**
  - iOS/Android installable web app
  - Touch-optimized interface
  - Biometric authentication (WebAuthn)
  - Offline mode support
- [ ] **WalletConnect Integration**
  - Auto-fill for dApps
  - Phishing-resistant authentication
  - Domain verification
- [ ] **CLI Tool**
  - Command-line interface for power users
  - Automation and scripting support
  - CI/CD integration

**Timeline**: 8-10 weeks
**Priority**: LOW - Future expansion

---

## Future Innovations (Post-Mainnet)

### Possible Features for 2027+
- **Cross-Chain Portability**: Export encrypted vault to Ethereum, Polygon, etc.
- **Browser Extension**: Chrome/Firefox/Brave extension with auto-fill
- **AI-Powered Security**: On-device ML for leak detection
- **NFT-Gated Passwords**: Unlock entries with NFT ownership
- **Programmable Access Rules**: Time-based, location-based, NFT-based access
- **Zero-Knowledge Proofs**: Prove password strength without revealing password
- **Hardware Wallet Integration**: YubiKey, Ledger support

### Deprioritized Features
- ~~Custom branding~~ - Not worth complexity for <1% of users
- ~~SSO Integration~~ - Conflicts with Web3-first philosophy
- ~~Desktop Apps~~ - PWA covers 90% of use cases
- ~~Compliance Reporting~~ - Premature for pre-mainnet product

---

## Technical Considerations

### Performance Optimization
1. **Lazy Loading**: Load only necessary chunks on-demand
2. **Client-Side Caching**: Cache decrypted entries in memory
3. **Batch Operations**: Group multiple updates into single transaction
4. **Index Optimization**: Maintain efficient blind indexes
5. **Compression**: Optional zstd compression for large entries

### Security Best Practices
1. **Zero-Knowledge**: Never transmit plaintext to server
2. **Client-Side Encryption**: All crypto operations in browser
3. **No Persistent Secrets**: Session keys stored in WeakMap
4. **Secure Sharing**: Asymmetric encryption for sharing
5. **Audit Logging**: Track all access on-chain

### Cost Analysis
- **Storage Rent**: ~0.0069 SOL per KB per 2 years (~$0.96 at $140/SOL)
- **Transaction Fees**: ~0.000005 SOL per transaction (~$0.0007)
- **Subscription Revenue**: 0.001-0.1 SOL per month ($0.14-$14)
- **Break-even**: ~50-100 paid users
- **Gasless Pool**: ~0.5 SOL per 1000 transactions (~$70)

### Blockchain Trade-offs

**Why Solana Over Ethereum:**
- **Low Fees**: ~$0.0007 per transaction vs. $50+ on Ethereum
- **Fast Finality**: 400ms vs. 12+ seconds
- **Account Model**: Easier to implement dynamic storage with realloc
- **Native Throughput**: 65k TPS without L2 complexity

**Trade-offs:**
- **Network Stability**: Solana has had outages (improving)
- **Developer Tooling**: Less mature than Ethereum ecosystem
- **User Base**: Smaller than Ethereum (but growing rapidly)

---

## Conclusion

This revised expansion strategy focuses on **solving Web3's biggest problems first** while maintaining feature parity with traditional password managers.

**Key Differentiators:**
1. **Social Recovery** - First password manager with trustless wallet recovery
2. **Emergency Access** - Dead man's switch for digital estate planning
3. **Gasless Transactions** - Web2 UX with Web3 security
4. **Zero-Knowledge** - True decentralization without central servers
5. **Blockchain-Native** - Programmable access rules, NFT-gating, time-locks

**Competitive Advantages:**
- **vs. 1Password/Bitwarden**: Decentralized, censorship-resistant, no data breaches possible
- **vs. MetaMask**: Purpose-built for passwords, better UX, social recovery
- **vs. Other Web3 Solutions**: Gasless transactions, emergency access, proven on devnet

**Next Steps:**
1. Complete Phase 4 (Search & Intelligence) - Q1 2026
2. Implement Phase 5 (Social Recovery) - Q1 2026
3. Security audit by professional auditors
4. Beta testing with select users
5. Mainnet launch - Q2 2026
