'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BackupCodesModal } from '../modals/BackupCodesModal';
import {
  getBackupCodesStats,
  hasBackupCodes,
  needsSecurityMigration,
  getMigrationMessage,
} from '../../lib/backup-codes-manager';

/**
 * Security Settings Panel
 *
 * Extracted from SettingsModal for use in /settings page
 * Includes:
 * - Recovery backup codes
 * - Security settings (auto-lock, clipboard, password warnings)
 */

export function SecuritySettingsPanel() {
  const router = useRouter();
  const [showBackupCodesModal, setShowBackupCodesModal] = useState(false);
  const backupCodesStats = hasBackupCodes() ? getBackupCodesStats() : null;
  const needsUpgrade = needsSecurityMigration();
  const migrationMessage = getMigrationMessage();

  return (
    <div className="security-settings-panel">
      {/* Optional Upgrade Banner for Old Backup Codes */}
      {needsUpgrade && (
        <div className="upgrade-banner">
          <div className="banner-icon-large">🔒</div>
          <div className="banner-content">
            <h4>Optional Security Upgrade Available</h4>
            <p>{migrationMessage}</p>
            <p className="banner-note">
              💡 Your current codes will continue to work. This upgrade is recommended but optional.
            </p>
            <button
              className="btn-upgrade-banner"
              onClick={() => setShowBackupCodesModal(true)}
            >
              Upgrade to Two-Factor →
            </button>
          </div>
        </div>
      )}

      <h3>Recovery & Backup</h3>
      <div className="settings-section">
        <div className="backup-codes-card">
          <div className="backup-codes-info">
            <div className="backup-codes-header">
              <span className="backup-icon">🔐</span>
              <div>
                <h4>Recovery Backup Codes</h4>
                {backupCodesStats && (
                  <div className="security-status">
                    {needsUpgrade ? (
                      <span className="status-badge basic">⚠️ Single-Factor</span>
                    ) : (
                      <span className="status-badge secure">✅ Two-Factor</span>
                    )}
                  </div>
                )}
                <p>
                  {backupCodesStats
                    ? `${backupCodesStats.unused} of ${backupCodesStats.total} codes remaining`
                    : 'Generate backup codes to recover your account if you lose wallet access'}
                </p>
              </div>
            </div>
            {backupCodesStats && backupCodesStats.unused < 3 && (
              <div className="backup-warning">
                ⚠️ Low on backup codes! Consider regenerating.
              </div>
            )}
          </div>
          <button
            className="btn-backup-codes"
            onClick={() => setShowBackupCodesModal(true)}
          >
            {backupCodesStats ? '🔄 Manage Codes' : '✨ Generate Codes'}
          </button>
        </div>

        {/* Recovery Console Link */}
        {hasBackupCodes() && (
          <div className="recovery-console-card">
            <div className="recovery-console-info">
              <div className="recovery-console-header">
                <span className="recovery-icon">🔓</span>
                <div>
                  <h4>Recovery Console</h4>
                  <p>
                    Access your passwords using backup codes without connecting your wallet
                  </p>
                </div>
              </div>
            </div>
            <button
              className="btn-recovery-console"
              onClick={() => router.push('/recovery')}
            >
              🔑 Open Recovery Console
            </button>
          </div>
        )}
      </div>

      {/* Security Settings - Coming Soon
      <h3>Security Settings</h3>
      <p className="settings-note">
        Advanced security settings (auto-lock, clipboard auto-clear, password policies) are planned for a future release.
      </p>
      */}

      <BackupCodesModal
        isOpen={showBackupCodesModal}
        onClose={() => setShowBackupCodesModal(false)}
        isFirstTime={!hasBackupCodes()}
      />

      <style jsx>{`
        .security-settings-panel h3 {
          margin: 0 0 1.5rem 0;
          color: #2c3e50;
          font-size: 1.25rem;
        }

        .settings-section {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .backup-codes-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.5rem;
          background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
          border: 2px solid #dee2e6;
          border-radius: 12px;
          gap: 1.5rem;
        }

        .backup-codes-info {
          flex: 1;
        }

        .backup-codes-header {
          display: flex;
          gap: 1rem;
          align-items: flex-start;
        }

        .backup-icon {
          font-size: 2rem;
          line-height: 1;
        }

        .backup-codes-header h4 {
          margin: 0 0 0.25rem 0;
          color: #2c3e50;
          font-size: 1.1rem;
        }

        .backup-codes-header p {
          margin: 0;
          color: #7f8c8d;
          font-size: 0.9rem;
        }

        .backup-warning {
          margin-top: 0.75rem;
          padding: 0.5rem 0.75rem;
          background: #fff3cd;
          border-left: 3px solid #ffc107;
          color: #856404;
          font-size: 0.85rem;
          border-radius: 4px;
        }

        .btn-backup-codes {
          padding: 0.75rem 1.5rem;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
          font-size: 0.95rem;
          transition: all 0.2s;
          white-space: nowrap;
        }

        .btn-backup-codes:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
        }

        /* Recovery Console Card Styles */
        .recovery-console-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.5rem;
          background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
          border: 2px solid #66bb6a;
          border-radius: 12px;
          gap: 1.5rem;
          margin-top: 1rem;
        }

        .recovery-console-info {
          flex: 1;
        }

        .recovery-console-header {
          display: flex;
          gap: 1rem;
          align-items: flex-start;
        }

        .recovery-icon {
          font-size: 2rem;
          line-height: 1;
        }

        .recovery-console-header h4 {
          margin: 0 0 0.25rem 0;
          color: #2c3e50;
          font-size: 1.1rem;
        }

        .recovery-console-header p {
          margin: 0;
          color: #5a6c7d;
          font-size: 0.9rem;
        }

        .btn-recovery-console {
          padding: 0.75rem 1.5rem;
          background: linear-gradient(135deg, #66bb6a 0%, #43a047 100%);
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
          font-size: 0.95rem;
          transition: all 0.2s;
          white-space: nowrap;
        }

        .btn-recovery-console:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 187, 106, 0.3);
        }

        .setting-item {
          padding: 0.75rem;
          border-radius: 8px;
          background: #f8f9fa;
        }

        .setting-item label {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          cursor: pointer;
        }

        .setting-item input[type="checkbox"] {
          width: 18px;
          height: 18px;
          cursor: pointer;
        }

        .setting-item select,
        .setting-item input[type="number"] {
          padding: 0.5rem;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          margin-left: 0.5rem;
        }

        .setting-detail {
          margin-top: 0.75rem;
          padding-left: 2rem;
        }

        .settings-note {
          margin-top: 1.5rem;
          padding: 1rem;
          background: #fffbeb;
          border-left: 4px solid #f59e0b;
          color: #92400e;
          font-size: 0.875rem;
          border-radius: 4px;
        }

        /* Upgrade Banner Styles */
        .upgrade-banner {
          display: flex;
          gap: 1.5rem;
          align-items: flex-start;
          padding: 1.5rem;
          margin-bottom: 2rem;
          background: linear-gradient(135deg, #fff9e6 0%, #fff5cc 100%);
          border: 2px solid #ffcb05;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(255, 203, 5, 0.15);
        }

        .banner-icon-large {
          font-size: 3rem;
          line-height: 1;
          flex-shrink: 0;
        }

        .banner-content {
          flex: 1;
        }

        .banner-content h4 {
          margin: 0 0 0.5rem 0;
          color: #2c3e50;
          font-size: 1.1rem;
        }

        .banner-content p {
          margin: 0 0 0.75rem 0;
          color: #5a6c7d;
          font-size: 0.9rem;
          line-height: 1.5;
        }

        .banner-note {
          font-size: 0.85rem !important;
          font-style: italic;
          color: #7f8c8d !important;
        }

        .btn-upgrade-banner {
          margin-top: 1rem;
          padding: 0.75rem 1.5rem;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
          font-size: 0.95rem;
          transition: all 0.2s;
        }

        .btn-upgrade-banner:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
        }

        /* Security Status Badge Styles */
        .security-status {
          margin-bottom: 0.5rem;
        }

        .status-badge {
          display: inline-block;
          padding: 0.25rem 0.75rem;
          border-radius: 12px;
          font-size: 0.75rem;
          font-weight: 600;
          letter-spacing: 0.3px;
        }

        .status-badge.basic {
          background: #fff3cd;
          color: #856404;
          border: 1px solid #ffc107;
        }

        .status-badge.secure {
          background: #d1fae5;
          color: #065f46;
          border: 1px solid #10b981;
        }
      `}</style>
    </div>
  );
}
