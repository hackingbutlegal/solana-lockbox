/**
 * Error Formatting Utility
 *
 * Converts technical blockchain errors into user-friendly messages
 * with actionable suggestions for resolution.
 */

import { LockboxV2Error } from './types-v2';

/**
 * User-friendly error with explanation and suggested actions
 */
export interface FormattedError {
  /** User-friendly title */
  title: string;
  /** Detailed explanation */
  message: string;
  /** Suggested actions for the user */
  actions: string[];
  /** Original error for debugging */
  originalError: Error;
  /** Error severity */
  severity: 'error' | 'warning' | 'info';
  /** Whether the error is retryable */
  retryable: boolean;
}

/**
 * Format a generic error into a user-friendly message
 */
export function formatError(error: Error | string): FormattedError {
  const err = typeof error === 'string' ? new Error(error) : error;
  const message = err.message.toLowerCase();

  // Network and RPC errors
  if (
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('econnreset')
  ) {
    return {
      title: 'Network Connection Failed',
      message: 'Unable to connect to the Solana network. This could be a temporary network issue.',
      actions: [
        'Check your internet connection',
        'Try again in a few moments',
        'Switch to a different RPC endpoint if the problem persists',
      ],
      originalError: err,
      severity: 'error',
      retryable: true,
    };
  }

  // Wallet connection errors
  if (message.includes('wallet') || message.includes('not connected')) {
    return {
      title: 'Wallet Not Connected',
      message: 'Your wallet is not connected to the application.',
      actions: [
        'Click the wallet button to connect',
        'Make sure your wallet extension is unlocked',
        'Refresh the page if the issue persists',
      ],
      originalError: err,
      severity: 'warning',
      retryable: false,
    };
  }

  // Transaction confirmation errors
  if (
    message.includes('blockhash') ||
    message.includes('not confirmed') ||
    message.includes('transaction expired')
  ) {
    return {
      title: 'Transaction Timeout',
      message: 'The transaction took too long to confirm. This often happens during network congestion.',
      actions: [
        'Your wallet was not charged',
        'Please try the operation again',
        'Consider increasing priority fees if network is congested',
      ],
      originalError: err,
      severity: 'warning',
      retryable: true,
    };
  }

  // User rejected transaction
  if (message.includes('user rejected') || message.includes('user denied')) {
    return {
      title: 'Transaction Cancelled',
      message: 'You cancelled the transaction in your wallet.',
      actions: [
        'No charges were made to your wallet',
        'Try again when ready to proceed',
      ],
      originalError: err,
      severity: 'info',
      retryable: false,
    };
  }

  // Insufficient balance
  if (message.includes('insufficient') || message.includes('not enough')) {
    return {
      title: 'Insufficient Balance',
      message: 'Your wallet does not have enough SOL to complete this transaction.',
      actions: [
        'Add more SOL to your wallet',
        'Transaction fees typically range from 0.000005 to 0.00001 SOL',
        'Storage rent varies by subscription tier',
      ],
      originalError: err,
      severity: 'error',
      retryable: false,
    };
  }

  // Program-specific errors
  if (message.includes('custom program error') || message.includes('0x')) {
    return formatProgramError(err);
  }

  // IDL loading errors
  if (message.includes('idl') && message.includes('not loaded')) {
    return {
      title: 'Program Not Available',
      message: 'The Lockbox program interface could not be loaded. The program may not be deployed on this network.',
      actions: [
        'Make sure you are connected to Solana Devnet',
        'Contact support if this issue persists',
        'Check the console for technical details',
      ],
      originalError: err,
      severity: 'error',
      retryable: false,
    };
  }

  // Default error
  return {
    title: 'Unexpected Error',
    message: err.message || 'An unknown error occurred. Please try again.',
    actions: [
      'Try refreshing the page',
      'Check the console for technical details',
      'Contact support if the issue persists',
    ],
    originalError: err,
    severity: 'error',
    retryable: false,
  };
}

/**
 * Format program-specific errors
 */
function formatProgramError(error: Error): FormattedError {
  const message = error.message.toLowerCase();

  // Extract error code if present
  const errorCodeMatch = error.message.match(/0x([0-9a-f]+)/i);
  const errorCode = errorCodeMatch ? parseInt(errorCodeMatch[1], 16) : null;

  // Map error codes to user-friendly messages
  if (errorCode) {
    switch (errorCode) {
      case LockboxV2Error.MaxChunksReached:
        return {
          title: 'Storage Limit Reached',
          message: 'You have reached the maximum number of storage chunks for your subscription tier.',
          actions: [
            'Upgrade your subscription to increase storage capacity',
            'Delete unused passwords to free up space',
            'Consider the Premium or Enterprise tier for more storage',
          ],
          originalError: error,
          severity: 'error',
          retryable: false,
        };

      case LockboxV2Error.InsufficientStorageCapacity:
      case LockboxV2Error.InsufficientChunkCapacity:
        return {
          title: 'Storage Capacity Exceeded',
          message: 'Your current subscription tier does not have enough storage space for this entry.',
          actions: [
            'Upgrade to a higher subscription tier',
            'Delete some passwords to free up space',
            'Try storing a smaller amount of data',
          ],
          originalError: error,
          severity: 'error',
          retryable: false,
        };

      case LockboxV2Error.SubscriptionExpired:
        return {
          title: 'Subscription Expired',
          message: 'Your subscription has expired. Please renew to continue using this feature.',
          actions: [
            'Renew your subscription in the Subscription section',
            'Your data is safe and will be accessible after renewal',
            'Contact support if you have questions about renewal',
          ],
          originalError: error,
          severity: 'warning',
          retryable: false,
        };

      case LockboxV2Error.Unauthorized:
        return {
          title: 'Unauthorized Access',
          message: 'You do not have permission to perform this action.',
          actions: [
            'Make sure you are using the correct wallet',
            'This lockbox belongs to a different wallet address',
            'Contact support if you believe this is an error',
          ],
          originalError: error,
          severity: 'error',
          retryable: false,
        };

      case LockboxV2Error.EntryNotFound:
        return {
          title: 'Entry Not Found',
          message: 'The password entry you are trying to access does not exist.',
          actions: [
            'Refresh the page to sync with the latest data',
            'The entry may have been deleted',
            'Contact support if entries are missing',
          ],
          originalError: error,
          severity: 'warning',
          retryable: false,
        };

      case LockboxV2Error.DataCorruption:
        return {
          title: 'Data Corruption Detected',
          message: 'The encrypted data appears to be corrupted or invalid.',
          actions: [
            'Do not attempt to modify this entry',
            'Contact support immediately',
            'You may need to restore from a backup',
          ],
          originalError: error,
          severity: 'error',
          retryable: false,
        };

      case LockboxV2Error.CooldownNotElapsed:
        return {
          title: 'Please Wait',
          message: 'You are performing actions too quickly. Please wait a moment before trying again.',
          actions: [
            'Wait a few seconds before retrying',
            'This is a rate limit to prevent abuse',
          ],
          originalError: error,
          severity: 'warning',
          retryable: true,
        };
    }
  }

  // Generic program error
  return {
    title: 'Program Error',
    message: `The Lockbox program returned an error: ${error.message}`,
    actions: [
      'Check that you have the required permissions',
      'Verify your subscription is active',
      'Try again in a few moments',
      'Contact support if the issue persists',
    ],
    originalError: error,
    severity: 'error',
    retryable: false,
  };
}

/**
 * Format storage limit errors with specific tier information
 */
export function formatStorageLimitError(
  currentTier: string,
  usedBytes: number,
  limitBytes: number
): FormattedError {
  return {
    title: 'Storage Limit Exceeded',
    message: `Your ${currentTier} tier storage is full (${usedBytes}/${limitBytes} bytes used).`,
    actions: [
      'Upgrade to a higher tier for more storage',
      'Delete unused passwords to free up space',
      currentTier === 'Free' ? 'Consider upgrading to Basic (10KB) or Premium (100KB)' : '',
    ].filter(Boolean),
    originalError: new Error('STORAGE_LIMIT_EXCEEDED'),
    severity: 'error',
    retryable: false,
  };
}

/**
 * Format validation errors
 */
export function formatValidationError(field: string, issue: string): FormattedError {
  return {
    title: 'Invalid Input',
    message: `${field}: ${issue}`,
    actions: [
      'Please correct the highlighted field',
      'Make sure all required fields are filled',
    ],
    originalError: new Error(`Validation error: ${field} - ${issue}`),
    severity: 'warning',
    retryable: false,
  };
}

/**
 * Get a short, one-line error message suitable for toasts
 */
export function getShortErrorMessage(error: Error | string): string {
  const formatted = formatError(error);
  return `${formatted.title}: ${formatted.message}`;
}

/**
 * Get suggested actions as a formatted string
 */
export function getActionsSummary(error: Error | string): string {
  const formatted = formatError(error);
  return formatted.actions
    .map((action, index) => `${index + 1}. ${action}`)
    .join('\n');
}

/**
 * Check if an error should be displayed to the user
 * (Some errors are informational and don't need prominent display)
 */
export function shouldDisplayError(error: Error | string): boolean {
  const formatted = formatError(error);
  return formatted.severity !== 'info';
}
