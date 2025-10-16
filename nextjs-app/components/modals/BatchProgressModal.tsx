'use client';

import React from 'react';
import { BatchUpdateProgress } from '../../lib/batch-update-operations';

/**
 * BatchProgressModal Component
 *
 * Visual progress modal for batch operations with:
 * - Real-time progress bar
 * - Individual entry status indicators
 * - Success/failure counters
 * - Cancel operation button
 * - Animated progress updates
 *
 * Usage:
 * ```tsx
 * const [showProgress, setShowProgress] = useState(false);
 * const [progress, setProgress] = useState<BatchUpdateProgress | null>(null);
 *
 * <BatchProgressModal
 *   isOpen={showProgress}
 *   operation="Archive"
 *   progress={progress}
 *   onCancel={() => {
 *     // Handle cancellation
 *     setShowProgress(false);
 *   }}
 * />
 * ```
 */

export interface BatchProgressModalProps {
  isOpen: boolean;
  operation: string; // e.g., "Archive", "Delete", "Favorite"
  progress: BatchUpdateProgress | null;
  totalItems: number;
  successCount: number;
  failureCount: number;
  onCancel?: () => void;
  onClose?: () => void;
  canCancel?: boolean;
}

export function BatchProgressModal({
  isOpen,
  operation,
  progress,
  totalItems,
  successCount,
  failureCount,
  onCancel,
  onClose,
  canCancel = false,
}: BatchProgressModalProps) {
  if (!isOpen) return null;

  const isComplete = progress ? progress.current >= progress.total : false;
  const progressPercentage = progress
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

  return (
    <div className="modal-overlay" onClick={(e) => e.stopPropagation()}>
      <div className="modal-container">
        <div className="modal-header">
          <h2>{operation} Passwords</h2>
          {isComplete && onClose && (
            <button
              onClick={onClose}
              className="btn-close"
              aria-label="Close"
            >
              ✕
            </button>
          )}
        </div>

        <div className="modal-body">
          {/* Progress Bar */}
          <div className="progress-section">
            <div className="progress-bar-container">
              <div
                className="progress-bar-fill"
                style={{ width: `${progressPercentage}%` }}
              >
                {progressPercentage > 0 && (
                  <span className="progress-bar-text">{progressPercentage}%</span>
                )}
              </div>
            </div>
            <div className="progress-text">
              {progress ? (
                <span>
                  Processing {progress.current} of {progress.total}
                </span>
              ) : (
                <span>Preparing...</span>
              )}
            </div>
          </div>

          {/* Status Indicators */}
          <div className="status-section">
            <div className="status-item status-success">
              <div className="status-icon">✓</div>
              <div className="status-label">Successful</div>
              <div className="status-count">{successCount}</div>
            </div>

            <div className="status-item status-pending">
              <div className="status-icon">⏳</div>
              <div className="status-label">Remaining</div>
              <div className="status-count">
                {totalItems - successCount - failureCount}
              </div>
            </div>

            <div className="status-item status-failed">
              <div className="status-icon">✗</div>
              <div className="status-label">Failed</div>
              <div className="status-count">{failureCount}</div>
            </div>
          </div>

          {/* Current Item */}
          {progress && progress.status === 'pending' && (
            <div className="current-item">
              <div className="spinner"></div>
              <span>Processing entry {progress.entryId}...</span>
            </div>
          )}

          {/* Completion Message */}
          {isComplete && (
            <div className="completion-message">
              {failureCount === 0 ? (
                <div className="success-message">
                  <div className="success-icon">🎉</div>
                  <p>
                    Successfully {operation.toLowerCase()}d {successCount} password
                    {successCount !== 1 ? 's' : ''}!
                  </p>
                </div>
              ) : (
                <div className="warning-message">
                  <div className="warning-icon">⚠️</div>
                  <p>
                    {operation} completed with some failures:
                    <br />
                    {successCount} successful, {failureCount} failed
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          {!isComplete && canCancel && onCancel && (
            <button onClick={onCancel} className="btn-cancel">
              Cancel Operation
            </button>
          )}
          {isComplete && onClose && (
            <button onClick={onClose} className="btn-primary">
              Close
            </button>
          )}
        </div>
      </div>

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          backdrop-filter: blur(4px);
        }

        .modal-container {
          background: white;
          border-radius: 16px;
          width: 90%;
          max-width: 500px;
          max-height: 90vh;
          overflow: auto;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          animation: slideUp 0.3s ease-out;
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .modal-header {
          padding: 1.5rem;
          border-bottom: 1px solid #e1e8ed;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .modal-header h2 {
          margin: 0;
          font-size: 1.5rem;
          color: #2c3e50;
        }

        .btn-close {
          background: transparent;
          border: none;
          font-size: 1.5rem;
          color: #7f8c8d;
          cursor: pointer;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          transition: all 0.2s;
        }

        .btn-close:hover {
          background: #f8f9fa;
          color: #2c3e50;
        }

        .modal-body {
          padding: 2rem 1.5rem;
        }

        .progress-section {
          margin-bottom: 2rem;
        }

        .progress-bar-container {
          width: 100%;
          height: 32px;
          background: #e1e8ed;
          border-radius: 16px;
          overflow: hidden;
          position: relative;
          margin-bottom: 0.75rem;
        }

        .progress-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
          transition: width 0.3s ease-out;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }

        .progress-bar-text {
          color: white;
          font-weight: 600;
          font-size: 0.875rem;
        }

        .progress-text {
          text-align: center;
          color: #7f8c8d;
          font-size: 0.875rem;
        }

        .status-section {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .status-item {
          background: #f8f9fa;
          border-radius: 12px;
          padding: 1rem;
          text-align: center;
          border: 2px solid transparent;
          transition: all 0.2s;
        }

        .status-item.status-success {
          border-color: #d1fae5;
          background: #f0fdf4;
        }

        .status-item.status-pending {
          border-color: #dbeafe;
          background: #eff6ff;
        }

        .status-item.status-failed {
          border-color: #fee2e2;
          background: #fef2f2;
        }

        .status-icon {
          font-size: 1.5rem;
          margin-bottom: 0.5rem;
        }

        .status-success .status-icon {
          color: #10b981;
        }

        .status-pending .status-icon {
          color: #3b82f6;
        }

        .status-failed .status-icon {
          color: #ef4444;
        }

        .status-label {
          font-size: 0.75rem;
          color: #7f8c8d;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 0.25rem;
        }

        .status-count {
          font-size: 1.5rem;
          font-weight: 700;
          color: #2c3e50;
        }

        .current-item {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 1rem;
          padding: 1rem;
          background: #f8f9fa;
          border-radius: 8px;
          color: #7f8c8d;
          font-size: 0.875rem;
        }

        .spinner {
          width: 20px;
          height: 20px;
          border: 3px solid #e1e8ed;
          border-top-color: #667eea;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .completion-message {
          margin-top: 1.5rem;
          padding: 1.5rem;
          border-radius: 12px;
          text-align: center;
        }

        .success-message {
          background: #f0fdf4;
          border: 2px solid #d1fae5;
        }

        .success-icon {
          font-size: 3rem;
          margin-bottom: 0.5rem;
        }

        .success-message p {
          margin: 0;
          color: #065f46;
          font-weight: 500;
          line-height: 1.6;
        }

        .warning-message {
          background: #fef3c7;
          border: 2px solid #fde68a;
        }

        .warning-icon {
          font-size: 2.5rem;
          margin-bottom: 0.5rem;
        }

        .warning-message p {
          margin: 0;
          color: #92400e;
          font-weight: 500;
          line-height: 1.6;
        }

        .modal-footer {
          padding: 1rem 1.5rem;
          border-top: 1px solid #e1e8ed;
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
        }

        .btn-cancel,
        .btn-primary {
          padding: 0.75rem 1.5rem;
          border: none;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-cancel {
          background: #f8f9fa;
          color: #2c3e50;
        }

        .btn-cancel:hover {
          background: #e1e8ed;
        }

        .btn-primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }

        /* Mobile Responsive */
        @media (max-width: 640px) {
          .modal-container {
            width: 95%;
            max-height: 95vh;
          }

          .modal-header h2 {
            font-size: 1.25rem;
          }

          .modal-body {
            padding: 1.5rem 1rem;
          }

          .status-section {
            gap: 0.75rem;
          }

          .status-item {
            padding: 0.75rem 0.5rem;
          }

          .status-icon {
            font-size: 1.25rem;
          }

          .status-count {
            font-size: 1.25rem;
          }
        }
      `}</style>
    </div>
  );
}
