/**
 * Dashboard Widgets System
 *
 * Provides data aggregation functions for dashboard widgets
 */

import { PasswordEntry } from '../sdk/src/types-v2';
import { checkPasswordStrength } from '../sdk/src/utils';
import { getActivityLogs, ActivityLog, ActivityType } from './activity-logger';

export interface SecurityScoreBreakdown {
  strongPasswordCount: number;
  weakPasswordCount: number;
  reusedPasswordCount: number;
  totalScore: number;
}

export interface SecurityScoreWidgetData {
  score: number;
  grade: string;
  trend: 'up' | 'down' | 'stable';
  breakdown: SecurityScoreBreakdown;
}

export interface RecentActivityWidgetData {
  activities: ActivityLog[];
  totalToday: number;
}

export interface WeakPasswordsWidgetData {
  weakPasswords: Array<{
    id: number;
    title: string;
    strength: number;
    url?: string;
  }>;
  count: number;
}

export interface StatisticsWidgetData {
  totalEntries: number;
  favoriteCount: number;
  weakCount: number;
  strongCount: number;
}

export function getSecurityScoreData(entries: PasswordEntry[]): SecurityScoreWidgetData {
  let strongCount = 0;
  let weakCount = 0;
  let passwordMap = new Map<string, number>();

  for (const entry of entries) {
    if (entry.type === 'login' && entry.password) {
      const strength = checkPasswordStrength(entry.password);
      if (strength.score <= 2) {
        weakCount++;
      } else if (strength.score >= 3) {
        strongCount++;
      }

      const count = passwordMap.get(entry.password) || 0;
      passwordMap.set(entry.password, count + 1);
    }
  }

  const reusedCount = Array.from(passwordMap.values()).filter(count => count > 1).length;

  // Calculate score: 100 - (weakCount * 10) - (reusedCount * 15)
  const score = Math.max(0, Math.min(100, 100 - (weakCount * 10) - (reusedCount * 15)));

  let grade = 'F';
  if (score >= 90) grade = 'A';
  else if (score >= 80) grade = 'B';
  else if (score >= 70) grade = 'C';
  else if (score >= 60) grade = 'D';

  const trend = weakCount === 0 ? 'up' : weakCount > 5 ? 'down' : 'stable';

  return {
    score,
    grade,
    trend,
    breakdown: {
      strongPasswordCount: strongCount,
      weakPasswordCount: weakCount,
      reusedPasswordCount: reusedCount,
      totalScore: score,
    },
  };
}

export function getRecentActivityData(limit: number = 5): RecentActivityWidgetData {
  const allActivities = getActivityLogs();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayActivities = allActivities.filter(a => {
    const activityDate = new Date(a.timestamp);
    activityDate.setHours(0, 0, 0, 0);
    return activityDate.getTime() === today.getTime();
  });

  return {
    activities: allActivities.slice(0, limit),
    totalToday: todayActivities.length,
  };
}

export function getWeakPasswordsData(
  entries: PasswordEntry[],
  limit: number = 5
): WeakPasswordsWidgetData {
  const weakPasswords: Array<{
    id: number;
    title: string;
    strength: number;
    url?: string;
  }> = [];

  for (const entry of entries) {
    if (entry.type === 'login' && entry.password && entry.id !== undefined) {
      const strength = checkPasswordStrength(entry.password);
      if (strength.score <= 2) {
        weakPasswords.push({
          id: entry.id,
          title: entry.title,
          strength: strength.score,
          url: entry.url,
        });
      }
    }
  }

  weakPasswords.sort((a, b) => a.strength - b.strength);

  return {
    weakPasswords: weakPasswords.slice(0, limit),
    count: weakPasswords.length,
  };
}

export function getStatisticsData(entries: PasswordEntry[]): StatisticsWidgetData {
  let weakCount = 0;
  let strongCount = 0;

  for (const entry of entries) {
    if (entry.type === 'login' && entry.password) {
      const strength = checkPasswordStrength(entry.password);
      if (strength.score <= 2) {
        weakCount++;
      } else if (strength.score >= 3) {
        strongCount++;
      }
    }
  }

  return {
    totalEntries: entries.length,
    favoriteCount: entries.filter(e => e.favorite).length,
    weakCount,
    strongCount,
  };
}

export function getActivityIcon(type: ActivityType): string {
  switch (type) {
    case ActivityType.ACCESS:
      return '\u{1F441}';
    case ActivityType.CREATE:
      return '\u{2795}';
    case ActivityType.UPDATE:
      return '\u{270F}';
    case ActivityType.DELETE:
      return '\u{1F5D1}';
    case ActivityType.COPY:
      return '\u{1F4CB}';
    case ActivityType.EXPORT:
      return '\u{1F4E4}';
    case ActivityType.IMPORT:
      return '\u{1F4E5}';
    case ActivityType.FAVORITE:
      return '\u{2B50}';
    case ActivityType.UNFAVORITE:
      return '\u{2606}';
    case ActivityType.TAG:
      return '\u{1F3F7}';
    case ActivityType.UNTAG:
      return '\u{1F3F7}';
    case ActivityType.ROTATION:
      return '\u{1F504}';
    case ActivityType.BREACH:
      return '\u{26A0}';
    case ActivityType.TOTP:
      return '\u{1F510}';
    case ActivityType.BACKUP:
      return '\u{1F4BE}';
    case ActivityType.RESTORE:
      return '\u{267B}';
    case ActivityType.SETTINGS:
      return '\u{2699}';
    default:
      return '\u{1F4CC}';
  }
}

export function getStrengthColor(score: number): string {
  if (score === 0) return '#dc2626';
  if (score === 1) return '#ea580c';
  if (score === 2) return '#ca8a04';
  if (score === 3) return '#16a34a';
  return '#059669';
}

export function getStrengthLabel(score: number): string {
  if (score === 0) return 'Very Weak';
  if (score === 1) return 'Weak';
  if (score === 2) return 'Fair';
  if (score === 3) return 'Strong';
  return 'Very Strong';
}

export function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}
