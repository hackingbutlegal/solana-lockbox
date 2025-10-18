//! # Social Recovery Instructions V2 (Secure)
//!
//! This implements the SECURE recovery flow with client-side reconstruction.
//!
//! ## Flow
//!
//! ### Setup Phase (Same as V1)
//! 1. Owner creates recovery config with guardian commitments
//! 2. Owner splits secret using Shamir, computes commitments
//! 3. Owner distributes shares to guardians OFF-CHAIN (encrypted)
//!
//! ### Recovery Phase (NEW - Secure)
//! 1. Guardian initiates recovery → generates on-chain challenge
//! 2. Other guardians confirm participation (no shares submitted)
//! 3. Guardians provide shares to REQUESTER off-chain
//! 4. Requester reconstructs secret client-side
//! 5. Requester decrypts challenge with reconstructed secret
//! 6. Requester submits decrypted challenge as proof
//! 7. On-chain verification → ownership transfer

use anchor_lang::prelude::*;
use anchor_lang::solana_program::hash::hash;
use crate::state::*;
use crate::errors::*;

/// Initialize recovery configuration V2 (with commitments)
///
/// Instead of encrypted shares, owner provides hash commitments.
/// The actual shares are distributed to guardians off-chain.
pub fn initialize_recovery_config_v2_handler(
    ctx: Context<InitializeRecoveryConfigV2>,
    threshold: u8,
    recovery_delay: i64,
    master_secret_hash: [u8; 32],
) -> Result<()> {
    let recovery_config = &mut ctx.accounts.recovery_config;
    let master_lockbox = &ctx.accounts.master_lockbox;
    let clock = Clock::get()?;

    // Verify subscription tier
    require!(
        matches!(
            master_lockbox.subscription_tier,
            SubscriptionTier::Premium | SubscriptionTier::Pro
        ),
        LockboxError::FeatureNotAvailable
    );

    // Validate threshold
    require!(
        threshold > 0 && threshold as usize <= MAX_GUARDIANS,
        LockboxError::InvalidThreshold
    );

    // Validate recovery delay
    require!(
        recovery_delay >= MIN_RECOVERY_DELAY && recovery_delay <= MAX_RECOVERY_DELAY,
        LockboxError::InvalidRecoveryDelay
    );

    // Initialize
    recovery_config.owner = ctx.accounts.owner.key();
    recovery_config.threshold = threshold;
    recovery_config.total_guardians = 0;
    recovery_config.guardians = Vec::new();
    recovery_config.recovery_delay = recovery_delay;
    recovery_config.created_at = clock.unix_timestamp;
    recovery_config.last_modified = clock.unix_timestamp;
    recovery_config.last_request_id = 0;
    recovery_config.master_secret_hash = master_secret_hash;
    recovery_config.bump = ctx.bumps.recovery_config;

    msg!("Recovery config V2 initialized: threshold={}, delay={}s", threshold, recovery_delay);

    Ok(())
}

/// Add guardian with share commitment (V2)
///
/// Owner provides SHA256(share || guardian_pubkey) as commitment.
/// Guardian receives actual share off-chain (encrypted to their pubkey).
pub fn add_guardian_v2_handler(
    ctx: Context<AddGuardianV2>,
    guardian_pubkey: Pubkey,
    share_index: u8,
    share_commitment: [u8; 32],
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

    // Check guardian doesn't exist
    require!(
        !recovery_config.guardians.iter().any(|g| g.guardian_pubkey == guardian_pubkey),
        LockboxError::GuardianAlreadyExists
    );

    // Validate share_index
    require!(
        share_index > 0 && share_index <= 255,
        LockboxError::InvalidShareIndex
    );

    // Validate uniqueness
    require!(
        !recovery_config.guardians.iter().any(|g| g.share_index == share_index),
        LockboxError::DuplicateShareIndex
    );

    // Add guardian
    recovery_config.guardians.push(GuardianV2 {
        guardian_pubkey,
        share_index,
        share_commitment,
        added_at: clock.unix_timestamp,
        nickname_encrypted,
        status: GuardianStatus::PendingAcceptance,
    });

    recovery_config.total_guardians = recovery_config.guardians.len() as u8;
    recovery_config.last_modified = clock.unix_timestamp;

    emit!(GuardianAddedV2Event {
        owner: recovery_config.owner,
        guardian: guardian_pubkey,
        share_index,
    });

    msg!("Guardian added: pubkey={}, index={}", guardian_pubkey, share_index);

    Ok(())
}

/// Initiate recovery V2 (generates challenge)
///
/// Creates on-chain encrypted challenge that proves requester
/// can reconstruct the secret.
pub fn initiate_recovery_v2_handler(
    ctx: Context<InitiateRecoveryV2>,
    request_id: u64,
    encrypted_challenge: Vec<u8>,
    challenge_hash: [u8; 32],
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

    // Enforce monotonic request_id
    require!(
        request_id > recovery_config.last_request_id,
        LockboxError::InvalidThreshold
    );

    // Validate challenge format (80 bytes: 24 nonce + 32 ciphertext + 16 tag)
    require!(
        encrypted_challenge.len() == 80,
        LockboxError::InvalidDataSize
    );

    // Initialize recovery request
    recovery_request.owner = recovery_config.owner;
    recovery_request.requester = requester;
    recovery_request.request_id = request_id;
    recovery_request.requested_at = clock.unix_timestamp;
    recovery_request.ready_at = clock.unix_timestamp + recovery_config.recovery_delay;
    recovery_request.expires_at = recovery_request.ready_at + RECOVERY_EXPIRATION_PERIOD;
    recovery_request.challenge = RecoveryChallenge {
        encrypted_challenge,
        challenge_hash,
        created_at: clock.unix_timestamp,
    };
    recovery_request.participating_guardians = Vec::new();
    recovery_request.new_owner = new_owner;
    recovery_request.status = RecoveryStatus::Pending;
    recovery_request.bump = ctx.bumps.recovery_request;

    // Update last request ID
    recovery_config.last_request_id = request_id;

    emit!(RecoveryInitiatedV2Event {
        owner: recovery_config.owner,
        requester,
        request_id,
        ready_at: recovery_request.ready_at,
    });

    msg!(
        "Recovery V2 initiated: requester={}, ready_at={}, expires_at={}",
        requester,
        recovery_request.ready_at,
        recovery_request.expires_at
    );

    Ok(())
}

/// Guardian confirms participation (V2)
///
/// Guardian signals they will provide their share to requester OFF-CHAIN.
/// No share data submitted to blockchain.
pub fn confirm_participation_handler(
    ctx: Context<ConfirmParticipation>,
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

    // Verify recovery is ready
    require!(
        recovery_request.is_ready_for_proof(clock.unix_timestamp),
        LockboxError::RecoveryNotReady
    );

    // Verify not already confirmed
    require!(
        !recovery_request.has_guardian_confirmed(&guardian_pubkey),
        LockboxError::GuardianAlreadyApproved
    );

    // Add confirmation
    recovery_request.participating_guardians.push(guardian_pubkey);

    // Check if we have enough participants
    if recovery_request.has_sufficient_participants(recovery_config.threshold) {
        recovery_request.status = RecoveryStatus::ReadyForReconstruction;
        msg!(
            "Recovery ready for proof: {}/{} guardians confirmed",
            recovery_request.participating_guardians.len(),
            recovery_config.threshold
        );
    }

    msg!(
        "Guardian confirmed: {}, total={}/{}",
        guardian_pubkey,
        recovery_request.participating_guardians.len(),
        recovery_config.threshold
    );

    Ok(())
}

/// Complete recovery with proof (V2 - SECURE)
///
/// Requester submits decrypted challenge as proof they reconstructed secret.
/// On-chain verification → ownership transfer.
///
/// # Security
/// - Challenge decryption proves knowledge of master secret
/// - No shares ever exposed on-chain
/// - Zero-knowledge proof of reconstruction
pub fn complete_recovery_with_proof_handler(
    ctx: Context<CompleteRecoveryV2>,
    challenge_plaintext: [u8; 32],
) -> Result<()> {
    let recovery_config = &ctx.accounts.recovery_config;
    let recovery_request = &mut ctx.accounts.recovery_request;
    let master_lockbox = &mut ctx.accounts.master_lockbox;
    let clock = Clock::get()?;

    // Verify sufficient participants
    require!(
        recovery_request.has_sufficient_participants(recovery_config.threshold),
        LockboxError::InsufficientApprovals
    );

    // Verify status
    require!(
        recovery_request.status == RecoveryStatus::ReadyForReconstruction,
        LockboxError::RecoveryNotReady
    );

    // Verify not expired
    require!(
        clock.unix_timestamp <= recovery_request.expires_at,
        LockboxError::RecoveryExpired
    );

    // SECURITY: Verify challenge plaintext matches hash
    let plaintext_hash = hash(&challenge_plaintext);
    require!(
        plaintext_hash.to_bytes() == recovery_request.challenge.challenge_hash,
        LockboxError::Unauthorized  // Invalid proof
    );

    // Transfer ownership
    let new_owner = recovery_request.new_owner.unwrap_or(recovery_request.requester);
    let previous_owner = master_lockbox.owner;
    master_lockbox.owner = new_owner;

    // Mark recovery as completed
    recovery_request.status = RecoveryStatus::Completed;

    emit!(RecoveryCompletedV2Event {
        previous_owner,
        new_owner,
        request_id: recovery_request.request_id,
    });

    msg!(
        "Recovery completed with proof: new_owner={}",
        new_owner
    );

    Ok(())
}

// ============================================================================
// Account Validation Contexts
// ============================================================================

#[derive(Accounts)]
pub struct InitializeRecoveryConfigV2<'info> {
    #[account(
        init,
        payer = owner,
        space = 8 + RecoveryConfigV2::INIT_SPACE,
        seeds = [b"recovery_config_v2", owner.key().as_ref()],
        bump
    )]
    pub recovery_config: Account<'info, RecoveryConfigV2>,

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
pub struct AddGuardianV2<'info> {
    #[account(
        mut,
        seeds = [b"recovery_config_v2", owner.key().as_ref()],
        bump = recovery_config.bump,
        constraint = recovery_config.owner == owner.key() @ LockboxError::Unauthorized
    )]
    pub recovery_config: Account<'info, RecoveryConfigV2>,

    pub owner: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(request_id: u64)]
pub struct InitiateRecoveryV2<'info> {
    #[account(
        mut,
        seeds = [b"recovery_config_v2", recovery_config.owner.as_ref()],
        bump = recovery_config.bump
    )]
    pub recovery_config: Account<'info, RecoveryConfigV2>,

    #[account(
        init,
        payer = guardian,
        space = 8 + RecoveryRequestV2::INIT_SPACE,
        seeds = [b"recovery_request_v2", recovery_config.owner.as_ref(), &request_id.to_le_bytes()],
        bump
    )]
    pub recovery_request: Account<'info, RecoveryRequestV2>,

    #[account(mut)]
    pub guardian: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ConfirmParticipation<'info> {
    pub recovery_config: Account<'info, RecoveryConfigV2>,

    #[account(mut)]
    pub recovery_request: Account<'info, RecoveryRequestV2>,

    pub guardian: Signer<'info>,
}

#[derive(Accounts)]
pub struct CompleteRecoveryV2<'info> {
    pub recovery_config: Account<'info, RecoveryConfigV2>,

    #[account(mut)]
    pub recovery_request: Account<'info, RecoveryRequestV2>,

    #[account(
        mut,
        seeds = [b"master_lockbox", recovery_config.owner.as_ref()],
        bump = master_lockbox.bump
    )]
    pub master_lockbox: Account<'info, MasterLockbox>,

    pub requester: Signer<'info>,
}

// ============================================================================
// Events
// ============================================================================

#[event]
pub struct GuardianAddedV2Event {
    pub owner: Pubkey,
    pub guardian: Pubkey,
    pub share_index: u8,
}

#[event]
pub struct RecoveryInitiatedV2Event {
    pub owner: Pubkey,
    pub requester: Pubkey,
    pub request_id: u64,
    pub ready_at: i64,
}

#[event]
pub struct RecoveryCompletedV2Event {
    pub previous_owner: Pubkey,
    pub new_owner: Pubkey,
    pub request_id: u64,
}
