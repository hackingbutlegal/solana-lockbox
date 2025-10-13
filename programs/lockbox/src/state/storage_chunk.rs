use anchor_lang::prelude::*;
use super::subscription::{StorageType, DataEntryHeader};

/// Storage chunk account - holds encrypted password entries
#[account]
#[derive(InitSpace)]
pub struct StorageChunk {
    /// Master lockbox this chunk belongs to
    pub master_lockbox: Pubkey,

    /// Owner's wallet address
    pub owner: Pubkey,

    /// Index of this chunk (0-based)
    pub chunk_index: u16,

    /// Maximum capacity of this chunk (bytes)
    pub max_capacity: u32,

    /// Currently used space (bytes)
    pub current_size: u32,

    /// Type of data stored
    pub data_type: StorageType,

    /// Encrypted data payload
    #[max_len(10240)]
    pub encrypted_data: Vec<u8>,

    /// Entry headers for quick lookup
    #[max_len(100)]
    pub entry_headers: Vec<DataEntryHeader>,

    /// Number of entries in this chunk
    pub entry_count: u16,

    /// Creation timestamp
    pub created_at: i64,

    /// Last modification timestamp
    pub last_modified: i64,

    /// PDA bump seed
    pub bump: u8,
}

impl StorageChunk {
    /// Seeds for PDA derivation
    pub const SEEDS_PREFIX: &'static [u8] = b"storage_chunk";

    /// Initial space for a chunk (excluding dynamic data)
    pub const BASE_SPACE: usize = 8 + // discriminator
        32 + // master_lockbox
        32 + // owner
        2 +  // chunk_index
        4 +  // max_capacity
        4 +  // current_size
        1 +  // data_type
        4 +  // encrypted_data vec length
        4 +  // entry_headers vec length
        2 +  // entry_count
        8 +  // created_at
        8 +  // last_modified
        1;   // bump

    /// Minimum chunk size (1KB)
    pub const MIN_CHUNK_SIZE: u32 = 1024;

    /// Maximum chunk size (10KB per realloc)
    pub const MAX_CHUNK_SIZE: u32 = 10240;

    /// Initialize a new storage chunk
    pub fn initialize(
        &mut self,
        master_lockbox: Pubkey,
        owner: Pubkey,
        chunk_index: u16,
        initial_capacity: u32,
        data_type: StorageType,
        bump: u8,
        current_timestamp: i64,
    ) -> Result<()> {
        self.master_lockbox = master_lockbox;
        self.owner = owner;
        self.chunk_index = chunk_index;
        self.max_capacity = initial_capacity;
        self.current_size = 0;
        self.data_type = data_type;
        self.encrypted_data = Vec::new();
        self.entry_headers = Vec::new();
        self.entry_count = 0;
        self.created_at = current_timestamp;
        self.last_modified = current_timestamp;
        self.bump = bump;
        Ok(())
    }

    /// Add a new entry to this chunk
    pub fn add_entry(
        &mut self,
        entry_header: DataEntryHeader,
        encrypted_data: Vec<u8>,
        current_timestamp: i64,
    ) -> Result<()> {
        require!(
            self.entry_headers.len() < 100,
            crate::errors::LockboxError::MaxEntriesPerChunk
        );

        // SECURITY: Use checked_add to prevent integer overflow
        let data_len = encrypted_data.len() as u32;
        let new_size = self.current_size
            .checked_add(data_len)
            .ok_or(crate::errors::LockboxError::InvalidDataSize)?;

        require!(
            new_size <= self.max_capacity,
            crate::errors::LockboxError::InsufficientChunkCapacity
        );

        // Add entry header
        self.entry_headers.push(entry_header);
        self.entry_count += 1;

        // Append encrypted data
        self.encrypted_data.extend_from_slice(&encrypted_data);
        self.current_size = new_size;
        self.last_modified = current_timestamp;

        Ok(())
    }

    /// Update an existing entry
    pub fn update_entry(
        &mut self,
        entry_id: u64,
        new_encrypted_data: Vec<u8>,
        current_timestamp: i64,
    ) -> Result<()> {
        // Find the entry header
        let header_idx = self.entry_headers
            .iter()
            .position(|h| h.entry_id == entry_id)
            .ok_or(crate::errors::LockboxError::EntryNotFound)?;

        // Get header info before mutable borrows
        let old_offset = self.entry_headers[header_idx].offset as usize;
        let old_size = self.entry_headers[header_idx].size;
        let new_size = new_encrypted_data.len() as u32;

        // SECURITY: Calculate size difference using checked arithmetic to prevent overflows
        let new_total_size = if new_size > old_size {
            // Growing: add the difference
            self.current_size
                .checked_add(new_size - old_size)
                .ok_or(crate::errors::LockboxError::InvalidDataSize)?
        } else {
            // Shrinking: subtract the difference
            self.current_size
                .checked_sub(old_size - new_size)
                .ok_or(crate::errors::LockboxError::InvalidDataSize)?
        };

        require!(
            new_total_size <= self.max_capacity,
            crate::errors::LockboxError::InsufficientChunkCapacity
        );

        // Replace data at offset
        if new_size == old_size {
            // Same size, just replace in-place
            self.encrypted_data[old_offset..old_offset + (new_size as usize)]
                .copy_from_slice(&new_encrypted_data);
        } else {
            // Different size, need to reorganize
            let mut new_data = Vec::with_capacity(new_total_size as usize);

            // Copy data before this entry
            new_data.extend_from_slice(&self.encrypted_data[..old_offset]);

            // Insert new data
            new_data.extend_from_slice(&new_encrypted_data);

            // Copy data after this entry
            let old_size_usize = old_size as usize;
            if old_offset + old_size_usize < self.encrypted_data.len() {
                new_data.extend_from_slice(&self.encrypted_data[old_offset + old_size_usize..]);
            }

            // SECURITY: Update all headers after this one using checked arithmetic
            for (idx, h) in self.entry_headers.iter_mut().enumerate() {
                if idx > header_idx {
                    if new_size > old_size {
                        // Growing: increase offset
                        h.offset = h.offset
                            .checked_add(new_size - old_size)
                            .ok_or(crate::errors::LockboxError::InvalidEntryOffset)?;
                    } else {
                        // Shrinking: decrease offset
                        h.offset = h.offset
                            .checked_sub(old_size - new_size)
                            .ok_or(crate::errors::LockboxError::InvalidEntryOffset)?;
                    }
                }
            }

            self.encrypted_data = new_data;
        }

        // Update header
        self.entry_headers[header_idx].size = new_size as u32;
        self.entry_headers[header_idx].last_modified = current_timestamp;
        self.entry_headers[header_idx].access_count += 1;

        self.current_size = new_total_size;
        self.last_modified = current_timestamp;

        Ok(())
    }

    /// Delete an entry from this chunk
    pub fn delete_entry(
        &mut self,
        entry_id: u64,
        current_timestamp: i64,
    ) -> Result<()> {
        // Find the entry header
        let header_idx = self.entry_headers
            .iter()
            .position(|h| h.entry_id == entry_id)
            .ok_or(crate::errors::LockboxError::EntryNotFound)?;

        let header = &self.entry_headers[header_idx];
        let offset = header.offset as usize;
        let size = header.size as usize;

        // Remove data
        let mut new_data = Vec::with_capacity(self.encrypted_data.len() - size);
        new_data.extend_from_slice(&self.encrypted_data[..offset]);
        if offset + size < self.encrypted_data.len() {
            new_data.extend_from_slice(&self.encrypted_data[offset + size..]);
        }

        // Update all headers after this one (use checked_sub to prevent underflow)
        for h in self.entry_headers.iter_mut().skip(header_idx + 1) {
            h.offset = h.offset
                .checked_sub(size as u32)
                .ok_or(crate::errors::LockboxError::InvalidEntryOffset)?;
        }

        // Remove header
        self.entry_headers.remove(header_idx);
        self.entry_count -= 1;

        self.encrypted_data = new_data;
        self.current_size -= size as u32;
        self.last_modified = current_timestamp;

        Ok(())
    }

    /// Get entry data by ID
    pub fn get_entry_data(&self, entry_id: u64) -> Result<Vec<u8>> {
        let header = self.entry_headers
            .iter()
            .find(|h| h.entry_id == entry_id)
            .ok_or(crate::errors::LockboxError::EntryNotFound)?;

        let offset = header.offset as usize;
        let size = header.size as usize;

        require!(
            offset + size <= self.encrypted_data.len(),
            crate::errors::LockboxError::InvalidEntryOffset
        );

        Ok(self.encrypted_data[offset..offset + size].to_vec())
    }

    /// Get available space in this chunk
    pub fn available_space(&self) -> u32 {
        self.max_capacity - self.current_size
    }

    /// Check if this chunk can fit additional data
    pub fn can_fit(&self, size: u32) -> bool {
        self.available_space() >= size
    }

    /// Get entry header by ID
    pub fn get_entry_header(&self, entry_id: u64) -> Result<&DataEntryHeader> {
        self.entry_headers
            .iter()
            .find(|h| h.entry_id == entry_id)
            .ok_or(crate::errors::LockboxError::EntryNotFound.into())
    }

    /// Get mutable entry header by ID
    pub fn get_entry_header_mut(&mut self, entry_id: u64) -> Result<&mut DataEntryHeader> {
        self.entry_headers
            .iter_mut()
            .find(|h| h.entry_id == entry_id)
            .ok_or(crate::errors::LockboxError::EntryNotFound.into())
    }
}
