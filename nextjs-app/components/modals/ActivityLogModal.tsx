'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  getActivityLogs,
  getFilteredActivityLogs,
  getActivitySummary,
  getActivityTimeline,
  exportActivityLogsCSV,
  clearActivityLogs,
  clearOldActivityLogs,
  getActivityIcon,
  getSeverityColor,
  getRelativeTime,
  ActivityType,
  ActivityLog,
  ActivitySummary,
} from '../../lib/activity-logger';
import { useToast } from '../ui/Toast';

interface ActivityLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialEntryId?: number; // Optional: filter to specific entry
}

export function ActivityLogModal({
  isOpen,
  onClose,
  initialEntryId,
}: ActivityLogModalProps) {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'timeline' | 'stats'>('timeline');
  const [filterType, setFilterType] = useState<ActivityType | 'all'>('all');
  const [filterSeverity, setFilterSeverity] = useState<'info' | 'warning' | 'critical' | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<'all' | 'today' | 'week' | 'month'>('all');

  // Load activity data
  const allLogs = useMemo(() => getActivityLogs(), [isOpen]);
  const summary = useMemo(() => getActivitySummary(), [isOpen]);

  // Apply filters
  const filteredLogs = useMemo(() => {
    const now = new Date();
    let startDate: Date | undefined;

    switch (dateRange) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
    }

    return getFilteredActivityLogs({
      type: filterType !== 'all' ? filterType : undefined,
      severity: filterSeverity !== 'all' ? filterSeverity : undefined,
      entryId: initialEntryId,
      startDate,
      search: searchQuery || undefined,
    });
  }, [filterType, filterSeverity, searchQuery, dateRange, initialEntryId, allLogs]);

  // Group logs by date
  const timeline = useMemo(() => {
    const grouped: Record<string, ActivityLog[]> = {};

    filteredLogs.forEach(log => {
      const dateKey = log.timestamp.toLocaleDateString();
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(log);
    });

    return grouped;
  }, [filteredLogs]);

  const handleExportCSV = () => {
    try {
      const csv = exportActivityLogsCSV();
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `activity-log-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast.showSuccess('Activity log exported to CSV');
    } catch (err) {
      toast.showError('Failed to export activity log');
    }
  };

  const handleClearOldLogs = () => {
    const confirmed = window.confirm(
      'Clear activity logs older than 90 days? This cannot be undone.'
    );

    if (!confirmed) return;

    clearOldActivityLogs(90);
    toast.showSuccess('Old activity logs cleared');
    window.location.reload(); // Reload to refresh data
  };

  const handleClearAllLogs = () => {
    const confirmed = window.confirm(
      'Clear ALL activity logs? This cannot be undone.'
    );

    if (!confirmed) return;

    clearActivityLogs();
    toast.showSuccess('All activity logs cleared');
    window.location.reload();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content activity-log-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📋 Activity Log</h2>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          {/* Tab Navigation */}
          <div className="tabs">
            <button
              className={`tab ${activeTab === 'timeline' ? 'active' : ''}`}
              onClick={() => setActiveTab('timeline')}
            >
              📅 Timeline
            </button>
            <button
              className={`tab ${activeTab === 'stats' ? 'active' : ''}`}
              onClick={() => setActiveTab('stats')}
            >
              📊 Statistics
            </button>
          </div>

          {/* Timeline Tab */}
          {activeTab === 'timeline' && (
            <>
              {/* Filters */}
              <div className="filters">
                <div className="filter-group">
                  <label>Date Range:</label>
                  <select value={dateRange} onChange={(e) => setDateRange(e.target.value as any)}>
                    <option value="all">All Time</option>
                    <option value="today">Today</option>
                    <option value="week">Last 7 Days</option>
                    <option value="month">This Month</option>
                  </select>
                </div>

                <div className="filter-group">
                  <label>Activity Type:</label>
                  <select value={filterType} onChange={(e) => setFilterType(e.target.value as any)}>
                    <option value="all">All Types</option>
                    {Object.values(ActivityType).map(type => (
                      <option key={type} value={type}>
                        {getActivityIcon(type)} {type.replace('_', ' ').toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="filter-group">
                  <label>Severity:</label>
                  <select value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value as any)}>
                    <option value="all">All</option>
                    <option value="info">Info</option>
                    <option value="warning">Warning</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>

                <div className="filter-group search-group">
                  <label>Search:</label>
                  <input
                    type="text"
                    placeholder="Search descriptions..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              {/* Activity Timeline */}
              <div className="activity-timeline">
                {Object.keys(timeline).length === 0 ? (
                  <div className="no-activities">
                    <p>No activities found matching your filters.</p>
                  </div>
                ) : (
                  Object.entries(timeline).map(([date, logs]) => (
                    <div key={date} className="timeline-day">
                      <div className="day-header">
                        <h3>{date}</h3>
                        <span className="day-count">{logs.length} activities</span>
                      </div>

                      <div className="day-activities">
                        {logs.map(log => (
                          <div
                            key={log.id}
                            className={`activity-item severity-${log.severity}`}
                            style={{
                              borderLeftColor: getSeverityColor(log.severity),
                            }}
                          >
                            <div className="activity-icon">
                              {getActivityIcon(log.type)}
                            </div>

                            <div className="activity-details">
                              <div className="activity-header">
                                <span className="activity-type">
                                  {log.type.replace('_', ' ').toUpperCase()}
                                </span>
                                {log.entryTitle && (
                                  <span className="activity-entry">
                                    {log.entryTitle}
                                  </span>
                                )}
                                <span className="activity-time">
                                  {getRelativeTime(log.timestamp)}
                                </span>
                              </div>

                              <p className="activity-description">
                                {log.description}
                              </p>

                              {log.metadata && Object.keys(log.metadata).length > 0 && (
                                <div className="activity-metadata">
                                  {Object.entries(log.metadata).map(([key, value]) => (
                                    <span key={key} className="metadata-item">
                                      <strong>{key}:</strong> {String(value)}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {/* Statistics Tab */}
          {activeTab === 'stats' && (
            <div className="stats-view">
              {/* Summary Cards */}
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon">📊</div>
                  <div className="stat-content">
                    <h4>Total Activities</h4>
                    <p className="stat-value">{summary.totalActivities}</p>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon">📅</div>
                  <div className="stat-content">
                    <h4>Today</h4>
                    <p className="stat-value">{summary.todayActivities}</p>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon">📆</div>
                  <div className="stat-content">
                    <h4>This Week</h4>
                    <p className="stat-value">{summary.weekActivities}</p>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon">📈</div>
                  <div className="stat-content">
                    <h4>This Month</h4>
                    <p className="stat-value">{summary.monthActivities}</p>
                  </div>
                </div>
              </div>

              {/* Most Accessed Entry */}
              {summary.mostAccessedEntry && (
                <div className="most-accessed">
                  <h3>Most Accessed Entry</h3>
                  <div className="accessed-card">
                    <span className="accessed-title">
                      {summary.mostAccessedEntry.title}
                    </span>
                    <span className="accessed-count">
                      {summary.mostAccessedEntry.count} times
                    </span>
                  </div>
                </div>
              )}

              {/* Activity Breakdown by Type */}
              <div className="activity-breakdown">
                <h3>Activity Breakdown</h3>
                <div className="breakdown-grid">
                  {Object.entries(summary.activityByType).map(([type, count]) => (
                    <div key={type} className="breakdown-item">
                      <span className="breakdown-icon">
                        {getActivityIcon(type as ActivityType)}
                      </span>
                      <span className="breakdown-type">
                        {type.replace('_', ' ')}
                      </span>
                      <span className="breakdown-count">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Activity */}
              {summary.recentActivity && (
                <div className="recent-activity">
                  <h3>Most Recent Activity</h3>
                  <div className="recent-card">
                    <div className="recent-icon">
                      {getActivityIcon(summary.recentActivity.type)}
                    </div>
                    <div className="recent-details">
                      <p className="recent-type">
                        {summary.recentActivity.type.replace('_', ' ').toUpperCase()}
                      </p>
                      <p className="recent-description">
                        {summary.recentActivity.description}
                      </p>
                      <p className="recent-time">
                        {getRelativeTime(summary.recentActivity.timestamp)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer activity-log-footer">
          <button onClick={handleExportCSV} className="btn-export">
            📥 Export CSV
          </button>
          <button onClick={handleClearOldLogs} className="btn-clear-old">
            🗑️ Clear Old Logs
          </button>
          <button onClick={handleClearAllLogs} className="btn-clear-all">
            ⚠️ Clear All
          </button>
          <button onClick={onClose} className="btn-close">
            Close
          </button>
        </div>

        <style jsx>{`
          .activity-log-modal {
            max-width: 900px;
            width: 95%;
            max-height: 90vh;
            display: flex;
            flex-direction: column;
          }

          .modal-body {
            overflow-y: auto;
            flex: 1;
          }

          .tabs {
            display: flex;
            gap: 0.5rem;
            margin-bottom: 1.5rem;
            border-bottom: 2px solid #e1e8ed;
          }

          .tab {
            padding: 0.75rem 1.5rem;
            background: none;
            border: none;
            cursor: pointer;
            font-size: 0.95rem;
            font-weight: 600;
            color: #7f8c8d;
            border-bottom: 3px solid transparent;
            transition: all 0.2s;
          }

          .tab:hover {
            color: #2c3e50;
          }

          .tab.active {
            color: #3498db;
            border-bottom-color: #3498db;
          }

          .filters {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
            margin-bottom: 1.5rem;
            padding: 1rem;
            background: #f8f9fa;
            border-radius: 8px;
          }

          .filter-group {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
          }

          .filter-group label {
            font-size: 0.85rem;
            font-weight: 600;
            color: #2c3e50;
          }

          .filter-group select,
          .filter-group input {
            padding: 0.5rem;
            border: 1px solid #e1e8ed;
            border-radius: 6px;
            font-size: 0.9rem;
            background: white;
          }

          .search-group {
            grid-column: span 2;
          }

          .activity-timeline {
            display: flex;
            flex-direction: column;
            gap: 2rem;
          }

          .timeline-day {
            border: 1px solid #e1e8ed;
            border-radius: 12px;
            overflow: hidden;
          }

          .day-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1rem 1.5rem;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
          }

          .day-header h3 {
            margin: 0;
            font-size: 1.1rem;
          }

          .day-count {
            font-size: 0.9rem;
            opacity: 0.9;
          }

          .day-activities {
            display: flex;
            flex-direction: column;
          }

          .activity-item {
            display: flex;
            gap: 1rem;
            padding: 1rem 1.5rem;
            border-left: 4px solid;
            border-bottom: 1px solid #e1e8ed;
            transition: background 0.2s;
          }

          .activity-item:last-child {
            border-bottom: none;
          }

          .activity-item:hover {
            background: #f8f9fa;
          }

          .activity-item.severity-critical {
            background: #fef5f5;
          }

          .activity-item.severity-warning {
            background: #fffbf0;
          }

          .activity-icon {
            font-size: 1.5rem;
            line-height: 1;
          }

          .activity-details {
            flex: 1;
          }

          .activity-header {
            display: flex;
            gap: 1rem;
            align-items: center;
            margin-bottom: 0.5rem;
          }

          .activity-type {
            font-size: 0.75rem;
            font-weight: 700;
            text-transform: uppercase;
            color: #3498db;
            letter-spacing: 0.5px;
          }

          .activity-entry {
            font-weight: 600;
            color: #2c3e50;
          }

          .activity-time {
            margin-left: auto;
            font-size: 0.85rem;
            color: #7f8c8d;
          }

          .activity-description {
            margin: 0 0 0.5rem 0;
            color: #34495e;
            line-height: 1.5;
          }

          .activity-metadata {
            display: flex;
            flex-wrap: wrap;
            gap: 0.75rem;
            margin-top: 0.5rem;
          }

          .metadata-item {
            font-size: 0.8rem;
            padding: 0.25rem 0.5rem;
            background: #e8f4f8;
            border-radius: 4px;
            color: #2c3e50;
          }

          .metadata-item strong {
            color: #3498db;
          }

          .no-activities {
            padding: 3rem;
            text-align: center;
            color: #7f8c8d;
          }

          .stats-view {
            display: flex;
            flex-direction: column;
            gap: 2rem;
          }

          .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
          }

          .stat-card {
            display: flex;
            align-items: center;
            gap: 1rem;
            padding: 1.5rem;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 12px;
            color: white;
          }

          .stat-icon {
            font-size: 2.5rem;
            line-height: 1;
          }

          .stat-content h4 {
            margin: 0 0 0.25rem 0;
            font-size: 0.9rem;
            opacity: 0.9;
          }

          .stat-value {
            margin: 0;
            font-size: 2rem;
            font-weight: 700;
          }

          .most-accessed,
          .activity-breakdown,
          .recent-activity {
            padding: 1.5rem;
            background: #f8f9fa;
            border-radius: 12px;
          }

          .most-accessed h3,
          .activity-breakdown h3,
          .recent-activity h3 {
            margin: 0 0 1rem 0;
            color: #2c3e50;
          }

          .accessed-card {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1rem;
            background: white;
            border-radius: 8px;
            border: 2px solid #3498db;
          }

          .accessed-title {
            font-weight: 600;
            color: #2c3e50;
          }

          .accessed-count {
            font-size: 1.25rem;
            font-weight: 700;
            color: #3498db;
          }

          .breakdown-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 0.75rem;
          }

          .breakdown-item {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            padding: 0.75rem;
            background: white;
            border-radius: 8px;
            border: 1px solid #e1e8ed;
          }

          .breakdown-icon {
            font-size: 1.5rem;
          }

          .breakdown-type {
            flex: 1;
            text-transform: capitalize;
            color: #2c3e50;
          }

          .breakdown-count {
            font-weight: 700;
            color: #3498db;
          }

          .recent-card {
            display: flex;
            gap: 1rem;
            padding: 1rem;
            background: white;
            border-radius: 8px;
            border: 1px solid #e1e8ed;
          }

          .recent-icon {
            font-size: 2rem;
          }

          .recent-details {
            flex: 1;
          }

          .recent-type {
            margin: 0 0 0.5rem 0;
            font-size: 0.85rem;
            font-weight: 700;
            color: #3498db;
          }

          .recent-description {
            margin: 0 0 0.5rem 0;
            color: #2c3e50;
          }

          .recent-time {
            margin: 0;
            font-size: 0.85rem;
            color: #7f8c8d;
          }

          .activity-log-footer {
            display: flex;
            gap: 0.75rem;
            flex-wrap: wrap;
          }

          .activity-log-footer button {
            padding: 0.75rem 1.25rem;
            border-radius: 6px;
            border: none;
            cursor: pointer;
            font-weight: 600;
            font-size: 0.9rem;
            transition: all 0.2s;
          }

          .btn-export {
            background: #3498db;
            color: white;
          }

          .btn-export:hover {
            background: #2980b9;
            transform: translateY(-1px);
          }

          .btn-clear-old {
            background: #95a5a6;
            color: white;
          }

          .btn-clear-old:hover {
            background: #7f8c8d;
          }

          .btn-clear-all {
            background: #e74c3c;
            color: white;
          }

          .btn-clear-all:hover {
            background: #c0392b;
          }

          .btn-close {
            background: #95a5a6;
            color: white;
            margin-left: auto;
          }

          .btn-close:hover {
            background: #7f8c8d;
          }

          @media (max-width: 768px) {
            .filters {
              grid-template-columns: 1fr;
            }

            .search-group {
              grid-column: span 1;
            }

            .stats-grid {
              grid-template-columns: 1fr;
            }

            .breakdown-grid {
              grid-template-columns: 1fr;
            }
          }
        `}</style>
      </div>
    </div>
  );
}
