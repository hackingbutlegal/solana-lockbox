'use client';

import React, { useState, useEffect } from 'react';
import {
  generateBackupCodes,
  loadBackupCodes,
  getBackupCodesStats,
  regenerateBackupCodes,
  downloadBackupCodes,
  exportBackupCodes,
  BackupCodesData,
} from '../../lib/backup-codes-manager';
import { useToast } from '../ui/Toast';

interface BackupCodesModalProps {
  isOpen: boolean;
  onClose: () => void;
  isFirstTime?: boolean; // true if this is initial setup
}

export function BackupCodesModal({
  isOpen,
  onClose,
  isFirstTime = false,
}: BackupCodesModalProps) {
  const toast = useToast();
  const [backupCodes, setBackupCodes] = useState<BackupCodesData | null>(null);
  const [hasConfirmedSave, setHasConfirmedSave] = useState(false);
  const [showCodes, setShowCodes] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const existing = loadBackupCodes();
      if (existing) {
        setBackupCodes(existing);
        setShowCodes(false);
        setHasConfirmedSave(true); // Already saved
      } else if (isFirstTime) {
        // Generate new codes for first-time setup
        handleGenerateCodes();
      }
    }
  }, [isOpen, isFirstTime]);

  const handleGenerateCodes = () => {
    const newCodes = generateBackupCodes();
    setBackupCodes(newCodes);
    setShowCodes(true);
    setHasConfirmedSave(false);
    toast.showSuccess('Backup codes generated successfully');
  };

  const handleRegenerateCodes = () => {
    const confirmed = window.confirm(
      'Regenerating backup codes will invalidate all existing codes. Are you sure?'
    );

    if (!confirmed) return;

    const newCodes = regenerateBackupCodes();
    setBackupCodes(newCodes);
    setShowCodes(true);
    setHasConfirmedSave(false);
    toast.showSuccess('New backup codes generated. Old codes are now invalid.');
  };

  const handleDownloadCodes = () => {
    try {
      downloadBackupCodes();
      toast.showSuccess('Backup codes downloaded');
    } catch (err) {
      toast.showError('Failed to download backup codes');
    }
  };

  const handleCopyToClipboard = () => {
    try {
      const content = exportBackupCodes();
      navigator.clipboard.writeText(content);
      toast.showSuccess('Backup codes copied to clipboard');
    } catch (err) {
      toast.showError('Failed to copy to clipboard');
    }
  };

  const handleConfirmSaved = () => {
    setHasConfirmedSave(true);
    toast.showSuccess('Great! Your backup codes are secure.');
  };

  const handleClose = () => {
    if (isFirstTime && !hasConfirmedSave) {
      const confirmed = window.confirm(
        'Warning: You have not confirmed saving your backup codes. Without these codes, you cannot recover your account if you lose access to your wallet. Close anyway?'
      );
      if (!confirmed) return;
    }

    onClose();
  };

  if (!isOpen) return null;

  const stats = backupCodes ? getBackupCodesStats() : null;
  const unusedCodes = backupCodes?.codes.filter(c => !c.used) || [];

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content backup-codes-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🔐 Recovery Backup Codes</h2>
          <button className="modal-close" onClick={handleClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          {isFirstTime && !hasConfirmedSave && (
            <div className="first-time-notice">
              <div className="notice-icon">⚠️</div>
              <div className="notice-content">
                <h3>Critical: Save Your Backup Codes</h3>
                <p>
                  These codes are your only way to recover your account if you lose access to your
                  Solana wallet. <strong>Each code can only be used once.</strong>
                </p>
              </div>
            </div>
          )}

          {stats && (
            <div className="codes-stats">
              <div className="stat-item">
                <span className="stat-label">Total Codes:</span>
                <span className="stat-value">{stats.total}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Unused:</span>
                <span className="stat-value unused">{stats.unused}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Used:</span>
                <span className="stat-value used">{stats.used}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Generated:</span>
                <span className="stat-value">
                  {stats.generatedAt ? new Date(stats.generatedAt).toLocaleDateString() : 'N/A'}
                </span>
              </div>
            </div>
          )}

          {backupCodes && showCodes && (
            <>
              <div className="codes-container">
                <div className="codes-header">
                  <h3>Your Backup Codes</h3>
                  <p className="codes-warning">
                    ⚠️ Store these codes in a secure location. Anyone with these codes can access
                    your vault.
                  </p>
                </div>

                <div className="codes-grid">
                  {unusedCodes.map((codeObj, index) => (
                    <div key={index} className="code-item">
                      <span className="code-number">{(index + 1).toString().padStart(2, '0')}.</span>
                      <code className="code-value">{codeObj.code}</code>
                    </div>
                  ))}
                </div>

                <div className="codes-instructions">
                  <h4>How to use these codes:</h4>
                  <ol>
                    <li>If you lose access to your Solana wallet</li>
                    <li>Click &quot;Recover with Backup Code&quot; on the login screen</li>
                    <li>Enter one of these codes to regain access</li>
                    <li>Immediately generate new backup codes after recovery</li>
                  </ol>
                </div>
              </div>

              {!hasConfirmedSave && (
                <div className="confirm-saved-section">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={hasConfirmedSave}
                      onChange={(e) => setHasConfirmedSave(e.target.checked)}
                    />
                    <span>
                      I have saved these codes in a secure location (printed or stored in a password
                      manager)
                    </span>
                  </label>
                </div>
              )}
            </>
          )}

          {backupCodes && !showCodes && (
            <div className="codes-hidden-notice">
              <p>
                Your backup codes are stored securely. Click &quot;View Codes&quot; to see them, or regenerate
                new codes if needed.
              </p>
            </div>
          )}

          {!backupCodes && !isFirstTime && (
            <div className="no-codes-notice">
              <p>
                You don&apos;t have any backup codes yet. Generate them now to protect your account.
              </p>
            </div>
          )}
        </div>

        <div className="modal-footer backup-codes-footer">
          {backupCodes && showCodes && (
            <>
              <button onClick={handleDownloadCodes} className="btn-download">
                📥 Download
              </button>
              <button onClick={handleCopyToClipboard} className="btn-copy">
                📋 Copy
              </button>
            </>
          )}

          {backupCodes && !showCodes && (
            <button onClick={() => setShowCodes(true)} className="btn-view">
              👁️ View Codes
            </button>
          )}

          {backupCodes ? (
            <button onClick={handleRegenerateCodes} className="btn-regenerate">
              🔄 Regenerate Codes
            </button>
          ) : (
            <button onClick={handleGenerateCodes} className="btn-generate">
              ✨ Generate Codes
            </button>
          )}

          <button onClick={handleClose} className="btn-close">
            {hasConfirmedSave || !isFirstTime ? 'Close' : 'Skip (Not Recommended)'}
          </button>
        </div>

        <style jsx>{`
          .backup-codes-modal {
            max-width: 700px;
            width: 90%;
          }

          .first-time-notice {
            display: flex;
            gap: 1rem;
            padding: 1.5rem;
            background: linear-gradient(135deg, #fff3cd 0%, #fff8e1 100%);
            border: 2px solid #ffc107;
            border-radius: 12px;
            margin-bottom: 1.5rem;
          }

          .notice-icon {
            font-size: 2rem;
            line-height: 1;
          }

          .notice-content h3 {
            margin: 0 0 0.5rem 0;
            color: #856404;
            font-size: 1.1rem;
          }

          .notice-content p {
            margin: 0;
            color: #856404;
            line-height: 1.5;
          }

          .codes-stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 1rem;
            margin-bottom: 1.5rem;
          }

          .stat-item {
            display: flex;
            flex-direction: column;
            padding: 1rem;
            background: #f8f9fa;
            border-radius: 8px;
            border: 1px solid #e1e8ed;
          }

          .stat-label {
            font-size: 0.85rem;
            color: #7f8c8d;
            margin-bottom: 0.25rem;
          }

          .stat-value {
            font-size: 1.5rem;
            font-weight: 700;
            color: #2c3e50;
          }

          .stat-value.unused {
            color: #27ae60;
          }

          .stat-value.used {
            color: #95a5a6;
          }

          .codes-container {
            border: 2px solid #e1e8ed;
            border-radius: 12px;
            padding: 1.5rem;
            background: #f8f9fa;
          }

          .codes-header {
            margin-bottom: 1.5rem;
          }

          .codes-header h3 {
            margin: 0 0 0.5rem 0;
            color: #2c3e50;
          }

          .codes-warning {
            margin: 0;
            padding: 0.75rem;
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            color: #856404;
            font-size: 0.9rem;
            border-radius: 4px;
          }

          .codes-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
            gap: 0.75rem;
            margin-bottom: 1.5rem;
          }

          .code-item {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.75rem;
            background: white;
            border: 1px solid #e1e8ed;
            border-radius: 6px;
          }

          .code-number {
            color: #7f8c8d;
            font-weight: 600;
            font-size: 0.85rem;
          }

          .code-value {
            font-family: 'SF Mono', 'Monaco', 'Cascadia Code', 'Courier New', monospace;
            font-size: 0.95rem;
            font-weight: 600;
            color: #2c3e50;
            letter-spacing: 0.5px;
          }

          .codes-instructions {
            padding: 1rem;
            background: white;
            border-radius: 8px;
            border: 1px solid #e1e8ed;
          }

          .codes-instructions h4 {
            margin: 0 0 0.75rem 0;
            color: #2c3e50;
            font-size: 0.95rem;
          }

          .codes-instructions ol {
            margin: 0;
            padding-left: 1.5rem;
            color: #7f8c8d;
            font-size: 0.9rem;
            line-height: 1.6;
          }

          .codes-instructions li {
            margin-bottom: 0.25rem;
          }

          .confirm-saved-section {
            margin-top: 1.5rem;
            padding: 1.25rem;
            background: white;
            border: 2px solid #3498db;
            border-radius: 8px;
          }

          .checkbox-label {
            display: flex;
            align-items: flex-start;
            gap: 0.75rem;
            cursor: pointer;
            font-size: 0.95rem;
            color: #2c3e50;
          }

          .checkbox-label input[type='checkbox'] {
            margin-top: 0.25rem;
            width: 18px;
            height: 18px;
            cursor: pointer;
          }

          .codes-hidden-notice,
          .no-codes-notice {
            padding: 1.5rem;
            background: #f8f9fa;
            border-radius: 8px;
            text-align: center;
            color: #7f8c8d;
          }

          .backup-codes-footer {
            display: flex;
            gap: 0.75rem;
            flex-wrap: wrap;
          }

          .backup-codes-footer button {
            padding: 0.75rem 1.25rem;
            border-radius: 6px;
            border: none;
            cursor: pointer;
            font-weight: 600;
            font-size: 0.95rem;
            transition: all 0.2s;
          }

          .btn-download,
          .btn-copy {
            background: #3498db;
            color: white;
          }

          .btn-download:hover,
          .btn-copy:hover {
            background: #2980b9;
            transform: translateY(-1px);
          }

          .btn-view {
            background: #9b59b6;
            color: white;
          }

          .btn-view:hover {
            background: #8e44ad;
            transform: translateY(-1px);
          }

          .btn-regenerate {
            background: #f39c12;
            color: white;
          }

          .btn-regenerate:hover {
            background: #e67e22;
            transform: translateY(-1px);
          }

          .btn-generate {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
          }

          .btn-generate:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
          }

          .btn-close {
            background: #95a5a6;
            color: white;
            margin-left: auto;
          }

          .btn-close:hover {
            background: #7f8c8d;
          }

          @media (max-width: 768px) {
            .codes-grid {
              grid-template-columns: 1fr;
            }

            .codes-stats {
              grid-template-columns: 1fr 1fr;
            }
          }
        `}</style>
      </div>
    </div>
  );
}
