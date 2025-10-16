/**
 * Activity Logger
 *
 * Comprehensive audit logging for all password manager operations.
 * Tracks access, modifications, deletions, and security events.
 *
 * Features:
 * - Automatic activity tracking
 * - Event categorization (access, modify, delete, security)
 * - Timeline visualization
 * - Search and filter capabilities
 * - Export to CSV
 * - Privacy-focused (no password content logged)
 *
 * @module activity-logger
 */

import { PasswordEntry } from '../sdk/src/types-v2';

export enum ActivityType {
  ACCESS = 'access',
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  COPY = 'copy',
  EXPORT = 'export',
  IMPORT = 'import',
  ARCHIVE = 'archive',
  UNARCHIVE = 'unarchive',
  FAVORITE = 'favorite',
  UNFAVORITE = 'unfavorite',
  CATEGORY_CHANGE = 'category_change',
  PASSWORD_CHANGE = 'password_change',
  TOTP_GENERATE = 'totp_generate',
  SECURITY = 'security',
  LOGIN = 'login',
  LOGOUT = 'logout',
}

export interface ActivityLog {
  id: string;
  timestamp: Date;
  type: ActivityType;
  entryId?: number;
  entryTitle?: string;
  description: string;
  metadata?: Record<string, any>;
  severity: 'info' | 'warning' | 'critical';
}

export interface ActivitySummary {
  totalActivities: number;
  todayActivities: number;
  weekActivities: number;
  monthActivities: number;
  mostAccessedEntry: { title: string; count: number } | null;
  recentActivity: ActivityLog | null;
  activityByType: Record<ActivityType, number>;
}

const STORAGE_KEY = 'lockbox_activity_log';
const MAX_LOGS = 1000; // Keep last 1000 activities

/**
 * Load all activity logs from localStorage
 */
function loadActivityLogs(): ActivityLog[] {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const logs = JSON.parse(stored);
    return logs.map((log: any) => ({
      ...log,
      timestamp: new Date(log.timestamp),
    }));
  } catch (err) {
    console.error('Failed to load activity logs:', err);
    return [];
  }
}

/**
 * Save activity logs to localStorage
 */
function saveActivityLogs(logs: ActivityLog[]): void {
  if (typeof window === 'undefined') return;

  try {
    // Keep only the last MAX_LOGS entries
    const trimmedLogs = logs.slice(0, MAX_LOGS);

    const serialized = trimmedLogs.map(log => ({
      ...log,
      timestamp: log.timestamp.toISOString(),
    }));

    localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
  } catch (err) {
    console.error('Failed to save activity logs:', err);
  }
}

/**
 * Log an activity
 */
export function logActivity(
  type: ActivityType,
  description: string,
  options?: {
    entryId?: number;
    entryTitle?: string;
    metadata?: Record<string, any>;
    severity?: 'info' | 'warning' | 'critical';
  }
): void {
  const logs = loadActivityLogs();

  const newLog: ActivityLog = {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date(),
    type,
    entryId: options?.entryId,
    entryTitle: options?.entryTitle,
    description,
    metadata: options?.metadata,
    severity: options?.severity || 'info',
  };

  logs.unshift(newLog);
  saveActivityLogs(logs);
}

/**
 * Get all activity logs
 */
export function getActivityLogs(): ActivityLog[] {
  return loadActivityLogs();
}

/**
 * Get activity logs filtered by criteria
 */
export function getFilteredActivityLogs(filters: {
  type?: ActivityType;
  entryId?: number;
  severity?: 'info' | 'warning' | 'critical';
  startDate?: Date;
  endDate?: Date;
  search?: string;
}): ActivityLog[] {
  let logs = loadActivityLogs();

  if (filters.type) {
    logs = logs.filter(log => log.type === filters.type);
  }

  if (filters.entryId !== undefined) {
    logs = logs.filter(log => log.entryId === filters.entryId);
  }

  if (filters.severity) {
    logs = logs.filter(log => log.severity === filters.severity);
  }

  if (filters.startDate) {
    logs = logs.filter(log => log.timestamp >= filters.startDate!);
  }

  if (filters.endDate) {
    logs = logs.filter(log => log.timestamp <= filters.endDate!);
  }

  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    logs = logs.filter(
      log =>
        log.description.toLowerCase().includes(searchLower) ||
        (log.entryTitle && log.entryTitle.toLowerCase().includes(searchLower))
    );
  }

  return logs;
}

/**
 * Get activity summary statistics
 */
export function getActivitySummary(): ActivitySummary {
  const logs = loadActivityLogs();

  if (logs.length === 0) {
    return {
      totalActivities: 0,
      todayActivities: 0,
      weekActivities: 0,
      monthActivities: 0,
      mostAccessedEntry: null,
      recentActivity: null,
      activityByType: {} as Record<ActivityType, number>,
    };
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const todayActivities = logs.filter(log => log.timestamp >= todayStart).length;
  const weekActivities = logs.filter(log => log.timestamp >= weekStart).length;
  const monthActivities = logs.filter(log => log.timestamp >= monthStart).length;

  // Count activities by type
  const activityByType: Record<string, number> = {};
  logs.forEach(log => {
    activityByType[log.type] = (activityByType[log.type] || 0) + 1;
  });

  // Find most accessed entry
  const entryAccessCounts: Record<string, { title: string; count: number }> = {};
  logs.forEach(log => {
    if (log.entryId && log.entryTitle && log.type === ActivityType.ACCESS) {
      const key = log.entryId.toString();
      if (!entryAccessCounts[key]) {
        entryAccessCounts[key] = { title: log.entryTitle, count: 0 };
      }
      entryAccessCounts[key].count++;
    }
  });

  let mostAccessedEntry: { title: string; count: number } | null = null;
  Object.values(entryAccessCounts).forEach(entry => {
    if (!mostAccessedEntry || entry.count > mostAccessedEntry.count) {
      mostAccessedEntry = entry;
    }
  });

  return {
    totalActivities: logs.length,
    todayActivities,
    weekActivities,
    monthActivities,
    mostAccessedEntry,
    recentActivity: logs[0] || null,
    activityByType: activityByType as Record<ActivityType, number>,
  };
}

/**
 * Get activity logs for a specific entry
 */
export function getEntryActivityLogs(entryId: number): ActivityLog[] {
  return getFilteredActivityLogs({ entryId });
}

/**
 * Clear all activity logs
 */
export function clearActivityLogs(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Clear old activity logs (older than specified days)
 */
export function clearOldActivityLogs(daysToKeep: number): void {
  const logs = loadActivityLogs();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  const filteredLogs = logs.filter(log => log.timestamp >= cutoffDate);
  saveActivityLogs(filteredLogs);
}

/**
 * Export activity logs as CSV
 */
export function exportActivityLogsCSV(): string {
  const logs = loadActivityLogs();

  let csv = 'Timestamp,Type,Entry Title,Description,Severity\n';

  logs.forEach(log => {
    const timestamp = log.timestamp.toISOString();
    const type = log.type;
    const entryTitle = log.entryTitle || 'N/A';
    const description = log.description.replace(/"/g, '""'); // Escape quotes
    const severity = log.severity;

    csv += `"${timestamp}","${type}","${entryTitle}","${description}","${severity}"\n`;
  });

  return csv;
}

/**
 * Get activity icon for type
 */
export function getActivityIcon(type: ActivityType): string {
  const icons: Record<ActivityType, string> = {
    [ActivityType.ACCESS]: '👁️',
    [ActivityType.CREATE]: '➕',
    [ActivityType.UPDATE]: '✏️',
    [ActivityType.DELETE]: '🗑️',
    [ActivityType.COPY]: '📋',
    [ActivityType.EXPORT]: '📤',
    [ActivityType.IMPORT]: '📥',
    [ActivityType.ARCHIVE]: '📦',
    [ActivityType.UNARCHIVE]: '📂',
    [ActivityType.FAVORITE]: '⭐',
    [ActivityType.UNFAVORITE]: '☆',
    [ActivityType.CATEGORY_CHANGE]: '🏷️',
    [ActivityType.PASSWORD_CHANGE]: '🔑',
    [ActivityType.TOTP_GENERATE]: '🔐',
    [ActivityType.SECURITY]: '🛡️',
    [ActivityType.LOGIN]: '🔓',
    [ActivityType.LOGOUT]: '🔒',
  };

  return icons[type] || '📝';
}

/**
 * Get severity color
 */
export function getSeverityColor(severity: 'info' | 'warning' | 'critical'): string {
  const colors = {
    info: '#3498db',
    warning: '#f39c12',
    critical: '#e74c3c',
  };

  return colors[severity];
}

/**
 * Get relative time string
 */
export function getRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  if (days < 7) return `${days} day${days !== 1 ? 's' : ''} ago`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return `${weeks} week${weeks !== 1 ? 's' : ''} ago`;
  }
  if (days < 365) {
    const months = Math.floor(days / 30);
    return `${months} month${months !== 1 ? 's' : ''} ago`;
  }

  const years = Math.floor(days / 365);
  return `${years} year${years !== 1 ? 's' : ''} ago`;
}

/**
 * Batch log activities
 */
export function batchLogActivity(
  activities: Array<{
    type: ActivityType;
    description: string;
    entryId?: number;
    entryTitle?: string;
  }>
): void {
  const logs = loadActivityLogs();

  activities.forEach(activity => {
    const newLog: ActivityLog = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      type: activity.type,
      entryId: activity.entryId,
      entryTitle: activity.entryTitle,
      description: activity.description,
      severity: 'info',
    };

    logs.unshift(newLog);
  });

  saveActivityLogs(logs);
}

/**
 * Get activity timeline grouped by date
 */
export function getActivityTimeline(): Record<string, ActivityLog[]> {
  const logs = loadActivityLogs();
  const timeline: Record<string, ActivityLog[]> = {};

  logs.forEach(log => {
    const dateKey = log.timestamp.toLocaleDateString();
    if (!timeline[dateKey]) {
      timeline[dateKey] = [];
    }
    timeline[dateKey].push(log);
  });

  return timeline;
}
