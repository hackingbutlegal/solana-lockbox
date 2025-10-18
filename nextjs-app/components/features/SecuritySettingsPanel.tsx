'use client';

import React, { useState } from 'react';
import { BackupCodesModal } from '../modals/BackupCodesModal';
import { getBackupCodesStats, hasBackupCodes } from '../../lib/backup-codes-manager';

/**
 * Security Settings Panel
 *
 * Extracted from SettingsModal for use in /settings page
 * Includes:
 * - Recovery backup codes
 * - Security settings (auto-lock, clipboard, password warnings)
 */

export function SecuritySettingsPanel() {
  const [showBackupCodesModal, setShowBackupCodesModal] = useState(false);
  const backupCodesStats = hasBackupCodes() ? getBackupCodesStats() : null;

  return (
    <div className="security-settings-panel">
      <h3>Recovery & Backup</h3>
      <div className="settings-section">
        <div className="backup-codes-card">
          <div className="backup-codes-info">
            <div className="backup-codes-header">
              <span className="backup-icon">🔐</span>
              <div>
                <h4>Recovery Backup Codes</h4>
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
      </div>

      <h3>Security Settings</h3>
      <div className="settings-section">
        <div className="setting-item">
          <label>
            <input type="checkbox" defaultChecked />
            <span>Require master password confirmation for sensitive operations</span>
          </label>
        </div>
        <div className="setting-item">
          <label>
            <input type="checkbox" defaultChecked />
            <span>Auto-lock after inactivity</span>
          </label>
          <div className="setting-detail">
            <label>
              Timeout (minutes):
              <input type="number" defaultValue="15" min="1" max="120" />
            </label>
          </div>
        </div>
        <div className="setting-item">
          <label>
            <input type="checkbox" defaultChecked />
            <span>Enable clipboard auto-clear (30 seconds)</span>
          </label>
        </div>
        <div className="setting-item">
          <label>
            <input type="checkbox" defaultChecked />
            <span>Show password strength warnings</span>
          </label>
        </div>
        <div className="setting-item">
          <label>
            <input type="checkbox" defaultChecked />
            <span>Warn when reusing passwords</span>
          </label>
        </div>
      </div>
      <p className="settings-note">
        Note: These settings are stored locally and will not sync across devices.
      </p>

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
      `}</style>
    </div>
  );
}
