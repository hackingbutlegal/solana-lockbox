/**
 * Lockbox Error Classes - Standardized Error Handling
 *
 * Provides consistent error structure across the application with:
 * - Error codes for programmatic handling
 * - User-friendly error messages
 * - Recovery guidance
 * - Metadata for debugging
 * - Categorization by severity
 *
 * @module errors
 */

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  /** Informational - no action required */
  INFO = 'info',
  /** Warning - degraded functionality but operation continues */
  WARNING = 'warning',
  /** Error - operation failed but recoverable */
  ERROR = 'error',
  /** Critical - system state compromised, immediate action required */
  CRITICAL = 'critical',
}

/**
 * Error category for classification
 */
export enum ErrorCategory {
  /** Authentication/session errors */
  AUTH = 'AUTH',
  /** Blockchain/network errors */
  NETWORK = 'NETWORK',
  /** Encryption/decryption errors */
  CRYPTO = 'CRYPTO',
  /** Data validation errors */
  VALIDATION = 'VALIDATION',
  /** Storage/state errors */
  STORAGE = 'STORAGE',
  /** User input errors */
  USER_INPUT = 'USER_INPUT',
  /** System/unexpected errors */
  SYSTEM = 'SYSTEM',
}

/**
 * Recovery action type
 */
export interface RecoveryAction {
  /** Action description */
  description: string;
  /** Action type (manual, retry, contact_support) */
  type: 'manual' | 'retry' | 'contact_support' | 'refresh';
  /** Is this action automatic? */
  automatic?: boolean;
}

/**
 * Base Lockbox Error
 */
export class LockboxError extends Error {
  public readonly code: string;
  public readonly category: ErrorCategory;
  public readonly severity: ErrorSeverity;
  public readonly userMessage: string;
  public readonly technicalDetails?: string;
  public readonly recoveryActions: RecoveryAction[];
  public readonly metadata?: Record<string, any>;
  public readonly recoverable: boolean;
  public readonly timestamp: Date;

  constructor(
    code: string,
    userMessage: string,
    options: {
      category: ErrorCategory;
      severity?: ErrorSeverity;
      technicalDetails?: string;
      recoveryActions?: RecoveryAction[];
      metadata?: Record<string, any>;
      recoverable?: boolean;
      cause?: Error;
    }
  ) {
    super(userMessage);
    this.name = 'LockboxError';
    this.code = code;
    this.userMessage = userMessage;
    this.category = options.category;
    this.severity = options.severity || ErrorSeverity.ERROR;
    this.technicalDetails = options.technicalDetails;
    this.recoveryActions = options.recoveryActions || [];
    this.metadata = options.metadata;
    this.recoverable = options.recoverable !== false; // Default to true
    this.timestamp = new Date();

    // Maintain proper stack trace
    if (options.cause) {
      this.stack = options.cause.stack;
    }
  }

  /**
   * Convert error to user-friendly display object
   */
  toDisplay(): {
    title: string;
    message: string;
    details?: string;
    actions: string[];
    severity: ErrorSeverity;
  } {
    return {
      title: `Error: ${this.code}`,
      message: this.userMessage,
      details: this.technicalDetails,
      actions: this.recoveryActions.map(a => a.description),
      severity: this.severity,
    };
  }

  /**
   * Convert error to JSON for logging
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      code: this.code,
      category: this.category,
      severity: this.severity,
      userMessage: this.userMessage,
      technicalDetails: this.technicalDetails,
      recoveryActions: this.recoveryActions,
      metadata: this.metadata,
      recoverable: this.recoverable,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack,
    };
  }
}

/**
 * Session expired error
 */
export class SessionExpiredError extends LockboxError {
  constructor(details?: string) {
    super('SESSION_EXPIRED', 'Your session has expired. Please sign in again to continue.', {
      category: ErrorCategory.AUTH,
      severity: ErrorSeverity.WARNING,
      technicalDetails: details,
      recoveryActions: [
        {
          description: 'Sign in again with your wallet',
          type: 'manual',
        },
      ],
      recoverable: true,
    });
    this.name = 'SessionExpiredError';
  }
}

/**
 * Decryption failed error
 */
export class DecryptionError extends LockboxError {
  constructor(entryId?: number, cause?: Error) {
    const message = entryId !== undefined
      ? `Failed to decrypt password entry #${entryId}. This may indicate data corruption or a wrong encryption key.`
      : 'Failed to decrypt data. This may indicate data corruption or a wrong encryption key.';

    super('DECRYPTION_FAILED', message, {
      category: ErrorCategory.CRYPTO,
      severity: ErrorSeverity.ERROR,
      technicalDetails: cause?.message,
      recoveryActions: [
        {
          description: 'Verify you are using the correct wallet (same wallet used to encrypt)',
          type: 'manual',
        },
        {
          description: 'Try signing in again to refresh your encryption key',
          type: 'refresh',
        },
        {
          description: 'If problem persists, entry may be corrupted - contact support',
          type: 'contact_support',
        },
      ],
      metadata: { entryId },
      recoverable: false,
      cause,
    });
    this.name = 'DecryptionError';
  }
}

/**
 * Network/RPC error
 */
export class NetworkError extends LockboxError {
  constructor(operation: string, cause?: Error) {
    super('NETWORK_ERROR', `Network error during ${operation}. Please check your connection and try again.`, {
      category: ErrorCategory.NETWORK,
      severity: ErrorSeverity.ERROR,
      technicalDetails: cause?.message,
      recoveryActions: [
        {
          description: 'Check your internet connection',
          type: 'manual',
        },
        {
          description: 'Retry the operation',
          type: 'retry',
        },
        {
          description: 'Try again in a few minutes (RPC may be temporarily unavailable)',
          type: 'manual',
        },
      ],
      metadata: { operation },
      recoverable: true,
      cause,
    });
    this.name = 'NetworkError';
  }
}

/**
 * Storage chunk not found error
 */
export class ChunkNotFoundError extends LockboxError {
  constructor(chunkIndex: number) {
    super('CHUNK_NOT_FOUND', `Storage chunk #${chunkIndex} was not found. This may indicate incomplete initialization.`, {
      category: ErrorCategory.STORAGE,
      severity: ErrorSeverity.ERROR,
      technicalDetails: `Chunk index ${chunkIndex} is referenced in master lockbox but PDA not found on-chain`,
      recoveryActions: [
        {
          description: 'This may be due to a partially failed transaction',
          type: 'manual',
        },
        {
          description: 'Try refreshing the page to reload data',
          type: 'refresh',
        },
        {
          description: 'Contact support if problem persists',
          type: 'contact_support',
        },
      ],
      metadata: { chunkIndex },
      recoverable: false,
    });
    this.name = 'ChunkNotFoundError';
  }
}

/**
 * Chunk not registered error (orphaned chunk)
 */
export class ChunkNotRegisteredError extends LockboxError {
  constructor(chunkIndex: number, expectedAddress: string) {
    super('CHUNK_NOT_REGISTERED', `Storage chunk #${chunkIndex} exists but is not properly registered in master lockbox.`, {
      category: ErrorCategory.STORAGE,
      severity: ErrorSeverity.CRITICAL,
      technicalDetails: `Chunk PDA ${expectedAddress} found on-chain but not in master lockbox registry`,
      recoveryActions: [
        {
          description: 'This indicates a partially failed transaction - chunk was created but not registered',
          type: 'manual',
        },
        {
          description: 'DO NOT create more passwords until this is resolved (to avoid data loss)',
          type: 'manual',
        },
        {
          description: 'Contact support immediately for chunk recovery',
          type: 'contact_support',
        },
      ],
      metadata: { chunkIndex, expectedAddress },
      recoverable: false,
    });
    this.name = 'ChunkNotRegisteredError';
  }
}

/**
 * Validation error
 */
export class ValidationError extends LockboxError {
  constructor(field: string, reason: string, value?: any) {
    super('VALIDATION_ERROR', `Invalid ${field}: ${reason}`, {
      category: ErrorCategory.VALIDATION,
      severity: ErrorSeverity.WARNING,
      technicalDetails: `Field '${field}' validation failed: ${reason}`,
      recoveryActions: [
        {
          description: `Correct the ${field} and try again`,
          type: 'manual',
        },
      ],
      metadata: { field, reason, value },
      recoverable: true,
    });
    this.name = 'ValidationError';
  }
}

/**
 * Storage limit exceeded error
 */
export class StorageLimitError extends LockboxError {
  constructor(currentTier: string, currentChunks: number, maxChunks: number) {
    super('STORAGE_LIMIT_EXCEEDED', `Storage limit reached for ${currentTier} tier (${currentChunks}/${maxChunks} chunks).`, {
      category: ErrorCategory.STORAGE,
      severity: ErrorSeverity.WARNING,
      technicalDetails: `Current tier: ${currentTier}, chunks: ${currentChunks}/${maxChunks}`,
      recoveryActions: [
        {
          description: 'Upgrade your subscription to get more storage',
          type: 'manual',
        },
        {
          description: 'Delete old or unused passwords to free up space',
          type: 'manual',
        },
      ],
      metadata: { currentTier, currentChunks, maxChunks },
      recoverable: true,
    });
    this.name = 'StorageLimitError';
  }
}

/**
 * Transaction failed error
 */
export class TransactionError extends LockboxError {
  constructor(operation: string, signature?: string, cause?: Error) {
    super('TRANSACTION_FAILED', `Transaction failed: ${operation}`, {
      category: ErrorCategory.NETWORK,
      severity: ErrorSeverity.ERROR,
      technicalDetails: cause?.message || 'Transaction failed on-chain',
      recoveryActions: [
        {
          description: 'Check your wallet has sufficient SOL for transaction fees',
          type: 'manual',
        },
        {
          description: 'Retry the operation',
          type: 'retry',
        },
        {
          description: 'If problem persists, try again later when network congestion is lower',
          type: 'manual',
        },
      ],
      metadata: { operation, signature },
      recoverable: true,
      cause,
    });
    this.name = 'TransactionError';
  }
}

/**
 * Master lockbox not initialized error
 */
export class MasterLockboxNotInitializedError extends LockboxError {
  constructor() {
    super('MASTER_LOCKBOX_NOT_INITIALIZED', 'Your vault has not been initialized yet.', {
      category: ErrorCategory.STORAGE,
      severity: ErrorSeverity.WARNING,
      recoveryActions: [
        {
          description: 'Initialize your vault by creating your first password',
          type: 'manual',
        },
      ],
      recoverable: true,
    });
    this.name = 'MasterLockboxNotInitializedError';
  }
}

/**
 * Wrap unknown errors in LockboxError
 */
export function wrapError(error: unknown, operation: string): LockboxError {
  if (error instanceof LockboxError) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);

  // Detect common error patterns
  if (message.includes('session') || message.includes('expired')) {
    return new SessionExpiredError(message);
  }

  if (message.includes('decrypt')) {
    return new DecryptionError(undefined, error instanceof Error ? error : undefined);
  }

  if (message.includes('network') || message.includes('RPC') || message.includes('fetch')) {
    return new NetworkError(operation, error instanceof Error ? error : undefined);
  }

  if (message.includes('transaction') || message.includes('simulate')) {
    return new TransactionError(operation, undefined, error instanceof Error ? error : undefined);
  }

  // Generic error
  return new LockboxError('UNKNOWN_ERROR', `An unexpected error occurred during ${operation}`, {
    category: ErrorCategory.SYSTEM,
    severity: ErrorSeverity.ERROR,
    technicalDetails: message,
    recoveryActions: [
      {
        description: 'Retry the operation',
        type: 'retry',
      },
      {
        description: 'Refresh the page and try again',
        type: 'refresh',
      },
      {
        description: 'If problem persists, contact support',
        type: 'contact_support',
      },
    ],
    recoverable: true,
    cause: error instanceof Error ? error : undefined,
  });
}

/**
 * Format error for user display
 */
export function formatErrorForUser(error: unknown): string {
  if (error instanceof LockboxError) {
    return error.userMessage;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

/**
 * Get recovery actions for error
 */
export function getRecoveryActions(error: unknown): RecoveryAction[] {
  if (error instanceof LockboxError) {
    return error.recoveryActions;
  }

  return [
    {
      description: 'Retry the operation',
      type: 'retry',
    },
    {
      description: 'Refresh the page',
      type: 'refresh',
    },
  ];
}
