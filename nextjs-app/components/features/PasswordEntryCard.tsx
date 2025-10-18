'use client';

import React, { useState } from 'react';
import { PasswordEntry, PasswordEntryType } from '../../sdk/src/types-v2';

/**
 * PasswordEntryCard Component
 *
 * Modern, interactive card for displaying password entries.
 * Designed for grid view with hover states and quick actions.
 *
 * Features:
 * - Visual hierarchy with gradients
 * - Quick copy buttons (password, username)
 * - Favorite toggle
 * - Health indicator
 * - Responsive design
 * - Smooth animations
 */

export interface PasswordEntryCardProps {
  entry: PasswordEntry;
  onClick?: () => void;
  onCopyPassword?: () => void;
  onCopyUsername?: () => void;
  onToggleFavorite?: () => void;
  showQuickActions?: boolean;
  healthScore?: number; // 0-100
  className?: string;
}

const TYPE_COLORS: Record<PasswordEntryType, { bg: string; border: string; icon: string }> = {
  [PasswordEntryType.Login]: { bg: '#eff6ff', border: '#3b82f6', icon: '🔐' },
  [PasswordEntryType.CreditCard]: { bg: '#fef3c7', border: '#f59e0b', icon: '💳' },
  [PasswordEntryType.SecureNote]: { bg: '#f0fdf4', border: '#10b981', icon: '📝' },
  [PasswordEntryType.Identity]: { bg: '#fce7f3', border: '#ec4899', icon: '👤' },
  [PasswordEntryType.ApiKey]: { bg: '#f5f3ff', border: '#8b5cf6', icon: '🔑' },
  [PasswordEntryType.SshKey]: { bg: '#fef2f2', border: '#ef4444', icon: '🔓' },
  [PasswordEntryType.CryptoWallet]: { bg: '#ecfdf5', border: '#059669', icon: '💰' },
};

export function PasswordEntryCard({
  entry,
  onClick,
  onCopyPassword,
  onCopyUsername,
  onToggleFavorite,
  showQuickActions = true,
  healthScore,
  className = '',
}: PasswordEntryCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [justCopied, setJustCopied] = useState<'password' | 'username' | null>(null);

  const typeConfig = TYPE_COLORS[entry.type];

  const handleCopy = (type: 'password' | 'username', callback?: () => void) => {
    callback?.();
    setJustCopied(type);
    setTimeout(() => setJustCopied(null), 2000);
  };

  const getHealthColor = (score?: number): string => {
    if (!score) return '#9ca3af';
    if (score >= 80) return '#10b981';
    if (score >= 60) return '#3b82f6';
    if (score >= 40) return '#f59e0b';
    return '#ef4444';
  };

  const formatLastModified = (date?: Date): string => {
    if (!date) return 'Never';
    const days = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return `${Math.floor(days / 30)}mo ago`;
  };

  return (
    <div
      className={`password-card ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      style={{
        borderColor: isHovered ? typeConfig.border : '#e5e7eb',
      }}
    >
      {/* Header with type icon and favorite */}
      <div className="card-header">
        <span className="type-icon" style={{ background: typeConfig.bg }}>
          {typeConfig.icon}
        </span>
        {entry.favorite && (
          <button
            className="favorite-btn active"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite?.();
            }}
            title="Remove from favorites"
          >
            ★
          </button>
        )}
        {!entry.favorite && isHovered && onToggleFavorite && (
          <button
            className="favorite-btn"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite?.();
            }}
            title="Add to favorites"
          >
            ☆
          </button>
        )}
      </div>

      {/* Title */}
      <h3 className="card-title">{entry.title}</h3>

      {/* Details */}
      <div className="card-details">
        {entry.type === PasswordEntryType.Login && 'username' in entry && (
          <div className="detail-row">
            <span className="detail-label">Username</span>
            <span className="detail-value">{entry.username}</span>
          </div>
        )}
        {entry.type === PasswordEntryType.Login && 'url' in entry && entry.url && (
          <div className="detail-row">
            <span className="detail-label">URL</span>
            <span className="detail-value">{new URL(entry.url).hostname}</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="card-footer">
        <span className="last-modified">{formatLastModified(entry.lastModified)}</span>
        {healthScore !== undefined && (
          <div className="health-indicator">
            <div
              className="health-bar"
              style={{
                width: `${healthScore}%`,
                background: getHealthColor(healthScore),
              }}
            />
          </div>
        )}
      </div>

      {/* Quick Actions (on hover) */}
      {showQuickActions && isHovered && entry.type === PasswordEntryType.Login && (
        <div className="quick-actions">
          {onCopyPassword && (
            <button
              className="quick-action"
              onClick={(e) => {
                e.stopPropagation();
                handleCopy('password', onCopyPassword);
              }}
              title="Copy password"
            >
              {justCopied === 'password' ? '✓' : '🔒'}
            </button>
          )}
          {onCopyUsername && 'username' in entry && (
            <button
              className="quick-action"
              onClick={(e) => {
                e.stopPropagation();
                handleCopy('username', onCopyUsername);
              }}
              title="Copy username"
            >
              {justCopied === 'username' ? '✓' : '👤'}
            </button>
          )}
        </div>
      )}

      {/* Archived badge */}
      {entry.archived && (
        <div className="archived-badge">
          Archived
        </div>
      )}

      <style jsx>{`
        .password-card {
          position: relative;
          background: linear-gradient(135deg, #ffffff 0%, #fafbfc 100%);
          border: 2px solid #e5e7eb;
          border-radius: 20px;
          padding: 20px;
          cursor: ${onClick ? 'pointer' : 'default'};
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          flex-direction: column;
          gap: 14px;
          height: 100%;
          min-height: 200px;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(0, 0, 0, 0.03);
        }

        .password-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
          background: linear-gradient(90deg, #667eea 0%, #764ba2 50%, #667eea 100%);
          background-size: 200% 100%;
          opacity: 0;
          transition: opacity 0.4s ease;
          animation: shimmer 3s linear infinite;
        }

        @keyframes shimmer {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }

        .password-card:hover {
          transform: translateY(-6px) scale(1.01);
          box-shadow: 0 16px 32px rgba(102, 126, 234, 0.15), 0 0 0 2px rgba(102, 126, 234, 0.1);
          border-color: #667eea;
          background: white;
        }

        .password-card:hover::before {
          opacity: 1;
        }

        .password-card:focus {
          outline: none;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3);
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .type-icon {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          transition: all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
          position: relative;
        }

        .type-icon::after {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 14px;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.6) 0%, transparent 100%);
          pointer-events: none;
        }

        .password-card:hover .type-icon {
          transform: scale(1.15) rotate(-5deg);
        }

        .favorite-btn {
          background: transparent;
          border: none;
          font-size: 20px;
          cursor: pointer;
          color: #d1d5db;
          transition: all 0.2s;
          padding: 4px;
          line-height: 1;
        }

        .favorite-btn:hover {
          transform: scale(1.2);
        }

        .favorite-btn.active {
          color: #f59e0b;
        }

        .card-title {
          margin: 0;
          font-size: 17px;
          font-weight: 700;
          color: #111827;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          line-height: 1.4;
          min-height: 48px;
          letter-spacing: -0.02em;
          transition: color 0.3s ease;
        }

        .password-card:hover .card-title {
          color: #667eea;
        }

        .card-details {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .detail-row {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .detail-label {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #9ca3af;
          font-weight: 600;
        }

        .detail-value {
          font-size: 13px;
          color: #4b5563;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .card-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 8px;
          border-top: 1px solid #f3f4f6;
        }

        .last-modified {
          font-size: 11px;
          color: #9ca3af;
        }

        .health-indicator {
          width: 60px;
          height: 4px;
          background: #e5e7eb;
          border-radius: 2px;
          overflow: hidden;
        }

        .health-bar {
          height: 100%;
          transition: width 0.3s ease;
          border-radius: 2px;
        }

        .quick-actions {
          position: absolute;
          top: 16px;
          right: 16px;
          display: flex;
          gap: 8px;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(8px);
          padding: 8px;
          border-radius: 12px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05);
          animation: slideDown 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-12px) scale(0.9);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .quick-action {
          width: 36px;
          height: 36px;
          border: none;
          background: linear-gradient(135deg, #f8f9fa 0%, #f3f4f6 100%);
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 15px;
          transition: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
        }

        .quick-action:hover {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          transform: scale(1.15) rotate(-5deg);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }

        .quick-action:active {
          transform: scale(1.05);
        }

        .archived-badge {
          position: absolute;
          top: -8px;
          left: 50%;
          transform: translateX(-50%);
          background: #fbbf24;
          color: white;
          font-size: 10px;
          font-weight: 700;
          padding: 4px 12px;
          border-radius: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        @media (max-width: 640px) {
          .password-card {
            min-height: 160px;
          }

          .card-title {
            font-size: 15px;
          }

          .quick-actions {
            position: static;
            margin-top: 8px;
            justify-content: flex-end;
          }
        }
      `}</style>
    </div>
  );
}
