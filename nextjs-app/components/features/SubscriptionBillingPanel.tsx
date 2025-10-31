'use client';

import React, { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useSubscription, useLockbox } from '../../contexts';
import { SubscriptionTier, TIER_INFO } from '../../sdk/src/types-v2';
import { SubscriptionCard } from './SubscriptionCard';
import { StorageSliderModal } from '../modals/StorageSliderModal';

/**
 * Subscription & Billing Panel
 *
 * Displays:
 * - Current subscription plan details
 * - Storage expansion via slider modal
 * - Billing history (future: transaction log)
 */

export function SubscriptionBillingPanel() {
  const { connected } = useWallet();
  const { client } = useLockbox();
  const {
    currentTier,
    storageUsed,
    storageLimit,
    storagePercentage,
    subscriptionExpiry,
    isActive,
    tierName,
    upgradeSubscription,
    loading
  } = useSubscription();

  const [upgrading, setUpgrading] = useState(false);
  const [showSliderModal, setShowSliderModal] = useState(false);

  const formatBytes = (bytes: number): string => {
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)}MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)}KB`;
    return `${bytes}B`;
  };

  const formatDate = (date: Date | null): string => {
    if (!date) return 'Never';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleStorageExpansion = async (targetBytes: number) => {
    // Verify wallet is connected before proceeding
    if (!connected || !client) {
      alert('Please connect your wallet first to expand storage.');
      return;
    }

    try {
      setUpgrading(true);

      // Use the smart expansion method that handles chunks automatically
      const signatures = await client.expandStorageToCapacity(targetBytes);

      console.log(`✅ Storage expanded successfully! ${signatures.length} transaction(s) completed.`);
      alert(`Storage expanded to ${targetBytes} bytes!\n\nCompleted ${signatures.length} blockchain transaction(s).`);

      // Refresh the subscription data to show new capacity
      // The context should automatically refetch, but we can trigger it explicitly
      window.location.reload(); // Simple refresh to show updated stats

    } catch (error) {
      console.error('Failed to expand storage:', error);
      alert(`Failed to expand storage: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    } finally {
      setUpgrading(false);
    }
  };

  const getStorageColor = (): string => {
    if (storagePercentage >= 90) return '#e74c3c';
    if (storagePercentage >= 70) return '#f39c12';
    return '#27ae60';
  };

  return (
    <div className="subscription-billing-panel">
      {/* Current Plan Section */}
      <div className="current-plan-card">
        <div className="plan-header">
          <div>
            <h4>{tierName}</h4>
            <p className="plan-status">
              {isActive ? (
                <span className="status-active">✓ Active</span>
              ) : (
                <span className="status-expired">⚠ Expired</span>
              )}
            </p>
          </div>
          {/* Only show price on right side for paid tiers (Free tier already shows "Free" as tier name) */}
          {TIER_INFO[currentTier].monthlyCost > 0 && (
            <div className="plan-price">
              <span className="price-amount">
                {(TIER_INFO[currentTier].monthlyCost / 1_000_000_000).toFixed(3)} SOL paid
              </span>
            </div>
          )}
        </div>

        <div className="plan-details">
          <div className="detail-item">
            <span className="detail-label">Storage Used</span>
            <span className="detail-value">
              {formatBytes(storageUsed)} / {formatBytes(storageLimit)} ({storagePercentage}%)
            </span>
          </div>
          <div className="storage-bar">
            <div
              className="storage-bar-fill"
              style={{
                width: `${storagePercentage}%`,
                background: getStorageColor()
              }}
            />
          </div>

          {subscriptionExpiry && (
            <div className="detail-item">
              <span className="detail-label">Next Billing Date</span>
              <span className="detail-value">{formatDate(subscriptionExpiry)}</span>
            </div>
          )}

          <div className="detail-item">
            <span className="detail-label">Max Passwords</span>
            <span className="detail-value">~{TIER_INFO[currentTier].maxEntries.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Storage Expansion */}
      <p className="upgrade-description">
        Need more space? Expand your storage capacity with our flexible slider. One-time payment includes refundable account rent plus a service fee to support platform development.
      </p>

      <div className="expansion-cta">
        <div className="cta-content">
          <div className="cta-icon">📦</div>
          <div className="cta-text">
            <h4>Expand Your Capacity</h4>
            <p>Choose exactly how much storage you need • Pay only for what you use</p>
          </div>
        </div>
        <button
          className="btn-expand"
          onClick={() => setShowSliderModal(true)}
          disabled={!connected || loading || upgrading}
          title={!connected ? 'Connect your wallet first' : ''}
        >
          {!connected ? 'Connect Wallet First' : upgrading ? 'Expanding...' : 'Open Storage Slider'}
        </button>
      </div>

      {/* Storage Slider Modal */}
      <StorageSliderModal
        isOpen={showSliderModal}
        onClose={() => setShowSliderModal(false)}
        currentCapacity={storageLimit}
        currentTier={currentTier}
        onConfirm={handleStorageExpansion}
      />

      {/* Billing History Section - HIDDEN: Non-functional */}
      {/* <h3>Billing History</h3>
      <div className="billing-history">
        <p className="empty-state">
          📜 Billing history will appear here once you make your first subscription payment.
        </p>
      </div> */}

      <style jsx>{`
        .subscription-billing-panel h3 {
          margin: 2rem 0 1rem 0;
          color: #2c3e50;
          font-size: 1.5rem;
          font-weight: 700;
        }

        .subscription-billing-panel h3:first-child {
          margin-top: 0;
        }

        .upgrade-description {
          margin: 0 0 1.5rem 0;
          color: #7f8c8d;
          font-size: 0.95rem;
        }

        .current-plan-card {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 16px;
          padding: 2rem;
          color: white;
          margin-bottom: 2rem;
        }

        .plan-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1.5rem;
        }

        .plan-header h4 {
          margin: 0 0 0.5rem 0;
          font-size: 2rem;
          font-weight: 700;
        }

        .plan-status {
          margin: 0;
          font-size: 0.9rem;
        }

        .status-active {
          color: #2ecc71;
          font-weight: 600;
        }

        .status-expired {
          color: #f39c12;
          font-weight: 600;
        }

        .plan-price {
          text-align: right;
        }

        .price-free {
          font-size: 1.5rem;
          font-weight: 700;
        }

        .price-amount {
          font-size: 1.25rem;
          font-weight: 600;
        }

        .plan-details {
          background: rgba(255, 255, 255, 0.15);
          border-radius: 12px;
          padding: 1.5rem;
        }

        .detail-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.75rem;
        }

        .detail-item:last-child {
          margin-bottom: 0;
        }

        .detail-label {
          font-size: 0.9rem;
          opacity: 0.9;
        }

        .detail-value {
          font-size: 1rem;
          font-weight: 600;
        }

        .storage-bar {
          width: 100%;
          height: 10px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 5px;
          overflow: hidden;
          margin: 1rem 0;
        }

        .storage-bar-fill {
          height: 100%;
          border-radius: 5px;
          transition: all 0.3s ease;
        }

        .expansion-cta {
          background: linear-gradient(135deg, #f8f9ff 0%, #ffffff 100%);
          border: 2px solid #667eea;
          border-radius: 20px;
          padding: 2rem;
          margin-bottom: 2rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 2rem;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .expansion-cta:hover {
          box-shadow: 0 8px 24px rgba(102, 126, 234, 0.15);
          transform: translateY(-2px);
        }

        .cta-content {
          display: flex;
          align-items: center;
          gap: 1.5rem;
          flex: 1;
        }

        .cta-icon {
          font-size: 3rem;
          flex-shrink: 0;
        }

        .cta-text h4 {
          margin: 0 0 0.5rem 0;
          font-size: 1.25rem;
          font-weight: 700;
          color: #2c3e50;
        }

        .cta-text p {
          margin: 0;
          font-size: 0.95rem;
          color: #6b7280;
        }

        .btn-expand {
          padding: 1rem 2rem;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 12px;
          font-size: 1rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 4px 14px rgba(102, 126, 234, 0.3);
          white-space: nowrap;
        }

        .btn-expand:hover:not(:disabled) {
          transform: translateY(-2px) scale(1.05);
          box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
        }

        .btn-expand:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .billing-history {
          background: #f8f9fa;
          border-radius: 12px;
          padding: 2rem;
          min-height: 150px;
        }

        .empty-state {
          text-align: center;
          color: #7f8c8d;
          font-size: 1rem;
          margin: 0;
        }

        @media (max-width: 768px) {
          .current-plan-card {
            padding: 1.5rem;
          }

          .plan-header {
            flex-direction: column;
            gap: 1rem;
          }

          .plan-header h4 {
            font-size: 1.5rem;
          }

          .expansion-cta {
            flex-direction: column;
            text-align: center;
          }

          .cta-content {
            flex-direction: column;
            text-align: center;
          }

          .btn-expand {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
