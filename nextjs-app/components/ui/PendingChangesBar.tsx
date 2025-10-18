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
    <>
      <div className={`pending-changes-bar ${positionClasses} ${className}`}>
        <div className="pending-changes-content">
          {/* Left: Info */}
          <div className="pending-info">
            <div className="pending-icon">
              ⚡
            </div>

            <div className="pending-text">
              <span className="pending-count">
                {pendingStats.total} unsaved {pendingStats.total === 1 ? 'change' : 'changes'}
              </span>
              <span className="pending-summary">
                {changeSummary.join(', ')} • Will be synced in {pendingStats.updates > 0 ? '1 batch transaction' : 'single transaction'}
              </span>
            </div>
          </div>

          {/* Right: Actions */}
          {!showConfirmDiscard ? (
            <div className="pending-actions">
              <button onClick={handleDiscard} disabled={syncing} className="btn-discard">
                Discard
              </button>

              <button onClick={handleSync} disabled={syncing} className="btn-sync">
                {syncing ? (
                  <>
                    <span className="spinner"></span>
                    Syncing batch...
                  </>
                ) : (
                  <>
                    <span className="sync-icon">🔄</span>
                    Sync to Blockchain
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="pending-confirm">
              <span className="confirm-text">Discard all changes?</span>
              <div className="confirm-actions">
                <button onClick={cancelDiscard} className="btn-cancel">
                  Cancel
                </button>
                <button onClick={confirmDiscard} className="btn-confirm-discard">
                  Yes, Discard
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .pending-changes-bar {
          position: fixed;
          left: 0;
          right: 0;
          z-index: var(--z-sticky);
          background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
          border: 1px solid #fbbf24;
          box-shadow: 0 4px 12px rgba(251, 191, 36, 0.3);
          animation: slideIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .pending-changes-bar.bottom-0 {
          bottom: 0;
          border-top: 2px solid #f59e0b;
        }

        .pending-changes-bar.top-0 {
          top: 0;
          border-bottom: 2px solid #f59e0b;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .pending-changes-content {
          max-width: 1400px;
          margin: 0 auto;
          padding: 1rem 1.5rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1.5rem;
        }

        .pending-info {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .pending-icon {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.25rem;
          animation: pulse 2s ease-in-out infinite;
          box-shadow: 0 4px 12px rgba(251, 191, 36, 0.4);
        }

        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.05);
            opacity: 0.9;
          }
        }

        .pending-text {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .pending-count {
          font-size: 0.9375rem;
          font-weight: 700;
          color: #78350f;
          letter-spacing: -0.01em;
        }

        .pending-summary {
          font-size: 0.8125rem;
          color: #92400e;
          font-weight: 500;
        }

        .pending-actions {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .btn-discard {
          padding: 0.625rem 1.25rem;
          font-size: 0.875rem;
          font-weight: 600;
          color: #78350f;
          background: white;
          border: 2px solid #fbbf24;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-discard:hover:not(:disabled) {
          background: #fef3c7;
          transform: translateY(-1px);
        }

        .btn-discard:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-sync {
          padding: 0.625rem 1.5rem;
          font-size: 0.875rem;
          font-weight: 700;
          color: white;
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4);
        }

        .btn-sync:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(245, 158, 11, 0.5);
        }

        .btn-sync:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .sync-icon {
          font-size: 1rem;
        }

        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .pending-confirm {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .confirm-text {
          font-size: 0.9375rem;
          font-weight: 600;
          color: #78350f;
        }

        .confirm-actions {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .btn-cancel {
          padding: 0.5rem 1rem;
          font-size: 0.875rem;
          font-weight: 600;
          color: #78350f;
          background: white;
          border: 2px solid #fbbf24;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-cancel:hover {
          background: #fef3c7;
        }

        .btn-confirm-discard {
          padding: 0.5rem 1rem;
          font-size: 0.875rem;
          font-weight: 700;
          color: white;
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-confirm-discard:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
        }

        @media (max-width: 768px) {
          .pending-changes-content {
            flex-direction: column;
            align-items: flex-start;
            gap: 1rem;
            padding: 1rem;
          }

          .pending-actions,
          .pending-confirm {
            width: 100%;
          }

          .btn-sync,
          .btn-discard {
            flex: 1;
          }
        }
      `}</style>
    </>
  );
}
