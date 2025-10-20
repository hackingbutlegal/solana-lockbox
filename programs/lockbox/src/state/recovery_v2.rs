//! # Social Recovery State Structures V2 (Secure)
//!
//! This is the SECURE version that eliminates plaintext shares on-chain.
//!
//! ## Key Changes from V1
//!
//! 1. **No Plaintext Shares**: Guardians never submit shares to blockchain
//! 2. **Challenge-Response**: On-chain challenge verifies reconstruction
//! 3. **Client-Side Reconstruction**: Shares combined off-chain
//! 4. **Proof of Knowledge**: Must prove secret knowledge to complete
//!
//! ## Security Model
//!
//! 1. Guardian commits to their share (hash commitment)
//! 2. Recovery initiated → challenge generated on-chain
//! 3. Guardians provide shares to REQUESTER off-chain
//! 4. Requester reconstructs secret client-side
//! 5. Requester decrypts challenge with reconstructed secret
//! 6. Submit decrypted challenge as proof → ownership transferred
//!
//! ## Advantages
//!
//! - Shares never exposed on-chain (even encrypted)
//! - Zero-knowledge proof of reconstruction
//! - Maintains Shamir security guarantees
//! - Simple cryptographic primitives (no zkSNARKs needed)

use anchor_lang::prelude::*;

/// Recovery challenge generated during recovery initiation
#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct RecoveryChallenge {
    /// Random challenge encrypted with the master secret
    /// Format: encrypt(random_32_bytes, master_secret) using XChaCha20-Poly1305
    /// Total: 32 (nonce) + 32 (ciphertext) + 16 (tag) = 80 bytes
    #[max_len(80)]
    pub encrypted_challenge: Vec<u8>,

    /// Hash of the plaintext challenge for verification
    /// SHA256(challenge_plaintext)
    pub challenge_hash: [u8; 32],

    /// Unix timestamp when challenge was created
    pub created_at: i64,
}

/// Guardian commitment to their share (V2)
///
/// Instead of storing encrypted shares, we store commitments.
/// The actual share is only revealed to the recovery requester off-chain.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct GuardianV2 {
    /// Guardian's wallet public key
    pub guardian_pubkey: Pubkey,

    /// Share index (1 to N) for Shamir Secret Sharing
    pub share_index: u8,

    /// SHA256 hash commitment to the share
    /// commitment = SHA256(share_bytes || guardian_pubkey)
    /// This prevents guardian from changing their share later
    pub share_commitment: [u8; 32],

    /// Unix timestamp when guardian was added
    pub added_at: i64,

    /// Optional encrypted nickname
    #[max_len(64)]
    pub nickname_encrypted: Vec<u8>,

    /// Guardian status
    pub status: crate::state::GuardianStatus,
}

/// Recovery request V2 (Secure)
///
/// Instead of collecting shares on-chain, we:
/// 1. Generate an encrypted challenge
/// 2. Guardians provide shares to requester OFF-CHAIN
/// 3. Requester reconstructs secret and decrypts challenge
/// 4. Submits decrypted challenge as proof
#[account]
#[derive(InitSpace)]
pub struct RecoveryRequestV2 {
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

    /// Unix timestamp when request expires
    pub expires_at: i64,

    /// Recovery challenge (encrypted with master secret)
    pub challenge: RecoveryChallenge,

    /// Guardians who have confirmed participation (pubkeys only)
    /// No shares stored - they provide shares to requester off-chain
    #[max_len(10)]
    pub participating_guardians: Vec<Pubkey>,

    /// New owner wallet that will gain access after recovery
    pub new_owner: Option<Pubkey>,

    /// Current status
    pub status: crate::state::RecoveryStatus,

    /// PDA bump seed
    pub bump: u8,
}

impl RecoveryRequestV2 {
    /// Check if enough guardians have confirmed participation
    pub fn has_sufficient_participants(&self, threshold: u8) -> bool {
        self.participating_guardians.len() >= threshold as usize
    }

    /// Check if guardian has already confirmed
    pub fn has_guardian_confirmed(&self, guardian: &Pubkey) -> bool {
        self.participating_guardians.iter().any(|g| g == guardian)
    }

    /// Check if request is ready for proof submission
    pub fn is_ready_for_proof(&self, current_time: i64) -> bool {
        current_time >= self.ready_at
            && current_time <= self.expires_at
            && self.status == crate::state::RecoveryStatus::ReadyForReconstruction
    }
}

/// Configuration for recovery V2 (compatible with V1)
#[account]
#[derive(InitSpace)]
pub struct RecoveryConfigV2 {
    /// Owner of this recovery configuration
    pub owner: Pubkey,

    /// Threshold (M) - number of guardians needed
    pub threshold: u8,

    /// Total guardians (N)
    pub total_guardians: u8,

    /// Guardian commitments (V2 - no encrypted shares)
    #[max_len(10)]
    pub guardians: Vec<GuardianV2>,

    /// Recovery delay in seconds
    pub recovery_delay: i64,

    /// Unix timestamp when created
    pub created_at: i64,

    /// Unix timestamp of last modification
    pub last_modified: i64,

    /// Last used request ID
    pub last_request_id: u64,

    /// Master secret hash for challenge verification
    /// SHA256(master_secret) - used to verify challenge encryption
    pub master_secret_hash: [u8; 32],

    /// SECURITY FIX (Phase 3): Rate limiting for recovery attempts
    /// Unix timestamp of last recovery initiation attempt
    pub last_recovery_attempt: i64,

    /// PDA bump seed
    pub bump: u8,
}

impl RecoveryConfigV2 {
    /// Verify a share matches its commitment
    pub fn verify_share_commitment(
        &self,
        guardian_pubkey: &Pubkey,
        share_bytes: &[u8],
    ) -> bool {
        if let Some(guardian) = self.guardians.iter().find(|g| &g.guardian_pubkey == guardian_pubkey) {
            // Recompute commitment: SHA256(share || guardian_pubkey)
            use anchor_lang::solana_program::hash::hash;
            let mut data = Vec::new();
            data.extend_from_slice(share_bytes);
            data.extend_from_slice(guardian_pubkey.as_ref());
            let computed_hash = hash(&data);

            computed_hash.to_bytes() == guardian.share_commitment
        } else {
            false
        }
    }

    /// Count active guardians
    pub fn active_guardian_count(&self) -> usize {
        self.guardians
            .iter()
            .filter(|g| g.status == crate::state::GuardianStatus::Active)
            .count()
    }

    /// Check if guardian is active
    pub fn is_active_guardian(&self, pubkey: &Pubkey) -> bool {
        self.guardians
            .iter()
            .any(|g| &g.guardian_pubkey == pubkey && g.status == crate::state::GuardianStatus::Active)
    }

    /// SECURITY FIX (Phase 3): Check recovery rate limit
    /// Prevents spam/DoS by limiting recovery attempts to 1 per hour
    pub fn check_recovery_rate_limit(&self, current_time: i64, cooldown_seconds: i64) -> bool {
        if self.last_recovery_attempt == 0 {
            return true; // First attempt
        }
        current_time - self.last_recovery_attempt >= cooldown_seconds
    }
}
