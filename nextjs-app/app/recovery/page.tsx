'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PublicKey } from '@solana/web3.js';
import {
  validateBackupCode,
  markBackupCodeUsed,
  loadBackupCodes,
  needsSecurityMigration
} from '../../lib/backup-codes-manager';
import { decryptRecoveryKey } from '../../lib/recovery-key-manager';
import { RecoveryClient } from '../../lib/recovery-client';
import { PasswordEntry } from '../../sdk/src/types-v2';

/**
 * Recovery Console Page
 *
 * Allows users to access their passwords using backup codes + recovery password.
 * Provides read-only access without requiring wallet connection.
 *
 * Security Model:
 * - Backup code validates user identity
 * - Recovery password decrypts the recovery key
 * - Recovery key can decrypt passwords (read-only)
 * - No wallet access = no ability to modify data
 */

type RecoveryStep = 'auth' | 'console';

export default function RecoveryPage() {
  const router = useRouter();
  const [step, setStep] = useState<RecoveryStep>('auth');
  const [backupCode, setBackupCode] = useState('');
  const [recoveryPassword, setRecoveryPassword] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Recovery console state
  const [recoveryKey, setRecoveryKey] = useState<Uint8Array | null>(null);
  const [isOldBackupCode, setIsOldBackupCode] = useState(false);
  const [passwords, setPasswords] = useState<PasswordEntry[]>([]);
  const [fetchError, setFetchError] = useState<string>('');
  const [fetchLoading, setFetchLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleAuthenticate = async () => {
    setError('');
    setLoading(true);

    try {
      // 1. Validate wallet address
      if (!walletAddress.trim()) {
        setError('Wallet address is required.');
        setLoading(false);
        return;
      }

      try {
        new PublicKey(walletAddress);
      } catch {
        setError('Invalid wallet address format.');
        setLoading(false);
        return;
      }

      // 2. Check if backup codes exist
      const backupCodesData = loadBackupCodes();
      if (!backupCodesData) {
        setError('No backup codes found. Please generate backup codes first.');
        setLoading(false);
        return;
      }

      // 3. Validate backup code
      const codeValid = validateBackupCode(backupCode);
      if (!codeValid) {
        setError('Invalid backup code or code has already been used.');
        setLoading(false);
        return;
      }

      // 4. Check if this is an old backup code (no recovery password)
      const needsMigration = needsSecurityMigration();
      const hasRecoveryPassword = backupCodesData.hasRecoveryPassword;

      if (needsMigration || !hasRecoveryPassword) {
        setError('Old backup codes without recovery passwords are not supported in recovery mode. Please upgrade your backup codes to use the recovery console.');
        setLoading(false);
        return;
      }

      // 5. For new backup codes, require recovery password
      if (!recoveryPassword) {
        setError('Recovery password is required for two-factor authentication.');
        setLoading(false);
        return;
      }

      // 6. Decrypt recovery key with password
      const key = await decryptRecoveryKey(recoveryPassword);
      if (!key) {
        setError('Invalid recovery password. Please try again.');
        setLoading(false);
        return;
      }

      // 7. Mark backup code as used
      markBackupCodeUsed(backupCode);

      // 8. Enter recovery console
      setRecoveryKey(key);
      setIsOldBackupCode(false);
      setStep('console');

      // 9. Automatically fetch passwords
      await fetchPasswords(key, walletAddress);
    } catch (err) {
      console.error('Recovery authentication error:', err);
      setError('Authentication failed. Please check your credentials and try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchPasswords = async (key: Uint8Array, wallet: string) => {
    setFetchLoading(true);
    setFetchError('');

    try {
      const publicKey = new PublicKey(wallet);
      const client = new RecoveryClient(publicKey);
      client.setRecoveryKey(key);

      const { entries, errors } = await client.listPasswords();

      setPasswords(entries);

      if (entries.length === 0 && errors.length === 0) {
        setFetchError('Your vault exists but contains no passwords. Nothing to recover.');
      } else if (errors.length > 0) {
        setFetchError(`Successfully decrypted ${entries.length} passwords, but ${errors.length} entries had errors.`);
      }
    } catch (err) {
      console.error('Failed to fetch passwords:', err);

      // Handle specific error cases
      if (err instanceof Error) {
        if (err.message.includes('buffer length') || err.message.includes('RangeError')) {
          setFetchError('Your vault exists but contains no passwords. Nothing to recover.');
        } else if (err.message.includes('not found') || err.message.includes('not been initialized')) {
          setFetchError('No vault found for this wallet address. Please check the address and try again.');
        } else {
          setFetchError(err.message);
        }
      } else {
        setFetchError('Failed to fetch passwords from blockchain.');
      }
    } finally {
      setFetchLoading(false);
    }
  };

  const handleExportJSON = () => {
    if (!recoveryKey || !walletAddress) return;

    const client = new RecoveryClient(new PublicKey(walletAddress));
    const json = client.exportToJSON(filteredPasswords);
    const filename = `lockbox-recovery-${new Date().toISOString().split('T')[0]}.json`;
    client.downloadFile(json, filename, 'application/json');
  };

  const handleExportCSV = () => {
    if (!recoveryKey || !walletAddress) return;

    const client = new RecoveryClient(new PublicKey(walletAddress));
    const csv = client.exportToCSV(filteredPasswords);
    const filename = `lockbox-recovery-${new Date().toISOString().split('T')[0]}.csv`;
    client.downloadFile(csv, filename, 'text/csv');
  };

  const handleGoBack = () => {
    router.push('/');
  };

  // Filter passwords based on search query
  const filteredPasswords = passwords.filter(entry =>
    entry.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    entry.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    entry.url?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (step === 'auth') {
    return (
      <div className="recovery-page">
        <div className="recovery-container">
          {/* Header */}
          <div className="recovery-header">
            <div className="recovery-icon">🔐</div>
            <h1>Account Recovery</h1>
            <p>Access your passwords using backup codes</p>
          </div>

          {/* Authentication Form */}
          <div className="recovery-card">
            <div className="form-section">
              <label htmlFor="walletAddress">
                Wallet Address
                <span className="required">*</span>
              </label>
              <input
                id="walletAddress"
                type="text"
                placeholder="Enter your wallet public key"
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                disabled={loading}
                autoComplete="off"
                spellCheck={false}
              />
              <p className="field-hint">
                Enter the wallet address that you used to create your vault.
              </p>
            </div>

            <div className="form-section">
              <label htmlFor="backupCode">
                Backup Code
                <span className="required">*</span>
              </label>
              <input
                id="backupCode"
                type="text"
                placeholder="XXXX-XXXX"
                value={backupCode}
                onChange={(e) => setBackupCode(e.target.value)}
                disabled={loading}
                autoComplete="off"
                spellCheck={false}
              />
              <p className="field-hint">
                Enter one of your 10 backup codes. Each code can only be used once.
              </p>
            </div>

            <div className="form-section">
              <label htmlFor="recoveryPassword">
                Recovery Password
                <span className="required">*</span>
              </label>
              <input
                id="recoveryPassword"
                type="password"
                placeholder="Enter your recovery password"
                value={recoveryPassword}
                onChange={(e) => setRecoveryPassword(e.target.value)}
                disabled={loading}
                autoComplete="off"
              />
              <p className="field-hint">
                Enter the recovery password you set when generating backup codes.
              </p>
            </div>

            {error && (
              <div className="error-message">
                <span className="error-icon">⚠️</span>
                {error}
              </div>
            )}

            <div className="form-actions">
              <button
                className="btn-primary"
                onClick={handleAuthenticate}
                disabled={loading || !backupCode.trim() || !recoveryPassword.trim() || !walletAddress.trim()}
              >
                {loading ? 'Authenticating...' : 'Access Recovery Console'}
              </button>
              <button
                className="btn-secondary"
                onClick={handleGoBack}
                disabled={loading}
              >
                Cancel
              </button>
            </div>
          </div>

          {/* Info Section */}
          <div className="recovery-info">
            <h3>What is Account Recovery?</h3>
            <ul>
              <li>
                <strong>Read-Only Access:</strong> View and export your passwords without wallet access
              </li>
              <li>
                <strong>No Modifications:</strong> Cannot add, edit, or delete passwords in recovery mode
              </li>
              <li>
                <strong>Single-Use Codes:</strong> Each backup code can only be used once
              </li>
              <li>
                <strong>Secure Export:</strong> Export your passwords to CSV or JSON for safekeeping
              </li>
            </ul>
          </div>
        </div>

        <style jsx>{`
          .recovery-page {
            min-height: 100vh;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 2rem;
          }

          .recovery-container {
            max-width: 600px;
            width: 100%;
          }

          .recovery-header {
            text-align: center;
            margin-bottom: 2rem;
            color: white;
          }

          .recovery-icon {
            font-size: 4rem;
            margin-bottom: 1rem;
            animation: pulse 2s infinite;
          }

          @keyframes pulse {
            0%, 100% {
              transform: scale(1);
            }
            50% {
              transform: scale(1.05);
            }
          }

          .recovery-header h1 {
            margin: 0 0 0.5rem 0;
            font-size: 2.5rem;
            font-weight: 800;
            text-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
          }

          .recovery-header p {
            margin: 0;
            font-size: 1.1rem;
            opacity: 0.95;
          }

          .recovery-card {
            background: white;
            border-radius: 16px;
            padding: 2.5rem;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            margin-bottom: 1.5rem;
          }

          .form-section {
            margin-bottom: 1.5rem;
          }

          .form-section:last-of-type {
            margin-bottom: 2rem;
          }

          label {
            display: block;
            margin-bottom: 0.5rem;
            font-weight: 600;
            color: #2c3e50;
            font-size: 0.95rem;
          }

          .required {
            color: #e74c3c;
            margin-left: 0.25rem;
          }

          input {
            width: 100%;
            padding: 0.75rem 1rem;
            border: 2px solid #e1e8ed;
            border-radius: 8px;
            font-size: 1rem;
            font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Courier New', monospace;
            transition: all 0.2s;
          }

          input:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
          }

          input:disabled {
            background: #f8f9fa;
            color: #95a5a6;
            cursor: not-allowed;
          }

          .field-hint {
            margin: 0.5rem 0 0 0;
            font-size: 0.85rem;
            color: #7f8c8d;
            line-height: 1.4;
          }

          .error-message {
            display: flex;
            align-items: flex-start;
            gap: 0.5rem;
            padding: 1rem;
            background: #fff5f5;
            border: 2px solid #feb2b2;
            border-radius: 8px;
            color: #c53030;
            font-size: 0.9rem;
            margin-bottom: 1.5rem;
          }

          .error-icon {
            font-size: 1.2rem;
            flex-shrink: 0;
          }

          .form-actions {
            display: flex;
            gap: 1rem;
          }

          .btn-primary,
          .btn-secondary {
            flex: 1;
            padding: 0.875rem 1.5rem;
            border: none;
            border-radius: 8px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
          }

          .btn-primary {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
          }

          .btn-primary:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 10px 25px rgba(102, 126, 234, 0.3);
          }

          .btn-primary:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          .btn-secondary {
            background: #f8f9fa;
            color: #2c3e50;
            border: 2px solid #e1e8ed;
          }

          .btn-secondary:hover:not(:disabled) {
            background: #e9ecef;
            border-color: #ced4da;
          }

          .btn-secondary:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          .recovery-info {
            background: rgba(255, 255, 255, 0.15);
            backdrop-filter: blur(10px);
            border: 2px solid rgba(255, 255, 255, 0.2);
            border-radius: 16px;
            padding: 2rem;
            color: white;
          }

          .recovery-info h3 {
            margin: 0 0 1rem 0;
            font-size: 1.25rem;
            font-weight: 700;
          }

          .recovery-info ul {
            margin: 0;
            padding: 0;
            list-style: none;
          }

          .recovery-info li {
            margin-bottom: 0.75rem;
            padding-left: 1.5rem;
            position: relative;
            line-height: 1.5;
          }

          .recovery-info li::before {
            content: '✓';
            position: absolute;
            left: 0;
            font-weight: bold;
          }

          .recovery-info li:last-child {
            margin-bottom: 0;
          }

          @media (max-width: 768px) {
            .recovery-page {
              padding: 1rem;
            }

            .recovery-header h1 {
              font-size: 2rem;
            }

            .recovery-card {
              padding: 1.5rem;
            }

            .form-actions {
              flex-direction: column;
            }
          }
        `}</style>
      </div>
    );
  }

  // Recovery Console View
  return (
    <div className="console-page">
      <div className="console-container">
        {/* Console Header */}
        <div className="console-header">
          <div className="console-status">
            <span className="status-icon">🔓</span>
            <div>
              <h1>Recovery Console</h1>
              <p className="status-text">✅ Two-Factor Authentication Active</p>
            </div>
          </div>
          <button className="btn-exit" onClick={handleGoBack}>
            Exit Recovery Mode
          </button>
        </div>

        {/* Read-Only Banner */}
        <div className="readonly-banner">
          <span className="banner-icon">👁️</span>
          <div className="banner-content">
            <strong>Read-Only Mode</strong>
            <p>
              You are viewing passwords in recovery mode.
              To modify passwords, connect your wallet on the main dashboard.
            </p>
          </div>
        </div>

        {/* Password List Section */}
        <div className="passwords-section">
          <div className="passwords-header">
            <h2>Your Passwords ({passwords.length})</h2>
            <div className="passwords-actions">
              <button className="btn-export" onClick={handleExportJSON} disabled={passwords.length === 0}>
                📄 Export JSON
              </button>
              <button className="btn-export" onClick={handleExportCSV} disabled={passwords.length === 0}>
                📊 Export CSV
              </button>
            </div>
          </div>

          {/* Search Bar */}
          {passwords.length > 0 && (
            <div className="search-bar">
              <input
                type="text"
                placeholder="🔍 Search passwords..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          )}

          {/* Loading State */}
          {fetchLoading && (
            <div className="loading-box">
              <div className="spinner"></div>
              <p>Fetching passwords from blockchain...</p>
            </div>
          )}

          {/* Error State */}
          {fetchError && !fetchLoading && (
            <div className="error-box">
              <span className="error-icon-large">⚠️</span>
              <p>{fetchError}</p>
            </div>
          )}

          {/* Empty State */}
          {!fetchLoading && !fetchError && passwords.length === 0 && (
            <div className="empty-box">
              <span className="empty-icon">📭</span>
              <h3>No Passwords Found</h3>
              <p>No password entries were found for this wallet address.</p>
            </div>
          )}

          {/* Password List */}
          {!fetchLoading && passwords.length > 0 && (
            <div className="password-list">
              {filteredPasswords.map((entry) => (
                <div key={entry.id} className="password-card">
                  <div className="password-card-header">
                    <div className="password-title-section">
                      {entry.isFavorite && <span className="favorite-badge">⭐</span>}
                      <h3>{entry.title || 'Untitled'}</h3>
                    </div>
                    {entry.category && (
                      <span className="category-badge">{entry.category}</span>
                    )}
                  </div>

                  <div className="password-details">
                    {entry.username && (
                      <div className="detail-row">
                        <span className="detail-label">Username:</span>
                        <span className="detail-value">{entry.username}</span>
                      </div>
                    )}
                    {entry.password && (
                      <div className="detail-row">
                        <span className="detail-label">Password:</span>
                        <code className="detail-value">{entry.password}</code>
                      </div>
                    )}
                    {entry.url && (
                      <div className="detail-row">
                        <span className="detail-label">URL:</span>
                        <a href={entry.url} target="_blank" rel="noopener noreferrer" className="detail-link">
                          {entry.url}
                        </a>
                      </div>
                    )}
                    {entry.notes && (
                      <div className="detail-row">
                        <span className="detail-label">Notes:</span>
                        <span className="detail-value">{entry.notes}</span>
                      </div>
                    )}
                    {entry.tags && entry.tags.length > 0 && (
                      <div className="detail-row">
                        <span className="detail-label">Tags:</span>
                        <div className="tags-list">
                          {entry.tags.map((tag, idx) => (
                            <span key={idx} className="tag">{tag}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="password-meta">
                    <span className="meta-item">Created: {entry.createdAt?.toLocaleDateString()}</span>
                    <span className="meta-item">Modified: {entry.lastModified?.toLocaleDateString()}</span>
                    <span className="meta-item">Views: {entry.accessCount || 0}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* No search results */}
          {!fetchLoading && passwords.length > 0 && filteredPasswords.length === 0 && (
            <div className="empty-box">
              <span className="empty-icon">🔍</span>
              <h3>No Results Found</h3>
              <p>No passwords match your search query.</p>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .console-page {
          min-height: 100vh;
          background: #f8f9fa;
          padding: 2rem;
        }

        .console-container {
          max-width: 1200px;
          margin: 0 auto;
        }

        .console-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
          padding: 1.5rem;
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .console-status {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .status-icon {
          font-size: 2.5rem;
        }

        .console-header h1 {
          margin: 0 0 0.25rem 0;
          font-size: 1.75rem;
          color: #2c3e50;
        }

        .status-text {
          margin: 0;
          font-size: 0.9rem;
          color: #7f8c8d;
        }

        .btn-exit {
          padding: 0.75rem 1.5rem;
          background: #e74c3c;
          color: white;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-exit:hover {
          background: #c0392b;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(231, 76, 60, 0.3);
        }

        .readonly-banner {
          display: flex;
          gap: 1rem;
          align-items: flex-start;
          padding: 1.5rem;
          background: linear-gradient(135deg, #fff9e6 0%, #fff5cc 100%);
          border: 2px solid #f59e0b;
          border-radius: 12px;
          margin-bottom: 2rem;
        }

        .banner-icon {
          font-size: 2rem;
          flex-shrink: 0;
        }

        .banner-content {
          flex: 1;
        }

        .banner-content strong {
          display: block;
          margin-bottom: 0.5rem;
          font-size: 1.1rem;
          color: #2c3e50;
        }

        .banner-content p {
          margin: 0;
          color: #5a6c7d;
          line-height: 1.5;
        }

        .passwords-section {
          background: white;
          border-radius: 12px;
          padding: 2rem;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .passwords-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
        }

        .passwords-header h2 {
          margin: 0;
          font-size: 1.5rem;
          color: #2c3e50;
        }

        .passwords-actions {
          display: flex;
          gap: 0.75rem;
        }

        .btn-export {
          padding: 0.625rem 1.25rem;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 0.9rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-export:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
        }

        .btn-export:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .search-bar {
          margin-bottom: 1.5rem;
        }

        .search-bar input {
          width: 100%;
          padding: 0.75rem 1rem;
          border: 2px solid #e1e8ed;
          border-radius: 8px;
          font-size: 1rem;
          transition: all 0.2s;
        }

        .search-bar input:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .loading-box,
        .error-box,
        .empty-box {
          text-align: center;
          padding: 3rem 2rem;
          background: #f8f9fa;
          border-radius: 12px;
          border: 2px dashed #d1d5db;
        }

        .spinner {
          width: 50px;
          height: 50px;
          margin: 0 auto 1rem;
          border: 4px solid #e1e8ed;
          border-top-color: #667eea;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .error-icon-large,
        .empty-icon {
          font-size: 4rem;
          display: block;
          margin-bottom: 1rem;
        }

        .error-box {
          background: #fff5f5;
          border-color: #feb2b2;
          color: #c53030;
        }

        .password-list {
          display: grid;
          gap: 1rem;
        }

        .password-card {
          background: #f8f9fa;
          border: 2px solid #e1e8ed;
          border-radius: 12px;
          padding: 1.5rem;
          transition: all 0.2s;
        }

        .password-card:hover {
          border-color: #667eea;
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
        }

        .password-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
          padding-bottom: 1rem;
          border-bottom: 2px solid #e1e8ed;
        }

        .password-title-section {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .favorite-badge {
          font-size: 1.2rem;
        }

        .password-card-header h3 {
          margin: 0;
          font-size: 1.25rem;
          color: #2c3e50;
        }

        .category-badge {
          padding: 0.25rem 0.75rem;
          background: #e1e8ed;
          color: #5a6c7d;
          border-radius: 6px;
          font-size: 0.8rem;
          font-weight: 600;
        }

        .password-details {
          display: grid;
          gap: 0.75rem;
          margin-bottom: 1rem;
        }

        .detail-row {
          display: flex;
          gap: 0.75rem;
        }

        .detail-label {
          font-weight: 600;
          color: #5a6c7d;
          min-width: 90px;
          flex-shrink: 0;
        }

        .detail-value {
          color: #2c3e50;
          word-break: break-all;
        }

        code.detail-value {
          font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Courier New', monospace;
          background: #e1e8ed;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
        }

        .detail-link {
          color: #667eea;
          text-decoration: none;
          word-break: break-all;
        }

        .detail-link:hover {
          text-decoration: underline;
        }

        .tags-list {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .tag {
          padding: 0.25rem 0.5rem;
          background: #667eea;
          color: white;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 600;
        }

        .password-meta {
          display: flex;
          gap: 1rem;
          padding-top: 1rem;
          border-top: 2px solid #e1e8ed;
          font-size: 0.85rem;
          color: #7f8c8d;
        }

        .meta-item {
          display: flex;
          align-items: center;
        }

        @media (max-width: 768px) {
          .console-page {
            padding: 1rem;
          }

          .console-header {
            flex-direction: column;
            gap: 1rem;
            text-align: center;
          }

          .console-status {
            flex-direction: column;
            text-align: center;
          }

          .btn-exit {
            width: 100%;
          }

          .passwords-section {
            padding: 1.5rem;
          }

          .passwords-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 1rem;
          }

          .passwords-actions {
            width: 100%;
            flex-direction: column;
          }

          .btn-export {
            width: 100%;
          }

          .detail-row {
            flex-direction: column;
            gap: 0.25rem;
          }

          .detail-label {
            min-width: auto;
          }

          .password-meta {
            flex-direction: column;
            gap: 0.5rem;
          }
        }
      `}</style>
    </div>
  );
}
