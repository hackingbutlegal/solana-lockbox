//! # Lockbox v2.0: Decentralized Password Manager on Solana
//!
//! This program provides a scalable, wallet-derived encrypted password manager on Solana.
//! It features multi-tier storage, unlimited password entries, encrypted search, and
//! subscription-based capacity tiers. All encryption happens client-side.
//!
//! ## Features
//!
//! - **Multi-Tier Storage**: Scale from 1KB to 1MB+ via dynamic chunk allocation
//! - **Unlimited Entries**: Store unlimited passwords within subscription limits
//! - **Encrypted Search**: Search without decrypting using blind indexes
//! - **Subscription Tiers**: Free (1KB), Basic (10KB), Premium (100KB), Enterprise (1MB+)
//! - **Zero-Knowledge**: Client-side encryption with XChaCha20-Poly1305 AEAD
//!
//! ## Security Model
//!
//! - **Client-Side Encryption**: All encryption/decryption happens off-chain
//! - **Wallet-Derived Keys**: Session keys derived from wallet signatures (HKDF)
//! - **AEAD Encryption**: XChaCha20-Poly1305 with authentication
//! - **No Key Storage**: Program never sees or stores encryption keys
//! - **PDA Isolation**: Each user gets their own Program Derived Address
//!
//! ## Architecture
//!
//! ### V2 Multi-Tier System:
//! - **MasterLockbox**: Manages metadata, subscriptions, and chunk references
//! - **StorageChunks**: Hold encrypted password entries (expandable via realloc)
//! - **Subscription System**: Paid tiers unlock more storage capacity
//!
//! ### V1 Compatibility (Legacy):
//! - Single Lockbox account with 1KB limit
//! - Maintained for backward compatibility
//! - Can be migrated to v2 system
//!
//! ## Program ID
//! `7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB` (Devnet)

use anchor_lang::prelude::*;

declare_id!("7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB");

// Import v2 modules
pub mod state;
pub mod instructions;
pub mod errors;

use instructions::*;
use state::*;
use errors::*;

/// Maximum encrypted payload size: 1024 bytes (1 KiB)
/// This limit prevents excessive storage costs and transaction size issues
const MAX_ENCRYPTED_SIZE: usize = 1024;

/// Salt size for HKDF: 32 bytes
/// Used in key derivation to add randomness
const SALT_SIZE: usize = 32;

/// Nonce size for XChaCha20-Poly1305: 24 bytes
/// XChaCha20 uses extended nonces for better security
const NONCE_SIZE: usize = 24;

/// Fee amount: 0.001 SOL per storage operation
/// Helps prevent spam and covers transaction costs
const FEE_LAMPORTS: u64 = 1_000_000;

/// Cooldown period: 10 slots (~4 seconds at 400ms/slot)
/// Rate limiting to prevent brute force attempts
const COOLDOWN_SLOTS: u64 = 10;

#[program]
pub mod lockbox {
    use super::*;

    // ============================================================================
    // V2 Instructions - Multi-Tier Password Manager
    // ============================================================================

    /// Initialize a new master lockbox account (v2)
    pub fn initialize_master_lockbox(ctx: Context<InitializeMasterLockbox>) -> Result<()> {
        instructions::initialize::handler(ctx)
    }

    /// Initialize a new storage chunk (v2)
    pub fn initialize_storage_chunk(
        ctx: Context<InitializeStorageChunk>,
        chunk_index: u16,
        initial_capacity: u32,
        data_type: StorageType,
    ) -> Result<()> {
        instructions::initialize::initialize_storage_chunk_handler(
            ctx,
            chunk_index,
            initial_capacity,
            data_type,
        )
    }

    /// Store a new password entry (v2)
    pub fn store_password_entry(
        ctx: Context<StorePasswordEntry>,
        chunk_index: u16,
        encrypted_data: Vec<u8>,
        entry_type: PasswordEntryType,
        category: u32,
        title_hash: [u8; 32],
    ) -> Result<()> {
        instructions::password_entry::store_password_entry_handler(
            ctx,
            chunk_index,
            encrypted_data,
            entry_type,
            category,
            title_hash,
        )
    }

    /// Retrieve a password entry (v2)
    pub fn retrieve_password_entry(
        ctx: Context<RetrievePasswordEntry>,
        chunk_index: u16,
        entry_id: u64,
    ) -> Result<Vec<u8>> {
        instructions::password_entry::retrieve_password_entry_handler(ctx, chunk_index, entry_id)
    }

    /// Update a password entry (v2)
    pub fn update_password_entry(
        ctx: Context<UpdatePasswordEntry>,
        chunk_index: u16,
        entry_id: u64,
        new_encrypted_data: Vec<u8>,
    ) -> Result<()> {
        instructions::password_entry::update_password_entry_handler(
            ctx,
            chunk_index,
            entry_id,
            new_encrypted_data,
        )
    }

    /// Delete a password entry (v2)
    pub fn delete_password_entry(
        ctx: Context<DeletePasswordEntry>,
        chunk_index: u16,
        entry_id: u64,
    ) -> Result<()> {
        instructions::password_entry::delete_password_entry_handler(ctx, chunk_index, entry_id)
    }

    /// Upgrade subscription tier (v2)
    pub fn upgrade_subscription(
        ctx: Context<UpgradeSubscription>,
        new_tier: SubscriptionTier,
    ) -> Result<()> {
        instructions::subscription::upgrade_subscription_handler(ctx, new_tier)
    }

    /// Renew subscription (v2)
    pub fn renew_subscription(ctx: Context<RenewSubscription>) -> Result<()> {
        instructions::subscription::renew_subscription_handler(ctx)
    }

    /// Downgrade to free tier (v2)
    pub fn downgrade_subscription(ctx: Context<DowngradeSubscription>) -> Result<()> {
        instructions::subscription::downgrade_subscription_handler(ctx)
    }

    /// Expand an existing storage chunk (v2)
    ///
    /// Uses Solana's realloc to dynamically increase chunk capacity without
    /// creating new accounts. More efficient for gradual storage growth.
    ///
    /// # Arguments
    /// * `additional_size` - Bytes to add (max 10KB per call)
    ///
    /// # Returns
    /// * `Ok(())` on successful expansion
    /// * `Err(LockboxError)` if expansion fails validation
    pub fn expand_chunk(
        ctx: Context<ExpandChunk>,
        additional_size: u32,
    ) -> Result<()> {
        instructions::chunk_management::expand_chunk_handler(ctx, additional_size)
    }

    /// Initialize category registry (v2)
    ///
    /// Creates the category registry account for organizing password entries.
    /// Requires Basic subscription tier or higher.
    pub fn initialize_category_registry(
        ctx: Context<InitializeCategoryRegistry>,
    ) -> Result<()> {
        instructions::category_management::initialize_category_registry_handler(ctx)
    }

    /// Create a new category (v2)
    ///
    /// Adds a user-defined category for organizing password entries.
    /// Category names are encrypted client-side before storage.
    ///
    /// # Arguments
    /// * `name_encrypted` - Encrypted category name (max 64 bytes)
    /// * `icon` - Icon identifier (0-255)
    /// * `color` - Color code (0-15)
    /// * `parent_id` - Optional parent category for hierarchy
    pub fn create_category(
        ctx: Context<CreateCategory>,
        name_encrypted: Vec<u8>,
        icon: u8,
        color: u8,
        parent_id: Option<u8>,
    ) -> Result<()> {
        instructions::category_management::create_category_handler(
            ctx,
            name_encrypted,
            icon,
            color,
            parent_id,
        )
    }

    /// Update an existing category (v2)
    ///
    /// Modifies category metadata. All parameters are optional.
    ///
    /// # Arguments
    /// * `category_id` - ID of category to update
    /// * `name_encrypted` - New encrypted name (optional)
    /// * `icon` - New icon (optional)
    /// * `color` - New color (optional)
    /// * `parent_id` - New parent category (optional)
    pub fn update_category(
        ctx: Context<UpdateCategory>,
        category_id: u8,
        name_encrypted: Option<Vec<u8>>,
        icon: Option<u8>,
        color: Option<u8>,
        parent_id: Option<Option<u8>>,
    ) -> Result<()> {
        instructions::category_management::update_category_handler(
            ctx,
            category_id,
            name_encrypted,
            icon,
            color,
            parent_id,
        )
    }

    /// Delete a category (v2)
    ///
    /// Removes a category from the registry. Category must be empty
    /// (no password entries assigned to it).
    ///
    /// # Arguments
    /// * `category_id` - ID of category to delete
    pub fn delete_category(
        ctx: Context<DeleteCategory>,
        category_id: u8,
    ) -> Result<()> {
        instructions::category_management::delete_category_handler(ctx, category_id)
    }

    // ============================================================================
    // V1 Instructions - Legacy (Backward Compatibility)
    // ============================================================================

    /// Initialize or update a user's lockbox with encrypted data (v1 - LEGACY)
    ///
    /// This instruction stores client-encrypted data on-chain. The program performs
    /// validation but never sees the plaintext or encryption keys.
    ///
    /// # Security Checks
    /// - Validates ciphertext size (max 1 KiB)
    /// - Enforces cooldown period between operations
    /// - Verifies fee payment (0.001 SOL)
    /// - Checks ciphertext is non-empty
    ///
    /// # Arguments
    /// * `ciphertext` - The encrypted payload (XChaCha20-Poly1305 output)
    /// * `nonce` - 24-byte nonce used in encryption
    /// * `salt` - 32-byte salt used in key derivation
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(LockboxError)` on validation failure
    pub fn store_encrypted(
        ctx: Context<StoreEncrypted>,
        ciphertext: Vec<u8>,
        nonce: [u8; NONCE_SIZE],
        salt: [u8; SALT_SIZE],
    ) -> Result<()> {
        let lockbox = &mut ctx.accounts.lockbox;
        let clock = Clock::get()?;

        // Validate ciphertext size
        require!(
            ciphertext.len() <= MAX_ENCRYPTED_SIZE,
            LockboxError::DataTooLarge
        );

        require!(
            !ciphertext.is_empty(),
            LockboxError::InvalidCiphertext
        );

        // Check cooldown period
        if lockbox.last_action_slot > 0 {
            require!(
                clock.slot >= lockbox.last_action_slot + COOLDOWN_SLOTS,
                LockboxError::CooldownNotElapsed
            );
        }

        // Verify fee payment
        let fee_account = &ctx.accounts.fee_receiver;
        let user = &ctx.accounts.user;

        require!(
            user.lamports() >= FEE_LAMPORTS,
            LockboxError::FeeTooLow
        );

        // Transfer fee
        let transfer_ix = anchor_lang::solana_program::system_instruction::transfer(
            &user.key(),
            &fee_account.key(),
            FEE_LAMPORTS,
        );

        anchor_lang::solana_program::program::invoke(
            &transfer_ix,
            &[
                user.to_account_info(),
                fee_account.to_account_info(),
            ],
        )?;

        // Store encrypted data
        lockbox.owner = ctx.accounts.user.key();
        lockbox.ciphertext = ciphertext;
        lockbox.nonce = nonce;
        lockbox.salt = salt;
        lockbox.last_action_slot = clock.slot;
        lockbox.bump = ctx.bumps.lockbox;

        msg!("Encrypted data stored successfully (v1)");
        Ok(())
    }

    /// Retrieve encrypted data (v1 - LEGACY)
    ///
    /// Returns the encrypted data stored in the user's lockbox. The client must
    /// derive the session key from their wallet signature to decrypt.
    ///
    /// # Security Checks
    /// - Verifies caller is the lockbox owner
    /// - Enforces cooldown period since last action
    ///
    /// # Returns
    /// * `Ok(EncryptedData)` containing ciphertext, nonce, and salt
    /// * `Err(LockboxError)` if unauthorized or cooldown not elapsed
    pub fn retrieve_encrypted(ctx: Context<RetrieveEncrypted>) -> Result<EncryptedData> {
        let lockbox = &ctx.accounts.lockbox;
        let clock = Clock::get()?;

        // Check cooldown period for retrieval
        require!(
            clock.slot >= lockbox.last_action_slot + COOLDOWN_SLOTS,
            LockboxError::CooldownNotElapsed
        );

        Ok(EncryptedData {
            ciphertext: lockbox.ciphertext.clone(),
            nonce: lockbox.nonce,
            salt: lockbox.salt,
        })
    }
}

/// Account validation struct for the `store_encrypted` instruction
///
/// Uses `init_if_needed` to allow both creating and updating lockboxes.
/// The PDA is derived from ["lockbox", user_pubkey], ensuring each user
/// has exactly one lockbox account.
#[derive(Accounts)]
pub struct StoreEncrypted<'info> {
    /// The user's lockbox PDA (Program Derived Address)
    /// Created on first use, updated on subsequent calls
    #[account(
        init_if_needed,
        payer = user,
        space = 8 + Lockbox::MAX_SIZE,
        seeds = [b"lockbox", user.key().as_ref()],
        bump
    )]
    pub lockbox: Account<'info, Lockbox>,

    /// The user's wallet (must sign the transaction)
    /// Pays for account creation and transaction fees
    #[account(mut)]
    pub user: Signer<'info>,

    /// Fee receiver account (e.g., program treasury or operator wallet)
    /// Receives 0.001 SOL per storage operation
    /// CHECK: Fee receiver account (could be program treasury)
    #[account(mut)]
    pub fee_receiver: AccountInfo<'info>,

    /// System program for account creation and SOL transfers
    pub system_program: Program<'info, System>,
}

/// Account validation struct for the `retrieve_encrypted` instruction
///
/// Enforces ownership: only the lockbox owner can retrieve their data.
#[derive(Accounts)]
pub struct RetrieveEncrypted<'info> {
    /// The user's lockbox PDA
    /// Must exist and be owned by the signer
    #[account(
        seeds = [b"lockbox", user.key().as_ref()],
        bump = lockbox.bump,
        constraint = lockbox.owner == user.key() @ LockboxError::Unauthorized
    )]
    pub lockbox: Account<'info, Lockbox>,

    /// The user's wallet (must be the lockbox owner)
    pub user: Signer<'info>,
}

/// On-chain account storing encrypted user data
///
/// # Storage Layout
/// - `owner`: The wallet pubkey that owns this lockbox (32 bytes)
/// - `ciphertext`: Encrypted payload, max 1024 bytes (4 + 1024 bytes)
/// - `nonce`: XChaCha20-Poly1305 nonce (24 bytes)
/// - `salt`: HKDF salt for key derivation (32 bytes)
/// - `last_action_slot`: Slot of last store/retrieve (8 bytes)
/// - `bump`: PDA bump seed (1 byte)
///
/// Total: ~1141 bytes maximum
#[account]
pub struct Lockbox {
    /// The wallet public key that owns this lockbox
    pub owner: Pubkey,

    /// Encrypted ciphertext (XChaCha20-Poly1305 output + auth tag)
    pub ciphertext: Vec<u8>,

    /// 24-byte nonce used in XChaCha20-Poly1305 encryption
    pub nonce: [u8; NONCE_SIZE],

    /// 32-byte salt used in HKDF key derivation
    pub salt: [u8; SALT_SIZE],

    /// Slot number of last store/retrieve operation (for rate limiting)
    pub last_action_slot: u64,

    /// PDA bump seed
    pub bump: u8,
}

impl Lockbox {
    pub const MAX_SIZE: usize = 8 + // discriminator
        32 + // owner pubkey
        4 + MAX_ENCRYPTED_SIZE + // vec length + data
        NONCE_SIZE + // nonce
        SALT_SIZE + // salt
        8 + // last_action_slot
        1; // bump
}

/// Return type for `retrieve_encrypted` instruction
///
/// Contains all data needed for client-side decryption:
/// - The ciphertext (encrypted payload)
/// - The nonce used during encryption
/// - The salt used in key derivation
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct EncryptedData {
    /// Encrypted payload (XChaCha20-Poly1305 output with auth tag)
    pub ciphertext: Vec<u8>,

    /// 24-byte nonce for XChaCha20-Poly1305
    pub nonce: [u8; NONCE_SIZE],

    /// 32-byte salt for HKDF key derivation
    pub salt: [u8; SALT_SIZE],
}

/// Custom error codes for the Lockbox program
///
/// These provide precise error reporting for various failure conditions.
#[error_code]
pub enum LockboxError {
    #[msg("Encrypted data exceeds maximum size of 1024 bytes")]
    DataTooLarge,

    #[msg("Invalid ciphertext: data cannot be empty")]
    InvalidCiphertext,

    #[msg("Nonce reuse detected: operation rejected")]
    NonceReuseDetected,

    #[msg("Fee too low: minimum 0.001 SOL required")]
    FeeTooLow,

    #[msg("Unauthorized: you are not the owner of this lockbox")]
    Unauthorized,

    #[msg("Cooldown not elapsed: wait 10 slots before retry")]
    CooldownNotElapsed,

    #[msg("Account space exceeded: cannot store more data")]
    AccountSpaceExceeded,
}
