'use client';

import React from 'react';
import { SubscriptionTier, TIER_INFO } from '../sdk/src/types-v2';

interface StorageUsageBarProps {
  used: number; // bytes
  total: number; // bytes
  tier: SubscriptionTier;
  onUpgrade?: () => void;
}

export function StorageUsageBar({ used, total, tier, onUpgrade }: StorageUsageBarProps) {
  const percentage = total > 0 ? Math.min((used / total) * 100, 100) : 0;
  const isNearLimit = percentage >= 80;
  const isAtLimit = percentage >= 95;

  const formatBytes = (bytes: number): string => {
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(2)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${bytes} B`;
  };

  const getStatusColor = (): string => {
    if (isAtLimit) return '#e74c3c';
    if (isNearLimit) return '#f39c12';
    return '#27ae60';
  };

  const getStatusText = (): string => {
    if (isAtLimit) return 'Storage Nearly Full';
    if (isNearLimit) return 'Storage Low';
    return 'Storage Available';
  };

  const tierInfo = TIER_INFO[tier];
  const canUpgrade = tier < SubscriptionTier.Enterprise;

  return (
    <div className="storage-usage-container">
      <div className="usage-header">
        <div className="usage-title">
          <h4>Storage Usage</h4>
          <span className={`status-badge ${isAtLimit ? 'critical' : isNearLimit ? 'warning' : 'ok'}`}>
            {getStatusText()}
          </span>
        </div>
        <div className="usage-stats">
          <span className="used">{formatBytes(used)}</span>
          <span className="separator">/</span>
          <span className="total">{formatBytes(total)}</span>
        </div>
      </div>

      <div className="usage-bar-container">
        <div
          className="usage-bar"
          style={{
            width: `${percentage}%`,
            background: getStatusColor(),
          }}
        >
          {percentage > 10 && <span className="percentage">{percentage.toFixed(1)}%</span>}
        </div>
      </div>

      <div className="usage-details">
        <div className="tier-info">
          <span className="tier-badge">{tierInfo.name} Tier</span>
          <span className="tier-limit">
            {tierInfo.maxCapacity >= 1048576
              ? `${(tierInfo.maxCapacity / 1048576).toFixed(0)}MB`
              : `${(tierInfo.maxCapacity / 1024).toFixed(0)}KB`} capacity
          </span>
        </div>

        {(isNearLimit || isAtLimit) && canUpgrade && (
          <button className="btn-upgrade-storage" onClick={onUpgrade}>
            Upgrade for More Storage
          </button>
        )}
      </div>

      {isAtLimit && (
        <div className="warning-message">
          <strong>⚠️ Storage limit reached!</strong>
          <p>
            {canUpgrade
              ? 'Upgrade your subscription to add more passwords.'
              : 'Consider deleting unused passwords to free up space.'}
          </p>
        </div>
      )}

      <style jsx>{`
        .storage-usage-container {
          background: white;
          border: 1px solid #e1e8ed;
          border-radius: 12px;
          padding: 1.5rem;
          margin-bottom: 1.5rem;
        }

        .usage-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1rem;
        }

        .usage-title {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .usage-title h4 {
          margin: 0;
          font-size: 1.1rem;
          color: #2c3e50;
        }

        .status-badge {
          padding: 0.25rem 0.75rem;
          border-radius: 12px;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
        }

        .status-badge.ok {
          background: #d4edda;
          color: #155724;
        }

        .status-badge.warning {
          background: #fff3cd;
          color: #856404;
        }

        .status-badge.critical {
          background: #f8d7da;
          color: #721c24;
        }

        .usage-stats {
          display: flex;
          align-items: baseline;
          gap: 0.5rem;
          font-size: 1.1rem;
        }

        .used {
          font-weight: 700;
          color: #2c3e50;
        }

        .separator {
          color: #95a5a6;
        }

        .total {
          color: #7f8c8d;
        }

        .usage-bar-container {
          height: 32px;
          background: #f8f9fa;
          border-radius: 16px;
          overflow: hidden;
          margin-bottom: 1rem;
          position: relative;
        }

        .usage-bar {
          height: 100%;
          transition: all 0.3s ease;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          padding-right: 1rem;
          position: relative;
        }

        .percentage {
          color: white;
          font-weight: 700;
          font-size: 0.875rem;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
        }

        .usage-details {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .tier-info {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .tier-badge {
          background: #667eea;
          color: white;
          padding: 0.25rem 0.75rem;
          border-radius: 8px;
          font-size: 0.85rem;
          font-weight: 600;
        }

        .tier-limit {
          color: #7f8c8d;
          font-size: 0.9rem;
        }

        .btn-upgrade-storage {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 8px;
          font-weight: 600;
          font-size: 0.9rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-upgrade-storage:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
        }

        .warning-message {
          background: #fff3cd;
          border: 1px solid #ffc107;
          border-radius: 8px;
          padding: 1rem;
          margin-top: 1rem;
        }

        .warning-message strong {
          display: block;
          color: #856404;
          margin-bottom: 0.5rem;
        }

        .warning-message p {
          margin: 0;
          color: #856404;
          font-size: 0.9rem;
        }

        @media (max-width: 768px) {
          .usage-header {
            flex-direction: column;
            gap: 0.75rem;
          }

          .usage-details {
            flex-direction: column;
            align-items: flex-start;
          }

          .btn-upgrade-storage {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
