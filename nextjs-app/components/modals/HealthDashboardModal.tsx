'use client';

import React, { useMemo, useState } from 'react';
import {
  PasswordHealthAnalyzer,
  PasswordHealth,
  PasswordSecurityAnalysis,
  type PasswordEntryForAnalysis,
} from '../../lib/password-health';

interface HealthDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: PasswordEntryForAnalysis[];
  onEditEntry?: (entryId: number) => void;
}

export function HealthDashboardModal({
  isOpen,
  onClose,
  entries,
  onEditEntry,
}: HealthDashboardModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'critical'>('overview');

  const healthData = useMemo(() => {
    if (entries.length === 0) return null;
    return PasswordHealthAnalyzer.analyze(entries);
  }, [entries]);

  const criticalPasswords = useMemo(() => {
    if (entries.length === 0) return [];
    return PasswordHealthAnalyzer.getCriticalPasswords(entries, 10);
  }, [entries]);

  const getScoreColor = (score: number): string => {
    if (score >= 80) return '#27ae60';
    if (score >= 60) return '#2ecc71';
    if (score >= 40) return '#f39c12';
    if (score >= 20) return '#e67e22';
    return '#e74c3c';
  };

  const getScoreLabel = (score: number): string => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    if (score >= 20) return 'Poor';
    return 'Critical';
  };

  const getStrengthLabel = (score: number): string => {
    if (score <= 1) return 'Very Weak';
    if (score === 2) return 'Weak';
    if (score === 3) return 'Fair';
    if (score === 4) return 'Strong';
    return 'Very Strong';
  };

  if (!isOpen) return null;

  if (entries.length === 0) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>Password Health Dashboard</h2>
            <button className="modal-close" onClick={onClose}>
              ×
            </button>
          </div>
          <div className="modal-body">
            <div className="empty-state">
              <div className="empty-icon">📊</div>
              <h3>No Passwords to Analyze</h3>
              <p>Add some password entries to see your vault health metrics.</p>
            </div>
          </div>
          <div className="modal-footer">
            <button onClick={onClose} className="btn-primary">
              Close
            </button>
          </div>
        </div>
        <style jsx>{`
          .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            padding: 1rem;
          }
          .modal-content {
            background: white;
            border-radius: 16px;
            width: 100%;
            max-width: 800px;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          }
          .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1.5rem;
            border-bottom: 1px solid #e1e8ed;
          }
          .modal-header h2 {
            margin: 0;
            color: #2c3e50;
            font-size: 1.5rem;
          }
          .modal-close {
            background: none;
            border: none;
            font-size: 2rem;
            color: #7f8c8d;
            cursor: pointer;
            line-height: 1;
            padding: 0;
            width: 32px;
            height: 32px;
          }
          .modal-body {
            padding: 1.5rem;
          }
          .empty-state {
            text-align: center;
            padding: 3rem 1rem;
          }
          .empty-icon {
            font-size: 4rem;
            margin-bottom: 1rem;
          }
          .empty-state h3 {
            color: #2c3e50;
            margin: 0 0 0.5rem 0;
          }
          .empty-state p {
            color: #7f8c8d;
            margin: 0;
          }
          .modal-footer {
            padding: 1.5rem;
            border-top: 1px solid #e1e8ed;
          }
          .btn-primary {
            width: 100%;
            padding: 0.875rem;
            border: none;
            border-radius: 8px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            background: #667eea;
            color: white;
            transition: all 0.2s;
          }
          .btn-primary:hover {
            background: #5568d3;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content health-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Password Health Dashboard</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="tabs">
          <button
            className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            📊 Overview
          </button>
          <button
            className={`tab ${activeTab === 'critical' ? 'active' : ''}`}
            onClick={() => setActiveTab('critical')}
          >
            ⚠️ Critical Issues ({criticalPasswords.length})
          </button>
        </div>

        <div className="modal-body">
          {activeTab === 'overview' && healthData && (
            <>
              {/* Overall Health Score */}
              <div className="health-score-card">
                <h3>Overall Health Score</h3>
                <div className="score-gauge">
                  <svg viewBox="0 0 200 120" className="gauge-svg">
                    {/* Background arc */}
                    <path
                      d="M 20 100 A 80 80 0 0 1 180 100"
                      fill="none"
                      stroke="#e1e8ed"
                      strokeWidth="20"
                      strokeLinecap="round"
                    />
                    {/* Score arc */}
                    <path
                      d="M 20 100 A 80 80 0 0 1 180 100"
                      fill="none"
                      stroke={getScoreColor(healthData.overallScore)}
                      strokeWidth="20"
                      strokeLinecap="round"
                      strokeDasharray={`${(healthData.overallScore / 100) * 251.2} 251.2`}
                      style={{ transition: 'all 0.5s ease' }}
                    />
                  </svg>
                  <div className="score-value" style={{ color: getScoreColor(healthData.overallScore) }}>
                    {healthData.overallScore}
                  </div>
                  <div className="score-label">{getScoreLabel(healthData.overallScore)}</div>
                </div>
              </div>

              {/* Statistics Grid */}
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon">🔐</div>
                  <div className="stat-value">{healthData.totalPasswords}</div>
                  <div className="stat-label">Total Passwords</div>
                </div>

                <div className="stat-card weak">
                  <div className="stat-icon">⚠️</div>
                  <div className="stat-value">{healthData.weakPasswords}</div>
                  <div className="stat-label">Weak Passwords</div>
                  <div className="stat-percentage">
                    {((healthData.weakPasswords / healthData.totalPasswords) * 100).toFixed(1)}%
                  </div>
                </div>

                <div className="stat-card reused">
                  <div className="stat-icon">🔄</div>
                  <div className="stat-value">{healthData.reusedPasswords}</div>
                  <div className="stat-label">Reused Passwords</div>
                  <div className="stat-percentage">
                    {((healthData.reusedPasswords / healthData.totalPasswords) * 100).toFixed(1)}%
                  </div>
                </div>

                <div className="stat-card old">
                  <div className="stat-icon">⏰</div>
                  <div className="stat-value">{healthData.oldPasswords}</div>
                  <div className="stat-label">Old Passwords (90+ days)</div>
                  <div className="stat-percentage">
                    {((healthData.oldPasswords / healthData.totalPasswords) * 100).toFixed(1)}%
                  </div>
                </div>
              </div>

              {/* Recommendations */}
              {healthData.recommendations.length > 0 && (
                <div className="recommendations-section">
                  <h3>Recommendations</h3>
                  <div className="recommendations-list">
                    {healthData.recommendations.map((rec, index) => (
                      <div key={index} className="recommendation-item">
                        <div className="rec-content">
                          {rec}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Security Summary */}
              <div className="security-summary">
                <h3>Security Summary</h3>
                <div className="summary-bars">
                  <div className="summary-bar-item">
                    <div className="summary-bar-label">
                      <span>Strong Passwords</span>
                      <span className="summary-bar-value">
                        {healthData.totalPasswords - healthData.weakPasswords}
                      </span>
                    </div>
                    <div className="summary-bar-track">
                      <div
                        className="summary-bar-fill strong"
                        style={{
                          width: `${((healthData.totalPasswords - healthData.weakPasswords) / healthData.totalPasswords) * 100}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="summary-bar-item">
                    <div className="summary-bar-label">
                      <span>Unique Passwords</span>
                      <span className="summary-bar-value">
                        {healthData.totalPasswords - healthData.reusedPasswords}
                      </span>
                    </div>
                    <div className="summary-bar-track">
                      <div
                        className="summary-bar-fill unique"
                        style={{
                          width: `${((healthData.totalPasswords - healthData.reusedPasswords) / healthData.totalPasswords) * 100}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="summary-bar-item">
                    <div className="summary-bar-label">
                      <span>Recently Updated</span>
                      <span className="summary-bar-value">
                        {healthData.totalPasswords - healthData.oldPasswords}
                      </span>
                    </div>
                    <div className="summary-bar-track">
                      <div
                        className="summary-bar-fill recent"
                        style={{
                          width: `${((healthData.totalPasswords - healthData.oldPasswords) / healthData.totalPasswords) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'critical' && (
            <div className="critical-section">
              {criticalPasswords.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">✅</div>
                  <h3>No Critical Issues</h3>
                  <p>Your passwords are in good shape! Keep up the good work.</p>
                </div>
              ) : (
                <>
                  <div className="critical-header">
                    <p>These passwords need your immediate attention</p>
                  </div>
                  <div className="critical-list">
                    {criticalPasswords.map((analysis) => {
                      const entry = entries.find((e) => e.id === analysis.entryId);
                      if (!entry) return null;

                      return (
                        <div key={analysis.entryId} className="critical-card">
                          <div className="critical-card-header">
                            <div className="critical-title">
                              <h4>{entry.title}</h4>
                              {entry.url && <span className="critical-url">{entry.url}</span>}
                            </div>
                            {onEditEntry && (
                              <button
                                className="btn-fix"
                                onClick={() => onEditEntry(typeof analysis.entryId === 'number' ? analysis.entryId : parseInt(String(analysis.entryId)))}
                              >
                                Fix
                              </button>
                            )}
                          </div>

                          <div className="critical-strength">
                            <div className="strength-bar-container">
                              <div
                                className={`strength-bar strength-${analysis.strengthScore}`}
                                style={{ width: `${(analysis.strengthScore / 5) * 100}%` }}
                              />
                            </div>
                            <span className="strength-text">
                              Strength: {getStrengthLabel(analysis.strengthScore)}
                            </span>
                          </div>

                          <div className="critical-issues">
                            {analysis.issues.map((issue, idx) => (
                              <div key={idx} className="issue-badge">
                                {issue.includes('Weak') && '⚠️ Weak'}
                                {issue.includes('reused') && '🔄 Reused'}
                                {issue.includes('old') && '⏰ Old'}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn-primary">
            Close
          </button>
        </div>

        <style jsx>{`
          .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            padding: 1rem;
          }

          .modal-content {
            background: white;
            border-radius: 16px;
            width: 100%;
            max-width: 900px;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          }

          .health-modal {
            max-width: 900px;
          }

          .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1.5rem;
            border-bottom: 1px solid #e1e8ed;
          }

          .modal-header h2 {
            margin: 0;
            color: #2c3e50;
            font-size: 1.5rem;
          }

          .modal-close {
            background: none;
            border: none;
            font-size: 2rem;
            color: #7f8c8d;
            cursor: pointer;
            line-height: 1;
            padding: 0;
            width: 32px;
            height: 32px;
          }

          .tabs {
            display: flex;
            border-bottom: 1px solid #e1e8ed;
          }

          .tab {
            flex: 1;
            padding: 1rem;
            background: none;
            border: none;
            border-bottom: 3px solid transparent;
            cursor: pointer;
            font-size: 1rem;
            font-weight: 600;
            color: #7f8c8d;
            transition: all 0.2s;
          }

          .tab:hover {
            background: #f8f9fa;
            color: #2c3e50;
          }

          .tab.active {
            color: #667eea;
            border-bottom-color: #667eea;
          }

          .modal-body {
            padding: 1.5rem;
          }

          .health-score-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 16px;
            padding: 2rem;
            text-align: center;
            color: white;
            margin-bottom: 1.5rem;
          }

          .health-score-card h3 {
            margin: 0 0 1.5rem 0;
            font-size: 1.2rem;
            opacity: 0.95;
          }

          .score-gauge {
            position: relative;
          }

          .gauge-svg {
            width: 200px;
            height: 120px;
            margin: 0 auto;
          }

          .score-value {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 3rem;
            font-weight: 700;
          }

          .score-label {
            margin-top: 0.5rem;
            font-size: 1.2rem;
            font-weight: 600;
            opacity: 0.95;
          }

          .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
            margin-bottom: 1.5rem;
          }

          .stat-card {
            background: white;
            border: 2px solid #e1e8ed;
            border-radius: 12px;
            padding: 1.5rem;
            text-align: center;
          }

          .stat-card.weak {
            border-color: #f39c12;
            background: #fffbf0;
          }

          .stat-card.reused {
            border-color: #e67e22;
            background: #fff5f0;
          }

          .stat-card.old {
            border-color: #95a5a6;
            background: #f8f9fa;
          }

          .stat-icon {
            font-size: 2rem;
            margin-bottom: 0.5rem;
          }

          .stat-value {
            font-size: 2.5rem;
            font-weight: 700;
            color: #2c3e50;
            margin-bottom: 0.25rem;
          }

          .stat-label {
            color: #7f8c8d;
            font-size: 0.9rem;
            margin-bottom: 0.5rem;
          }

          .stat-percentage {
            font-size: 0.85rem;
            font-weight: 600;
            color: #95a5a6;
          }

          .recommendations-section {
            background: #f8f9fa;
            border-radius: 12px;
            padding: 1.5rem;
            margin-bottom: 1.5rem;
          }

          .recommendations-section h3 {
            margin: 0 0 1rem 0;
            color: #2c3e50;
          }

          .recommendations-list {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
          }

          .recommendation-item {
            display: flex;
            background: white;
            padding: 1rem;
            border-radius: 8px;
            border-left: 4px solid #667eea;
          }

          .rec-content {
            flex: 1;
            color: #2c3e50;
            font-size: 0.95rem;
            line-height: 1.5;
          }

          .security-summary {
            background: white;
            border: 1px solid #e1e8ed;
            border-radius: 12px;
            padding: 1.5rem;
          }

          .security-summary h3 {
            margin: 0 0 1rem 0;
            color: #2c3e50;
          }

          .summary-bars {
            display: flex;
            flex-direction: column;
            gap: 1rem;
          }

          .summary-bar-item {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
          }

          .summary-bar-label {
            display: flex;
            justify-content: space-between;
            font-size: 0.9rem;
            color: #7f8c8d;
          }

          .summary-bar-value {
            font-weight: 600;
            color: #2c3e50;
          }

          .summary-bar-track {
            height: 8px;
            background: #e1e8ed;
            border-radius: 4px;
            overflow: hidden;
          }

          .summary-bar-fill {
            height: 100%;
            border-radius: 4px;
            transition: width 0.5s ease;
          }

          .summary-bar-fill.strong {
            background: #27ae60;
          }

          .summary-bar-fill.unique {
            background: #3498db;
          }

          .summary-bar-fill.recent {
            background: #667eea;
          }

          .critical-section {
            min-height: 200px;
          }

          .critical-header {
            margin-bottom: 1rem;
          }

          .critical-header p {
            color: #7f8c8d;
            margin: 0;
          }

          .critical-list {
            display: flex;
            flex-direction: column;
            gap: 1rem;
          }

          .critical-card {
            background: white;
            border: 2px solid #e74c3c;
            border-radius: 12px;
            padding: 1.5rem;
          }

          .critical-card-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 1rem;
          }

          .critical-title h4 {
            margin: 0 0 0.25rem 0;
            color: #2c3e50;
            font-size: 1.1rem;
          }

          .critical-url {
            font-size: 0.85rem;
            color: #7f8c8d;
          }

          .btn-fix {
            background: #667eea;
            color: white;
            border: none;
            border-radius: 6px;
            padding: 0.5rem 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
          }

          .btn-fix:hover {
            background: #5568d3;
            transform: translateY(-1px);
          }

          .critical-strength {
            margin-bottom: 1rem;
          }

          .strength-bar-container {
            height: 8px;
            background: #e1e8ed;
            border-radius: 4px;
            overflow: hidden;
            margin-bottom: 0.5rem;
          }

          .strength-bar {
            height: 100%;
            transition: all 0.3s;
            border-radius: 4px;
          }

          .strength-bar.strength-0,
          .strength-bar.strength-1 {
            background: #e74c3c;
          }

          .strength-bar.strength-2 {
            background: #f39c12;
          }

          .strength-bar.strength-3 {
            background: #f1c40f;
          }

          .strength-bar.strength-4 {
            background: #2ecc71;
          }

          .strength-bar.strength-5 {
            background: #27ae60;
          }

          .strength-text {
            font-size: 0.85rem;
            color: #7f8c8d;
          }

          .critical-issues {
            display: flex;
            flex-wrap: wrap;
            gap: 0.5rem;
            margin-bottom: 1rem;
          }

          .issue-badge {
            background: #fff3cd;
            color: #856404;
            padding: 0.25rem 0.75rem;
            border-radius: 12px;
            font-size: 0.85rem;
            font-weight: 600;
          }

          .empty-state {
            text-align: center;
            padding: 3rem 1rem;
          }

          .empty-icon {
            font-size: 4rem;
            margin-bottom: 1rem;
          }

          .empty-state h3 {
            color: #2c3e50;
            margin: 0 0 0.5rem 0;
          }

          .empty-state p {
            color: #7f8c8d;
            margin: 0;
          }

          .modal-footer {
            padding: 1.5rem;
            border-top: 1px solid #e1e8ed;
          }

          .btn-primary {
            width: 100%;
            padding: 0.875rem;
            border: none;
            border-radius: 8px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            background: #667eea;
            color: white;
            transition: all 0.2s;
          }

          .btn-primary:hover {
            background: #5568d3;
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
          }

          @media (max-width: 768px) {
            .modal-content {
              max-width: 100%;
              margin: 0.5rem;
            }

            .stats-grid {
              grid-template-columns: 1fr;
            }

            .score-value {
              font-size: 2.5rem;
            }

            .gauge-svg {
              width: 160px;
              height: 100px;
            }
          }
        `}</style>
      </div>
    </div>
  );
}
