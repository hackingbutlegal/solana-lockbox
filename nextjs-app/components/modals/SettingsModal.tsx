'use client';

import React, { useState } from 'react';
import { PasswordEntry } from '../../sdk/src/types-v2';
import { ImportExportPanel } from '../features/ImportExportPanel';

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
                  onExport={(exportedData, format) => {
                    console.log(`Exported ${entries.length} entries as ${format}`);
                  }}
                  supportedFormats={['json', 'csv', 'lastpass', '1password', 'bitwarden']}
                />
              </div>
            )}

            {activeTab === 'security' && (
              <div className="tab-panel">
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
                      <input type="checkbox" />
                      <span>Enable clipboard auto-clear (30 seconds)</span>
                    </label>
                  </div>
                  <div className="setting-item">
                    <label>
                      <input type="checkbox" defaultChecked />
                      <span>Show password strength warnings</span>
                    </label>
                  </div>
                </div>
                <p className="settings-note">
                  Note: These settings are stored locally and will not sync across devices.
                </p>
              </div>
            )}

            {activeTab === 'preferences' && (
              <div className="tab-panel">
                <h3>Display Preferences</h3>
                <div className="settings-section">
                  <div className="setting-item">
                    <label>
                      Default view mode:
                      <select defaultValue="list">
                        <option value="list">List</option>
                        <option value="grid">Grid</option>
                        <option value="virtual">Virtual (for large vaults)</option>
                      </select>
                    </label>
                  </div>
                  <div className="setting-item">
                    <label>
                      Theme:
                      <select defaultValue="system">
                        <option value="light">Light</option>
                        <option value="dark">Dark</option>
                        <option value="system">System</option>
                      </select>
                    </label>
                  </div>
                  <div className="setting-item">
                    <label>
                      <input type="checkbox" defaultChecked />
                      <span>Show entry previews in list view</span>
                    </label>
                  </div>
                  <div className="setting-item">
                    <label>
                      <input type="checkbox" defaultChecked />
                      <span>Compact mode (higher density)</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'about' && (
              <div className="tab-panel">
                <h3>About Solana Lockbox</h3>
                <div className="about-section">
                  <div className="about-item">
                    <strong>Version:</strong> v2.2.1
                  </div>
                  <div className="about-item">
                    <strong>Build Date:</strong> October 15, 2025
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
                    Solana Lockbox is a decentralized password manager built on the Solana blockchain.
                    Your passwords are encrypted client-side and stored securely on-chain, giving you
                    complete control over your data.
                  </p>
                  <p>
                    <strong>Key Features:</strong>
                  </p>
                  <ul>
                    <li>End-to-end encryption</li>
                    <li>Blockchain-based storage</li>
                    <li>Multi-device sync</li>
                    <li>Password health monitoring</li>
                    <li>Batch operations support</li>
                    <li>Import from popular password managers</li>
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
    </div>
  );
}
