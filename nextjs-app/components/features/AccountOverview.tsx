'use client';

import React from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useLockbox, usePassword } from '../../contexts';

/**
 * Account Overview Panel
 *
 * Displays account information:
 * - Wallet address
 * - Account creation date
 * - Total entries
 * - Account statistics
 */

export function AccountOverview() {
  const { publicKey } = useWallet();
  const { masterLockbox } = useLockbox();
  const { entries } = usePassword();

  const formatAddress = (address: string): string => {
    if (!address) return 'Not connected';
    return `${address.slice(0, 8)}...${address.slice(-8)}`;
  };

  const formatDate = (timestamp: number): string => {
    if (!timestamp) return 'Unknown';
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Toast notification would go here
  };

  return (
    <div className="account-overview">
      <h3>Account Information</h3>

      <div className="account-cards">
        {/* Wallet Address Card */}
        <div className="info-card">
          <div className="card-icon">👛</div>
          <div className="card-content">
            <h4>Wallet Address</h4>
            <div className="address-container">
              <code className="address-text">
                {publicKey ? formatAddress(publicKey.toBase58()) : 'Not connected'}
              </code>
              {publicKey && (
                <button
                  className="btn-copy"
                  onClick={() => copyToClipboard(publicKey.toBase58())}
                  title="Copy full address"
                >
                  📋
                </button>
              )}
            </div>
            {publicKey && (
              <p className="full-address">{publicKey.toBase58()}</p>
            )}
          </div>
        </div>

        {/* Account Created Card */}
        <div className="info-card">
          <div className="card-icon">📅</div>
          <div className="card-content">
            <h4>Account Created</h4>
            <p className="card-value">
              {masterLockbox ? formatDate(masterLockbox.createdAt) : 'Not initialized'}
            </p>
          </div>
        </div>

        {/* Total Entries Card */}
        <div className="info-card">
          <div className="card-icon">🔑</div>
          <div className="card-content">
            <h4>Total Entries</h4>
            <p className="card-value">{entries.length} passwords</p>
          </div>
        </div>

        {/* Storage Chunks Card */}
        <div className="info-card">
          <div className="card-icon">📦</div>
          <div className="card-content">
            <h4>Storage Chunks</h4>
            <p className="card-value">
              {masterLockbox?.storageChunksCount || 0} chunks allocated
            </p>
          </div>
        </div>
      </div>

      <style jsx>{`
        .account-overview h3 {
          margin: 0 0 1.5rem 0;
          color: #2c3e50;
          font-size: 1.5rem;
          font-weight: 700;
        }

        .account-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1.5rem;
        }

        .info-card {
          background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
          border: 2px solid #e1e8ed;
          border-radius: 12px;
          padding: 1.5rem;
          display: flex;
          gap: 1rem;
          transition: all 0.2s;
        }

        .info-card:hover {
          border-color: #667eea;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.1);
        }

        .card-icon {
          font-size: 2.5rem;
          line-height: 1;
        }

        .card-content {
          flex: 1;
        }

        .card-content h4 {
          margin: 0 0 0.5rem 0;
          color: #7f8c8d;
          font-size: 0.85rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .card-value {
          margin: 0;
          color: #2c3e50;
          font-size: 1.25rem;
          font-weight: 700;
        }

        .address-container {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.5rem;
        }

        .address-text {
          background: #f8f9fa;
          padding: 0.5rem 0.75rem;
          border-radius: 6px;
          font-family: 'Courier New', monospace;
          font-size: 0.95rem;
          color: #667eea;
          font-weight: 600;
        }

        .btn-copy {
          background: transparent;
          border: none;
          cursor: pointer;
          font-size: 1.2rem;
          padding: 0.25rem;
          opacity: 0.7;
          transition: all 0.2s;
        }

        .btn-copy:hover {
          opacity: 1;
          transform: scale(1.1);
        }

        .full-address {
          margin: 0;
          font-size: 0.7rem;
          color: #95a5a6;
          word-break: break-all;
          font-family: 'Courier New', monospace;
        }

        @media (max-width: 768px) {
          .account-cards {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
