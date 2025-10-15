'use client';

import React from 'react';
import { PasswordHealth, PasswordStrength } from '../../lib/password-health-analyzer';

/**
 * PasswordHealthCard Component
 *
 * Displays password health metrics in a compact card:
 * - Strength indicator with color coding
 * - Entropy score
 * - Issues and warnings
 * - Actionable recommendations
 * - Visual progress bars
 */

export interface PasswordHealthCardProps {
  title: string;
  health: PasswordHealth;
  onClick?: () => void;
  className?: string;
  compact?: boolean;
}

const STRENGTH_LABELS: Record<PasswordStrength, string> = {
  [PasswordStrength.VeryWeak]: 'Very Weak',
  [PasswordStrength.Weak]: 'Weak',
  [PasswordStrength.Fair]: 'Fair',
  [PasswordStrength.Strong]: 'Strong',
  [PasswordStrength.VeryStrong]: 'Very Strong',
};

const STRENGTH_COLORS: Record<PasswordStrength, { bg: string; text: string; bar: string }> = {
  [PasswordStrength.VeryWeak]: { bg: '#fef2f2', text: '#991b1b', bar: '#dc2626' },
  [PasswordStrength.Weak]: { bg: '#fef3c7', text: '#92400e', bar: '#f59e0b' },
  [PasswordStrength.Fair]: { bg: '#dbeafe', text: '#1e40af', bar: '#3b82f6' },
  [PasswordStrength.Strong]: { bg: '#d1fae5', text: '#065f46', bar: '#10b981' },
  [PasswordStrength.VeryStrong]: { bg: '#d1fae5', text: '#065f46', bar: '#059669' },
};

export function PasswordHealthCard({
  title,
  health,
  onClick,
  className = '',
  compact = false,
}: PasswordHealthCardProps) {
  const strengthConfig = STRENGTH_COLORS[health.strength];
  const strengthLabel = STRENGTH_LABELS[health.strength];

  // Calculate percentage for progress bar (0-5 scale to 0-100)
  const strengthPercentage = (health.strength / 4) * 100;

  // Priority issues (show max 3 in compact mode)
  const displayedRecommendations = compact
    ? health.recommendations.slice(0, 3)
    : health.recommendations;

  return (
    <div
      className={`password-health-card ${onClick ? 'clickable' : ''} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="card-header">
        <h3 className="card-title">{title}</h3>
        <div
          className="strength-badge"
          style={{
            background: strengthConfig.bg,
            color: strengthConfig.text,
          }}
        >
          {strengthLabel}
        </div>
      </div>

      {/* Strength Progress Bar */}
      <div className="strength-bar-container">
        <div className="strength-bar-bg">
          <div
            className="strength-bar-fill"
            style={{
              width: `${strengthPercentage}%`,
              background: strengthConfig.bar,
            }}
          />
        </div>
        <span className="strength-percentage">{Math.round(strengthPercentage)}%</span>
      </div>

      {/* Metrics Grid */}
      {!compact && (
        <div className="metrics-grid">
          <div className="metric">
            <span className="metric-label">Entropy</span>
            <span className="metric-value">{health.entropy.toFixed(1)} bits</span>
          </div>
          {health.age !== undefined && (
            <div className="metric">
              <span className="metric-label">Age</span>
              <span className="metric-value">{health.age} days</span>
            </div>
          )}
        </div>
      )}

      {/* Warnings */}
      {(health.isCommon || health.isReused || health.isOld) && (
        <div className="warnings">
          {health.isCommon && (
            <div className="warning-badge common">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z" />
                <path d="M11 7h2v6h-2z" fill="#fff" />
                <circle cx="12" cy="16" r="1" fill="#fff" />
              </svg>
              Common
            </div>
          )}
          {health.isReused && (
            <div className="warning-badge reused">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h2v-2h-2v2zm0-4h2V7h-2v6z" />
              </svg>
              Reused
            </div>
          )}
          {health.isOld && (
            <div className="warning-badge old">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" stroke="#fff" strokeWidth="2" fill="none" />
              </svg>
              Old (90+ days)
            </div>
          )}
        </div>
      )}

      {/* Recommendations */}
      {displayedRecommendations.length > 0 && (
        <div className="recommendations">
          <h4>Recommendations</h4>
          <ul>
            {displayedRecommendations.map((rec, idx) => (
              <li key={idx}>{rec}</li>
            ))}
          </ul>
          {compact && health.recommendations.length > 3 && (
            <span className="more-recommendations">
              +{health.recommendations.length - 3} more
            </span>
          )}
        </div>
      )}

      <style jsx>{`
        .password-health-card {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 16px;
          transition: all 0.2s;
        }

        .password-health-card.clickable {
          cursor: pointer;
        }

        .password-health-card.clickable:hover {
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          transform: translateY(-2px);
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .card-title {
          margin: 0;
          font-size: 15px;
          font-weight: 600;
          color: #111827;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          flex: 1;
          margin-right: 8px;
        }

        .strength-badge {
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          white-space: nowrap;
        }

        .strength-bar-container {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
        }

        .strength-bar-bg {
          flex: 1;
          height: 8px;
          background: #e5e7eb;
          border-radius: 4px;
          overflow: hidden;
        }

        .strength-bar-fill {
          height: 100%;
          transition: width 0.3s ease;
          border-radius: 4px;
        }

        .strength-percentage {
          font-size: 12px;
          font-weight: 600;
          color: #6b7280;
          min-width: 40px;
          text-align: right;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
          gap: 12px;
          margin-bottom: 12px;
          padding-bottom: 12px;
          border-bottom: 1px solid #f3f4f6;
        }

        .metric {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .metric-label {
          font-size: 11px;
          color: #9ca3af;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          font-weight: 500;
        }

        .metric-value {
          font-size: 14px;
          font-weight: 600;
          color: #374151;
        }

        .warnings {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 12px;
        }

        .warning-badge {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
        }

        .warning-badge svg {
          width: 14px;
          height: 14px;
        }

        .warning-badge.common {
          background: #fef2f2;
          color: #991b1b;
        }

        .warning-badge.reused {
          background: #fff7ed;
          color: #9a3412;
        }

        .warning-badge.old {
          background: #fef3c7;
          color: #92400e;
        }

        .recommendations {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid #f3f4f6;
        }

        .recommendations h4 {
          margin: 0 0 8px 0;
          font-size: 12px;
          font-weight: 600;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .recommendations ul {
          margin: 0;
          padding-left: 20px;
          list-style: disc;
        }

        .recommendations li {
          font-size: 13px;
          color: #4b5563;
          margin-bottom: 4px;
          line-height: 1.5;
        }

        .more-recommendations {
          display: inline-block;
          margin-top: 4px;
          font-size: 12px;
          color: #667eea;
          font-weight: 500;
        }

        @media (max-width: 640px) {
          .card-title {
            font-size: 14px;
          }

          .metrics-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
