use anchor_lang::prelude::*;

#[error_code]
pub enum LockboxError {
    #[msg("Maximum number of storage chunks reached")]
    MaxChunksReached,

    #[msg("Storage chunk not found")]
    ChunkNotFound,

    #[msg("Maximum entries per chunk reached")]
    MaxEntriesPerChunk,

    #[msg("Insufficient chunk capacity")]
    InsufficientChunkCapacity,

    #[msg("Entry not found")]
    EntryNotFound,

    #[msg("Invalid entry offset")]
    InvalidEntryOffset,

    #[msg("Invalid tier upgrade")]
    InvalidTierUpgrade,

    #[msg("Subscription expired")]
    SubscriptionExpired,

    #[msg("Insufficient storage capacity")]
    InsufficientStorageCapacity,

    #[msg("Payment amount incorrect")]
    IncorrectPaymentAmount,

    #[msg("Unauthorized access")]
    Unauthorized,

    #[msg("Invalid data size")]
    InvalidDataSize,

    #[msg("Cooldown period not elapsed")]
    CooldownNotElapsed,

    #[msg("Invalid chunk index")]
    InvalidChunkIndex,

    #[msg("Cannot downgrade subscription tier")]
    CannotDowngrade,

    #[msg("Invalid entry type")]
    InvalidEntryType,

    #[msg("Search index full")]
    SearchIndexFull,

    #[msg("Category limit reached")]
    CategoryLimitReached,

    #[msg("Invalid category")]
    InvalidCategory,

    #[msg("Chunk already exists")]
    ChunkAlreadyExists,

    #[msg("Duplicate chunk index")]
    DuplicateChunk,

    #[msg("Master lockbox not initialized")]
    NotInitialized,

    #[msg("Data corruption detected")]
    DataCorruption,

    #[msg("Rate limit exceeded: please wait before retrying")]
    RateLimitExceeded,

    #[msg("Chunk expansion would exceed maximum chunk size")]
    ChunkTooLarge,

    #[msg("Realloc increment exceeds maximum (10KB per call)")]
    ReallocTooLarge,
}
