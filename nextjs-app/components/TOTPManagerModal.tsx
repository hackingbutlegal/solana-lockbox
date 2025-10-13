'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { TOTPManager, BackupCodesGenerator } from '../lib/totp';
import { useToast } from './Toast';
import { useConfirm } from './ConfirmDialog';

export interface TOTPEntry {
  id: number;
  title: string;
  secret: string;
  issuer?: string;
  accountName?: string;
}

interface TOTPManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: TOTPEntry[];
}

interface TOTPCode {
  entryId: number;
  code: string;
  timeRemaining: number;
}

export function TOTPManagerModal({ isOpen, onClose, entries }: TOTPManagerModalProps) {
  const toast = useToast();
  const confirm = useConfirm();
  const [totpCodes, setTotpCodes] = useState<TOTPCode[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<TOTPEntry | null>(null);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showQRCode, setShowQRCode] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Generate TOTP codes and update every second
  useEffect(() => {
    if (!isOpen) return;

    const updateCodes = async () => {
      const now = Math.floor(Date.now() / 1000);
      const timeRemaining = 30 - (now % 30);

      const codes: TOTPCode[] = [];
      for (const entry of entries) {
        if (entry.secret) {
          try {
            const code = await TOTPManager.generate(entry.secret, 30);
            codes.push({
              entryId: entry.id,
              code,
              timeRemaining,
            });
          } catch (error) {
            console.error(`Failed to generate TOTP for ${entry.title}:`, error);
          }
        }
      }
      setTotpCodes(codes);
    };

    updateCodes();
    const interval = setInterval(updateCodes, 1000);

    return () => clearInterval(interval);
  }, [isOpen, entries]);

  const copyToClipboard = async (code: string, entryId: number) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(entryId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      toast.showError('Failed to copy code');
    }
  };

  const handleGenerateBackupCodes = () => {
    const codes = BackupCodesGenerator.generate(10, 8);
    setBackupCodes(codes);
    setShowBackupCodes(true);
  };

  const handleShowQRCode = (entry: TOTPEntry) => {
    setSelectedEntry(entry);
    setShowQRCode(true);
  };

  const copyAllBackupCodes = async () => {
    try {
      await navigator.clipboard.writeText(backupCodes.join('\n'));
      toast.showSuccess('All backup codes copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy:', error);
      toast.showError('Failed to copy backup codes');
    }
  };

  const qrCodeURI = useMemo(() => {
    if (!selectedEntry) return null;
    return TOTPManager.generateQRCodeURI(
      selectedEntry.secret,
      selectedEntry.accountName || selectedEntry.title,
      selectedEntry.issuer || 'Lockbox'
    );
  }, [selectedEntry]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content totp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>2FA / TOTP Manager</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          {/* No TOTP Entries */}
          {entries.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">🔐</div>
              <h3>No 2FA Entries</h3>
              <p>Add TOTP secrets to your password entries to enable 2FA code generation.</p>
            </div>
          )}

          {/* TOTP Code List */}
          {entries.length > 0 && !showBackupCodes && !showQRCode && (
            <div className="totp-list">
              {entries.map((entry) => {
                const totpData = totpCodes.find((tc) => tc.entryId === entry.id);
                return (
                  <div key={entry.id} className="totp-card">
                    <div className="totp-header">
                      <div className="totp-title">
                        <h3>{entry.title}</h3>
                        {entry.accountName && (
                          <span className="totp-account">{entry.accountName}</span>
                        )}
                      </div>
                      <button
                        className="btn-icon"
                        onClick={() => handleShowQRCode(entry)}
                        title="Show QR Code"
                      >
                        📱
                      </button>
                    </div>

                    {totpData ? (
                      <>
                        <div className="totp-code-display">
                          <div className="totp-code">
                            {totpData.code.slice(0, 3)} {totpData.code.slice(3, 6)}
                          </div>
                          <button
                            className={`btn-copy ${copiedId === entry.id ? 'copied' : ''}`}
                            onClick={() => copyToClipboard(totpData.code, entry.id)}
                          >
                            {copiedId === entry.id ? '✓' : '📋'}
                          </button>
                        </div>

                        <div className="totp-timer">
                          <div className="timer-bar-container">
                            <div
                              className={`timer-bar ${totpData.timeRemaining <= 5 ? 'expiring' : ''}`}
                              style={{ width: `${(totpData.timeRemaining / 30) * 100}%` }}
                            />
                          </div>
                          <span className="timer-text">{totpData.timeRemaining}s</span>
                        </div>
                      </>
                    ) : (
                      <div className="totp-error">
                        <span>⚠️ Invalid secret</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Backup Codes View */}
          {showBackupCodes && (
            <div className="backup-codes-view">
              <div className="backup-header">
                <h3>Backup Codes</h3>
                <p className="backup-description">
                  Save these codes in a secure location. Each code can only be used once.
                </p>
              </div>

              <div className="backup-codes-grid">
                {backupCodes.map((code, index) => (
                  <div key={index} className="backup-code">
                    <span className="code-number">{index + 1}.</span>
                    <span className="code-value">{code}</span>
                  </div>
                ))}
              </div>

              <div className="backup-actions">
                <button onClick={copyAllBackupCodes} className="btn-secondary">
                  📋 Copy All
                </button>
                <button onClick={() => setShowBackupCodes(false)} className="btn-primary">
                  Done
                </button>
              </div>

              <div className="backup-warning">
                ⚠️ <strong>Important:</strong> Store these codes offline. Anyone with access to
                these codes can bypass your 2FA.
              </div>
            </div>
          )}

          {/* QR Code View */}
          {showQRCode && selectedEntry && qrCodeURI && (
            <div className="qr-code-view">
              <div className="qr-header">
                <h3>Setup Authenticator App</h3>
                <p>Scan this QR code with Google Authenticator, Authy, or similar apps</p>
              </div>

              <div className="qr-code-container">
                <div className="qr-code-placeholder">
                  <div className="qr-icon">📱</div>
                  <p className="qr-instruction">
                    QR Code Generation
                    <br />
                    <small>
                      Use a QR code library or manually enter the secret in your authenticator app
                    </small>
                  </p>
                </div>
              </div>

              <div className="manual-entry">
                <h4>Manual Entry</h4>
                <div className="secret-display">
                  <code>{selectedEntry.secret}</code>
                  <button
                    className="btn-copy-inline"
                    onClick={() => copyToClipboard(selectedEntry.secret, -1)}
                  >
                    📋
                  </button>
                </div>
                <p className="entry-hint">
                  <strong>Account:</strong> {selectedEntry.accountName || selectedEntry.title}
                  <br />
                  <strong>Type:</strong> Time-based (30s)
                </p>
              </div>

              <div className="qr-actions">
                <button onClick={() => setShowQRCode(false)} className="btn-primary">
                  Done
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          {!showBackupCodes && !showQRCode && (
            <>
              <button onClick={handleGenerateBackupCodes} className="btn-secondary">
                🔑 Generate Backup Codes
              </button>
              <button onClick={onClose} className="btn-primary">
                Close
              </button>
            </>
          )}
          {(showBackupCodes || showQRCode) && (
            <button
              onClick={() => {
                setShowBackupCodes(false);
                setShowQRCode(false);
                setSelectedEntry(null);
              }}
              className="btn-secondary"
            >
              ← Back to Codes
            </button>
          )}
        </div>

        <style jsx>{`
          .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            padding: 1rem;
          }

          .modal-content {
            background: white;
            border-radius: 16px;
            width: 100%;
            max-width: 700px;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          }

          .totp-modal {
            max-width: 600px;
          }

          .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1.5rem;
            border-bottom: 1px solid #e1e8ed;
          }

          .modal-header h2 {
            margin: 0;
            color: #2c3e50;
            font-size: 1.5rem;
          }

          .modal-close {
            background: none;
            border: none;
            font-size: 2rem;
            color: #7f8c8d;
            cursor: pointer;
            line-height: 1;
            padding: 0;
            width: 32px;
            height: 32px;
          }

          .modal-body {
            padding: 1.5rem;
            min-height: 200px;
          }

          .empty-state {
            text-align: center;
            padding: 3rem 1rem;
          }

          .empty-icon {
            font-size: 4rem;
            margin-bottom: 1rem;
          }

          .empty-state h3 {
            color: #2c3e50;
            margin: 0 0 0.5rem 0;
          }

          .empty-state p {
            color: #7f8c8d;
            margin: 0;
          }

          .totp-list {
            display: flex;
            flex-direction: column;
            gap: 1rem;
          }

          .totp-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 12px;
            padding: 1.5rem;
            color: white;
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
          }

          .totp-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 1rem;
          }

          .totp-title h3 {
            margin: 0 0 0.25rem 0;
            font-size: 1.2rem;
            font-weight: 600;
          }

          .totp-account {
            font-size: 0.9rem;
            opacity: 0.9;
          }

          .btn-icon {
            background: rgba(255, 255, 255, 0.2);
            border: none;
            border-radius: 8px;
            width: 36px;
            height: 36px;
            cursor: pointer;
            font-size: 1.2rem;
            transition: all 0.2s;
          }

          .btn-icon:hover {
            background: rgba(255, 255, 255, 0.3);
            transform: scale(1.05);
          }

          .totp-code-display {
            display: flex;
            align-items: center;
            gap: 1rem;
            margin-bottom: 1rem;
          }

          .totp-code {
            font-family: 'Courier New', monospace;
            font-size: 2.5rem;
            font-weight: 700;
            letter-spacing: 0.2rem;
            flex: 1;
          }

          .btn-copy {
            background: rgba(255, 255, 255, 0.2);
            border: none;
            border-radius: 8px;
            width: 48px;
            height: 48px;
            cursor: pointer;
            font-size: 1.5rem;
            transition: all 0.2s;
          }

          .btn-copy:hover {
            background: rgba(255, 255, 255, 0.3);
          }

          .btn-copy.copied {
            background: rgba(46, 213, 115, 0.3);
          }

          .totp-timer {
            display: flex;
            align-items: center;
            gap: 0.75rem;
          }

          .timer-bar-container {
            flex: 1;
            height: 6px;
            background: rgba(255, 255, 255, 0.3);
            border-radius: 3px;
            overflow: hidden;
          }

          .timer-bar {
            height: 100%;
            background: white;
            transition: width 1s linear;
            border-radius: 3px;
          }

          .timer-bar.expiring {
            background: #f39c12;
          }

          .timer-text {
            font-weight: 600;
            font-size: 0.9rem;
            min-width: 30px;
          }

          .totp-error {
            padding: 1rem;
            background: rgba(231, 76, 60, 0.2);
            border-radius: 8px;
            text-align: center;
          }

          .backup-codes-view {
            padding: 1rem 0;
          }

          .backup-header {
            margin-bottom: 1.5rem;
          }

          .backup-header h3 {
            margin: 0 0 0.5rem 0;
            color: #2c3e50;
          }

          .backup-description {
            color: #7f8c8d;
            margin: 0;
            font-size: 0.9rem;
          }

          .backup-codes-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 0.75rem;
            margin-bottom: 1.5rem;
          }

          .backup-code {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            background: #f8f9fa;
            padding: 0.75rem;
            border-radius: 8px;
            font-family: 'Courier New', monospace;
          }

          .code-number {
            color: #7f8c8d;
            font-size: 0.85rem;
            min-width: 25px;
          }

          .code-value {
            font-weight: 600;
            color: #2c3e50;
            letter-spacing: 0.05rem;
          }

          .backup-actions {
            display: flex;
            gap: 0.75rem;
            margin-bottom: 1rem;
          }

          .backup-warning {
            background: #fff3cd;
            border: 1px solid #ffc107;
            border-radius: 8px;
            padding: 1rem;
            color: #856404;
            font-size: 0.9rem;
          }

          .qr-code-view {
            padding: 1rem 0;
          }

          .qr-header {
            margin-bottom: 1.5rem;
            text-align: center;
          }

          .qr-header h3 {
            margin: 0 0 0.5rem 0;
            color: #2c3e50;
          }

          .qr-header p {
            color: #7f8c8d;
            margin: 0;
            font-size: 0.9rem;
          }

          .qr-code-container {
            display: flex;
            justify-content: center;
            margin-bottom: 1.5rem;
          }

          .qr-code-placeholder {
            width: 256px;
            height: 256px;
            border: 2px dashed #e1e8ed;
            border-radius: 12px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: #f8f9fa;
            padding: 1rem;
            text-align: center;
          }

          .qr-icon {
            font-size: 4rem;
            margin-bottom: 0.5rem;
          }

          .qr-instruction {
            color: #7f8c8d;
            margin: 0;
            font-size: 0.9rem;
          }

          .qr-instruction small {
            font-size: 0.85rem;
            color: #95a5a6;
          }

          .manual-entry {
            background: #f8f9fa;
            border-radius: 12px;
            padding: 1.5rem;
            margin-bottom: 1rem;
          }

          .manual-entry h4 {
            margin: 0 0 1rem 0;
            color: #2c3e50;
          }

          .secret-display {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            background: white;
            padding: 1rem;
            border-radius: 8px;
            margin-bottom: 1rem;
          }

          .secret-display code {
            flex: 1;
            font-family: 'Courier New', monospace;
            font-size: 1rem;
            color: #2c3e50;
            word-break: break-all;
          }

          .btn-copy-inline {
            background: #667eea;
            border: none;
            border-radius: 6px;
            width: 36px;
            height: 36px;
            cursor: pointer;
            font-size: 1rem;
            transition: all 0.2s;
          }

          .btn-copy-inline:hover {
            background: #5568d3;
            transform: scale(1.05);
          }

          .entry-hint {
            color: #7f8c8d;
            font-size: 0.9rem;
            margin: 0;
            line-height: 1.6;
          }

          .qr-actions {
            display: flex;
            justify-content: center;
          }

          .modal-footer {
            display: flex;
            gap: 0.75rem;
            padding: 1.5rem;
            border-top: 1px solid #e1e8ed;
          }

          .btn-secondary,
          .btn-primary {
            flex: 1;
            padding: 0.875rem;
            border: none;
            border-radius: 8px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
          }

          .btn-secondary {
            background: #f8f9fa;
            color: #2c3e50;
          }

          .btn-secondary:hover {
            background: #e1e8ed;
          }

          .btn-primary {
            background: #667eea;
            color: white;
          }

          .btn-primary:hover {
            background: #5568d3;
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
          }

          @media (max-width: 768px) {
            .modal-content {
              max-width: 100%;
              margin: 0.5rem;
            }

            .totp-code {
              font-size: 2rem;
            }

            .backup-codes-grid {
              grid-template-columns: 1fr;
            }

            .qr-code-placeholder {
              width: 220px;
              height: 220px;
            }
          }
        `}</style>
      </div>
    </div>
  );
}
