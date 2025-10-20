/**
 * Retry Utility for Transient Failures
 *
 * Provides exponential backoff retry logic for handling transient
 * network and RPC failures in Solana transactions.
 */

import { MAX_RETRIES, RETRY_BACKOFF_MS } from './constants';

/**
 * Error that should not be retried
 */
export class NonRetryableError extends Error {
  constructor(message: string, public readonly originalError?: Error) {
    super(message);
    this.name = 'NonRetryableError';
  }
}

/**
 * Configuration for retry behavior
 */
export interface RetryOptions {
  /**
   * Maximum number of retry attempts
   * @default 3
   */
  maxRetries?: number;

  /**
   * Initial backoff delay in milliseconds
   * @default 1000
   */
  initialBackoff?: number;

  /**
   * Backoff multiplier for exponential backoff
   * @default 2
   */
  backoffMultiplier?: number;

  /**
   * Maximum backoff delay in milliseconds
   * @default 10000
   */
  maxBackoff?: number;

  /**
   * Function to determine if an error should be retried
   */
  shouldRetry?: (error: Error, attemptNumber: number) => boolean;

  /**
   * Callback invoked before each retry attempt
   */
  onRetry?: (error: Error, attemptNumber: number, delayMs: number) => void;
}

/**
 * Default error classification for Solana RPC
 */
export function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase();

  // Network errors
  if (
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('econnreset') ||
    message.includes('enotfound') ||
    message.includes('econnrefused')
  ) {
    return true;
  }

  // RPC errors that should be retried
  if (
    message.includes('429') || // Rate limit
    message.includes('503') || // Service unavailable
    message.includes('502') || // Bad gateway
    message.includes('504') || // Gateway timeout
    message.includes('blockhash not found') ||
    message.includes('node is unhealthy') ||
    message.includes('transaction was not confirmed')
  ) {
    return true;
  }

  // Simulation failures that might be transient
  if (
    message.includes('blockhash expired') ||
    message.includes('recent blockhash')
  ) {
    return true;
  }

  return false;
}

/**
 * Default shouldRetry implementation
 */
function defaultShouldRetry(error: Error, attemptNumber: number): boolean {
  // Never retry NonRetryableErrors
  if (error instanceof NonRetryableError) {
    return false;
  }

  // Don't retry program errors (these are deterministic)
  if (
    error.message.includes('custom program error') ||
    error.message.includes('instruction error') ||
    error.message.includes('already in use') ||
    error.message.includes('already processed') ||
    error.message.includes('account not found')
  ) {
    return false;
  }

  return isRetryableError(error);
}

/**
 * Calculate backoff delay with exponential backoff and jitter
 *
 * SECURITY FIX (VULN-001): Uses cryptographically secure random for jitter
 * to prevent timing analysis attacks. Previously used Math.random() which
 * is predictable and could leak information about retry patterns.
 */
function calculateBackoff(
  attemptNumber: number,
  initialBackoff: number,
  backoffMultiplier: number,
  maxBackoff: number
): number {
  const exponentialDelay = initialBackoff * Math.pow(backoffMultiplier, attemptNumber - 1);
  const cappedDelay = Math.min(exponentialDelay, maxBackoff);

  // SECURITY: Use cryptographically secure random for jitter
  // Generate 2 random bytes for higher precision (0-65535 range)
  const randomBytes = new Uint8Array(2);
  crypto.getRandomValues(randomBytes);
  const randomValue = (randomBytes[0] << 8 | randomBytes[1]) / 65535; // 0.0 to 1.0

  // Add jitter (±25% random variation)
  const jitter = cappedDelay * 0.25 * (randomValue * 2 - 1);
  return Math.floor(cappedDelay + jitter);
}

/**
 * Retry a function with exponential backoff
 *
 * @param fn - Async function to retry
 * @param options - Retry configuration
 * @returns Promise resolving to the function result
 * @throws Last error if all retries exhausted
 *
 * @example
 * ```typescript
 * const result = await retry(
 *   async () => await connection.sendTransaction(tx),
 *   {
 *     maxRetries: 3,
 *     onRetry: (err, attempt, delay) => {
 *       console.log(`Retry attempt ${attempt} after ${delay}ms: ${err.message}`);
 *     }
 *   }
 * );
 * ```
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = MAX_RETRIES,
    initialBackoff = RETRY_BACKOFF_MS,
    backoffMultiplier = 2,
    maxBackoff = 10000,
    shouldRetry = defaultShouldRetry,
    onRetry,
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Last attempt - throw the error
      if (attempt > maxRetries) {
        throw lastError;
      }

      // Check if we should retry this error
      if (!shouldRetry(lastError, attempt)) {
        throw lastError;
      }

      // Calculate backoff delay
      const delayMs = calculateBackoff(attempt, initialBackoff, backoffMultiplier, maxBackoff);

      // Call onRetry callback
      if (onRetry) {
        onRetry(lastError, attempt, delayMs);
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  // Should never reach here, but TypeScript needs it
  throw lastError || new Error('Retry failed with unknown error');
}

/**
 * Retry with custom error classification
 *
 * @example
 * ```typescript
 * const result = await retryWithClassification(
 *   async () => await program.methods.storePassword().rpc(),
 *   (error) => {
 *     // Custom logic to determine if error is retryable
 *     return error.message.includes('RPC timeout');
 *   },
 *   { maxRetries: 5 }
 * );
 * ```
 */
export async function retryWithClassification<T>(
  fn: () => Promise<T>,
  classifier: (error: Error) => boolean,
  options: Omit<RetryOptions, 'shouldRetry'> = {}
): Promise<T> {
  return retry(fn, {
    ...options,
    shouldRetry: (error, attemptNumber) => {
      if (error instanceof NonRetryableError) {
        return false;
      }
      return classifier(error);
    },
  });
}

/**
 * Wraps a function to automatically retry on failure
 *
 * @example
 * ```typescript
 * const sendTxWithRetry = withRetry(
 *   async (tx: Transaction) => await connection.sendTransaction(tx),
 *   { maxRetries: 3 }
 * );
 *
 * const signature = await sendTxWithRetry(myTransaction);
 * ```
 */
export function withRetry<TArgs extends any[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: RetryOptions = {}
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    return retry(() => fn(...args), options);
  };
}

/**
 * Batch operations with individual retry logic
 *
 * @param operations - Array of async operations to execute
 * @param options - Retry configuration
 * @returns Promise resolving to array of results (or errors)
 *
 * @example
 * ```typescript
 * const results = await retryBatch([
 *   () => client.storePassword(entry1),
 *   () => client.storePassword(entry2),
 *   () => client.storePassword(entry3),
 * ], { maxRetries: 2 });
 *
 * results.forEach((result, index) => {
 *   if (result.success) {
 *     console.log(`Operation ${index} succeeded:`, result.value);
 *   } else {
 *     console.error(`Operation ${index} failed:`, result.error);
 *   }
 * });
 * ```
 */
export async function retryBatch<T>(
  operations: (() => Promise<T>)[],
  options: RetryOptions = {}
): Promise<Array<{ success: true; value: T } | { success: false; error: Error }>> {
  const results = await Promise.allSettled(
    operations.map(op => retry(op, options))
  );

  return results.map(result => {
    if (result.status === 'fulfilled') {
      return { success: true, value: result.value };
    } else {
      return { success: false, error: result.reason };
    }
  });
}
