'use client';

import React, { useMemo } from 'react';
import { PasswordEntry } from '../../sdk/src/types-v2';
import {
  getSecurityScoreData,
  getRecentActivityData,
  getWeakPasswordsData,
  getStatisticsData,
  getActivityIcon,
  getStrengthColor,
  getStrengthLabel,
  formatTimeAgo,
} from '../../lib/dashboard-widgets';

interface DashboardProps {
  entries: PasswordEntry[];
  onEntryClick?: (entry: PasswordEntry) => void;
  onQuickAction?: (action: string) => void;
}

export function Dashboard({ entries, onEntryClick, onQuickAction }: DashboardProps) {
  const securityData = useMemo(() => getSecurityScoreData(entries), [entries]);
  const activityData = useMemo(() => getRecentActivityData(5), []);
  const weakPasswordsData = useMemo(() => getWeakPasswordsData(entries, 5), [entries]);
  const statsData = useMemo(() => getStatisticsData(entries), [entries]);

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div className="header-content">
          <h2>Dashboard</h2>
          <p className="dashboard-subtitle">Your security command center</p>
        </div>
        <div className="header-badge">
          <span className="badge-label">Total Entries</span>
          <span className="badge-value">{entries.length}</span>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Security Score Widget */}
        <div className="widget widget-large">
          <div className="widget-header">
            <h3>Security Score</h3>
            <span className={`score-badge score-${securityData.grade.toLowerCase()}`}>
              {securityData.grade}
            </span>
          </div>
          <div className="widget-body">
            <div className="score-display">
              <div className="score-value">{securityData.score}</div>
              <div className="score-max">/100</div>
            </div>
            <div className="score-breakdown">
              <div className="breakdown-item">
                <span className="breakdown-label">Strong Passwords</span>
                <span className="breakdown-value">{securityData.breakdown.strongPasswordCount}</span>
              </div>
              <div className="breakdown-item">
                <span className="breakdown-label">Weak Passwords</span>
                <span className="breakdown-value breakdown-warn">{securityData.breakdown.weakPasswordCount}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions Widget */}
        <div className="widget widget-medium">
          <div className="widget-header">
            <h3>Quick Actions</h3>
          </div>
          <div className="widget-body">
            <div className="quick-actions-grid">
              <button className="quick-action-btn" onClick={() => onQuickAction && onQuickAction('add')}>
                <span className="action-icon">+</span>
                <span className="action-label">Add Entry</span>
              </button>
              <button className="quick-action-btn" onClick={() => onQuickAction && onQuickAction('health')}>
                <span className="action-icon">d</span>
                <span className="action-label">Health Check</span>
              </button>
            </div>
          </div>
        </div>

        {/* Recent Activity Widget */}
        <div className="widget widget-medium">
          <div className="widget-header">
            <h3>Recent Activity</h3>
            <span className="activity-count">{activityData.totalToday} today</span>
          </div>
          <div className="widget-body">
            <div className="activity-list">
              {activityData.activities.length === 0 ? (
                <div className="empty-state">No recent activity</div>
              ) : (
                activityData.activities.map((activity, index) => (
                  <div key={`${activity.id}-${index}`} className="activity-item">
                    <span className="activity-icon">{getActivityIcon(activity.type)}</span>
                    <div className="activity-content">
                      <div className="activity-description">{activity.description}</div>
                      <div className="activity-time">{formatTimeAgo(activity.timestamp)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Weak Passwords Widget */}
        <div className="widget widget-medium">
          <div className="widget-header">
            <h3>Weak Passwords</h3>
            {weakPasswordsData.count > 0 && (
              <span className="alert-badge">{weakPasswordsData.count}</span>
            )}
          </div>
          <div className="widget-body">
            <div className="password-list">
              {weakPasswordsData.weakPasswords.length === 0 ? (
                <div className="empty-state success-state">
                  <div className="success-icon"></div>
                  <div>No weak passwords found!</div>
                </div>
              ) : (
                weakPasswordsData.weakPasswords.map(pwd => (
                  <div
                    key={pwd.id}
                    className="password-item"
                    onClick={() => {
                      const entry = entries.find(e => e.id === pwd.id);
                      if (entry && onEntryClick) onEntryClick(entry);
                    }}
                  >
                    <div className="password-info">
                      <div className="password-title">{pwd.title}</div>
                      {pwd.url && <div className="password-url">{pwd.url}</div>}
                    </div>
                    <div
                      className="strength-indicator"
                      style={{ backgroundColor: getStrengthColor(pwd.strength) }}
                    >
                      {getStrengthLabel(pwd.strength)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Statistics Widget */}
        <div className="widget widget-medium">
          <div className="widget-header">
            <h3>Statistics</h3>
          </div>
          <div className="widget-body">
            <div className="stats-grid">
              <div className="stat-item">
                <div className="stat-value">{statsData.totalEntries}</div>
                <div className="stat-label">Total Entries</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{statsData.favoriteCount}</div>
                <div className="stat-label">Favorites</div>
              </div>
              <div className="stat-item">
                <div className="stat-value stat-success">{statsData.strongCount}</div>
                <div className="stat-label">Strong</div>
              </div>
              <div className="stat-item">
                <div className="stat-value stat-danger">{statsData.weakCount}</div>
                <div className="stat-label">Weak</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .dashboard {
          padding: 2rem;
          max-width: 1400px;
          margin: 0 auto;
          animation: fadeIn 0.4s ease-out;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2.5rem;
          padding-bottom: 1.5rem;
          border-bottom: 2px solid #f3f4f6;
        }

        .header-content h2 {
          margin: 0;
          font-size: 2.25rem;
          font-weight: 800;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          letter-spacing: -0.03em;
          margin-bottom: 0.5rem;
        }

        .dashboard-subtitle {
          margin: 0;
          color: #6b7280;
          font-size: 1.125rem;
          font-weight: 500;
        }

        .header-badge {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 1rem 1.5rem;
          border-radius: 16px;
          box-shadow: 0 8px 24px rgba(102, 126, 234, 0.25);
        }

        .badge-label {
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: rgba(255, 255, 255, 0.8);
          font-weight: 600;
          margin-bottom: 0.25rem;
        }

        .badge-value {
          font-size: 2rem;
          font-weight: 800;
          color: white;
          line-height: 1;
        }

        .dashboard-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 1.5rem;
        }

        .widget-large {
          grid-column: span 2;
        }

        .widget {
          background: white;
          border-radius: 20px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06),
                      0 0 0 1px rgba(0, 0, 0, 0.04);
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          border: 1px solid transparent;
          position: relative;
        }

        .widget::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
          background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .widget:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 28px rgba(0, 0, 0, 0.12),
                      0 0 0 1px rgba(102, 126, 234, 0.1);
          border-color: rgba(102, 126, 234, 0.1);
        }

        .widget:hover::before {
          opacity: 1;
        }

        .widget-header {
          padding: 1.5rem;
          border-bottom: 1px solid #f3f4f6;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: linear-gradient(180deg, #fafbfc 0%, #ffffff 100%);
        }

        .widget-header h3 {
          margin: 0;
          font-size: 1.125rem;
          font-weight: 700;
          color: #1f2937;
          letter-spacing: -0.01em;
        }

        .widget-body {
          padding: 1.5rem;
        }

        .score-badge {
          padding: 0.25rem 0.75rem;
          border-radius: 20px;
          font-weight: 700;
          font-size: 0.875rem;
        }

        .score-badge.score-a { background: #d1fae5; color: #065f46; }
        .score-badge.score-b { background: #bfdbfe; color: #1e40af; }
        .score-badge.score-c { background: #fef3c7; color: #92400e; }
        .score-badge.score-d { background: #fed7aa; color: #9a3412; }
        .score-badge.score-f { background: #fee2e2; color: #991b1b; }

        .score-display {
          display: flex;
          align-items: baseline;
          gap: 0.5rem;
          margin-bottom: 2rem;
          position: relative;
        }

        .score-value {
          font-size: 4rem;
          font-weight: 800;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          line-height: 1;
          letter-spacing: -0.03em;
          animation: countUp 0.6s ease-out;
        }

        @keyframes countUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .score-max {
          font-size: 1.75rem;
          color: #9ca3af;
          font-weight: 600;
        }

        .score-breakdown {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .breakdown-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem;
          background: #f8f9fa;
          border-radius: 8px;
        }

        .breakdown-label {
          color: #7f8c8d;
          font-size: 0.875rem;
        }

        .breakdown-value {
          font-weight: 600;
          color: #2c3e50;
        }

        .breakdown-value.breakdown-warn {
          color: #dc2626;
        }

        .activity-count {
          padding: 0.25rem 0.75rem;
          background: #eff6ff;
          color: #1e40af;
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: 600;
        }

        .activity-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .activity-item {
          display: flex;
          gap: 0.75rem;
          align-items: flex-start;
        }

        .activity-icon {
          font-size: 1.25rem;
          flex-shrink: 0;
        }

        .activity-content {
          flex: 1;
          min-width: 0;
        }

        .activity-description {
          color: #2c3e50;
          font-size: 0.875rem;
          margin-bottom: 0.25rem;
        }

        .activity-time {
          color: #7f8c8d;
          font-size: 0.75rem;
        }

        .alert-badge {
          padding: 0.25rem 0.75rem;
          background: #fee2e2;
          color: #991b1b;
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: 700;
        }

        .password-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .password-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem;
          background: linear-gradient(135deg, #fafbfc 0%, #f8f9fa 100%);
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          border: 1px solid transparent;
          position: relative;
        }

        .password-item::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 3px;
          background: linear-gradient(180deg, #ef4444 0%, #dc2626 100%);
          border-radius: 12px 0 0 12px;
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .password-item:hover {
          background: white;
          border-color: rgba(239, 68, 68, 0.2);
          transform: translateX(4px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        }

        .password-item:hover::before {
          opacity: 1;
        }

        .password-info {
          flex: 1;
          min-width: 0;
        }

        .password-title {
          font-weight: 600;
          color: #2c3e50;
          margin-bottom: 0.25rem;
        }

        .password-url {
          color: #7f8c8d;
          font-size: 0.75rem;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .strength-indicator {
          padding: 0.25rem 0.75rem;
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: 600;
          color: white;
          flex-shrink: 0;
        }

        .quick-actions-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.75rem;
        }

        .quick-action-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
          padding: 1.5rem;
          background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
          border: 2px solid #e5e7eb;
          border-radius: 16px;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
        }

        .quick-action-btn::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .quick-action-btn:hover {
          border-color: #667eea;
          transform: translateY(-4px) scale(1.02);
          box-shadow: 0 8px 20px rgba(102, 126, 234, 0.2);
        }

        .quick-action-btn:hover::before {
          opacity: 0.05;
        }

        .action-icon {
          font-size: 2rem;
          position: relative;
          z-index: 1;
          transition: transform 0.3s ease;
        }

        .quick-action-btn:hover .action-icon {
          transform: scale(1.1);
        }

        .action-label {
          color: #1f2937;
          font-size: 0.875rem;
          font-weight: 700;
          position: relative;
          z-index: 1;
          letter-spacing: -0.01em;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1rem;
        }

        .stat-item {
          text-align: center;
          padding: 1.25rem;
          background: linear-gradient(135deg, #fafbfc 0%, #f8f9fa 100%);
          border-radius: 12px;
          border: 1px solid #e5e7eb;
          transition: all 0.3s ease;
        }

        .stat-item:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
          border-color: #d1d5db;
        }

        .stat-value {
          font-size: 2.25rem;
          font-weight: 800;
          color: #1f2937;
          margin-bottom: 0.5rem;
          line-height: 1;
          letter-spacing: -0.02em;
        }

        .stat-value.stat-success {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .stat-value.stat-danger {
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .stat-label {
          color: #6b7280;
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          font-weight: 700;
        }

        .empty-state {
          text-align: center;
          padding: 2rem 1rem;
          color: #7f8c8d;
        }

        .empty-state.success-state {
          color: #16a34a;
        }

        .success-icon {
          font-size: 2rem;
          margin-bottom: 0.5rem;
        }

        @media (max-width: 1024px) {
          .widget-large {
            grid-column: span 1;
          }
        }

        @media (max-width: 768px) {
          .dashboard-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 1rem;
          }

          .header-badge {
            align-self: stretch;
            align-items: center;
          }

          .features-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 640px) {
          .dashboard {
            padding: 1rem;
          }

          .header-content h2 {
            font-size: 1.875rem;
          }

          .dashboard-subtitle {
            font-size: 1rem;
          }

          .dashboard-grid {
            grid-template-columns: 1fr;
            gap: 1.25rem;
          }

          .widget-large {
            grid-column: span 1;
          }

          .score-value {
            font-size: 3rem;
          }

          .quick-actions-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .stat-value {
            font-size: 1.875rem;
          }
        }
      `}</style>
    </div>
  );
}
