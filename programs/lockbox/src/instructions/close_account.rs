/**
 * Close Account Instructions
 *
 * Provides functionality for permanently closing Master Lockbox accounts
 * and reclaiming rent. This is a destructive operation that cannot be undone.
 *
 * Security:
 * - Only the account owner can close their account
 * - Rent is returned to the owner's wallet
 * - All data is permanently deleted
 */

use anchor_lang::prelude::*;
use crate::state::master_lockbox::MasterLockbox;
use crate::state::storage_chunk::StorageChunk;
use crate::errors::LockboxError;

/**
 * Close Master Lockbox Account
 *
 * Permanently closes the user's Master Lockbox account and returns
 * all rent to the owner's wallet. This is irreversible.
 *
 * # Security Checks
 * - Verifies the signer is the account owner
 * - Transfers all lamports (rent) back to owner
 * - Closes the account (marks for garbage collection)
 *
 * # Returns
 * - `Ok(())` on successful closure
 * - `Err(LockboxError::Unauthorized)` if signer is not owner
 */
pub fn close_master_lockbox_handler(ctx: Context<CloseMasterLockbox>) -> Result<()> {
    // Verify ownership (already enforced by constraint, but explicit check for clarity)
    let master = &ctx.accounts.master_lockbox;
    require!(
        master.owner == ctx.accounts.owner.key(),
        LockboxError::Unauthorized
    );

    msg!("Master Lockbox closed successfully - rent reclaimed");
    Ok(())
}

/**
 * Account validation for close_master_lockbox instruction
 *
 * Uses Anchor's `close` constraint to automatically transfer rent
 * and mark the account for garbage collection.
 */
#[derive(Accounts)]
pub struct CloseMasterLockbox<'info> {
    /// The Master Lockbox PDA to close
    /// Rent will be returned to the owner
    #[account(
        mut,
        close = owner,
        seeds = [b"master_lockbox", owner.key().as_ref()],
        bump = master_lockbox.bump,
        constraint = master_lockbox.owner == owner.key() @ LockboxError::Unauthorized
    )]
    pub master_lockbox: Account<'info, MasterLockbox>,

    /// The owner/signer who is closing the account
    /// Must be the original creator of the Master Lockbox
    /// Receives all rent lamports
    #[account(mut)]
    pub owner: Signer<'info>,
}

/**
 * Close Storage Chunk Account
 *
 * Closes an individual storage chunk and returns rent to the owner.
 * Chunks should be closed before closing the Master Lockbox for maximum
 * rent recovery.
 *
 * # Arguments
 * - `chunk_index`: Index of the chunk to close
 *
 * # Returns
 * - `Ok(())` on successful closure
 * - `Err(LockboxError::Unauthorized)` if signer is not owner
 */
pub fn close_storage_chunk_handler(
    _ctx: Context<CloseStorageChunk>,
    _chunk_index: u16,
) -> Result<()> {
    msg!("Storage chunk closed successfully - rent reclaimed");
    Ok(())
}

/**
 * Account validation for close_storage_chunk instruction
 */
#[derive(Accounts)]
#[instruction(chunk_index: u16)]
pub struct CloseStorageChunk<'info> {
    /// The Storage Chunk PDA to close
    #[account(
        mut,
        close = owner,
        seeds = [
            b"storage_chunk",
            master_lockbox.key().as_ref(),
            &chunk_index.to_le_bytes()
        ],
        bump = storage_chunk.bump
    )]
    pub storage_chunk: Account<'info, StorageChunk>,

    /// The Master Lockbox (for ownership verification)
    #[account(
        seeds = [b"master_lockbox", owner.key().as_ref()],
        bump = master_lockbox.bump,
        constraint = master_lockbox.owner == owner.key() @ LockboxError::Unauthorized
    )]
    pub master_lockbox: Account<'info, MasterLockbox>,

    /// The owner/signer who is closing the chunk
    /// Receives all rent lamports
    #[account(mut)]
    pub owner: Signer<'info>,
}
