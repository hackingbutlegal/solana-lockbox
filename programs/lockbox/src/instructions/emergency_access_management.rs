//! # Emergency Access Instructions (Dead Man's Switch)
//!
//! This module implements the instruction handlers for emergency access,
//! allowing users to designate emergency contacts who gain access after
//! a period of inactivity.
//!
//! ## Instruction Flow
//!
//! ### Setup Phase
//! 1. `initialize_emergency_access` - Owner creates emergency access config
//! 2. `add_emergency_contact` - Owner adds emergency contacts with access levels
//! 3. `accept_emergency_contact` - Contact accepts their role
//! 4. `remove_emergency_contact` - Owner removes a contact
//!
//! ### Activity Tracking
//! 1. `record_activity` - Called on every password operation (extends countdown)
//! 2. `manual_activity_ping` - Owner manually signals they're alive
//!
//! ### Emergency Activation
//! 1. `check_and_start_countdown` - Cron job checks inactivity
//! 2. `activate_emergency_access` - After grace period, grant access
//! 3. `cancel_emergency_countdown` - Owner cancels countdown

use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;

/// Initialize emergency access configuration
///
/// Creates the EmergencyAccess account for a user. Requires Premium or
/// Enterprise subscription.
///
/// # Arguments
/// * `inactivity_period` - Time in seconds before countdown starts (e.g., 90 days)
/// * `grace_period` - Time after countdown to grant access (e.g., 7 days)
pub fn initialize_emergency_access_handler(
    ctx: Context<InitializeEmergencyAccess>,
    inactivity_period: i64,
    grace_period: i64,
) -> Result<()> {
    let emergency_access = &mut ctx.accounts.emergency_access;
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

    // Validate inactivity period
    require!(
        inactivity_period >= MIN_INACTIVITY_PERIOD && inactivity_period <= MAX_INACTIVITY_PERIOD,
        LockboxError::InvalidInactivityPeriod
    );

    // Validate grace period
    require!(
        grace_period >= MIN_RECOVERY_DELAY,
        LockboxError::InvalidGracePeriod
    );

    // Initialize emergency access
    emergency_access.owner = ctx.accounts.owner.key();
    emergency_access.emergency_contacts = Vec::new();
    emergency_access.inactivity_period = inactivity_period;
    emergency_access.grace_period = grace_period;
    emergency_access.last_activity = clock.unix_timestamp;
    emergency_access.countdown_started = None;
    emergency_access.status = EmergencyStatus::Active;
    emergency_access.created_at = clock.unix_timestamp;
    emergency_access.bump = ctx.bumps.emergency_access;

    msg!(
        "Emergency access initialized: inactivity={}s, grace={}s",
        inactivity_period,
        grace_period
    );

    Ok(())
}

/// Add an emergency contact
///
/// Adds a new emergency contact with their access level and encrypted key.
///
/// # Arguments
/// * `contact_pubkey` - Contact's wallet public key
/// * `contact_name_encrypted` - Encrypted contact name
/// * `access_level` - Access level granted to contact
/// * `encrypted_key` - Vault key encrypted with contact's pubkey
pub fn add_emergency_contact_handler(
    ctx: Context<AddEmergencyContact>,
    contact_pubkey: Pubkey,
    contact_name_encrypted: Vec<u8>,
    access_level: EmergencyAccessLevel,
    encrypted_key: Vec<u8>,
) -> Result<()> {
    let emergency_access = &mut ctx.accounts.emergency_access;
    let clock = Clock::get()?;

    // Verify owner
    require!(
        emergency_access.owner == ctx.accounts.owner.key(),
        LockboxError::Unauthorized
    );

    // Check maximum contacts
    require!(
        emergency_access.emergency_contacts.len() < MAX_EMERGENCY_CONTACTS,
        LockboxError::TooManyContacts
    );

    // Check contact doesn't already exist
    require!(
        !emergency_access
            .emergency_contacts
            .iter()
            .any(|c| c.contact_pubkey == contact_pubkey),
        LockboxError::ContactAlreadyExists
    );

    // Validate sizes
    require!(
        contact_name_encrypted.len() <= 64,
        LockboxError::InvalidNicknameSize
    );
    require!(
        encrypted_key.len() <= 128,
        LockboxError::InvalidKeySize
    );

    // Add contact
    emergency_access.emergency_contacts.push(EmergencyContact {
        contact_pubkey,
        contact_name_encrypted,
        access_level,
        encrypted_key,
        added_at: clock.unix_timestamp,
        access_granted_at: None,
        status: EmergencyContactStatus::PendingAcceptance,
    });

    msg!(
        "Emergency contact added: pubkey={}, level={:?}",
        contact_pubkey,
        access_level
    );

    Ok(())
}

/// Emergency contact accepts their role
///
/// Contact explicitly accepts their role in emergency access.
pub fn accept_emergency_contact_handler(ctx: Context<AcceptEmergencyContact>) -> Result<()> {
    let emergency_access = &mut ctx.accounts.emergency_access;
    let contact_pubkey = ctx.accounts.contact.key();

    // Find contact
    let contact = emergency_access
        .emergency_contacts
        .iter_mut()
        .find(|c| c.contact_pubkey == contact_pubkey)
        .ok_or(LockboxError::ContactNotFound)?;

    // Verify status is pending
    require!(
        contact.status == EmergencyContactStatus::PendingAcceptance,
        LockboxError::ContactAlreadyAccepted
    );

    // Activate contact
    contact.status = EmergencyContactStatus::Active;

    msg!("Emergency contact accepted: pubkey={}", contact_pubkey);

    Ok(())
}

/// Remove an emergency contact
///
/// Owner can remove an emergency contact at any time.
///
/// # Arguments
/// * `contact_pubkey` - Contact to remove
pub fn remove_emergency_contact_handler(
    ctx: Context<RemoveEmergencyContact>,
    contact_pubkey: Pubkey,
) -> Result<()> {
    let emergency_access = &mut ctx.accounts.emergency_access;

    // Verify owner
    require!(
        emergency_access.owner == ctx.accounts.owner.key(),
        LockboxError::Unauthorized
    );

    // Find and remove contact
    let contact_index = emergency_access
        .emergency_contacts
        .iter()
        .position(|c| c.contact_pubkey == contact_pubkey)
        .ok_or(LockboxError::ContactNotFound)?;

    emergency_access.emergency_contacts.remove(contact_index);

    msg!("Emergency contact removed: pubkey={}", contact_pubkey);

    Ok(())
}

/// Record activity (called on password operations)
///
/// This instruction should be called as part of password store/retrieve/update
/// operations to track user activity and reset the countdown.
pub fn record_activity_handler(ctx: Context<RecordActivity>) -> Result<()> {
    let emergency_access = &mut ctx.accounts.emergency_access;
    let clock = Clock::get()?;

    emergency_access.record_activity(clock.unix_timestamp);

    msg!("Activity recorded: countdown reset");

    Ok(())
}

/// Manual activity ping
///
/// Owner can manually signal they're alive to reset the countdown.
/// This is useful as a "I'm alive" button in the UI.
pub fn manual_activity_ping_handler(ctx: Context<ManualActivityPing>) -> Result<()> {
    let emergency_access = &mut ctx.accounts.emergency_access;
    let clock = Clock::get()?;

    // Verify owner
    require!(
        emergency_access.owner == ctx.accounts.owner.key(),
        LockboxError::Unauthorized
    );

    emergency_access.record_activity(clock.unix_timestamp);

    msg!("Manual activity ping: countdown reset");

    Ok(())
}

/// Check and start countdown
///
/// Cron job instruction to check for inactivity and start countdown.
/// Anyone can call this (designed for cron bots).
pub fn check_and_start_countdown_handler(ctx: Context<CheckAndStartCountdown>) -> Result<()> {
    let emergency_access = &mut ctx.accounts.emergency_access;
    let clock = Clock::get()?;

    // Check if countdown should start
    if emergency_access.should_start_countdown(clock.unix_timestamp) {
        emergency_access.start_countdown(clock.unix_timestamp);

        msg!(
            "Emergency countdown started: grace_period_ends={}",
            clock.unix_timestamp + emergency_access.grace_period
        );

        // Emit event for notifications
        emit!(EmergencyCountdownStartedEvent {
            owner: emergency_access.owner,
            countdown_started: clock.unix_timestamp,
            grace_period_ends: clock.unix_timestamp + emergency_access.grace_period,
        });
    }

    Ok(())
}

/// Activate emergency access
///
/// After grace period elapses, grant access to all active emergency contacts.
/// Anyone can call this (designed for cron bots).
pub fn activate_emergency_access_handler(ctx: Context<ActivateEmergencyAccess>) -> Result<()> {
    let emergency_access = &mut ctx.accounts.emergency_access;
    let clock = Clock::get()?;

    // Verify grace period has elapsed
    require!(
        emergency_access.should_activate_emergency(clock.unix_timestamp),
        LockboxError::GracePeriodNotElapsed
    );

    emergency_access.activate_emergency(clock.unix_timestamp);

    msg!(
        "Emergency access activated: {} contacts granted access",
        emergency_access.active_contact_count()
    );

    // Emit event
    emit!(EmergencyAccessActivatedEvent {
        owner: emergency_access.owner,
        contacts_count: emergency_access.active_contact_count() as u8,
        activated_at: clock.unix_timestamp,
    });

    Ok(())
}

/// Cancel emergency countdown
///
/// Owner cancels an active countdown. This is called when the owner
/// returns and wants to stop the emergency access process.
pub fn cancel_emergency_countdown_handler(ctx: Context<CancelEmergencyCountdown>) -> Result<()> {
    let emergency_access = &mut ctx.accounts.emergency_access;
    let clock = Clock::get()?;

    // Verify owner
    require!(
        emergency_access.owner == ctx.accounts.owner.key(),
        LockboxError::Unauthorized
    );

    // Verify countdown is active
    require!(
        emergency_access.status == EmergencyStatus::CountdownStarted,
        LockboxError::NoActiveCountdown
    );

    emergency_access.cancel_countdown(clock.unix_timestamp);

    msg!("Emergency countdown cancelled");

    Ok(())
}

// ============================================================================
// Account Validation Contexts
// ============================================================================

#[derive(Accounts)]
pub struct InitializeEmergencyAccess<'info> {
    #[account(
        init,
        payer = owner,
        space = 8 + EmergencyAccess::INIT_SPACE,
        seeds = [b"emergency_access", owner.key().as_ref()],
        bump
    )]
    pub emergency_access: Account<'info, EmergencyAccess>,

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
pub struct AddEmergencyContact<'info> {
    #[account(
        mut,
        seeds = [b"emergency_access", owner.key().as_ref()],
        bump = emergency_access.bump,
        constraint = emergency_access.owner == owner.key() @ LockboxError::Unauthorized
    )]
    pub emergency_access: Account<'info, EmergencyAccess>,

    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct AcceptEmergencyContact<'info> {
    #[account(mut)]
    pub emergency_access: Account<'info, EmergencyAccess>,

    pub contact: Signer<'info>,
}

#[derive(Accounts)]
pub struct RemoveEmergencyContact<'info> {
    #[account(
        mut,
        seeds = [b"emergency_access", owner.key().as_ref()],
        bump = emergency_access.bump,
        constraint = emergency_access.owner == owner.key() @ LockboxError::Unauthorized
    )]
    pub emergency_access: Account<'info, EmergencyAccess>,

    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct RecordActivity<'info> {
    #[account(
        mut,
        seeds = [b"emergency_access", emergency_access.owner.as_ref()],
        bump = emergency_access.bump
    )]
    pub emergency_access: Account<'info, EmergencyAccess>,
}

#[derive(Accounts)]
pub struct ManualActivityPing<'info> {
    #[account(
        mut,
        seeds = [b"emergency_access", owner.key().as_ref()],
        bump = emergency_access.bump,
        constraint = emergency_access.owner == owner.key() @ LockboxError::Unauthorized
    )]
    pub emergency_access: Account<'info, EmergencyAccess>,

    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct CheckAndStartCountdown<'info> {
    #[account(mut)]
    pub emergency_access: Account<'info, EmergencyAccess>,
}

#[derive(Accounts)]
pub struct ActivateEmergencyAccess<'info> {
    #[account(mut)]
    pub emergency_access: Account<'info, EmergencyAccess>,
}

#[derive(Accounts)]
pub struct CancelEmergencyCountdown<'info> {
    #[account(
        mut,
        seeds = [b"emergency_access", owner.key().as_ref()],
        bump = emergency_access.bump,
        constraint = emergency_access.owner == owner.key() @ LockboxError::Unauthorized
    )]
    pub emergency_access: Account<'info, EmergencyAccess>,

    pub owner: Signer<'info>,
}

// ============================================================================
// Events
// ============================================================================

#[event]
pub struct EmergencyCountdownStartedEvent {
    pub owner: Pubkey,
    pub countdown_started: i64,
    pub grace_period_ends: i64,
}

#[event]
pub struct EmergencyAccessActivatedEvent {
    pub owner: Pubkey,
    pub contacts_count: u8,
    pub activated_at: i64,
}
