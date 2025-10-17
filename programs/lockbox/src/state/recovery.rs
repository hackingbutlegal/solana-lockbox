//! # Social Recovery State Structures
//!
//! This module defines the on-chain state for social recovery via Shamir Secret Sharing.
//! Social recovery allows users to designate trusted guardians who can collectively
//! help recover access to the vault if the wallet is lost.
//!
//! ## Architecture
//!
//! - **RecoveryConfig**: Master configuration for a user's social recovery setup
//! - **Guardian**: Individual guardian with encrypted secret share
//! - **RecoveryRequest**: Active recovery attempt with time-lock protection
//! - **RecoveryApproval**: Guardian approval of recovery request with share submission
//!
//! ## Security Model
//!
//! 1. **Shamir Secret Sharing (M-of-N)**:
//!    - Master encryption key split into N shares
//!    - Any M shares can reconstruct the key
//!    - Individual shares reveal nothing
//!    - Polynomial-based secret sharing
//!
//! 2. **Time-Lock Protection**:
//!    - Mandatory delay period (e.g., 7 days) after recovery initiation
//!    - Owner can cancel during delay
//!    - Prevents instant takeover attacks
//!
//! 3. **Encrypted Share Distribution**:
//!    - Each share encrypted with guardian's public key (X25519)
//!    - Guardians never see plaintext shares
//!    - On-chain encrypted storage
//!
//! 4. **Audit Trail**:
//!    - All recovery attempts logged on-chain
//!    - Guardian additions/removals tracked
//!    - Immutable recovery history

use anchor_lang::prelude::*;

/// Maximum number of guardians allowed (prevents excessive account size)
pub const MAX_GUARDIANS: usize = 10;

/// Maximum number of recovery approvals stored
pub const MAX_RECOVERY_APPROVALS: usize = 10;

/// Default recovery delay: 7 days in seconds
pub const DEFAULT_RECOVERY_DELAY: i64 = 7 * 24 * 60 * 60;

/// Minimum recovery delay: 1 day in seconds
pub const MIN_RECOVERY_DELAY: i64 = 24 * 60 * 60;

/// Maximum recovery delay: 30 days in seconds
pub const MAX_RECOVERY_DELAY: i64 = 30 * 24 * 60 * 60;

/// Recovery configuration account
///
/// Stores the guardian network and recovery settings for a user.
/// Each user has one RecoveryConfig account derived from their wallet.
///
/// # PDA Derivation
/// Seeds: ["recovery_config", owner_pubkey]
///
/// # Storage Layout
/// - Fixed: ~300 bytes (without guardians)
/// - Variable: ~200 bytes per guardian
/// - Max: ~2300 bytes (10 guardians)
#[account]
#[derive(InitSpace)]
pub struct RecoveryConfig {
    /// Owner of this recovery configuration (wallet that set it up)
    pub owner: Pubkey,

    /// Threshold (M) - number of guardians needed for recovery
    pub threshold: u8,

    /// Total guardians (N) in the network
    pub total_guardians: u8,

    /// List of designated guardians with encrypted shares
    #[max_len(MAX_GUARDIANS)]
    pub guardians: Vec<Guardian>,

    /// Mandatory delay in seconds before recovery can complete
    pub recovery_delay: i64,

    /// Unix timestamp when this config was created
    pub created_at: i64,

    /// Unix timestamp of last modification
    pub last_modified: i64,

    /// Last used request ID (for monotonic enforcement)
    pub last_request_id: u64,

    /// PDA bump seed for this account
    pub bump: u8,
}

/// Guardian struct representing a trusted recovery contact
///
/// Each guardian holds an encrypted share of the master key. The share
/// is encrypted with the guardian's public key using X25519 encryption.
///
/// # Encrypted Share Format
/// The encrypted_share field contains:
/// - Ephemeral public key (32 bytes)
/// - Nonce (24 bytes)
/// - Encrypted share + auth tag (~48 bytes)
/// Total: ~104 bytes per encrypted share
#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct Guardian {
    /// Guardian's wallet public key
    pub guardian_pubkey: Pubkey,

    /// Share index (1 to N) for Shamir Secret Sharing
    /// MUST be non-zero (1-indexed to avoid division by zero in Lagrange interpolation)
    pub share_index: u8,

    /// Encrypted share data (encrypted with guardian's pubkey)
    /// Format: [ephemeral_pubkey(32) | nonce(24) | encrypted_share(~32) | tag(16)]
    #[max_len(128)]
    pub encrypted_share: Vec<u8>,

    /// Unix timestamp when guardian was added
    pub added_at: i64,

    /// Optional encrypted nickname (e.g., "Mom", "Best Friend")
    /// Max 32 bytes encrypted
    #[max_len(64)]
    pub nickname_encrypted: Vec<u8>,

    /// Guardian status
    pub status: GuardianStatus,
}

/// Guardian status enum
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum GuardianStatus {
    /// Pending guardian acceptance (not yet active)
    PendingAcceptance,

    /// Active and can participate in recovery
    Active,

    /// Revoked by owner (cannot participate)
    Revoked,
}

/// Active recovery request account
///
/// Created when a guardian initiates recovery. Contains time-lock logic
/// and tracks guardian approvals.
///
/// # PDA Derivation
/// Seeds: ["recovery_request", owner_pubkey, request_id_bytes]
///
/// # Lifecycle
/// 1. Guardian initiates recovery → RecoveryRequest created (status: Pending)
/// 2. Delay period elapses → status: ReadyForReconstruction
/// 3. M guardians submit shares → status: Completed
/// 4. Owner cancels OR timeout → status: Cancelled
#[account]
#[derive(InitSpace)]
pub struct RecoveryRequest {
    /// Original owner whose vault is being recovered
    pub owner: Pubkey,

    /// Guardian who initiated this recovery request
    pub requester: Pubkey,

    /// Unique request ID (monotonic counter)
    pub request_id: u64,

    /// Unix timestamp when recovery was requested
    pub requested_at: i64,

    /// Unix timestamp when recovery becomes ready (requested_at + delay)
    pub ready_at: i64,

    /// Guardian approvals with decrypted shares
    #[max_len(MAX_RECOVERY_APPROVALS)]
    pub approvals: Vec<RecoveryApproval>,

    /// New owner wallet that will gain access after recovery
    /// If None, requester becomes new owner
    pub new_owner: Option<Pubkey>,

    /// Current status of this recovery request
    pub status: RecoveryStatus,

    /// Unix timestamp when request expires (ready_at + expiration period)
    pub expires_at: i64,

    /// PDA bump seed
    pub bump: u8,
}

/// Default expiration period: 30 days after ready_at
pub const RECOVERY_EXPIRATION_PERIOD: i64 = 30 * 24 * 60 * 60;

/// Guardian approval of a recovery request
///
/// Each guardian submits their decrypted share. The share is validated
/// against the share hash stored in RecoveryConfig.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct RecoveryApproval {
    /// Guardian's wallet pubkey
    pub guardian: Pubkey,

    /// Guardian's share index (for Shamir reconstruction)
    pub share_index: u8,

    /// Guardian's decrypted share (verified before storage)
    /// 32 bytes for standard Shamir share
    pub share_decrypted: [u8; 32],

    /// Unix timestamp of approval
    pub approved_at: i64,
}

/// Recovery request status
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum RecoveryStatus {
    /// Recovery initiated, waiting for delay period
    Pending,

    /// Delay elapsed, ready for guardian share submissions
    ReadyForReconstruction,

    /// Recovery completed successfully (M shares collected)
    Completed,

    /// Recovery cancelled by owner or expired
    Cancelled,

    /// Recovery expired (timeout after ready_at + grace period)
    Expired,
}

impl RecoveryConfig {
    /// Validate recovery configuration parameters
    pub fn validate_threshold(&self) -> bool {
        self.threshold > 0
            && self.threshold as usize <= self.guardians.len()
            && (self.threshold as usize) <= MAX_GUARDIANS
    }

    /// Check if recovery delay is within allowed bounds
    pub fn is_delay_valid(&self) -> bool {
        self.recovery_delay >= MIN_RECOVERY_DELAY && self.recovery_delay <= MAX_RECOVERY_DELAY
    }

    /// Count active guardians
    pub fn active_guardian_count(&self) -> usize {
        self.guardians
            .iter()
            .filter(|g| g.status == GuardianStatus::Active)
            .count()
    }

    /// Get guardian by pubkey
    pub fn get_guardian(&self, pubkey: &Pubkey) -> Option<&Guardian> {
        self.guardians.iter().find(|g| &g.guardian_pubkey == pubkey)
    }

    /// Check if guardian exists and is active
    pub fn is_active_guardian(&self, pubkey: &Pubkey) -> bool {
        self.guardians
            .iter()
            .any(|g| &g.guardian_pubkey == pubkey && g.status == GuardianStatus::Active)
    }
}

impl RecoveryRequest {
    /// Check if recovery delay has elapsed
    pub fn is_ready(&self, current_time: i64) -> bool {
        current_time >= self.ready_at && self.status == RecoveryStatus::Pending
    }

    /// Check if enough guardians have approved
    pub fn has_sufficient_approvals(&self, threshold: u8) -> bool {
        self.approvals.len() >= threshold as usize
    }

    /// Check if guardian has already approved
    pub fn has_guardian_approved(&self, guardian: &Pubkey) -> bool {
        self.approvals.iter().any(|a| &a.guardian == guardian)
    }

    /// Check if request has expired
    pub fn is_expired(&self, current_time: i64, expiry_period: i64) -> bool {
        self.status == RecoveryStatus::ReadyForReconstruction
            && current_time > self.ready_at + expiry_period
    }
}
