//! # Social Recovery Instructions
//!
//! This module implements the instruction handlers for social recovery via
//! Shamir Secret Sharing. These instructions allow users to set up guardian
//! networks and perform wallet recovery.
//!
//! ## Instruction Flow
//!
//! ### Setup Phase
//! 1. `initialize_recovery_config` - Owner creates recovery configuration
//! 2. `add_guardian` - Owner adds guardians with encrypted shares
//! 3. `accept_guardianship` - Guardian accepts their role
//! 4. `remove_guardian` - Owner removes a guardian
//!
//! ### Recovery Phase
//! 1. `initiate_recovery` - Guardian starts recovery request (with time-lock)
//! 2. `approve_recovery` - M guardians submit their shares
//! 3. `complete_recovery` - Reconstruct key and transfer ownership
//! 4. `cancel_recovery` - Owner cancels active recovery

use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;

/// Initialize recovery configuration
///
/// Creates the RecoveryConfig account for a user. This must be called before
/// adding guardians. Requires Premium or Enterprise subscription.
///
/// # Arguments
/// * `threshold` - Number of guardians needed for recovery (M)
/// * `recovery_delay` - Time-lock delay in seconds (e.g., 7 days)
///
/// # Accounts
/// * `recovery_config` - RecoveryConfig PDA (to be created)
/// * `master_lockbox` - User's master lockbox (for subscription verification)
/// * `owner` - User wallet (signer and payer)
/// * `system_program` - System program
pub fn initialize_recovery_config_handler(
    ctx: Context<InitializeRecoveryConfig>,
    threshold: u8,
    recovery_delay: i64,
) -> Result<()> {
    let recovery_config = &mut ctx.accounts.recovery_config;
    let master_lockbox = &ctx.accounts.master_lockbox;
    let clock = Clock::get()?;

    // Verify subscription tier (Premium or Enterprise required)
    require!(
        matches!(
            master_lockbox.subscription_tier,
            SubscriptionTier::Premium | SubscriptionTier::Enterprise
        ),
        LockboxError::FeatureNotAvailable
    );

    // Validate threshold
    require!(threshold > 0 && threshold as usize <= MAX_GUARDIANS, LockboxError::InvalidThreshold);

    // Validate recovery delay
    require!(
        recovery_delay >= MIN_RECOVERY_DELAY && recovery_delay <= MAX_RECOVERY_DELAY,
        LockboxError::InvalidRecoveryDelay
    );

    // Initialize recovery configuration
    recovery_config.owner = ctx.accounts.owner.key();
    recovery_config.threshold = threshold;
    recovery_config.total_guardians = 0;
    recovery_config.guardians = Vec::new();
    recovery_config.recovery_delay = recovery_delay;
    recovery_config.created_at = clock.unix_timestamp;
    recovery_config.last_modified = clock.unix_timestamp;
    recovery_config.last_request_id = 0;
    recovery_config.bump = ctx.bumps.recovery_config;

    msg!("Recovery configuration initialized: threshold={}, delay={}s", threshold, recovery_delay);

    Ok(())
}

/// Add a guardian to the recovery network
///
/// Adds a new guardian with their encrypted share. The share must be encrypted
/// client-side with the guardian's public key using X25519.
///
/// # Arguments
/// * `guardian_pubkey` - Guardian's wallet public key
/// * `share_index` - Share index for Shamir Secret Sharing (0 to N-1)
/// * `encrypted_share` - Encrypted share data
/// * `nickname_encrypted` - Optional encrypted nickname
///
/// # Security
/// - Only owner can add guardians
/// - Share must be encrypted with guardian's pubkey
/// - Maximum 10 guardians allowed
pub fn add_guardian_handler(
    ctx: Context<AddGuardian>,
    guardian_pubkey: Pubkey,
    share_index: u8,
    encrypted_share: Vec<u8>,
    nickname_encrypted: Vec<u8>,
) -> Result<()> {
    let recovery_config = &mut ctx.accounts.recovery_config;
    let clock = Clock::get()?;

    // Verify owner
    require!(
        recovery_config.owner == ctx.accounts.owner.key(),
        LockboxError::Unauthorized
    );

    // Check maximum guardians
    require!(
        recovery_config.guardians.len() < MAX_GUARDIANS,
        LockboxError::TooManyGuardians
    );

    // Check guardian doesn't already exist
    require!(
        !recovery_config.guardians.iter().any(|g| g.guardian_pubkey == guardian_pubkey),
        LockboxError::GuardianAlreadyExists
    );

    // SECURITY: Validate share_index is non-zero (1-indexed for Shamir)
    require!(
        share_index > 0 && share_index <= 255,
        LockboxError::InvalidShareIndex
    );

    // SECURITY: Validate share_index is unique (prevents Lagrange interpolation failure)
    require!(
        !recovery_config.guardians.iter().any(|g| g.share_index == share_index),
        LockboxError::DuplicateShareIndex
    );

    // Validate encrypted share size
    require!(
        encrypted_share.len() <= 128,
        LockboxError::InvalidShareSize
    );

    // Validate nickname size
    require!(
        nickname_encrypted.len() <= 64,
        LockboxError::InvalidNicknameSize
    );

    // Add guardian
    recovery_config.guardians.push(Guardian {
        guardian_pubkey,
        share_index,
        encrypted_share,
        added_at: clock.unix_timestamp,
        nickname_encrypted,
        status: GuardianStatus::PendingAcceptance,
    });

    recovery_config.total_guardians = recovery_config.guardians.len() as u8;
    recovery_config.last_modified = clock.unix_timestamp;

    msg!("Guardian added: pubkey={}, share_index={}", guardian_pubkey, share_index);

    Ok(())
}

/// Guardian accepts their role
///
/// Guardian explicitly accepts their role in the recovery network.
/// This activates the guardian and allows them to participate in recovery.
pub fn accept_guardianship_handler(ctx: Context<AcceptGuardianship>) -> Result<()> {
    let recovery_config = &mut ctx.accounts.recovery_config;
    let guardian_pubkey = ctx.accounts.guardian.key();

    // Find guardian
    let guardian = recovery_config
        .guardians
        .iter_mut()
        .find(|g| g.guardian_pubkey == guardian_pubkey)
        .ok_or(LockboxError::GuardianNotFound)?;

    // Verify status is pending
    require!(
        guardian.status == GuardianStatus::PendingAcceptance,
        LockboxError::GuardianAlreadyAccepted
    );

    // Activate guardian
    guardian.status = GuardianStatus::Active;

    msg!("Guardian accepted: pubkey={}", guardian_pubkey);

    Ok(())
}

/// Remove a guardian from the recovery network
///
/// Owner can remove a guardian at any time. This revokes the guardian's
/// ability to participate in recovery.
///
/// # Arguments
/// * `guardian_pubkey` - Guardian to remove
pub fn remove_guardian_handler(
    ctx: Context<RemoveGuardian>,
    guardian_pubkey: Pubkey,
) -> Result<()> {
    let recovery_config = &mut ctx.accounts.recovery_config;
    let clock = Clock::get()?;

    // Verify owner
    require!(
        recovery_config.owner == ctx.accounts.owner.key(),
        LockboxError::Unauthorized
    );

    // Find guardian
    let guardian_index = recovery_config
        .guardians
        .iter()
        .position(|g| g.guardian_pubkey == guardian_pubkey)
        .ok_or(LockboxError::GuardianNotFound)?;

    // SECURITY: Ensure remaining guardians >= threshold after removal
    let remaining_guardians = recovery_config.guardians.len() - 1;
    require!(
        remaining_guardians as u8 >= recovery_config.threshold,
        LockboxError::InsufficientGuardians
    );

    // Remove guardian
    recovery_config.guardians.remove(guardian_index);
    recovery_config.total_guardians = recovery_config.guardians.len() as u8;
    recovery_config.last_modified = clock.unix_timestamp;

    msg!("Guardian removed: pubkey={}, remaining={}", guardian_pubkey, recovery_config.total_guardians);

    Ok(())
}

/// Initiate wallet recovery
///
/// A guardian starts the recovery process. This creates a RecoveryRequest
/// with a time-lock delay. The owner can cancel during this delay.
///
/// # Arguments
/// * `request_id` - Unique request ID (monotonic counter)
/// * `new_owner` - Optional new owner wallet (defaults to requester)
pub fn initiate_recovery_handler(
    ctx: Context<InitiateRecovery>,
    request_id: u64,
    new_owner: Option<Pubkey>,
) -> Result<()> {
    let recovery_config = &mut ctx.accounts.recovery_config;
    let recovery_request = &mut ctx.accounts.recovery_request;
    let clock = Clock::get()?;
    let requester = ctx.accounts.guardian.key();

    // Verify guardian is active
    require!(
        recovery_config.is_active_guardian(&requester),
        LockboxError::NotActiveGuardian
    );

    // SECURITY: Enforce monotonic request_id to prevent replay attacks
    require!(
        request_id > recovery_config.last_request_id,
        LockboxError::InvalidThreshold  // TODO: Add specific error
    );

    // Initialize recovery request
    recovery_request.owner = recovery_config.owner;
    recovery_request.requester = requester;
    recovery_request.request_id = request_id;
    recovery_request.requested_at = clock.unix_timestamp;
    recovery_request.ready_at = clock.unix_timestamp + recovery_config.recovery_delay;
    recovery_request.expires_at = recovery_request.ready_at + RECOVERY_EXPIRATION_PERIOD;
    recovery_request.approvals = Vec::new();
    recovery_request.new_owner = new_owner;
    recovery_request.status = RecoveryStatus::Pending;
    recovery_request.bump = ctx.bumps.recovery_request;

    // Update last request ID
    recovery_config.last_request_id = request_id;

    msg!(
        "Recovery initiated: requester={}, ready_at={}",
        requester,
        recovery_request.ready_at
    );

    // Emit event for owner notification
    emit!(RecoveryInitiatedEvent {
        owner: recovery_config.owner,
        requester,
        request_id,
        ready_at: recovery_request.ready_at,
    });

    Ok(())
}

/// Approve recovery request with guardian share
///
/// Guardian submits their decrypted share to approve the recovery.
/// Once M guardians approve, the recovery can be completed.
///
/// # Arguments
/// * `share_decrypted` - Guardian's decrypted 32-byte share
pub fn approve_recovery_handler(
    ctx: Context<ApproveRecovery>,
    share_decrypted: [u8; 32],
) -> Result<()> {
    let recovery_config = &ctx.accounts.recovery_config;
    let recovery_request = &mut ctx.accounts.recovery_request;
    let clock = Clock::get()?;
    let guardian_pubkey = ctx.accounts.guardian.key();

    // Verify guardian is active
    require!(
        recovery_config.is_active_guardian(&guardian_pubkey),
        LockboxError::NotActiveGuardian
    );

    // Verify recovery is ready (time-lock elapsed)
    require!(
        recovery_request.is_ready(clock.unix_timestamp),
        LockboxError::RecoveryNotReady
    );

    // SECURITY: Check if recovery has expired
    require!(
        clock.unix_timestamp <= recovery_request.expires_at,
        LockboxError::RecoveryExpired
    );

    // Verify guardian hasn't already approved
    require!(
        !recovery_request.has_guardian_approved(&guardian_pubkey),
        LockboxError::GuardianAlreadyApproved
    );

    // Get guardian share index
    let guardian = recovery_config
        .get_guardian(&guardian_pubkey)
        .ok_or(LockboxError::GuardianNotFound)?;

    // Add approval
    recovery_request.approvals.push(RecoveryApproval {
        guardian: guardian_pubkey,
        share_index: guardian.share_index,
        share_decrypted,
        approved_at: clock.unix_timestamp,
    });

    // Check if we have enough approvals
    if recovery_request.has_sufficient_approvals(recovery_config.threshold) {
        recovery_request.status = RecoveryStatus::ReadyForReconstruction;
        msg!("Recovery ready: sufficient approvals collected ({}/{})",
            recovery_request.approvals.len(),
            recovery_config.threshold
        );
    }

    msg!(
        "Recovery approved: guardian={}, approvals={}/{}",
        guardian_pubkey,
        recovery_request.approvals.len(),
        recovery_config.threshold
    );

    Ok(())
}

/// Complete recovery and transfer ownership
///
/// After M guardians approve, the master key can be reconstructed client-side
/// and ownership transferred to the new wallet.
///
/// # NOTE
/// The actual Shamir reconstruction happens CLIENT-SIDE. This instruction
/// only transfers ownership after verification that sufficient shares exist.
pub fn complete_recovery_handler(ctx: Context<CompleteRecovery>) -> Result<()> {
    let recovery_config = &ctx.accounts.recovery_config;
    let recovery_request = &mut ctx.accounts.recovery_request;
    let master_lockbox = &mut ctx.accounts.master_lockbox;

    // Verify sufficient approvals
    require!(
        recovery_request.has_sufficient_approvals(recovery_config.threshold),
        LockboxError::InsufficientApprovals
    );

    // Verify status
    require!(
        recovery_request.status == RecoveryStatus::ReadyForReconstruction,
        LockboxError::RecoveryNotReady
    );

    // Transfer ownership
    let new_owner = recovery_request.new_owner.unwrap_or(recovery_request.requester);
    master_lockbox.owner = new_owner;

    // Mark recovery as completed
    recovery_request.status = RecoveryStatus::Completed;

    msg!("Recovery completed: new_owner={}", new_owner);

    // Emit event
    emit!(RecoveryCompletedEvent {
        previous_owner: recovery_config.owner,
        new_owner,
        request_id: recovery_request.request_id,
    });

    Ok(())
}

/// Cancel an active recovery request
///
/// Owner can cancel a recovery request during the delay period.
/// This prevents unauthorized recovery attempts.
pub fn cancel_recovery_handler(ctx: Context<CancelRecovery>) -> Result<()> {
    let recovery_config = &ctx.accounts.recovery_config;
    let recovery_request = &mut ctx.accounts.recovery_request;

    // Verify owner
    require!(
        recovery_config.owner == ctx.accounts.owner.key(),
        LockboxError::Unauthorized
    );

    // Verify recovery is not yet completed
    require!(
        recovery_request.status != RecoveryStatus::Completed,
        LockboxError::RecoveryAlreadyCompleted
    );

    // Cancel recovery
    recovery_request.status = RecoveryStatus::Cancelled;

    msg!("Recovery cancelled: request_id={}", recovery_request.request_id);

    Ok(())
}

// ============================================================================
// Account Validation Contexts
// ============================================================================

#[derive(Accounts)]
pub struct InitializeRecoveryConfig<'info> {
    #[account(
        init,
        payer = owner,
        space = 8 + RecoveryConfig::INIT_SPACE,
        seeds = [b"recovery_config", owner.key().as_ref()],
        bump
    )]
    pub recovery_config: Account<'info, RecoveryConfig>,

    #[account(
        seeds = [b"master_lockbox", owner.key().as_ref()],
        bump = master_lockbox.bump,
        constraint = master_lockbox.owner == owner.key() @ LockboxError::Unauthorized
    )]
    pub master_lockbox: Account<'info, MasterLockbox>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AddGuardian<'info> {
    #[account(
        mut,
        seeds = [b"recovery_config", owner.key().as_ref()],
        bump = recovery_config.bump,
        constraint = recovery_config.owner == owner.key() @ LockboxError::Unauthorized
    )]
    pub recovery_config: Account<'info, RecoveryConfig>,

    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct AcceptGuardianship<'info> {
    #[account(mut)]
    pub recovery_config: Account<'info, RecoveryConfig>,

    pub guardian: Signer<'info>,
}

#[derive(Accounts)]
pub struct RemoveGuardian<'info> {
    #[account(
        mut,
        seeds = [b"recovery_config", owner.key().as_ref()],
        bump = recovery_config.bump,
        constraint = recovery_config.owner == owner.key() @ LockboxError::Unauthorized
    )]
    pub recovery_config: Account<'info, RecoveryConfig>,

    pub owner: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(request_id: u64)]
pub struct InitiateRecovery<'info> {
    #[account(
        mut,
        seeds = [b"recovery_config", recovery_config.owner.as_ref()],
        bump = recovery_config.bump
    )]
    pub recovery_config: Account<'info, RecoveryConfig>,

    #[account(
        init,
        payer = guardian,
        space = 8 + RecoveryRequest::INIT_SPACE,
        seeds = [b"recovery_request", recovery_config.owner.as_ref(), &request_id.to_le_bytes()],
        bump
    )]
    pub recovery_request: Account<'info, RecoveryRequest>,

    #[account(mut)]
    pub guardian: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ApproveRecovery<'info> {
    pub recovery_config: Account<'info, RecoveryConfig>,

    #[account(mut)]
    pub recovery_request: Account<'info, RecoveryRequest>,

    pub guardian: Signer<'info>,
}

#[derive(Accounts)]
pub struct CompleteRecovery<'info> {
    pub recovery_config: Account<'info, RecoveryConfig>,

    #[account(mut)]
    pub recovery_request: Account<'info, RecoveryRequest>,

    #[account(
        mut,
        seeds = [b"master_lockbox", recovery_config.owner.as_ref()],
        bump = master_lockbox.bump
    )]
    pub master_lockbox: Account<'info, MasterLockbox>,
}

#[derive(Accounts)]
pub struct CancelRecovery<'info> {
    #[account(
        seeds = [b"recovery_config", owner.key().as_ref()],
        bump = recovery_config.bump,
        constraint = recovery_config.owner == owner.key() @ LockboxError::Unauthorized
    )]
    pub recovery_config: Account<'info, RecoveryConfig>,

    #[account(mut)]
    pub recovery_request: Account<'info, RecoveryRequest>,

    pub owner: Signer<'info>,
}

// ============================================================================
// Events
// ============================================================================

#[event]
pub struct RecoveryInitiatedEvent {
    pub owner: Pubkey,
    pub requester: Pubkey,
    pub request_id: u64,
    pub ready_at: i64,
}

#[event]
pub struct RecoveryCompletedEvent {
    pub previous_owner: Pubkey,
    pub new_owner: Pubkey,
    pub request_id: u64,
}
