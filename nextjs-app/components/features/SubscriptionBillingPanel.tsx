'use client';

import React, { useState } from 'react';
import { useSubscription } from '../../contexts';
import { SubscriptionTier, TIER_INFO } from '../../sdk/src/types-v2';
import { SubscriptionCard } from './SubscriptionCard';

/**
 * Subscription & Billing Panel
 *
 * Displays:
 * - Current subscription plan details
 * - Upgrade options (all tiers)
 * - Billing history (future: transaction log)
 */

export function SubscriptionBillingPanel() {
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

  const handleUpgrade = async (tier: SubscriptionTier) => {
    try {
      setUpgrading(true);
      await upgradeSubscription(tier);
      // Success toast would go here
    } catch (error) {
      console.error('Failed to upgrade subscription:', error);
      // Error toast would go here
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
      <h3>Current Plan</h3>
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
          <div className="plan-price">
            {TIER_INFO[currentTier].monthlyCost === 0 ? (
              <span className="price-free">Free</span>
            ) : (
              <span className="price-amount">
                {(TIER_INFO[currentTier].monthlyCost / 1_000_000_000).toFixed(3)} SOL/month
              </span>
            )}
          </div>
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

      {/* Upgrade Options */}
      <h3>Upgrade Options</h3>
      <p className="upgrade-description">
        Choose the plan that fits your needs. Upgrade anytime to unlock more storage and features.
      </p>

      <div className="subscription-tiers">
        {Object.values(SubscriptionTier)
          .filter(tier => typeof tier === 'number')
          .map(tier => (
            <SubscriptionCard
              key={tier}
              tier={tier as SubscriptionTier}
              currentTier={currentTier}
              onUpgrade={handleUpgrade}
              disabled={upgrading || loading}
            />
          ))}
      </div>

      {/* Billing History Section */}
      <h3>Billing History</h3>
      <div className="billing-history">
        <p className="empty-state">
          📜 Billing history will appear here once you make your first subscription payment.
        </p>
        {/* Future: Transaction table with Solana Explorer links */}
      </div>

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

        .subscription-tiers {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1.5rem;
          margin-bottom: 2rem;
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
          .subscription-tiers {
            grid-template-columns: 1fr;
          }

          .current-plan-card {
            padding: 1.5rem;
          }

          .plan-header h4 {
            font-size: 1.5rem;
          }
        }
      `}</style>
    </div>
  );
}
