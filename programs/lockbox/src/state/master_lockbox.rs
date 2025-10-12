use anchor_lang::prelude::*;
use super::subscription::{SubscriptionTier, StorageChunkInfo};

/// Master lockbox account - manages user's password vault
#[account]
#[derive(InitSpace)]
pub struct MasterLockbox {
    /// Owner's wallet address
    pub owner: Pubkey,

    /// Total number of password entries across all chunks
    pub total_entries: u64,

    /// Number of storage chunks allocated
    pub storage_chunks_count: u16,

    /// Current subscription tier
    pub subscription_tier: SubscriptionTier,

    /// Last time lockbox was accessed
    pub last_accessed: i64,

    /// When subscription expires (for paid tiers)
    pub subscription_expires: i64,

    /// Total storage capacity across all chunks (bytes)
    pub total_capacity: u64,

    /// Total storage currently used (bytes)
    pub storage_used: u64,

    /// List of storage chunk metadata (max 100 chunks)
    #[max_len(100)]
    pub storage_chunks: Vec<StorageChunkInfo>,

    /// Encrypted search index (blind indexes for password titles)
    #[max_len(10240)]
    pub encrypted_index: Vec<u8>,

    /// Next entry ID to assign
    pub next_entry_id: u64,

    /// Number of categories created
    pub categories_count: u32,

    /// Account creation timestamp
    pub created_at: i64,

    /// PDA bump seed
    pub bump: u8,
}

impl MasterLockbox {
    /// Seeds for PDA derivation
    pub const SEEDS_PREFIX: &'static [u8] = b"master_lockbox";

    /// Initial space calculation for account creation
    pub const INIT_SPACE: usize = 8 + // discriminator
        32 + // owner
        8 +  // total_entries
        2 +  // storage_chunks_count
        1 +  // subscription_tier
        8 +  // last_accessed
        8 +  // subscription_expires
        8 +  // total_capacity
        8 +  // storage_used
        4 +  // storage_chunks vec length
        8 +  // next_entry_id
        4 +  // categories_count
        8 +  // created_at
        1;   // bump

    /// Initialize a new master lockbox
    pub fn initialize(
        &mut self,
        owner: Pubkey,
        bump: u8,
        current_timestamp: i64,
    ) -> Result<()> {
        self.owner = owner;
        self.total_entries = 0;
        self.storage_chunks_count = 0;
        self.subscription_tier = SubscriptionTier::Free;
        self.last_accessed = current_timestamp;
        self.subscription_expires = 0;
        self.total_capacity = 0;
        self.storage_used = 0;
        self.storage_chunks = Vec::new();
        self.encrypted_index = Vec::new();
        self.next_entry_id = 1;
        self.categories_count = 0;
        self.created_at = current_timestamp;
        self.bump = bump;
        Ok(())
    }

    /// Register a new storage chunk
    pub fn add_chunk(&mut self, chunk_info: StorageChunkInfo) -> Result<()> {
        require!(
            self.storage_chunks.len() < 100,
            crate::errors::LockboxError::MaxChunksReached
        );

        self.storage_chunks.push(chunk_info);
        self.storage_chunks_count += 1;
        self.total_capacity += chunk_info.max_capacity as u64;

        Ok(())
    }

    /// Update chunk usage
    pub fn update_chunk_usage(&mut self, chunk_index: u16, new_size: u32) -> Result<()> {
        let chunk = self.storage_chunks
            .iter_mut()
            .find(|c| c.chunk_index == chunk_index)
            .ok_or(crate::errors::LockboxError::ChunkNotFound)?;

        let old_size = chunk.size_used;
        chunk.size_used = new_size;

        // Update total storage used
        if new_size > old_size {
            self.storage_used += (new_size - old_size) as u64;
        } else {
            self.storage_used -= (old_size - new_size) as u64;
        }

        Ok(())
    }

    /// Check if there's enough capacity for new data
    pub fn has_capacity(&self, additional_bytes: u64) -> bool {
        let max_capacity = self.subscription_tier.max_capacity();
        self.storage_used + additional_bytes <= max_capacity
    }

    /// Upgrade subscription tier
    pub fn upgrade_subscription(
        &mut self,
        new_tier: SubscriptionTier,
        current_timestamp: i64,
    ) -> Result<()> {
        require!(
            self.subscription_tier.can_upgrade_to(&new_tier),
            crate::errors::LockboxError::InvalidTierUpgrade
        );

        self.subscription_tier = new_tier;

        // Set expiration for paid tiers
        if new_tier != SubscriptionTier::Free {
            self.subscription_expires = current_timestamp + new_tier.duration_seconds();
        }

        Ok(())
    }

    /// Check if subscription is active
    pub fn is_subscription_active(&self, current_timestamp: i64) -> bool {
        if self.subscription_tier == SubscriptionTier::Free {
            return true;
        }
        current_timestamp < self.subscription_expires
    }

    /// Get next entry ID and increment
    pub fn get_next_entry_id(&mut self) -> u64 {
        let id = self.next_entry_id;
        self.next_entry_id += 1;
        id
    }

    /// Increment total entries
    pub fn increment_entries(&mut self) {
        self.total_entries += 1;
    }

    /// Decrement total entries
    pub fn decrement_entries(&mut self) {
        if self.total_entries > 0 {
            self.total_entries -= 1;
        }
    }

    /// Update last accessed timestamp
    pub fn touch(&mut self, timestamp: i64) {
        self.last_accessed = timestamp;
    }
}
