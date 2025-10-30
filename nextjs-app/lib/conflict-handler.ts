/**
 * Multi-Device Conflict Handler
 *
 * Handles conflicts when multiple devices or tabs modify the same password vault.
 * Implements automatic state reconciliation and user notification.
 */

export interface ConflictError {
  type: 'conflict';
  message: string;
  localVersion: number;
  remoteVersion: number;
  entryId?: number;
}

export interface ConflictResolution {
  action: 'retry' | 'refresh' | 'cancel';
  refreshNeeded: boolean;
  userMessage: string;
}

/**
 * Detect if an error is a conflict error
 */
export function isConflictError(error: unknown): error is ConflictError {
  if (typeof error === 'object' && error !== null) {
    const err = error as any;
    return err.type === 'conflict' ||
           err.message?.includes('already been modified') ||
           err.message?.includes('Transaction simulation failed') ||
           err.message?.includes('Account in use');
  }
  return false;
}

/**
 * Determine conflict resolution strategy
 */
export function resolveConflict(error: ConflictError): ConflictResolution {
  // Check if this is a version mismatch
  if (error.localVersion && error.remoteVersion && error.localVersion < error.remoteVersion) {
    return {
      action: 'refresh',
      refreshNeeded: true,
      userMessage: 'Your vault was updated from another device. Refreshing...',
    };
  }

  // Check if this is a concurrent modification
  if (error.message.includes('already been modified') || error.message.includes('Account in use')) {
    return {
      action: 'retry',
      refreshNeeded: true,
      userMessage: 'Another device is modifying your vault. Retrying...',
    };
  }

  // Default: ask user to retry
  return {
    action: 'refresh',
    refreshNeeded: true,
    userMessage: 'Your vault was updated from another device. Please refresh and try again.',
  };
}

/**
 * Create a user-friendly conflict message
 */
export function getConflictMessage(error: ConflictError): string {
  if (error.entryId) {
    return `Password entry #${error.entryId} was modified on another device. Your changes were not saved. Please refresh and try again.`;
  }

  return 'Your vault was modified on another device. Please refresh to see the latest changes.';
}

/**
 * Retry operation with exponential backoff
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      // Don't retry if it's not a conflict error
      if (!isConflictError(error)) {
        throw error;
      }

      // Don't retry on last attempt
      if (attempt === maxRetries) {
        break;
      }

      // Wait with exponential backoff
      const delay = initialDelay * Math.pow(2, attempt);
      console.log(`Conflict detected, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Wrap an operation with conflict handling and auto-retry
 */
export async function withConflictHandling<T>(
  operation: () => Promise<T>,
  onRefreshNeeded?: () => Promise<void>,
  maxRetries: number = 3
): Promise<T> {
  try {
    return await retryWithBackoff(operation, maxRetries);
  } catch (error) {
    if (isConflictError(error)) {
      const resolution = resolveConflict(error);

      if (resolution.refreshNeeded && onRefreshNeeded) {
        console.log('Refreshing vault state due to conflict...');
        await onRefreshNeeded();
      }

      throw new Error(resolution.userMessage);
    }

    throw error;
  }
}

/**
 * Check if blockchain state has changed since last fetch
 */
export async function detectStateChange(
  fetchCurrentState: () => Promise<number>,
  lastKnownVersion: number
): Promise<boolean> {
  try {
    const currentVersion = await fetchCurrentState();
    return currentVersion > lastKnownVersion;
  } catch (error) {
    console.error('Failed to detect state change:', error);
    return false; // Assume no change if we can't fetch
  }
}

/**
 * Lock-free optimistic update with conflict detection
 */
export class OptimisticUpdateManager<T> {
  private optimisticState: T | null = null;
  private serverState: T | null = null;
  private pendingUpdate: Promise<T> | null = null;

  constructor(
    private fetchState: () => Promise<T>,
    private applyUpdate: (update: Partial<T>) => Promise<T>
  ) {}

  /**
   * Apply optimistic update and sync with server
   */
  async update(update: Partial<T>): Promise<T> {
    // Fetch current server state if we don't have it
    if (!this.serverState) {
      this.serverState = await this.fetchState();
    }

    // Apply optimistic update locally
    this.optimisticState = { ...this.serverState, ...update };

    // Start server update in background
    this.pendingUpdate = this.applyUpdate(update)
      .then(newState => {
        this.serverState = newState;
        this.optimisticState = newState;
        this.pendingUpdate = null;
        return newState;
      })
      .catch(error => {
        // Revert optimistic update on failure
        console.error('Optimistic update failed, reverting:', error);
        this.optimisticState = this.serverState;
        this.pendingUpdate = null;
        throw error;
      });

    return this.optimisticState;
  }

  /**
   * Get current state (optimistic or server)
   */
  getState(): T | null {
    return this.optimisticState || this.serverState;
  }

  /**
   * Wait for pending update to complete
   */
  async waitForSync(): Promise<T | null> {
    if (this.pendingUpdate) {
      await this.pendingUpdate;
    }
    return this.serverState;
  }

  /**
   * Refresh state from server
   */
  async refresh(): Promise<T> {
    this.serverState = await this.fetchState();
    this.optimisticState = this.serverState;
    return this.serverState;
  }
}
