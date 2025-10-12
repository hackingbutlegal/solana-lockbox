use anchor_lang::prelude::*;
use crate::state::{MasterLockbox, StorageChunk, StorageChunkInfo, StorageType};

/// Initialize a new master lockbox account for the user
#[derive(Accounts)]
pub struct InitializeMasterLockbox<'info> {
    #[account(
        init,
        payer = owner,
        space = MasterLockbox::INIT_SPACE,
        seeds = [MasterLockbox::SEEDS_PREFIX, owner.key().as_ref()],
        bump
    )]
    pub master_lockbox: Account<'info, MasterLockbox>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitializeMasterLockbox>) -> Result<()> {
    let master_lockbox = &mut ctx.accounts.master_lockbox;
    let owner = ctx.accounts.owner.key();
    let bump = ctx.bumps.master_lockbox;
    let current_timestamp = Clock::get()?.unix_timestamp;

    master_lockbox.initialize(owner, bump, current_timestamp)?;

    msg!("Master lockbox initialized for owner: {}", owner);
    msg!("Subscription tier: Free (1KB capacity)");

    Ok(())
}

/// Initialize a new storage chunk
#[derive(Accounts)]
#[instruction(chunk_index: u16, initial_capacity: u32)]
pub struct InitializeStorageChunk<'info> {
    #[account(
        mut,
        seeds = [MasterLockbox::SEEDS_PREFIX, owner.key().as_ref()],
        bump = master_lockbox.bump,
        constraint = master_lockbox.owner == owner.key() @ crate::errors::LockboxError::Unauthorized
    )]
    pub master_lockbox: Account<'info, MasterLockbox>,

    #[account(
        init,
        payer = owner,
        space = StorageChunk::BASE_SPACE + initial_capacity as usize,
        seeds = [
            StorageChunk::SEEDS_PREFIX,
            master_lockbox.key().as_ref(),
            &chunk_index.to_le_bytes()
        ],
        bump
    )]
    pub storage_chunk: Account<'info, StorageChunk>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn initialize_storage_chunk_handler(
    ctx: Context<InitializeStorageChunk>,
    chunk_index: u16,
    initial_capacity: u32,
    data_type: StorageType,
) -> Result<()> {
    let master_lockbox = &mut ctx.accounts.master_lockbox;
    let storage_chunk = &mut ctx.accounts.storage_chunk;
    let owner = ctx.accounts.owner.key();
    let bump = ctx.bumps.storage_chunk;
    let current_timestamp = Clock::get()?.unix_timestamp;

    // Validate capacity
    require!(
        initial_capacity >= StorageChunk::MIN_CHUNK_SIZE,
        crate::errors::LockboxError::InvalidDataSize
    );
    require!(
        initial_capacity <= StorageChunk::MAX_CHUNK_SIZE,
        crate::errors::LockboxError::InvalidDataSize
    );

    // Check subscription limits
    let new_total_capacity = master_lockbox.total_capacity + initial_capacity as u64;
    let max_capacity = master_lockbox.subscription_tier.max_capacity();
    require!(
        new_total_capacity <= max_capacity,
        crate::errors::LockboxError::InsufficientStorageCapacity
    );

    // Initialize chunk
    storage_chunk.initialize(
        master_lockbox.key(),
        owner,
        chunk_index,
        initial_capacity,
        data_type,
        bump,
        current_timestamp,
    )?;

    // Register chunk in master lockbox
    let chunk_info = StorageChunkInfo {
        chunk_address: storage_chunk.key(),
        chunk_index,
        max_capacity: initial_capacity,
        size_used: 0,
        data_type,
        created_at: current_timestamp,
        last_modified: current_timestamp,
    };

    master_lockbox.add_chunk(chunk_info)?;
    master_lockbox.touch(current_timestamp);

    msg!("Storage chunk {} initialized with {}KB capacity", chunk_index, initial_capacity / 1024);

    Ok(())
}
