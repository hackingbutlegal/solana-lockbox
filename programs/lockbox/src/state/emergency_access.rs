//! # Emergency Access State Structures (Dead Man's Switch)
//!
//! This module defines the on-chain state for emergency access, also known as
//! a "dead man's switch". It allows users to designate emergency contacts who
//! gain access to the vault after a period of inactivity.
//!
//! ## Architecture
//!
//! - **EmergencyAccess**: Configuration for inactivity monitoring and emergency contacts
//! - **EmergencyContact**: Individual contact with access level and encrypted emergency key
//! - **ActivityLog**: Track user activity to detect inactivity
//!
//! ## Security Model
//!
//! 1. **Inactivity Detection**:
//!    - User sets inactivity period (e.g., 90 days)
//!    - Every password operation updates last_activity timestamp
//!    - Cron job checks for inactivity threshold
//!
//! 2. **Two-Stage Countdown**:
//!    - Stage 1: Inactivity detected → countdown starts
//!    - Owner receives notifications (email/SMS/on-chain events)
//!    - Grace period (e.g., 7 days) to cancel
//!    - Stage 2: Grace period expires → emergency access granted
//!
//! 3. **Emergency Contacts**:
//!    - Owner designates trusted contacts
//!    - Each contact has specific access level
//!    - Contacts receive encrypted emergency keys
//!    - Access automatically revokes when owner returns
//!
//! 4. **Activity Tracking**:
//!    - Every password operation extends countdown
//!    - Manual "I'm alive" button in UI
//!    - Activity notifications to emergency contacts

use anchor_lang::prelude::*;

/// Maximum number of emergency contacts
pub const MAX_EMERGENCY_CONTACTS: usize = 5;

/// Default inactivity period: 90 days in seconds
pub const DEFAULT_INACTIVITY_PERIOD: i64 = 90 * 24 * 60 * 60;

/// Minimum inactivity period: 30 days
pub const MIN_INACTIVITY_PERIOD: i64 = 30 * 24 * 60 * 60;

/// Maximum inactivity period: 1 year
pub const MAX_INACTIVITY_PERIOD: i64 = 365 * 24 * 60 * 60;

/// Default grace period: 7 days
pub const DEFAULT_GRACE_PERIOD: i64 = 7 * 24 * 60 * 60;

/// Emergency access configuration account
///
/// Stores the emergency contacts and inactivity monitoring settings.
/// Each user has one EmergencyAccess account derived from their wallet.
///
/// # PDA Derivation
/// Seeds: ["emergency_access", owner_pubkey]
///
/// # Storage Layout
/// - Fixed: ~200 bytes (without contacts)
/// - Variable: ~200 bytes per contact
/// - Max: ~1200 bytes (5 contacts)
#[account]
#[derive(InitSpace)]
pub struct EmergencyAccess {
    /// Owner of this emergency access configuration
    pub owner: Pubkey,

    /// List of designated emergency contacts
    #[max_len(MAX_EMERGENCY_CONTACTS)]
    pub emergency_contacts: Vec<EmergencyContact>,

    /// Inactivity period in seconds (e.g., 90 days)
    pub inactivity_period: i64,

    /// Grace period in seconds after countdown starts (e.g., 7 days)
    pub grace_period: i64,

    /// Unix timestamp of last activity (updated on any password operation)
    pub last_activity: i64,

    /// Unix timestamp when countdown started (None if not started)
    pub countdown_started: Option<i64>,

    /// Current status of emergency access
    pub status: EmergencyStatus,

    /// Unix timestamp when this config was created
    pub created_at: i64,

    /// PDA bump seed
    pub bump: u8,
}

/// Emergency contact struct
///
/// Represents a trusted contact who can gain access to the vault
/// after the owner's inactivity period.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct EmergencyContact {
    /// Contact's wallet public key
    pub contact_pubkey: Pubkey,

    /// Encrypted contact name (e.g., "Spouse", "Lawyer")
    /// Max 32 bytes encrypted
    #[max_len(64)]
    pub contact_name_encrypted: Vec<u8>,

    /// Access level granted to this contact
    pub access_level: EmergencyAccessLevel,

    /// Encrypted emergency key (vault key encrypted with contact's pubkey)
    /// Format: [ephemeral_pubkey(32) | nonce(24) | encrypted_key(32) | tag(16)]
    #[max_len(128)]
    pub encrypted_key: Vec<u8>,

    /// Unix timestamp when contact was added
    pub added_at: i64,

    /// Unix timestamp when access was granted (None if not yet granted)
    pub access_granted_at: Option<i64>,

    /// Contact status
    pub status: EmergencyContactStatus,
}

/// Emergency access level enum
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum EmergencyAccessLevel {
    /// Can view specified entries only
    ViewOnly,

    /// Can view and export all entries
    FullAccess,

    /// Can take full ownership and control
    TransferOwnership,
}

/// Emergency contact status
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum EmergencyContactStatus {
    /// Pending contact acceptance
    PendingAcceptance,

    /// Active and will receive access on emergency
    Active,

    /// Revoked by owner
    Revoked,

    /// Access granted (emergency activated)
    AccessGranted,
}

/// Emergency access status
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum EmergencyStatus {
    /// Normal operation, user is active
    Active,

    /// No activity detected, countdown started
    CountdownStarted,

    /// Grace period elapsed, emergency access granted
    EmergencyActive,

    /// Owner cancelled countdown
    Cancelled,
}

impl EmergencyAccess {
    /// Check if inactivity period is within allowed bounds
    pub fn is_inactivity_period_valid(&self) -> bool {
        self.inactivity_period >= MIN_INACTIVITY_PERIOD
            && self.inactivity_period <= MAX_INACTIVITY_PERIOD
    }

    /// Check if enough time has passed to start countdown
    pub fn should_start_countdown(&self, current_time: i64) -> bool {
        self.status == EmergencyStatus::Active
            && (current_time - self.last_activity) >= self.inactivity_period
    }

    /// Check if grace period has elapsed and emergency should activate
    pub fn should_activate_emergency(&self, current_time: i64) -> bool {
        if let Some(countdown_start) = self.countdown_started {
            self.status == EmergencyStatus::CountdownStarted
                && (current_time - countdown_start) >= self.grace_period
        } else {
            false
        }
    }

    /// Record activity (resets countdown)
    pub fn record_activity(&mut self, current_time: i64) {
        self.last_activity = current_time;
        self.countdown_started = None;
        self.status = EmergencyStatus::Active;
    }

    /// Start countdown
    pub fn start_countdown(&mut self, current_time: i64) {
        self.countdown_started = Some(current_time);
        self.status = EmergencyStatus::CountdownStarted;
    }

    /// Activate emergency access
    pub fn activate_emergency(&mut self, current_time: i64) {
        self.status = EmergencyStatus::EmergencyActive;
        // Grant access to all active emergency contacts
        for contact in &mut self.emergency_contacts {
            if contact.status == EmergencyContactStatus::Active {
                contact.status = EmergencyContactStatus::AccessGranted;
                contact.access_granted_at = Some(current_time);
            }
        }
    }

    /// Cancel countdown (owner is back)
    pub fn cancel_countdown(&mut self, current_time: i64) {
        self.last_activity = current_time;
        self.countdown_started = None;
        self.status = EmergencyStatus::Active;
    }

    /// Get contact by pubkey
    pub fn get_contact(&self, pubkey: &Pubkey) -> Option<&EmergencyContact> {
        self.emergency_contacts
            .iter()
            .find(|c| &c.contact_pubkey == pubkey)
    }

    /// Check if contact has access granted
    pub fn has_access_granted(&self, pubkey: &Pubkey) -> bool {
        self.emergency_contacts.iter().any(|c| {
            &c.contact_pubkey == pubkey && c.status == EmergencyContactStatus::AccessGranted
        })
    }

    /// Count active emergency contacts
    pub fn active_contact_count(&self) -> usize {
        self.emergency_contacts
            .iter()
            .filter(|c| c.status == EmergencyContactStatus::Active)
            .count()
    }
}
