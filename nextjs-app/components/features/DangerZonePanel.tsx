'use client';

import React, { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useAuth, useLockbox } from '../../contexts';
import { useLock } from '../../contexts/LockContext';
import { useToast } from '../ui/Toast';
import { useConfirm } from '../ui/ConfirmDialog';

/**
 * Danger Zone Panel
 *
 * Dangerous account operations that could result in data loss:
 * - Clear session (soft reset)
 * - Close account permanently (hard reset with rent recovery)
 */

export function DangerZonePanel() {
  const { disconnect } = useWallet();
  const { client } = useAuth();
  const { refreshLockbox } = useLockbox();
  const { clearLock } = useLock();
  const toast = useToast();
  const { confirm } = useConfirm();

  const handleClearSession = async () => {
    const confirmed = await confirm({
      title: 'Clear Session',
      message: 'Clear local session and reload? Your on-chain data will remain intact.',
      confirmText: 'Clear & Reload',
      cancelText: 'Cancel',
      danger: false
    });

    if (confirmed) {
      sessionStorage.clear();
      window.location.reload();
    }
  };

  const handleCloseAccount = async () => {
    if (!client) {
      toast.showError('Client not initialized');
      return;
    }

    const confirmed = await confirm({
      title: 'Close Account Permanently',
      message: 'WARNING: This will permanently delete ALL passwords and cannot be undone!\n\nAre you absolutely sure you want to close your account and reclaim rent?',
      confirmText: 'Close Account',
      cancelText: 'Cancel',
      danger: true
    });

    if (!confirmed) return;

    try {
      const signature = await client.closeMasterLockbox();

      toast.showSuccess(
        `Account closed successfully! Transaction: ${signature}. Rent has been returned to your wallet.`
      );

      // Clear lock state first to prevent lock screen from showing
      clearLock();

      // Refresh lockbox to clear state immediately
      await refreshLockbox();

      // Clean up ALL local data - session, preferences, backup codes, recovery keys, etc.
      sessionStorage.clear();
      localStorage.clear();

      // Disconnect wallet - this will trigger Providers.tsx redirect to homepage
      // No need for manual redirect as the wallet disconnect handler will take care of it
      await disconnect();
    } catch (error: any) {
      console.error('Failed to close account:', error);

      if (
        error.message?.includes('already been processed') ||
        error.message?.includes('AlreadyProcessed')
      ) {
        toast.showInfo(
          'Your account may have already been closed.'
        );

        // Clear lock state first to prevent lock screen from showing
        clearLock();

        // Refresh lockbox to clear state immediately
        await refreshLockbox();

        // Clean up ALL local data
        sessionStorage.clear();
        localStorage.clear();

        // Disconnect wallet - this will trigger Providers.tsx redirect to homepage
        await disconnect();
      } else if (
        error.message?.includes('AccountNotFound') ||
        error.message?.includes('not found')
      ) {
        toast.showInfo('Account is already closed.');

        // Clear lock state first to prevent lock screen from showing
        clearLock();

        // Refresh lockbox to clear state immediately
        await refreshLockbox();

        // Clean up ALL local data
        sessionStorage.clear();
        localStorage.clear();

        // Disconnect wallet - this will trigger Providers.tsx redirect to homepage
        await disconnect();
      } else {
        toast.showError(
          `Failed to close account: ${error.message || 'Unknown error'}. Please try refreshing the page.`
        );
      }
    }
  };

  const copyPDA = () => {
    if (client?.masterLockboxPDA) {
      navigator.clipboard.writeText(client.masterLockboxPDA.toString());
      toast.showSuccess('PDA address copied to clipboard!');
    }
  };

  return (
    <div className="danger-zone-panel">
      <div className="panel-header">
        <h2>⚠️ Danger Zone</h2>
        <p>Irreversible actions that can affect your account</p>
      </div>

      {/* Account Info */}
      <div className="info-section">
        <h3>Your Master Lockbox PDA</h3>
        <p>This is your unique on-chain account address</p>
        <div className="pda-container">
          <code className="pda-address">
            {client?.masterLockboxPDA?.toString() || 'Not available'}
          </code>
          <button className="btn-copy" onClick={copyPDA} disabled={!client?.masterLockboxPDA}>
            Copy
          </button>
        </div>
        {client?.masterLockboxPDA && (
          <a
            href={`https://explorer.solana.com/address/${client.masterLockboxPDA.toString()}?cluster=devnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="explorer-link"
          >
            View on Solana Explorer ↗
          </a>
        )}
      </div>

      {/* Clear Session */}
      <div className="action-section">
        <div className="action-header">
          <h3>🔄 Clear Session</h3>
          <span className="badge-safe">Safe</span>
        </div>
        <p>
          Clear your local session and reload the page. Your passwords remain safely stored
          on-chain and will be available when you reconnect your wallet.
        </p>
        <button className="btn-action btn-warning" onClick={handleClearSession}>
          Clear Session & Reload
        </button>
      </div>

      {/* Close Account */}
      <div className="action-section danger">
        <div className="action-header">
          <h3>🚨 Close Account Permanently</h3>
          <span className="badge-danger">Irreversible</span>
        </div>
        <div className="warning-box">
          <strong>⚠️ Warning: Permanent Data Loss</strong>
          <p>
            Closing your account will <strong>permanently delete all stored passwords</strong> and
            cannot be undone. Make sure you have backed up any important passwords before
            proceeding.
          </p>
          <p>
            <strong>✅ Benefit:</strong> You will reclaim all rent paid for storage.
          </p>
        </div>
        <button className="btn-action btn-danger" onClick={handleCloseAccount} disabled={!client}>
          ⚠️ Close Account & Reclaim Rent
        </button>
      </div>

      <style jsx>{`
        .danger-zone-panel {
          max-width: 800px;
        }

        .panel-header {
          margin-bottom: 2rem;
        }

        .panel-header h2 {
          margin: 0 0 0.5rem 0;
          font-size: 1.75rem;
          color: #dc3545;
          font-weight: 700;
        }

        .panel-header p {
          margin: 0;
          color: #6c757d;
          font-size: 1rem;
        }

        .info-section,
        .action-section {
          background: #f8f9fa;
          border: 1px solid #dee2e6;
          border-radius: 12px;
          padding: 1.5rem;
          margin-bottom: 1.5rem;
        }

        .action-section.danger {
          background: #fff5f5;
          border-color: #fecaca;
        }

        .info-section h3,
        .action-section h3 {
          margin: 0 0 0.5rem 0;
          font-size: 1.25rem;
          color: #2c3e50;
          font-weight: 600;
        }

        .info-section p,
        .action-section p {
          margin: 0 0 1rem 0;
          color: #6c757d;
          line-height: 1.6;
        }

        .action-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 0.75rem;
        }

        .badge-safe,
        .badge-danger {
          padding: 0.25rem 0.75rem;
          border-radius: 6px;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .badge-safe {
          background: #d4edda;
          color: #155724;
        }

        .badge-danger {
          background: #f8d7da;
          color: #721c24;
        }

        .pda-container {
          display: flex;
          gap: 0.75rem;
          align-items: center;
          margin-bottom: 1rem;
        }

        .pda-address {
          flex: 1;
          background: white;
          padding: 0.75rem 1rem;
          border: 1px solid #dee2e6;
          border-radius: 8px;
          font-family: 'Courier New', monospace;
          font-size: 0.85rem;
          color: #495057;
          word-break: break-all;
        }

        .btn-copy {
          padding: 0.75rem 1.5rem;
          background: #667eea;
          color: white;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }

        .btn-copy:hover {
          background: #5568d3;
          transform: translateY(-1px);
        }

        .btn-copy:disabled {
          background: #6c757d;
          cursor: not-allowed;
          opacity: 0.5;
        }

        .explorer-link {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          color: #667eea;
          text-decoration: none;
          font-weight: 500;
          font-size: 0.95rem;
          transition: all 0.2s;
        }

        .explorer-link:hover {
          color: #5568d3;
          text-decoration: underline;
        }

        .warning-box {
          background: white;
          border: 2px solid #f8d7da;
          border-radius: 8px;
          padding: 1rem;
          margin-bottom: 1rem;
        }

        .warning-box strong {
          display: block;
          margin-bottom: 0.5rem;
          color: #721c24;
          font-size: 1rem;
        }

        .warning-box p {
          margin: 0.5rem 0;
          color: #495057;
          font-size: 0.95rem;
        }

        .warning-box p:last-child {
          margin-bottom: 0;
        }

        .btn-action {
          padding: 0.875rem 1.75rem;
          border: none;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          width: 100%;
        }

        .btn-warning {
          background: #ffc107;
          color: #000;
        }

        .btn-warning:hover {
          background: #e0a800;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(255, 193, 7, 0.3);
        }

        .btn-danger {
          background: #dc3545;
          color: white;
        }

        .btn-danger:hover {
          background: #c82333;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(220, 53, 69, 0.3);
        }

        .btn-action:disabled {
          background: #6c757d;
          cursor: not-allowed;
          opacity: 0.5;
        }

        .btn-action:disabled:hover {
          transform: none;
          box-shadow: none;
        }

        @media (max-width: 768px) {
          .pda-container {
            flex-direction: column;
          }

          .btn-copy {
            width: 100%;
          }

          .action-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.5rem;
          }
        }
      `}</style>
    </div>
  );
}
