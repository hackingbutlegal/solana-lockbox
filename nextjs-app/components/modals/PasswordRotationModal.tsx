'use client';

import React, { useState, useEffect } from 'react';
import { PasswordEntry } from '../../sdk/src/types-v2';
import {
  getRotationPolicy,
  saveRotationPolicy,
  getRotationSummary,
  getEntriesNeedingRotation,
  recordPasswordRotation,
  getRotationStatusMessage,
  getRotationBadgeColor,
  exportRotationReport,
  RotationPolicy,
  PasswordRotationStatus,
} from '../../lib/password-rotation-manager';
import { useToast } from '../ui/Toast';

interface PasswordRotationModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: PasswordEntry[];
  onEditEntry?: (entryId: number) => void;
}

export function PasswordRotationModal({
  isOpen,
  onClose,
  entries,
  onEditEntry,
}: PasswordRotationModalProps) {
  const toast = useToast();
  const [policy, setPolicy] = useState<RotationPolicy>(getRotationPolicy());
  const [showSettings, setShowSettings] = useState(false);
  const [includeWarnings, setIncludeWarnings] = useState(true);

  const summary = getRotationSummary(entries, policy);
  const needingRotation = getEntriesNeedingRotation(entries, includeWarnings, policy);

  const handleSavePolicy = () => {
    saveRotationPolicy(policy);
    toast.showSuccess('Rotation policy saved');
    setShowSettings(false);
  };

  const handleMarkRotated = (entryId: number, title: string) => {
    recordPasswordRotation(entryId, 'Manual mark as rotated');
    toast.showSuccess(`Marked "${title}" as rotated`);
    // Force re-render by updating policy (triggers recalculation)
    setPolicy({ ...policy });
  };

  const handleExportReport = () => {
    try {
      const csv = exportRotationReport(entries);
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `password-rotation-report-${Date.now()}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.showSuccess('Rotation report exported');
    } catch (err) {
      toast.showError('Failed to export report');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="rotation-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🔄 Password Rotation Manager</h2>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          {/* Summary Stats */}
          <div className="rotation-summary">
            <div className="summary-card total">
              <div className="card-icon">📊</div>
              <div className="card-content">
                <div className="card-value">{summary.total}</div>
                <div className="card-label">Total Passwords</div>
              </div>
            </div>

            <div className="summary-card critical">
              <div className="card-icon">🚨</div>
              <div className="card-content">
                <div className="card-value">{summary.critical}</div>
                <div className="card-label">Critical</div>
              </div>
            </div>

            <div className="summary-card overdue">
              <div className="card-icon">⚠️</div>
              <div className="card-content">
                <div className="card-value">{summary.overdue}</div>
                <div className="card-label">Overdue</div>
              </div>
            </div>

            <div className="summary-card warning">
              <div className="card-icon">⏰</div>
              <div className="card-content">
                <div className="card-value">{summary.warning}</div>
                <div className="card-label">Due Soon</div>
              </div>
            </div>

            <div className="summary-card good">
              <div className="card-icon">✅</div>
              <div className="card-content">
                <div className="card-value">{summary.upToDate}</div>
                <div className="card-label">Up to Date</div>
              </div>
            </div>
          </div>

          {/* Next Rotation Due */}
          {summary.nextRotationDue && (
            <div className="next-rotation-card">
              <div className="next-rotation-icon">📅</div>
              <div className="next-rotation-content">
                <h4>Next Rotation Due</h4>
                <p className="next-rotation-title">{summary.nextRotationDue.title}</p>
                <p className="next-rotation-date">
                  {summary.nextRotationDue.nextRotationDue.toLocaleDateString()} ({summary.nextRotationDue.daysUntilRotation} days)
                </p>
              </div>
            </div>
          )}

          {/* Settings Toggle */}
          <div className="rotation-controls">
            <button
              className="btn-settings"
              onClick={() => setShowSettings(!showSettings)}
            >
              ⚙️ {showSettings ? 'Hide' : 'Show'} Settings
            </button>
            <button className="btn-export" onClick={handleExportReport}>
              📥 Export Report
            </button>
            <label className="checkbox-inline">
              <input
                type="checkbox"
                checked={includeWarnings}
                onChange={(e) => setIncludeWarnings(e.target.checked)}
              />
              <span>Include warnings</span>
            </label>
          </div>

          {/* Settings Panel */}
          {showSettings && (
            <div className="settings-panel">
              <h3>Rotation Policy</h3>

              <div className="setting-group">
                <label>
                  <input
                    type="checkbox"
                    checked={policy.enabled}
                    onChange={(e) => setPolicy({ ...policy, enabled: e.target.checked })}
                  />
                  <span>Enable automatic rotation tracking</span>
                </label>
              </div>

              <div className="setting-group">
                <label>
                  Default rotation period (days):
                  <input
                    type="number"
                    min="30"
                    max="365"
                    value={policy.defaultDays}
                    onChange={(e) =>
                      setPolicy({ ...policy, defaultDays: parseInt(e.target.value) })
                    }
                    disabled={!policy.enabled}
                  />
                </label>
              </div>

              <div className="setting-group">
                <label>
                  Critical accounts rotation (days):
                  <input
                    type="number"
                    min="30"
                    max="180"
                    value={policy.criticalAccountsDays}
                    onChange={(e) =>
                      setPolicy({ ...policy, criticalAccountsDays: parseInt(e.target.value) })
                    }
                    disabled={!policy.enabled}
                  />
                </label>
                <p className="setting-hint">
                  Banks, financial accounts rotate more frequently
                </p>
              </div>

              <div className="setting-group">
                <label>
                  Warn days before expiration:
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={policy.warnDaysBefore}
                    onChange={(e) =>
                      setPolicy({ ...policy, warnDaysBefore: parseInt(e.target.value) })
                    }
                    disabled={!policy.enabled}
                  />
                </label>
              </div>

              <button className="btn-save-policy" onClick={handleSavePolicy}>
                💾 Save Policy
              </button>
            </div>
          )}

          {/* Passwords Needing Rotation */}
          <div className="rotation-list-container">
            <h3>
              Passwords Needing Rotation ({needingRotation.length})
            </h3>

            {needingRotation.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">✨</div>
                <p>All passwords are up to date!</p>
              </div>
            ) : (
              <div className="rotation-list">
                {needingRotation.map((status) => (
                  <div
                    key={status.entryId}
                    className={`rotation-item ${status.isCritical ? 'critical' : status.isOverdue ? 'overdue' : 'warning'}`}
                  >
                    <div className="item-header">
                      <div className="item-title">
                        <span className="title-text">{status.title}</span>
                        <span
                          className="status-badge"
                          style={{ backgroundColor: getRotationBadgeColor(status) }}
                        >
                          {getRotationStatusMessage(status)}
                        </span>
                      </div>
                    </div>

                    <div className="item-details">
                      <div className="detail-row">
                        <span className="detail-label">Last rotated:</span>
                        <span className="detail-value">
                          {status.lastRotated.toLocaleDateString()}
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Next due:</span>
                        <span className="detail-value">
                          {status.nextRotationDue.toLocaleDateString()}
                        </span>
                      </div>
                      {status.rotationHistory.length > 1 && (
                        <div className="detail-row">
                          <span className="detail-label">Rotation history:</span>
                          <span className="detail-value">
                            {status.rotationHistory.length} rotations
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="item-actions">
                      {onEditEntry && (
                        <button
                          className="btn-rotate"
                          onClick={() => onEditEntry(status.entryId)}
                        >
                          🔑 Change Password
                        </button>
                      )}
                      <button
                        className="btn-mark-rotated"
                        onClick={() => handleMarkRotated(status.entryId, status.title)}
                      >
                        ✓ Mark as Rotated
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn-close">
            Close
          </button>
        </div>

        <style jsx>{`
          .rotation-modal {
            max-width: 900px;
            width: 95%;
            max-height: 90vh;
            background: white;
            border-radius: 16px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
            display: flex;
            flex-direction: column;
          }

          .modal-body {
            padding: 1.5rem;
            overflow-y: auto;
            flex: 1;
          }

          .rotation-summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
            gap: 1rem;
            margin-bottom: 1.5rem;
          }

          .summary-card {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            padding: 1rem;
            border-radius: 12px;
            background: #f8f9fa;
            border: 2px solid #e1e8ed;
          }

          .summary-card.critical {
            background: linear-gradient(135deg, #ffe5e5 0%, #ffd5d5 100%);
            border-color: #c0392b;
          }

          .summary-card.overdue {
            background: linear-gradient(135deg, #fff3e5 0%, #ffe8d5 100%);
            border-color: #e74c3c;
          }

          .summary-card.warning {
            background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
            border-color: #f39c12;
          }

          .summary-card.good {
            background: linear-gradient(135deg, #e8f5e9 0%, #d4edda 100%);
            border-color: #27ae60;
          }

          .card-icon {
            font-size: 2rem;
            line-height: 1;
          }

          .card-value {
            font-size: 1.75rem;
            font-weight: 700;
            color: #2c3e50;
          }

          .card-label {
            font-size: 0.85rem;
            color: #7f8c8d;
            font-weight: 600;
          }

          .next-rotation-card {
            display: flex;
            gap: 1rem;
            padding: 1.25rem;
            background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
            border: 2px solid #2196f3;
            border-radius: 12px;
            margin-bottom: 1.5rem;
          }

          .next-rotation-icon {
            font-size: 2.5rem;
            line-height: 1;
          }

          .next-rotation-content h4 {
            margin: 0 0 0.5rem 0;
            color: #1565c0;
            font-size: 0.95rem;
            font-weight: 600;
          }

          .next-rotation-title {
            margin: 0 0 0.25rem 0;
            font-size: 1.1rem;
            font-weight: 600;
            color: #2c3e50;
          }

          .next-rotation-date {
            margin: 0;
            font-size: 0.9rem;
            color: #1565c0;
          }

          .rotation-controls {
            display: flex;
            gap: 1rem;
            align-items: center;
            margin-bottom: 1.5rem;
            flex-wrap: wrap;
          }

          .btn-settings,
          .btn-export {
            padding: 0.75rem 1.25rem;
            border-radius: 8px;
            border: none;
            cursor: pointer;
            font-weight: 600;
            font-size: 0.95rem;
            transition: all 0.2s;
          }

          .btn-settings {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
          }

          .btn-settings:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
          }

          .btn-export {
            background: #3498db;
            color: white;
          }

          .btn-export:hover {
            background: #2980b9;
            transform: translateY(-1px);
          }

          .checkbox-inline {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            cursor: pointer;
            font-size: 0.95rem;
            color: #2c3e50;
          }

          .checkbox-inline input {
            width: 18px;
            height: 18px;
            cursor: pointer;
          }

          .settings-panel {
            padding: 1.5rem;
            background: #f8f9fa;
            border-radius: 12px;
            margin-bottom: 1.5rem;
            border: 2px solid #e1e8ed;
          }

          .settings-panel h3 {
            margin: 0 0 1rem 0;
            color: #2c3e50;
            font-size: 1.1rem;
          }

          .setting-group {
            margin-bottom: 1.25rem;
          }

          .setting-group label {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            font-size: 0.95rem;
            color: #2c3e50;
          }

          .setting-group input[type="number"] {
            width: 100px;
            padding: 0.5rem;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            font-size: 0.95rem;
          }

          .setting-group input[type="checkbox"] {
            width: 18px;
            height: 18px;
            cursor: pointer;
          }

          .setting-hint {
            margin: 0.5rem 0 0 2rem;
            font-size: 0.85rem;
            color: #7f8c8d;
            font-style: italic;
          }

          .btn-save-policy {
            padding: 0.75rem 1.5rem;
            background: linear-gradient(135deg, #27ae60 0%, #229954 100%);
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
            font-size: 0.95rem;
            transition: all 0.2s;
          }

          .btn-save-policy:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(39, 174, 96, 0.3);
          }

          .rotation-list-container h3 {
            margin: 0 0 1rem 0;
            color: #2c3e50;
            font-size: 1.1rem;
          }

          .empty-state {
            text-align: center;
            padding: 3rem 1rem;
          }

          .empty-icon {
            font-size: 4rem;
            margin-bottom: 1rem;
          }

          .empty-state p {
            margin: 0;
            color: #7f8c8d;
            font-size: 1.1rem;
          }

          .rotation-list {
            display: flex;
            flex-direction: column;
            gap: 1rem;
          }

          .rotation-item {
            padding: 1.25rem;
            border-radius: 12px;
            background: white;
            border: 2px solid #e1e8ed;
          }

          .rotation-item.critical {
            border-color: #c0392b;
            background: linear-gradient(135deg, #fff5f5 0%, #ffe5e5 100%);
          }

          .rotation-item.overdue {
            border-color: #e74c3c;
            background: linear-gradient(135deg, #fffaf5 0%, #fff3e5 100%);
          }

          .rotation-item.warning {
            border-color: #f39c12;
            background: linear-gradient(135deg, #fffef5 0%, #fffbeb 100%);
          }

          .item-header {
            margin-bottom: 0.75rem;
          }

          .item-title {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            flex-wrap: wrap;
          }

          .title-text {
            font-size: 1.05rem;
            font-weight: 600;
            color: #2c3e50;
          }

          .status-badge {
            padding: 0.25rem 0.75rem;
            border-radius: 20px;
            font-size: 0.85rem;
            font-weight: 600;
            color: white;
          }

          .item-details {
            margin-bottom: 1rem;
          }

          .detail-row {
            display: flex;
            justify-content: space-between;
            padding: 0.5rem 0;
            border-bottom: 1px solid #e1e8ed;
          }

          .detail-row:last-child {
            border-bottom: none;
          }

          .detail-label {
            font-size: 0.9rem;
            color: #7f8c8d;
          }

          .detail-value {
            font-size: 0.9rem;
            font-weight: 600;
            color: #2c3e50;
          }

          .item-actions {
            display: flex;
            gap: 0.75rem;
            flex-wrap: wrap;
          }

          .btn-rotate,
          .btn-mark-rotated {
            padding: 0.6rem 1rem;
            border-radius: 6px;
            border: none;
            cursor: pointer;
            font-weight: 600;
            font-size: 0.9rem;
            transition: all 0.2s;
          }

          .btn-rotate {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
          }

          .btn-rotate:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
          }

          .btn-mark-rotated {
            background: #27ae60;
            color: white;
          }

          .btn-mark-rotated:hover {
            background: #229954;
            transform: translateY(-1px);
          }

          @media (max-width: 768px) {
            .rotation-summary {
              grid-template-columns: repeat(2, 1fr);
            }

            .rotation-modal {
              width: 100%;
              max-height: 95vh;
              border-radius: 16px 16px 0 0;
            }
          }
        `}</style>
      </div>
    </div>
  );
}
