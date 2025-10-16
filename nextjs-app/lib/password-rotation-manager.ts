/**
 * Password Rotation Manager
 *
 * Manages password rotation schedules, reminders, and tracking.
 * Helps users maintain good password hygiene by rotating passwords regularly.
 *
 * Features:
 * - Configurable rotation policies (30, 60, 90 days)
 * - Automatic expiration tracking
 * - Overdue password detection
 * - Rotation reminders
 * - Batch rotation operations
 * - Exemption management for special accounts
 *
 * @module password-rotation-manager
 */

import { PasswordEntry, isLoginEntry } from '../sdk/src/types-v2';

export interface RotationPolicy {
  enabled: boolean;
  defaultDays: number; // 30, 60, 90, or custom
  warnDaysBefore: number; // Days before expiration to warn
  criticalAccountsDays: number; // Shorter rotation for critical accounts (banks, etc.)
  exemptedCategories: number[]; // Categories exempt from rotation
}

export interface PasswordRotationStatus {
  entryId: number;
  title: string;
  lastRotated: Date;
  nextRotationDue: Date;
  daysUntilRotation: number;
  isOverdue: boolean;
  isCritical: boolean; // Overdue by more than 30 days
  isWarning: boolean; // Within warning period
  rotationHistory: RotationHistoryEntry[];
  isExempt: boolean;
}

export interface RotationHistoryEntry {
  rotatedAt: Date;
  reason?: string; // e.g., "Scheduled rotation", "Security breach", "User initiated"
}

export interface RotationSummary {
  total: number;
  upToDate: number;
  warning: number;
  overdue: number;
  critical: number;
  exempt: number;
  averageDaysSinceRotation: number;
  nextRotationDue?: PasswordRotationStatus;
}

const STORAGE_KEY = 'lockbox_rotation_data';
const DEFAULT_POLICY: RotationPolicy = {
  enabled: true,
  defaultDays: 90,
  warnDaysBefore: 14,
  criticalAccountsDays: 60,
  exemptedCategories: [],
};

/**
 * Get rotation policy from localStorage
 */
export function getRotationPolicy(): RotationPolicy {
  if (typeof window === 'undefined') return DEFAULT_POLICY;

  try {
    const stored = localStorage.getItem('lockbox_rotation_policy');
    if (!stored) return DEFAULT_POLICY;
    return { ...DEFAULT_POLICY, ...JSON.parse(stored) };
  } catch (err) {
    console.error('Failed to load rotation policy:', err);
    return DEFAULT_POLICY;
  }
}

/**
 * Save rotation policy to localStorage
 */
export function saveRotationPolicy(policy: RotationPolicy): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem('lockbox_rotation_policy', JSON.stringify(policy));
  } catch (err) {
    console.error('Failed to save rotation policy:', err);
  }
}

/**
 * Get rotation data for all entries
 */
function getRotationData(): Map<number, RotationHistoryEntry[]> {
  if (typeof window === 'undefined') return new Map();

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return new Map();

    const data = JSON.parse(stored);
    const map = new Map<number, RotationHistoryEntry[]>();

    // Convert stored data back to Map with Date objects
    Object.entries(data).forEach(([key, value]) => {
      const entries = (value as any[]).map((entry: any) => ({
        rotatedAt: new Date(entry.rotatedAt),
        reason: entry.reason,
      }));
      map.set(parseInt(key), entries);
    });

    return map;
  } catch (err) {
    console.error('Failed to load rotation data:', err);
    return new Map();
  }
}

/**
 * Save rotation data to localStorage
 */
function saveRotationData(data: Map<number, RotationHistoryEntry[]>): void {
  if (typeof window === 'undefined') return;

  try {
    // Convert Map to plain object for JSON serialization
    const obj: Record<number, any[]> = {};
    data.forEach((value, key) => {
      obj[key] = value.map(entry => ({
        rotatedAt: entry.rotatedAt.toISOString(),
        reason: entry.reason,
      }));
    });

    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch (err) {
    console.error('Failed to save rotation data:', err);
  }
}

/**
 * Record a password rotation
 */
export function recordPasswordRotation(
  entryId: number,
  reason?: string
): void {
  const data = getRotationData();
  const history = data.get(entryId) || [];

  history.unshift({
    rotatedAt: new Date(),
    reason: reason || 'User initiated',
  });

  // Keep only last 10 rotations
  if (history.length > 10) {
    history.splice(10);
  }

  data.set(entryId, history);
  saveRotationData(data);
}

/**
 * Check if entry is exempt from rotation
 */
function isExemptFromRotation(entry: PasswordEntry, policy: RotationPolicy): boolean {
  if (!policy.enabled) return true;
  if (entry.category && policy.exemptedCategories.includes(entry.category)) return true;
  return false;
}

/**
 * Determine if entry is a critical account requiring shorter rotation
 */
function isCriticalAccount(entry: PasswordEntry): boolean {
  const criticalKeywords = [
    'bank',
    'financial',
    'paypal',
    'venmo',
    'crypto',
    'exchange',
    'investment',
    'retirement',
    '401k',
    'ira',
    'mortgage',
    'loan',
    'credit',
    'insurance',
  ];

  const titleLower = entry.title.toLowerCase();
  const notesLower = (entry.notes || '').toLowerCase();

  return criticalKeywords.some(
    keyword => titleLower.includes(keyword) || notesLower.includes(keyword)
  );
}

/**
 * Get rotation status for a single entry
 */
export function getPasswordRotationStatus(
  entry: PasswordEntry,
  policy: RotationPolicy = getRotationPolicy()
): PasswordRotationStatus | null {
  // Only track rotation for login entries
  if (!isLoginEntry(entry) || !entry.id) return null;

  const isExempt = isExemptFromRotation(entry, policy);
  const isCrit = isCriticalAccount(entry);
  const rotationDays = isCrit ? policy.criticalAccountsDays : policy.defaultDays;

  // Get rotation history
  const rotationData = getRotationData();
  const history = rotationData.get(entry.id) || [];

  // Determine last rotation date
  let lastRotated: Date;
  if (history.length > 0) {
    lastRotated = history[0].rotatedAt;
  } else {
    // Use lastModified or createdAt as fallback
    lastRotated = entry.lastModified || entry.createdAt || new Date();
  }

  // Calculate next rotation due date
  const nextRotationDue = new Date(lastRotated);
  nextRotationDue.setDate(nextRotationDue.getDate() + rotationDays);

  // Calculate days until rotation
  const now = new Date();
  const daysUntilRotation = Math.ceil(
    (nextRotationDue.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  const isOverdue = daysUntilRotation < 0;
  const isCritical = daysUntilRotation < -30; // Overdue by more than 30 days
  const isWarning = daysUntilRotation > 0 && daysUntilRotation <= policy.warnDaysBefore;

  return {
    entryId: entry.id,
    title: entry.title,
    lastRotated,
    nextRotationDue,
    daysUntilRotation,
    isOverdue,
    isCritical,
    isWarning,
    rotationHistory: history,
    isExempt,
  };
}

/**
 * Get rotation status for all entries
 */
export function getAllRotationStatuses(
  entries: PasswordEntry[],
  policy: RotationPolicy = getRotationPolicy()
): PasswordRotationStatus[] {
  const statuses: PasswordRotationStatus[] = [];

  entries.forEach(entry => {
    const status = getPasswordRotationStatus(entry, policy);
    if (status) {
      statuses.push(status);
    }
  });

  return statuses;
}

/**
 * Get rotation summary statistics
 */
export function getRotationSummary(
  entries: PasswordEntry[],
  policy: RotationPolicy = getRotationPolicy()
): RotationSummary {
  const statuses = getAllRotationStatuses(entries, policy);

  if (statuses.length === 0) {
    return {
      total: 0,
      upToDate: 0,
      warning: 0,
      overdue: 0,
      critical: 0,
      exempt: 0,
      averageDaysSinceRotation: 0,
    };
  }

  let upToDate = 0;
  let warning = 0;
  let overdue = 0;
  let critical = 0;
  let exempt = 0;
  let totalDaysSinceRotation = 0;
  let nextRotationDue: PasswordRotationStatus | undefined;

  statuses.forEach(status => {
    if (status.isExempt) {
      exempt++;
    } else if (status.isCritical) {
      critical++;
    } else if (status.isOverdue) {
      overdue++;
    } else if (status.isWarning) {
      warning++;
    } else {
      upToDate++;
    }

    // Calculate days since rotation
    const daysSince = Math.floor(
      (Date.now() - status.lastRotated.getTime()) / (1000 * 60 * 60 * 24)
    );
    totalDaysSinceRotation += daysSince;

    // Find next rotation due
    if (!status.isExempt && !status.isOverdue) {
      if (!nextRotationDue || status.daysUntilRotation < nextRotationDue.daysUntilRotation) {
        nextRotationDue = status;
      }
    }
  });

  return {
    total: statuses.length,
    upToDate,
    warning,
    overdue,
    critical,
    exempt,
    averageDaysSinceRotation: Math.floor(totalDaysSinceRotation / statuses.length),
    nextRotationDue,
  };
}

/**
 * Get entries that need rotation (overdue or warning)
 */
export function getEntriesNeedingRotation(
  entries: PasswordEntry[],
  includeWarnings: boolean = true,
  policy: RotationPolicy = getRotationPolicy()
): PasswordRotationStatus[] {
  const statuses = getAllRotationStatuses(entries, policy);

  return statuses.filter(status => {
    if (status.isExempt) return false;
    if (status.isOverdue) return true;
    if (includeWarnings && status.isWarning) return true;
    return false;
  }).sort((a, b) => {
    // Sort by criticality: critical > overdue > warning
    if (a.isCritical && !b.isCritical) return -1;
    if (!a.isCritical && b.isCritical) return 1;
    if (a.isOverdue && !b.isOverdue) return -1;
    if (!a.isOverdue && b.isOverdue) return 1;
    // Then by days until rotation (most urgent first)
    return a.daysUntilRotation - b.daysUntilRotation;
  });
}

/**
 * Mark entry as exempt from rotation
 */
export function exemptEntryFromRotation(entryId: number): void {
  const data = getRotationData();
  const history = data.get(entryId) || [];

  history.unshift({
    rotatedAt: new Date(),
    reason: 'Exempted from rotation',
  });

  data.set(entryId, history);
  saveRotationData(data);
}

/**
 * Batch record rotation for multiple entries
 */
export function batchRecordRotation(entryIds: number[], reason?: string): void {
  const data = getRotationData();

  entryIds.forEach(entryId => {
    const history = data.get(entryId) || [];

    history.unshift({
      rotatedAt: new Date(),
      reason: reason || 'Batch rotation',
    });

    if (history.length > 10) {
      history.splice(10);
    }

    data.set(entryId, history);
  });

  saveRotationData(data);
}

/**
 * Clear rotation history for an entry
 */
export function clearRotationHistory(entryId: number): void {
  const data = getRotationData();
  data.delete(entryId);
  saveRotationData(data);
}

/**
 * Get formatted rotation status message
 */
export function getRotationStatusMessage(status: PasswordRotationStatus): string {
  if (status.isExempt) {
    return 'Exempt from rotation';
  }

  if (status.isCritical) {
    return `CRITICAL: Overdue by ${Math.abs(status.daysUntilRotation)} days`;
  }

  if (status.isOverdue) {
    return `Overdue by ${Math.abs(status.daysUntilRotation)} days`;
  }

  if (status.isWarning) {
    return `Due in ${status.daysUntilRotation} days`;
  }

  return `Next rotation in ${status.daysUntilRotation} days`;
}

/**
 * Get rotation badge color
 */
export function getRotationBadgeColor(status: PasswordRotationStatus): string {
  if (status.isExempt) return '#95a5a6';
  if (status.isCritical) return '#c0392b';
  if (status.isOverdue) return '#e74c3c';
  if (status.isWarning) return '#f39c12';
  return '#27ae60';
}

/**
 * Export rotation report as CSV
 */
export function exportRotationReport(entries: PasswordEntry[]): string {
  const statuses = getAllRotationStatuses(entries);

  let csv = 'Title,Last Rotated,Next Due,Days Until,Status,Critical Account,Exempt\n';

  statuses.forEach(status => {
    const lastRotated = status.lastRotated.toLocaleDateString();
    const nextDue = status.nextRotationDue.toLocaleDateString();
    const statusMsg = getRotationStatusMessage(status);

    csv += `"${status.title}",${lastRotated},${nextDue},${status.daysUntilRotation},"${statusMsg}",${isCriticalAccount({ title: status.title } as any) ? 'Yes' : 'No'},${status.isExempt ? 'Yes' : 'No'}\n`;
  });

  return csv;
}
