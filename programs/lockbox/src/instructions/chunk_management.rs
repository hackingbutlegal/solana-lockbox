use anchor_lang::prelude::*;
use crate::state::{MasterLockbox, StorageChunk};
use crate::errors::LockboxError;

/// Maximum realloc increment per call (10KB)
/// This prevents excessive single reallocations and manages rent requirements
const MAX_REALLOC_INCREMENT: u32 = 10240;

/// Expand an existing storage chunk
///
/// Uses Solana's realloc feature to increase chunk capacity without creating a new account.
/// This is more efficient than allocating new chunks for gradual storage growth.
///
/// # Arguments
/// * `additional_size` - Number of bytes to add to chunk capacity (max 10KB per call)
///
/// # Security
/// - Validates expansion doesn't exceed MAX_CHUNK_SIZE
/// - Enforces max realloc increment (prevents abuse)
/// - Calculates and transfers additional rent from user
/// - Updates master lockbox capacity tracking
///
/// # Errors
/// * `ChunkTooLarge` - Expansion would exceed MAX_CHUNK_SIZE
/// * `ReallocTooLarge` - Trying to expand by more than 10KB in one call
/// * `ChunkNotFound` - Referenced chunk not found in master lockbox
/// * `Unauthorized` - Caller doesn't own the lockbox
pub fn expand_chunk_handler(
    ctx: Context<ExpandChunk>,
    additional_size: u32,
) -> Result<()> {
    let chunk = &mut ctx.accounts.storage_chunk;
    let master = &mut ctx.accounts.master_lockbox;
    let clock = Clock::get()?;

    // Validate expansion doesn't exceed limits
    let new_capacity = chunk.max_capacity
        .checked_add(additional_size)
        .ok_or(LockboxError::InvalidDataSize)?;

    require!(
        new_capacity <= StorageChunk::MAX_CHUNK_SIZE,
        LockboxError::ChunkTooLarge
    );

    // Validate realloc increment (max 10KB per call)
    require!(
        additional_size > 0 && additional_size <= MAX_REALLOC_INCREMENT,
        LockboxError::ReallocTooLarge
    );

    // Calculate additional rent needed
    let current_len = chunk.to_account_info().data_len();
    let new_len = current_len + additional_size as usize;

    let rent = Rent::get()?;
    let current_rent = rent.minimum_balance(current_len);
    let new_rent = rent.minimum_balance(new_len);
    let additional_rent = new_rent.saturating_sub(current_rent);

    // Transfer additional rent from user if needed
    if additional_rent > 0 {
        let transfer_ix = anchor_lang::solana_program::system_instruction::transfer(
            ctx.accounts.payer.key,
            chunk.to_account_info().key,
            additional_rent,
        );

        anchor_lang::solana_program::program::invoke(
            &transfer_ix,
            &[
                ctx.accounts.payer.to_account_info(),
                chunk.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;
    }

    // Perform reallocation
    chunk.to_account_info().realloc(new_len, false)?;
    chunk.max_capacity = new_capacity;
    chunk.last_modified = clock.unix_timestamp;

    // Update master lockbox tracking
    let chunk_info = master.storage_chunks
        .iter_mut()
        .find(|c| c.chunk_index == chunk.chunk_index)
        .ok_or(LockboxError::ChunkNotFound)?;

    chunk_info.max_capacity = new_capacity;
    chunk_info.last_modified = clock.unix_timestamp;

    master.total_capacity = master.total_capacity
        .checked_add(additional_size as u64)
        .ok_or(LockboxError::InvalidDataSize)?;

    msg!("Expanded chunk {} by {} bytes to {} total",
        chunk.chunk_index, additional_size, new_capacity);

    Ok(())
}

#[derive(Accounts)]
pub struct ExpandChunk<'info> {
    /// Master lockbox that owns the chunk
    #[account(
        mut,
        seeds = [MasterLockbox::SEEDS_PREFIX, owner.key().as_ref()],
        bump = master_lockbox.bump,
        has_one = owner @ LockboxError::Unauthorized
    )]
    pub master_lockbox: Account<'info, MasterLockbox>,

    /// Storage chunk to expand
    #[account(
        mut,
        seeds = [
            StorageChunk::SEEDS_PREFIX,
            master_lockbox.key().as_ref(),
            &storage_chunk.chunk_index.to_le_bytes()
        ],
        bump = storage_chunk.bump,
        constraint = storage_chunk.master_lockbox == master_lockbox.key() @ LockboxError::ChunkNotFound,
        constraint = storage_chunk.owner == owner.key() @ LockboxError::Unauthorized
    )]
    pub storage_chunk: Account<'info, StorageChunk>,

    /// Owner wallet (must sign)
    pub owner: Signer<'info>,

    /// Payer for additional rent
    #[account(mut)]
    pub payer: Signer<'info>,

    /// System program for rent transfers
    pub system_program: Program<'info, System>,
}
