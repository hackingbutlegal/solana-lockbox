use anchor_lang::prelude::*;

/// Subscription tiers for storage capacity
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum SubscriptionTier {
    /// Free tier: 1KB storage (~10 passwords)
    Free,
    /// Basic tier: 10KB storage (~100 passwords) - 0.001 SOL/month
    Basic,
    /// Premium tier: 100KB storage (~1,000 passwords) - 0.01 SOL/month
    Premium,
    /// Enterprise tier: 1MB+ storage (unlimited) - 0.1 SOL/month
    Enterprise,
}

impl SubscriptionTier {
    /// Get maximum storage capacity for this tier (in bytes)
    pub fn max_capacity(&self) -> u64 {
        match self {
            SubscriptionTier::Free => 1024,           // 1KB
            SubscriptionTier::Basic => 10_240,        // 10KB
            SubscriptionTier::Premium => 102_400,     // 100KB
            SubscriptionTier::Enterprise => 1_048_576, // 1MB
        }
    }

    /// Get monthly cost in lamports
    pub fn monthly_cost(&self) -> u64 {
        match self {
            SubscriptionTier::Free => 0,
            SubscriptionTier::Basic => 1_000_000,      // 0.001 SOL
            SubscriptionTier::Premium => 10_000_000,   // 0.01 SOL
            SubscriptionTier::Enterprise => 100_000_000, // 0.1 SOL
        }
    }

    /// Get subscription duration in seconds (30 days)
    pub fn duration_seconds(&self) -> i64 {
        30 * 24 * 60 * 60 // 30 days
    }

    /// Check if this tier can be upgraded to target tier
    pub fn can_upgrade_to(&self, target: &SubscriptionTier) -> bool {
        match (self, target) {
            (SubscriptionTier::Free, SubscriptionTier::Basic) => true,
            (SubscriptionTier::Free, SubscriptionTier::Premium) => true,
            (SubscriptionTier::Free, SubscriptionTier::Enterprise) => true,
            (SubscriptionTier::Basic, SubscriptionTier::Premium) => true,
            (SubscriptionTier::Basic, SubscriptionTier::Enterprise) => true,
            (SubscriptionTier::Premium, SubscriptionTier::Enterprise) => true,
            _ => false,
        }
    }
}

/// Storage chunk metadata stored in MasterLockbox
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace, Debug)]
pub struct StorageChunkInfo {
    /// Address of the storage chunk account
    pub chunk_address: Pubkey,
    /// Index of this chunk (0-based)
    pub chunk_index: u16,
    /// Maximum capacity of this chunk (bytes)
    pub max_capacity: u32,
    /// Currently used space in this chunk (bytes)
    pub size_used: u32,
    /// Type of data stored (passwords, shared items, etc.)
    pub data_type: StorageType,
    /// When this chunk was created
    pub created_at: i64,
    /// Last modification timestamp
    pub last_modified: i64,
}

/// Types of storage chunks
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum StorageType {
    /// Password entries
    Passwords,
    /// Shared vault items
    SharedItems,
    /// Search index
    SearchIndex,
    /// Audit logs
    AuditLogs,
}

/// Password entry types
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum PasswordEntryType {
    /// Login credentials (username/password)
    Login,
    /// Credit card
    CreditCard,
    /// Secure note
    SecureNote,
    /// Identity information
    Identity,
    /// API key
    ApiKey,
    /// SSH key
    SshKey,
    /// Cryptocurrency wallet
    CryptoWallet,
}

/// Password entry metadata header
#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace, Debug)]
pub struct DataEntryHeader {
    /// Unique entry ID
    pub entry_id: u64,
    /// Offset in chunk where entry data starts
    pub offset: u32,
    /// Size of the encrypted entry (bytes)
    pub size: u32,
    /// Type of password entry
    pub entry_type: PasswordEntryType,
    /// Category ID (user-defined)
    pub category: u32,
    /// HMAC hash of encrypted title (for blind search)
    pub title_hash: [u8; 32],
    /// Creation timestamp
    pub created_at: i64,
    /// Last modified timestamp
    pub last_modified: i64,
    /// Access count for analytics
    pub access_count: u32,
    /// Flags (favorite, archived, etc.)
    pub flags: u8,
}

impl DataEntryHeader {
    /// Check if entry is marked as favorite
    pub fn is_favorite(&self) -> bool {
        self.flags & 0x01 != 0
    }

    /// Check if entry is archived
    pub fn is_archived(&self) -> bool {
        self.flags & 0x02 != 0
    }

    /// Set favorite flag
    pub fn set_favorite(&mut self, favorite: bool) {
        if favorite {
            self.flags |= 0x01;
        } else {
            self.flags &= !0x01;
        }
    }

    /// Set archived flag
    pub fn set_archived(&mut self, archived: bool) {
        if archived {
            self.flags |= 0x02;
        } else {
            self.flags &= !0x02;
        }
    }
}
