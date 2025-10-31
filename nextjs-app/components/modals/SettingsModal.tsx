'use client';

import React, { useState } from 'react';
import { PasswordEntry } from '../../sdk/src/types-v2';
import { ImportExportPanel } from '../features/ImportExportPanel';
import { PreferencesPanel } from '../features/PreferencesPanel';
import { BackupCodesModal } from './BackupCodesModal';
import { getBackupCodesStats, hasBackupCodes } from '../../lib/backup-codes-manager';

/**
 * SettingsModal Component
 *
 * Comprehensive settings interface with tabbed sections:
 * - Import/Export - Bulk password import and export
 * - Security - Password policies and session settings
 * - Preferences - UI customization and display options
 * - About - Version info and help resources
 *
 * Usage:
 * ```tsx
 * <SettingsModal
 *   isOpen={showSettings}
 *   onClose={() => setShowSettings(false)}
 *   entries={entries}
 *   onImport={handleBulkImport}
 * />
 * ```
 */

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: PasswordEntry[];
  onImport: (entries: PasswordEntry[]) => Promise<void>;
}

type SettingsTab = 'import-export' | 'security' | 'preferences' | 'about';

export function SettingsModal({
  isOpen,
  onClose,
  entries,
  onImport,
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('import-export');
  const [showBackupCodesModal, setShowBackupCodesModal] = useState(false);
  const backupCodesStats = hasBackupCodes() ? getBackupCodesStats() : null;

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Settings</h2>
          <button
            onClick={onClose}
            className="btn-close"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="modal-body">
          {/* Tab Navigation */}
          <div className="tabs-nav">
            <button
              className={`tab-btn ${activeTab === 'import-export' ? 'active' : ''}`}
              onClick={() => setActiveTab('import-export')}
            >
              <span className="tab-icon">📦</span>
              Import/Export
            </button>
            <button
              className={`tab-btn ${activeTab === 'security' ? 'active' : ''}`}
              onClick={() => setActiveTab('security')}
            >
              <span className="tab-icon">🔐</span>
              Security
            </button>
            <button
              className={`tab-btn ${activeTab === 'preferences' ? 'active' : ''}`}
              onClick={() => setActiveTab('preferences')}
            >
              <span className="tab-icon">⚙️</span>
              Preferences
            </button>
            <button
              className={`tab-btn ${activeTab === 'about' ? 'active' : ''}`}
              onClick={() => setActiveTab('about')}
            >
              <span className="tab-icon">ℹ️</span>
              About
            </button>
          </div>

          {/* Tab Content */}
          <div className="tab-content">
            {activeTab === 'import-export' && (
              <div className="tab-panel">
                <ImportExportPanel
                  entries={entries}
                  onImport={onImport}
                />
              </div>
            )}

            {activeTab === 'security' && (
              <div className="tab-panel">
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

                {/* Security Settings - Coming Soon
                <h3>Security Settings</h3>
                <p className="settings-note">
                  Advanced security settings (auto-lock, clipboard auto-clear, password policies) are planned for a future release.
                </p>
                */}
              </div>
            )}

            {activeTab === 'preferences' && (
              <div className="tab-panel">
                <PreferencesPanel />
              </div>
            )}

            {activeTab === 'about' && (
              <div className="tab-panel">
                <h3>About Solana Lockbox</h3>
                <div className="about-section">
                  <div className="about-item">
                    <strong>Version:</strong> v2.3.2
                  </div>
                  <div className="about-item">
                    <strong>Build Date:</strong> October 30, 2025
                  </div>
                  <div className="about-item">
                    <strong>Network:</strong> Solana Devnet
                  </div>
                  <div className="about-item">
                    <strong>Program ID:</strong>{' '}
                    <code className="program-id">7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB</code>
                  </div>
                </div>

                <div className="about-description">
                  <p>
                    Solana Lockbox is an open-source password manager with blockchain storage, built on Solana by Web3 Studios LLC.
                    Your passwords are encrypted client-side and stored securely on-chain, accessible only with your wallet.
                  </p>
                  <p>
                    <strong>Key Features:</strong>
                  </p>
                  <ul>
                    <li>Client-side encryption (XChaCha20-Poly1305)</li>
                    <li>Blockchain-based storage on Solana</li>
                    <li>Multi-device sync via wallet</li>
                    <li>Password health monitoring</li>
                    <li>Cryptographic password generator</li>
                    <li>Import/Export (LastPass, 1Password, Bitwarden)</li>
                    <li>Progressive Web App (offline support)</li>
                    <li>Recovery backup codes (two-factor)</li>
                  </ul>
                </div>

                <div className="about-links">
                  <a href="https://github.com/hackingbutlegal/solana-lockbox" target="_blank" rel="noopener noreferrer">
                    📚 Documentation
                  </a>
                  <a href="https://github.com/hackingbutlegal/solana-lockbox/issues" target="_blank" rel="noopener noreferrer">
                    🐛 Report Issue
                  </a>
                  <a href="https://github.com/hackingbutlegal/solana-lockbox" target="_blank" rel="noopener noreferrer">
                    💻 Source Code
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn-primary">
            Close
          </button>
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
          max-width: 900px;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
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
          flex: 1;
          overflow: auto;
          display: flex;
          flex-direction: column;
        }

        .tabs-nav {
          display: flex;
          border-bottom: 2px solid #e1e8ed;
          padding: 0 1.5rem;
          gap: 0.5rem;
          background: #f8f9fa;
        }

        .tab-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1.25rem;
          border: none;
          background: transparent;
          color: #7f8c8d;
          font-size: 0.9rem;
          font-weight: 500;
          cursor: pointer;
          border-bottom: 3px solid transparent;
          transition: all 0.2s;
          position: relative;
          top: 2px;
        }

        .tab-btn:hover {
          color: #2c3e50;
          background: rgba(102, 126, 234, 0.05);
        }

        .tab-btn.active {
          color: #667eea;
          border-bottom-color: #667eea;
          background: white;
        }

        .tab-icon {
          font-size: 1.1rem;
        }

        .tab-content {
          flex: 1;
          overflow: auto;
        }

        .tab-panel {
          padding: 2rem 1.5rem;
        }

        .tab-panel h3 {
          margin: 0 0 1.5rem 0;
          color: #2c3e50;
          font-size: 1.25rem;
        }

        .settings-section {
          display: flex;
          flex-direction: column;
          gap: 1rem;
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

        .about-section {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          margin-bottom: 2rem;
        }

        .about-item {
          display: flex;
          gap: 0.5rem;
          padding: 0.5rem 0;
          border-bottom: 1px solid #e1e8ed;
        }

        .about-item strong {
          min-width: 120px;
          color: #2c3e50;
        }

        .program-id {
          background: #f8f9fa;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-family: 'Courier New', monospace;
          font-size: 0.85rem;
          color: #667eea;
        }

        .about-description {
          line-height: 1.6;
          color: #4a5568;
        }

        .about-description p {
          margin: 0 0 1rem 0;
        }

        .about-description ul {
          margin: 0;
          padding-left: 1.5rem;
        }

        .about-description li {
          margin-bottom: 0.5rem;
        }

        .about-links {
          display: flex;
          gap: 1rem;
          margin-top: 2rem;
          padding-top: 2rem;
          border-top: 2px solid #e1e8ed;
        }

        .about-links a {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1.25rem;
          background: #f8f9fa;
          border-radius: 8px;
          color: #2c3e50;
          text-decoration: none;
          font-weight: 500;
          transition: all 0.2s;
        }

        .about-links a:hover {
          background: #e1e8ed;
          transform: translateY(-2px);
        }

        .modal-footer {
          padding: 1rem 1.5rem;
          border-top: 1px solid #e1e8ed;
          display: flex;
          justify-content: flex-end;
        }

        .btn-primary {
          padding: 0.75rem 2rem;
          border: none;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          transition: all 0.2s;
        }

        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }

        @media (max-width: 768px) {
          .modal-container {
            width: 95%;
            max-height: 95vh;
          }

          .tabs-nav {
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
          }

          .tab-btn {
            padding: 0.75rem 1rem;
            font-size: 0.85rem;
            white-space: nowrap;
          }

          .tab-icon {
            font-size: 1rem;
          }

          .tab-panel {
            padding: 1.5rem 1rem;
          }

          .about-links {
            flex-direction: column;
          }
        }
      `}</style>

      {/* Backup Codes Modal */}
      <BackupCodesModal
        isOpen={showBackupCodesModal}
        onClose={() => setShowBackupCodesModal(false)}
        isFirstTime={!hasBackupCodes()}
      />
    </div>
  );
}
