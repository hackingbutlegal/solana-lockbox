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

    // Social Recovery Errors
    #[msg("Feature not available for current subscription tier")]
    FeatureNotAvailable,

    #[msg("Invalid recovery threshold (must be > 0 and <= total guardians)")]
    InvalidThreshold,

    #[msg("Invalid recovery delay (must be between 1 and 30 days)")]
    InvalidRecoveryDelay,

    #[msg("Maximum number of guardians reached (10)")]
    TooManyGuardians,

    #[msg("Guardian already exists")]
    GuardianAlreadyExists,

    #[msg("Invalid encrypted share size")]
    InvalidShareSize,

    #[msg("Invalid nickname size")]
    InvalidNicknameSize,

    #[msg("Guardian not found")]
    GuardianNotFound,

    #[msg("Guardian already accepted")]
    GuardianAlreadyAccepted,

    #[msg("Not an active guardian")]
    NotActiveGuardian,

    #[msg("Recovery request not ready (time-lock not elapsed)")]
    RecoveryNotReady,

    #[msg("Guardian already approved this recovery")]
    GuardianAlreadyApproved,

    #[msg("Insufficient guardian approvals")]
    InsufficientApprovals,

    #[msg("Recovery already completed")]
    RecoveryAlreadyCompleted,

    // Emergency Access Errors
    #[msg("Invalid inactivity period (must be between 30 days and 1 year)")]
    InvalidInactivityPeriod,

    #[msg("Invalid grace period (must be >= 1 day)")]
    InvalidGracePeriod,

    #[msg("Maximum number of emergency contacts reached (5)")]
    TooManyContacts,

    #[msg("Emergency contact already exists")]
    ContactAlreadyExists,

    #[msg("Invalid encrypted key size")]
    InvalidKeySize,

    #[msg("Emergency contact not found")]
    ContactNotFound,

    #[msg("Emergency contact already accepted")]
    ContactAlreadyAccepted,

    #[msg("Grace period not elapsed")]
    GracePeriodNotElapsed,

    #[msg("No active emergency countdown")]
    NoActiveCountdown,

    // Additional Security Validations
    #[msg("Invalid share index (must be 1-255)")]
    InvalidShareIndex,

    #[msg("Duplicate share index detected")]
    DuplicateShareIndex,

    #[msg("Insufficient guardians remaining (would fall below threshold)")]
    InsufficientGuardians,

    #[msg("Active recovery request exists - cannot modify guardians")]
    ActiveRecoveryExists,

    #[msg("Recovery request expired")]
    RecoveryExpired,
}
