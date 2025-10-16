'use client';

import React, { useMemo, useState } from 'react';
import {
  PasswordHealthAnalyzer,
  PasswordHealth,
  PasswordSecurityAnalysis,
  type PasswordEntryForAnalysis,
} from '../../lib/password-health';
import { PasswordHealthCard } from '../features/PasswordHealthCard';
import { analyzePasswordHealth } from '../../lib/password-health-analyzer';
import {
  generateHealthRecommendations,
  getPriorityColor,
  getPriorityIcon,
  getCategoryIcon,
  getSecurityGrade,
} from '../../lib/health-recommendations';

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
  const [activeTab, setActiveTab] = useState<'overview' | 'critical' | 'recommendations'>('overview');

  const healthData = useMemo(() => {
    if (entries.length === 0) return null;
    return PasswordHealthAnalyzer.analyze(entries);
  }, [entries]);

  const criticalPasswords = useMemo(() => {
    if (entries.length === 0) return [];
    return PasswordHealthAnalyzer.getCriticalPasswords(entries, 10);
  }, [entries]);

  const recommendations = useMemo(() => {
    if (entries.length === 0) return null;
    return generateHealthRecommendations(entries as any);
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
      <div className="health-dashboard-modal-overlay" onClick={onClose}>
        <div className="health-dashboard-modal-content" onClick={(e) => e.stopPropagation()}>
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
        <style jsx global>{`
          .health-dashboard-modal-overlay {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            background: rgba(0, 0, 0, 0.8) !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            z-index: 99999 !important;
            padding: 1rem !important;
          }
          .health-dashboard-modal-content {
            background: white !important;
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
    <div className="health-dashboard-modal-overlay" onClick={onClose}>
      <div className="health-dashboard-modal-content health-modal" onClick={(e) => e.stopPropagation()}>
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
          <button
            className={`tab ${activeTab === 'recommendations' ? 'active' : ''}`}
            onClick={() => setActiveTab('recommendations')}
          >
            💡 Recommendations {recommendations && `(${recommendations.summary.totalRecommendations})`}
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
                      if (!entry || !entry.password || !entry.title) return null;

                      // Build password map for reuse detection
                      const passwordMap = new Map<string, string[]>();
                      entries.forEach(e => {
                        const pwd = e.password;
                        if (pwd && typeof pwd === 'string' && e.title) {
                          const titles = passwordMap.get(pwd) || [];
                          titles.push(e.title);
                          passwordMap.set(pwd, titles);
                        }
                      });

                      // Convert to PasswordHealthDetails format
                      const healthDetails = analyzePasswordHealth(entry as any, passwordMap);

                      return (
                        <div key={analysis.entryId} className="critical-card-wrapper">
                          <PasswordHealthCard
                            title={entry.title}
                            health={healthDetails}
                            onClick={onEditEntry ? () => onEditEntry(typeof analysis.entryId === 'number' ? analysis.entryId : parseInt(String(analysis.entryId))) : undefined}
                          />
                          {entry.url && (
                            <div className="critical-url-badge">
                              <span className="url-icon">🔗</span>
                              <span className="url-text">{entry.url}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'recommendations' && recommendations && (
            <div className="recommendations-section">
              {/* Security Score Banner */}
              <div className="security-score-banner" style={{
                background: `linear-gradient(135deg, ${getSecurityGrade(recommendations.summary.securityScore).color} 0%, ${getSecurityGrade(recommendations.summary.securityScore).color}dd 100%)`,
                color: 'white'
              }}>
                <div className="score-grade">
                  <div className="grade-letter">{getSecurityGrade(recommendations.summary.securityScore).grade}</div>
                  <div className="grade-score">{recommendations.summary.securityScore}/100</div>
                </div>
                <div className="score-description">
                  <h3>{getSecurityGrade(recommendations.summary.securityScore).description}</h3>
                  <p>{recommendations.summary.totalRecommendations} recommendation{recommendations.summary.totalRecommendations !== 1 ? 's' : ''} • Est. {recommendations.summary.estimatedTimeMinutes} min</p>
                </div>
              </div>

              {/* Quick Summary Cards */}
              <div className="rec-summary-grid">
                {recommendations.summary.criticalCount > 0 && (
                  <div className="rec-summary-card critical">
                    <div className="card-icon">🚨</div>
                    <div className="card-content">
                      <div className="card-count">{recommendations.summary.criticalCount}</div>
                      <div className="card-label">Critical</div>
                    </div>
                  </div>
                )}
                {recommendations.summary.highCount > 0 && (
                  <div className="rec-summary-card high">
                    <div className="card-icon">⚠️</div>
                    <div className="card-content">
                      <div className="card-count">{recommendations.summary.highCount}</div>
                      <div className="card-label">High Priority</div>
                    </div>
                  </div>
                )}
                {recommendations.summary.mediumCount > 0 && (
                  <div className="rec-summary-card medium">
                    <div className="card-icon">⚡</div>
                    <div className="card-content">
                      <div className="card-count">{recommendations.summary.mediumCount}</div>
                      <div className="card-label">Medium</div>
                    </div>
                  </div>
                )}
                {recommendations.summary.quickWins > 0 && (
                  <div className="rec-summary-card quick-win">
                    <div className="card-icon">✨</div>
                    <div className="card-content">
                      <div className="card-count">{recommendations.summary.quickWins}</div>
                      <div className="card-label">Quick Wins</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Wins Section */}
              {recommendations.quickWins.length > 0 && (
                <div className="quick-wins-section">
                  <h3>⚡ Quick Wins - High Impact, Low Effort</h3>
                  <div className="recommendations-list">
                    {recommendations.quickWins.map((rec) => (
                      <div key={rec.id} className="recommendation-card quick-win-card">
                        <div className="rec-header">
                          <div className="rec-icon-badge" style={{ background: getPriorityColor(rec.priority) }}>
                            {getCategoryIcon(rec.category)}
                          </div>
                          <div className="rec-title-section">
                            <h4>{rec.title}</h4>
                            <div className="rec-meta">
                              <span className="rec-priority" style={{ color: getPriorityColor(rec.priority) }}>
                                {getPriorityIcon(rec.priority)} {rec.priority.toUpperCase()}
                              </span>
                              <span className="rec-effort">Effort: {rec.effort}</span>
                              <span className="rec-affected">{rec.affectedCount} {rec.affectedCount === 1 ? 'entry' : 'entries'}</span>
                            </div>
                          </div>
                        </div>
                        <p className="rec-description">{rec.description}</p>
                        <div className="rec-impact">
                          <strong>Impact:</strong> {rec.impact}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* All Recommendations */}
              <div className="all-recommendations-section">
                <h3>📋 All Recommendations</h3>
                {recommendations.recommendations.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">🎉</div>
                    <h3>Excellent Security!</h3>
                    <p>No recommendations at this time. Your vault is well-maintained.</p>
                  </div>
                ) : (
                  <div className="recommendations-list">
                    {recommendations.recommendations.map((rec) => (
                      <div key={rec.id} className={`recommendation-card priority-${rec.priority}`}>
                        <div className="rec-header">
                          <div className="rec-icon-badge" style={{ background: getPriorityColor(rec.priority) }}>
                            {getCategoryIcon(rec.category)}
                          </div>
                          <div className="rec-title-section">
                            <h4>{rec.title}</h4>
                            <div className="rec-meta">
                              <span className="rec-priority" style={{ color: getPriorityColor(rec.priority) }}>
                                {getPriorityIcon(rec.priority)} {rec.priority.toUpperCase()}
                              </span>
                              <span className="rec-effort">Effort: {rec.effort}</span>
                              {rec.affectedCount > 0 && (
                                <span className="rec-affected">{rec.affectedCount} {rec.affectedCount === 1 ? 'entry' : 'entries'}</span>
                              )}
                              {rec.quickWin && <span className="quick-win-badge">⚡ Quick Win</span>}
                            </div>
                          </div>
                        </div>
                        <p className="rec-description">{rec.description}</p>
                        <div className="rec-impact">
                          <strong>Impact:</strong> {rec.impact}
                        </div>
                        {rec.affectedEntries.length > 0 && onEditEntry && (
                          <div className="rec-actions">
                            <button
                              className="btn-view-affected"
                              onClick={() => {
                                // For now, just open the first affected entry
                                if (rec.affectedEntries[0]) {
                                  onEditEntry(rec.affectedEntries[0]);
                                }
                              }}
                            >
                              View Affected {rec.affectedCount === 1 ? 'Entry' : 'Entries'}
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn-primary">
            Close
          </button>
        </div>

        <style jsx global>{`
          .health-dashboard-modal-overlay {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            background: rgba(0, 0, 0, 0.8) !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            z-index: 99999 !important;
            padding: 1rem !important;
          }

          .health-dashboard-modal-content {
            background: white !important;
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

          .critical-card-wrapper {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
          }

          .critical-url-badge {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.5rem 0.75rem;
            background: #f8f9fa;
            border-radius: 6px;
            font-size: 0.875rem;
            color: #4a5568;
          }

          .url-icon {
            font-size: 1rem;
          }

          .url-text {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
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
            .health-dashboard-modal-content {
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

            .rec-summary-grid {
              grid-template-columns: 1fr;
            }

            .recommendation-card {
              padding: 1rem;
            }

            .rec-header {
              flex-direction: column;
              align-items: flex-start;
            }

            .rec-meta {
              flex-direction: column;
              align-items: flex-start;
              gap: 0.25rem;
            }
          }

          /* Recommendations Section Styles */
          .recommendations-section {
            display: flex;
            flex-direction: column;
            gap: 1.5rem;
          }

          .security-score-banner {
            padding: 2rem;
            border-radius: 12px;
            display: flex;
            align-items: center;
            gap: 2rem;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          }

          .score-grade {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 0.5rem;
          }

          .grade-letter {
            font-size: 4rem;
            font-weight: 800;
            line-height: 1;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          }

          .grade-score {
            font-size: 1.25rem;
            font-weight: 600;
            opacity: 0.9;
          }

          .score-description h3 {
            margin: 0 0 0.5rem 0;
            font-size: 1.5rem;
            font-weight: 700;
          }

          .score-description p {
            margin: 0;
            opacity: 0.9;
            font-size: 1rem;
          }

          .rec-summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 1rem;
          }

          .rec-summary-card {
            padding: 1.5rem;
            border-radius: 12px;
            display: flex;
            align-items: center;
            gap: 1rem;
            transition: transform 0.2s;
          }

          .rec-summary-card:hover {
            transform: translateY(-2px);
          }

          .rec-summary-card.critical {
            background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
            border: 2px solid #dc2626;
          }

          .rec-summary-card.high {
            background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
            border: 2px solid #f59e0b;
          }

          .rec-summary-card.medium {
            background: linear-gradient(135deg, #fefce8 0%, #fef9c3 100%);
            border: 2px solid #eab308;
          }

          .rec-summary-card.quick-win {
            background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
            border: 2px solid #3b82f6;
          }

          .rec-summary-card .card-icon {
            font-size: 2rem;
            line-height: 1;
          }

          .rec-summary-card .card-count {
            font-size: 2rem;
            font-weight: 700;
            color: #1f2937;
          }

          .rec-summary-card .card-label {
            font-size: 0.875rem;
            font-weight: 600;
            color: #6b7280;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          .quick-wins-section,
          .all-recommendations-section {
            display: flex;
            flex-direction: column;
            gap: 1rem;
          }

          .quick-wins-section h3,
          .all-recommendations-section h3 {
            margin: 0;
            font-size: 1.25rem;
            font-weight: 700;
            color: #1f2937;
          }

          .recommendations-list {
            display: flex;
            flex-direction: column;
            gap: 1rem;
          }

          .recommendation-card {
            padding: 1.5rem;
            border-radius: 12px;
            border: 2px solid #e5e7eb;
            background: white;
            transition: all 0.2s;
          }

          .recommendation-card:hover {
            border-color: #3b82f6;
            box-shadow: 0 4px 12px rgba(59, 130, 246, 0.1);
          }

          .recommendation-card.quick-win-card {
            background: linear-gradient(135deg, #f0f9ff 0%, #ffffff 100%);
            border-color: #3b82f6;
          }

          .recommendation-card.priority-critical {
            border-left: 4px solid #dc2626;
          }

          .recommendation-card.priority-high {
            border-left: 4px solid #f59e0b;
          }

          .recommendation-card.priority-medium {
            border-left: 4px solid #eab308;
          }

          .recommendation-card.priority-low {
            border-left: 4px solid #3b82f6;
          }

          .rec-header {
            display: flex;
            align-items: flex-start;
            gap: 1rem;
            margin-bottom: 1rem;
          }

          .rec-icon-badge {
            width: 48px;
            height: 48px;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.5rem;
            flex-shrink: 0;
          }

          .rec-title-section {
            flex: 1;
          }

          .rec-title-section h4 {
            margin: 0 0 0.5rem 0;
            font-size: 1.125rem;
            font-weight: 700;
            color: #1f2937;
          }

          .rec-meta {
            display: flex;
            flex-wrap: wrap;
            gap: 0.75rem;
            font-size: 0.875rem;
          }

          .rec-priority,
          .rec-effort,
          .rec-affected {
            font-weight: 600;
          }

          .quick-win-badge {
            padding: 0.25rem 0.5rem;
            background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
            color: white;
            border-radius: 4px;
            font-size: 0.75rem;
            font-weight: 700;
          }

          .rec-description {
            margin: 0 0 1rem 0;
            line-height: 1.6;
            color: #4b5563;
          }

          .rec-impact {
            padding: 0.75rem;
            background: #f9fafb;
            border-radius: 8px;
            font-size: 0.875rem;
            color: #374151;
            line-height: 1.5;
          }

          .rec-impact strong {
            color: #1f2937;
          }

          .rec-actions {
            margin-top: 1rem;
            display: flex;
            gap: 0.5rem;
          }

          .btn-view-affected {
            padding: 0.5rem 1rem;
            background: #3b82f6;
            color: white;
            border: none;
            border-radius: 6px;
            font-weight: 600;
            font-size: 0.875rem;
            cursor: pointer;
            transition: background 0.2s;
          }

          .btn-view-affected:hover {
            background: #2563eb;
          }
        `}</style>
      </div>
    </div>
  );
}
