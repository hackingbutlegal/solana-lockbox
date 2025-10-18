'use client';

import React from 'react';

/**
 * Batch Mode Toggle
 *
 * Allows users to choose between:
 * - Immediate mode: Changes save to blockchain immediately (1 transaction each)
 * - Batch mode: Changes queue locally, sync all at once (1 transaction for multiple)
 */

export interface BatchModeToggleProps {
  isBatchMode: boolean;
  onToggle: (batchMode: boolean) => void;
  className?: string;
}

export function BatchModeToggle({ isBatchMode, onToggle, className = '' }: BatchModeToggleProps) {
  return (
    <>
      <div className={`batch-mode-toggle ${className}`}>
        <div className="toggle-header">
          <span className="toggle-icon">{isBatchMode ? '📦' : '⚡'}</span>
          <div className="toggle-info">
            <span className="toggle-title">
              {isBatchMode ? 'Batch Mode' : 'Immediate Mode'}
            </span>
            <span className="toggle-description">
              {isBatchMode
                ? 'Queue changes locally, sync all at once'
                : 'Save each change to blockchain immediately'
              }
            </span>
          </div>
        </div>

        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={isBatchMode}
            onChange={(e) => onToggle(e.target.checked)}
          />
          <span className="slider"></span>
        </label>
      </div>

      <div className="mode-explanation">
        {isBatchMode ? (
          <div className="explanation-card batch">
            <div className="card-header">
              <span className="card-icon">📦</span>
              <h4>Batch Mode Active</h4>
            </div>
            <ul className="benefits-list">
              <li>✅ Make multiple changes without signing each one</li>
              <li>✅ Sync all changes in 1 transaction = Lower fees</li>
              <li>✅ Click "Sync to Blockchain" when ready</li>
            </ul>
            <div className="warning">
              ⚠️ Changes are <strong>not saved</strong> until you sync to blockchain
            </div>
          </div>
        ) : (
          <div className="explanation-card immediate">
            <div className="card-header">
              <span className="card-icon">⚡</span>
              <h4>Immediate Mode Active</h4>
            </div>
            <ul className="benefits-list">
              <li>✅ Each change saves to blockchain right away</li>
              <li>✅ No need to remember to sync</li>
              <li>⚠️ Requires signature for each change</li>
            </ul>
            <div className="info">
              💡 Switch to Batch Mode to save on fees when making multiple changes
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .batch-mode-toggle {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem 1.25rem;
          background: linear-gradient(135deg, #ffffff 0%, #fafbfc 100%);
          border: 2px solid #e5e7eb;
          border-radius: 12px;
          transition: all 0.3s ease;
        }

        .batch-mode-toggle:hover {
          border-color: #667eea;
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.1);
        }

        .toggle-header {
          display: flex;
          align-items: center;
          gap: 1rem;
          flex: 1;
        }

        .toggle-icon {
          font-size: 1.75rem;
          line-height: 1;
        }

        .toggle-info {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .toggle-title {
          font-size: 1rem;
          font-weight: 700;
          color: #1f2937;
          letter-spacing: -0.01em;
        }

        .toggle-description {
          font-size: 0.875rem;
          color: #6b7280;
          font-weight: 500;
        }

        .toggle-switch {
          position: relative;
          display: inline-block;
          width: 56px;
          height: 32px;
          flex-shrink: 0;
          cursor: pointer;
        }

        .toggle-switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }

        .slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: #cbd5e1;
          transition: 0.3s;
          border-radius: 32px;
        }

        .slider:before {
          position: absolute;
          content: "";
          height: 24px;
          width: 24px;
          left: 4px;
          bottom: 4px;
          background-color: white;
          transition: 0.3s;
          border-radius: 50%;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }

        input:checked + .slider {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }

        input:checked + .slider:before {
          transform: translateX(24px);
        }

        input:focus + .slider {
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.3);
        }

        .mode-explanation {
          margin-top: 1rem;
        }

        .explanation-card {
          padding: 1.25rem;
          border-radius: 12px;
          border: 2px solid;
        }

        .explanation-card.batch {
          background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
          border-color: #fbbf24;
        }

        .explanation-card.immediate {
          background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
          border-color: #93c5fd;
        }

        .card-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 1rem;
        }

        .card-icon {
          font-size: 1.5rem;
        }

        .card-header h4 {
          margin: 0;
          font-size: 1.0625rem;
          font-weight: 700;
          color: #1f2937;
          letter-spacing: -0.01em;
        }

        .benefits-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .benefits-list li {
          font-size: 0.9375rem;
          color: #374151;
          font-weight: 500;
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
        }

        .warning {
          margin-top: 1rem;
          padding: 0.75rem 1rem;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 8px;
          font-size: 0.875rem;
          color: #991b1b;
          font-weight: 600;
        }

        .info {
          margin-top: 1rem;
          padding: 0.75rem 1rem;
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.3);
          border-radius: 8px;
          font-size: 0.875rem;
          color: #1e40af;
          font-weight: 500;
        }

        @media (max-width: 640px) {
          .toggle-description {
            font-size: 0.8125rem;
          }

          .benefits-list li {
            font-size: 0.875rem;
          }
        }
      `}</style>
    </>
  );
}
