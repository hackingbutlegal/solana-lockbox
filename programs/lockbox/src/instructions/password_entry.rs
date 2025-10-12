use anchor_lang::prelude::*;
use crate::state::{MasterLockbox, StorageChunk, DataEntryHeader, PasswordEntryType};

/// Store a new password entry
#[derive(Accounts)]
#[instruction(chunk_index: u16)]
pub struct StorePasswordEntry<'info> {
    #[account(
        mut,
        seeds = [MasterLockbox::SEEDS_PREFIX, owner.key().as_ref()],
        bump = master_lockbox.bump,
        constraint = master_lockbox.owner == owner.key() @ crate::errors::LockboxError::Unauthorized
    )]
    pub master_lockbox: Account<'info, MasterLockbox>,

    #[account(
        mut,
        seeds = [
            StorageChunk::SEEDS_PREFIX,
            master_lockbox.key().as_ref(),
            &chunk_index.to_le_bytes()
        ],
        bump = storage_chunk.bump,
        constraint = storage_chunk.master_lockbox == master_lockbox.key() @ crate::errors::LockboxError::Unauthorized,
        constraint = storage_chunk.owner == owner.key() @ crate::errors::LockboxError::Unauthorized
    )]
    pub storage_chunk: Account<'info, StorageChunk>,

    #[account(mut)]
    pub owner: Signer<'info>,
}

pub fn store_password_entry_handler(
    ctx: Context<StorePasswordEntry>,
    _chunk_index: u16,
    encrypted_data: Vec<u8>,
    entry_type: PasswordEntryType,
    category: u32,
    title_hash: [u8; 32],
) -> Result<()> {
    let master_lockbox = &mut ctx.accounts.master_lockbox;
    let storage_chunk = &mut ctx.accounts.storage_chunk;
    let current_timestamp = Clock::get()?.unix_timestamp;

    // Check subscription is active
    require!(
        master_lockbox.is_subscription_active(current_timestamp),
        crate::errors::LockboxError::SubscriptionExpired
    );

    // Check capacity
    let data_size = encrypted_data.len() as u64;
    require!(
        master_lockbox.has_capacity(data_size),
        crate::errors::LockboxError::InsufficientStorageCapacity
    );

    require!(
        storage_chunk.can_fit(encrypted_data.len() as u32),
        crate::errors::LockboxError::InsufficientChunkCapacity
    );

    // Get next entry ID
    let entry_id = master_lockbox.get_next_entry_id();

    // Create entry header
    let entry_header = DataEntryHeader {
        entry_id,
        offset: storage_chunk.current_size,
        size: encrypted_data.len() as u32,
        entry_type,
        category,
        title_hash,
        created_at: current_timestamp,
        last_modified: current_timestamp,
        access_count: 0,
        flags: 0,
    };

    // Add entry to chunk
    storage_chunk.add_entry(entry_header, encrypted_data, current_timestamp)?;

    // Update master lockbox
    master_lockbox.update_chunk_usage(storage_chunk.chunk_index, storage_chunk.current_size)?;
    master_lockbox.increment_entries();
    master_lockbox.touch(current_timestamp);

    msg!("Password entry {} stored successfully", entry_id);

    Ok(())
}

/// Retrieve a password entry
#[derive(Accounts)]
#[instruction(chunk_index: u16, entry_id: u64)]
pub struct RetrievePasswordEntry<'info> {
    #[account(
        mut,
        seeds = [MasterLockbox::SEEDS_PREFIX, owner.key().as_ref()],
        bump = master_lockbox.bump,
        constraint = master_lockbox.owner == owner.key() @ crate::errors::LockboxError::Unauthorized
    )]
    pub master_lockbox: Account<'info, MasterLockbox>,

    #[account(
        mut,
        seeds = [
            StorageChunk::SEEDS_PREFIX,
            master_lockbox.key().as_ref(),
            &chunk_index.to_le_bytes()
        ],
        bump = storage_chunk.bump,
        constraint = storage_chunk.master_lockbox == master_lockbox.key() @ crate::errors::LockboxError::Unauthorized,
        constraint = storage_chunk.owner == owner.key() @ crate::errors::LockboxError::Unauthorized
    )]
    pub storage_chunk: Account<'info, StorageChunk>,

    pub owner: Signer<'info>,
}

pub fn retrieve_password_entry_handler(
    ctx: Context<RetrievePasswordEntry>,
    _chunk_index: u16,
    entry_id: u64,
) -> Result<Vec<u8>> {
    let master_lockbox = &mut ctx.accounts.master_lockbox;
    let storage_chunk = &mut ctx.accounts.storage_chunk;
    let current_timestamp = Clock::get()?.unix_timestamp;

    // Check subscription is active
    require!(
        master_lockbox.is_subscription_active(current_timestamp),
        crate::errors::LockboxError::SubscriptionExpired
    );

    // Get entry data
    let data = storage_chunk.get_entry_data(entry_id)?;

    // Update access count
    let header = storage_chunk.get_entry_header_mut(entry_id)?;
    header.access_count += 1;

    // Update timestamps
    storage_chunk.last_modified = current_timestamp;
    master_lockbox.touch(current_timestamp);

    msg!("Password entry {} retrieved", entry_id);

    Ok(data)
}

/// Update a password entry
#[derive(Accounts)]
#[instruction(chunk_index: u16, entry_id: u64)]
pub struct UpdatePasswordEntry<'info> {
    #[account(
        mut,
        seeds = [MasterLockbox::SEEDS_PREFIX, owner.key().as_ref()],
        bump = master_lockbox.bump,
        constraint = master_lockbox.owner == owner.key() @ crate::errors::LockboxError::Unauthorized
    )]
    pub master_lockbox: Account<'info, MasterLockbox>,

    #[account(
        mut,
        seeds = [
            StorageChunk::SEEDS_PREFIX,
            master_lockbox.key().as_ref(),
            &chunk_index.to_le_bytes()
        ],
        bump = storage_chunk.bump,
        constraint = storage_chunk.master_lockbox == master_lockbox.key() @ crate::errors::LockboxError::Unauthorized,
        constraint = storage_chunk.owner == owner.key() @ crate::errors::LockboxError::Unauthorized
    )]
    pub storage_chunk: Account<'info, StorageChunk>,

    #[account(mut)]
    pub owner: Signer<'info>,
}

pub fn update_password_entry_handler(
    ctx: Context<UpdatePasswordEntry>,
    _chunk_index: u16,
    entry_id: u64,
    new_encrypted_data: Vec<u8>,
) -> Result<()> {
    let master_lockbox = &mut ctx.accounts.master_lockbox;
    let storage_chunk = &mut ctx.accounts.storage_chunk;
    let current_timestamp = Clock::get()?.unix_timestamp;

    // Check subscription is active
    require!(
        master_lockbox.is_subscription_active(current_timestamp),
        crate::errors::LockboxError::SubscriptionExpired
    );

    // Update entry
    storage_chunk.update_entry(entry_id, new_encrypted_data, current_timestamp)?;

    // Update master lockbox
    master_lockbox.update_chunk_usage(storage_chunk.chunk_index, storage_chunk.current_size)?;
    master_lockbox.touch(current_timestamp);

    msg!("Password entry {} updated", entry_id);

    Ok(())
}

/// Delete a password entry
#[derive(Accounts)]
#[instruction(chunk_index: u16, entry_id: u64)]
pub struct DeletePasswordEntry<'info> {
    #[account(
        mut,
        seeds = [MasterLockbox::SEEDS_PREFIX, owner.key().as_ref()],
        bump = master_lockbox.bump,
        constraint = master_lockbox.owner == owner.key() @ crate::errors::LockboxError::Unauthorized
    )]
    pub master_lockbox: Account<'info, MasterLockbox>,

    #[account(
        mut,
        seeds = [
            StorageChunk::SEEDS_PREFIX,
            master_lockbox.key().as_ref(),
            &chunk_index.to_le_bytes()
        ],
        bump = storage_chunk.bump,
        constraint = storage_chunk.master_lockbox == master_lockbox.key() @ crate::errors::LockboxError::Unauthorized,
        constraint = storage_chunk.owner == owner.key() @ crate::errors::LockboxError::Unauthorized
    )]
    pub storage_chunk: Account<'info, StorageChunk>,

    #[account(mut)]
    pub owner: Signer<'info>,
}

pub fn delete_password_entry_handler(
    ctx: Context<DeletePasswordEntry>,
    _chunk_index: u16,
    entry_id: u64,
) -> Result<()> {
    let master_lockbox = &mut ctx.accounts.master_lockbox;
    let storage_chunk = &mut ctx.accounts.storage_chunk;
    let current_timestamp = Clock::get()?.unix_timestamp;

    // Check subscription is active
    require!(
        master_lockbox.is_subscription_active(current_timestamp),
        crate::errors::LockboxError::SubscriptionExpired
    );

    // Delete entry
    storage_chunk.delete_entry(entry_id, current_timestamp)?;

    // Update master lockbox
    master_lockbox.update_chunk_usage(storage_chunk.chunk_index, storage_chunk.current_size)?;
    master_lockbox.decrement_entries();
    master_lockbox.touch(current_timestamp);

    msg!("Password entry {} deleted", entry_id);

    Ok(())
}
