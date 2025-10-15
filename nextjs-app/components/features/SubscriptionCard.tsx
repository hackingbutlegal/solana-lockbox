'use client';

import React from 'react';
import { SubscriptionTier, TIER_INFO } from '../../sdk/src/types-v2';

interface SubscriptionCardProps {
  tier: SubscriptionTier;
  currentTier: SubscriptionTier;
  onUpgrade?: (tier: SubscriptionTier) => void;
  disabled?: boolean;
}

export function SubscriptionCard({ tier, currentTier, onUpgrade, disabled }: SubscriptionCardProps) {
  const info = TIER_INFO[tier];
  const isCurrent = tier === currentTier;
  const isUpgrade = tier > currentTier;
  const isDowngrade = tier < currentTier;

  // Format SOL amount
  const formatSOL = (lamports: number): string => {
    if (lamports === 0) return 'Free';
    return `${(lamports / 1_000_000_000).toFixed(3)} SOL/month`;
  };

  // Format storage size
  const formatStorage = (bytes: number): string => {
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(0)}MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)}KB`;
    return `${bytes}B`;
  };

  const handleClick = () => {
    if (!disabled && isUpgrade && onUpgrade) {
      onUpgrade(tier);
    }
  };

  return (
    <div
      className={`subscription-card ${isCurrent ? 'current' : ''} ${isUpgrade ? 'upgrade' : ''} ${isDowngrade ? 'downgrade' : ''}`}
      onClick={handleClick}
      style={{ cursor: isUpgrade && !disabled ? 'pointer' : 'default' }}
    >
      <div className="card-header">
        <h3 className="tier-name">{info.name}</h3>
        {isCurrent && <span className="badge-current">Current Plan</span>}
        {tier === SubscriptionTier.Premium && <span className="badge-popular">Popular</span>}
      </div>

      <div className="card-price">
        <span className="price-amount">{formatSOL(info.monthlyCost)}</span>
      </div>

      <div className="card-storage">
        <div className="storage-label">Storage Capacity</div>
        <div className="storage-value">{formatStorage(info.maxCapacity)}</div>
        <div className="storage-entries">~{info.maxEntries.toLocaleString()} passwords</div>
      </div>

      <ul className="card-features">
        {info.features.map((feature, idx) => (
          <li key={idx}>
            <span className="feature-check">✓</span>
            <span className="feature-text">{feature}</span>
          </li>
        ))}
      </ul>

      <div className="card-action">
        {isCurrent && (
          <button className="btn-current" disabled>
            Current Plan
          </button>
        )}
        {isUpgrade && (
          <button className="btn-upgrade" disabled={disabled}>
            {disabled ? 'Processing...' : 'Upgrade Now'}
          </button>
        )}
        {isDowngrade && (
          <button className="btn-downgrade" disabled>
            Not Available
          </button>
        )}
      </div>

      <style jsx>{`
        .subscription-card {
          background: white;
          border: 2px solid #e1e8ed;
          border-radius: 16px;
          padding: 2rem;
          transition: all 0.3s ease;
          position: relative;
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        .subscription-card.upgrade:hover {
          border-color: #667eea;
          transform: translateY(-4px);
          box-shadow: 0 12px 24px rgba(102, 126, 234, 0.15);
        }

        .subscription-card.current {
          border-color: #667eea;
          background: linear-gradient(135deg, #f8f9ff 0%, #ffffff 100%);
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1rem;
        }

        .tier-name {
          font-size: 1.5rem;
          font-weight: 700;
          color: #2c3e50;
          margin: 0;
        }

        .badge-current {
          background: #667eea;
          color: white;
          padding: 0.25rem 0.75rem;
          border-radius: 12px;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
        }

        .badge-popular {
          background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
          color: white;
          padding: 0.25rem 0.75rem;
          border-radius: 12px;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
        }

        .card-price {
          margin-bottom: 1.5rem;
        }

        .price-amount {
          font-size: 2rem;
          font-weight: 700;
          color: #2c3e50;
        }

        .card-storage {
          background: #f8f9fa;
          border-radius: 12px;
          padding: 1rem;
          margin-bottom: 1.5rem;
          text-align: center;
        }

        .storage-label {
          font-size: 0.85rem;
          color: #7f8c8d;
          margin-bottom: 0.5rem;
        }

        .storage-value {
          font-size: 1.75rem;
          font-weight: 700;
          color: #667eea;
          margin-bottom: 0.25rem;
        }

        .storage-entries {
          font-size: 0.9rem;
          color: #95a5a6;
        }

        .card-features {
          list-style: none;
          padding: 0;
          margin: 0 0 2rem 0;
          flex-grow: 1;
        }

        .card-features li {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 0.75rem;
          font-size: 0.95rem;
          color: #2c3e50;
        }

        .feature-check {
          color: #27ae60;
          font-weight: 700;
          font-size: 1.1rem;
        }

        .feature-text {
          flex: 1;
        }

        .card-action {
          margin-top: auto;
        }

        .btn-current,
        .btn-upgrade,
        .btn-downgrade {
          width: 100%;
          padding: 0.875rem;
          border: none;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-current {
          background: #e8eaf6;
          color: #667eea;
          cursor: default;
        }

        .btn-upgrade {
          background: #667eea;
          color: white;
        }

        .btn-upgrade:hover:not(:disabled) {
          background: #5568d3;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
        }

        .btn-upgrade:disabled {
          background: #95a5a6;
          cursor: not-allowed;
        }

        .btn-downgrade {
          background: #f8f9fa;
          color: #95a5a6;
          cursor: not-allowed;
          border: 1px solid #e1e8ed;
        }

        @media (max-width: 768px) {
          .subscription-card {
            padding: 1.5rem;
          }

          .tier-name {
            font-size: 1.25rem;
          }

          .price-amount {
            font-size: 1.5rem;
          }

          .storage-value {
            font-size: 1.5rem;
          }
        }
      `}</style>
    </div>
  );
}
