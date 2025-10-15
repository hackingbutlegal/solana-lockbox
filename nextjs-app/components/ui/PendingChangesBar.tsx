'use client';

import React from 'react';
import { usePassword } from '../../contexts/PasswordContext';

/**
 * Pending Changes Bar
 * 
 * Displays a notification bar when there are unsaved changes,
 * with options to sync or discard.
 * 
 * Features:
 * - Shows count and summary of pending changes
 * - Sync button to send all changes in batched transaction
 * - Discard button to revert local changes
 * - Loading state during sync
 * - Sticky positioning at top or bottom
 */

interface PendingChangesBarProps {
  position?: 'top' | 'bottom';
  className?: string;
}

export function PendingChangesBar({ position = 'bottom', className = '' }: PendingChangesBarProps) {
  const {
    hasPendingChanges,
    pendingStats,
    syncPendingChanges,
    discardPendingChanges,
    syncing,
  } = usePassword();

  const [showConfirmDiscard, setShowConfirmDiscard] = React.useState(false);

  const handleSync = async () => {
    const success = await syncPendingChanges();
    if (success) {
      console.log('✓ Changes synced successfully');
    }
  };

  const handleDiscard = () => {
    setShowConfirmDiscard(true);
  };

  const confirmDiscard = async () => {
    await discardPendingChanges();
    setShowConfirmDiscard(false);
  };

  const cancelDiscard = () => {
    setShowConfirmDiscard(false);
  };

  // Don't render if no pending changes
  if (!hasPendingChanges) {
    return null;
  }

  const positionClasses = position === 'top'
    ? 'top-0 border-b'
    : 'bottom-0 border-t';

  const changeSummary = [];
  if (pendingStats.creates > 0) {
    changeSummary.push(`${pendingStats.creates} new`);
  }
  if (pendingStats.updates > 0) {
    changeSummary.push(`${pendingStats.updates} updated`);
  }
  if (pendingStats.deletes > 0) {
    changeSummary.push(`${pendingStats.deletes} deleted`);
  }

  return (
    <div
      className={`fixed left-0 right-0 z-50 ${positionClasses} bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800 ${className}`}
    >
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        {/* Left: Info */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-yellow-100 dark:bg-yellow-800/50">
            <svg
              className="w-5 h-5 text-yellow-600 dark:text-yellow-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>

          <div className="flex flex-col">
            <span className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
              {pendingStats.total} unsaved {pendingStats.total === 1 ? 'change' : 'changes'}
            </span>
            <span className="text-xs text-yellow-700 dark:text-yellow-300">
              {changeSummary.join(', ')}
            </span>
          </div>
        </div>

        {/* Right: Actions */}
        {!showConfirmDiscard ? (
          <div className="flex items-center gap-2">
            <button
              onClick={handleDiscard}
              disabled={syncing}
              className="px-4 py-2 text-sm font-medium text-yellow-900 bg-white border border-yellow-300 rounded-md hover:bg-yellow-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors dark:bg-yellow-900/30 dark:text-yellow-100 dark:border-yellow-700 dark:hover:bg-yellow-900/50"
            >
              Discard
            </button>

            <button
              onClick={handleSync}
              disabled={syncing}
              className="px-4 py-2 text-sm font-medium text-white bg-yellow-600 rounded-md hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 dark:bg-yellow-500 dark:hover:bg-yellow-600"
            >
              {syncing ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Syncing...
                </>
              ) : (
                <>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Sync to Blockchain
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-sm text-yellow-900 dark:text-yellow-100">
              Discard all changes?
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={cancelDiscard}
                className="px-3 py-1.5 text-sm font-medium text-yellow-900 bg-white border border-yellow-300 rounded hover:bg-yellow-50 transition-colors dark:bg-yellow-900/30 dark:text-yellow-100 dark:border-yellow-700"
              >
                Cancel
              </button>
              <button
                onClick={confirmDiscard}
                className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded hover:bg-red-700 transition-colors dark:bg-red-500 dark:hover:bg-red-600"
              >
                Yes, Discard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
