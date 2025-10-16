/**
 * Password History Tracker
 *
 * Tracks password changes over time for security auditing and recovery.
 * Stores history in browser sessionStorage (cleared when tab closes).
 *
 * Features:
 * - Track up to 5 previous passwords per entry
 * - Store timestamp of each change
 * - Prevent reuse of recent passwords
 * - Display password age metrics
 *
 * @module password-history
 */

export interface PasswordHistoryEntry {
  password: string;
  changedAt: string; // ISO 8601 timestamp
  changedBy?: string; // Optional: user identifier
}

export interface PasswordHistory {
  entryId: number;
  currentPassword: string;
  history: PasswordHistoryEntry[];
  lastChanged: string;
}

const STORAGE_KEY = 'lockbox_password_history';
const MAX_HISTORY_PER_ENTRY = 5;

/**
 * Get all password history from sessionStorage
 */
function getAllHistory(): Record<number, PasswordHistory> {
  if (typeof window === 'undefined') return {};

  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (err) {
    console.error('Failed to load password history:', err);
    return {};
  }
}

/**
 * Save all password history to sessionStorage
 */
function saveAllHistory(history: Record<number, PasswordHistory>): void {
  if (typeof window === 'undefined') return;

  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch (err) {
    console.error('Failed to save password history:', err);
  }
}

/**
 * Track a password change for an entry
 *
 * @param entryId - The password entry ID
 * @param oldPassword - The previous password
 * @param newPassword - The new password
 */
export function trackPasswordChange(
  entryId: number,
  oldPassword: string,
  newPassword: string
): void {
  const allHistory = getAllHistory();
  const existing = allHistory[entryId];

  const now = new Date().toISOString();

  if (!existing) {
    // First time tracking this entry
    allHistory[entryId] = {
      entryId,
      currentPassword: newPassword,
      history: oldPassword ? [{
        password: oldPassword,
        changedAt: now,
      }] : [],
      lastChanged: now,
    };
  } else {
    // Add current password to history
    existing.history.unshift({
      password: existing.currentPassword,
      changedAt: existing.lastChanged,
    });

    // Keep only MAX_HISTORY_PER_ENTRY entries
    if (existing.history.length > MAX_HISTORY_PER_ENTRY) {
      existing.history = existing.history.slice(0, MAX_HISTORY_PER_ENTRY);
    }

    // Update current password
    existing.currentPassword = newPassword;
    existing.lastChanged = now;
  }

  saveAllHistory(allHistory);
}

/**
 * Get password history for a specific entry
 *
 * @param entryId - The password entry ID
 * @returns Password history or null if none exists
 */
export function getPasswordHistory(entryId: number): PasswordHistory | null {
  const allHistory = getAllHistory();
  return allHistory[entryId] || null;
}

/**
 * Check if a password was recently used
 *
 * @param entryId - The password entry ID
 * @param password - The password to check
 * @returns true if password was used within last MAX_HISTORY_PER_ENTRY changes
 */
export function isPasswordReused(entryId: number, password: string): boolean {
  const history = getPasswordHistory(entryId);
  if (!history) return false;

  // Check current password
  if (history.currentPassword === password) return true;

  // Check historical passwords
  return history.history.some(entry => entry.password === password);
}

/**
 * Get the age of the current password in days
 *
 * @param entryId - The password entry ID
 * @returns Number of days since password was last changed, or null if unknown
 */
export function getPasswordAge(entryId: number): number | null {
  const history = getPasswordHistory(entryId);
  if (!history) return null;

  const lastChanged = new Date(history.lastChanged);
  const now = new Date();
  const diffMs = now.getTime() - lastChanged.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return diffDays;
}

/**
 * Get password change frequency (average days between changes)
 *
 * @param entryId - The password entry ID
 * @returns Average days between password changes, or null if insufficient data
 */
export function getPasswordChangeFrequency(entryId: number): number | null {
  const history = getPasswordHistory(entryId);
  if (!history || history.history.length === 0) return null;

  // Calculate time differences between changes
  const dates = [
    new Date(history.lastChanged),
    ...history.history.map(h => new Date(h.changedAt))
  ];

  if (dates.length < 2) return null;

  let totalDays = 0;
  for (let i = 0; i < dates.length - 1; i++) {
    const diffMs = dates[i].getTime() - dates[i + 1].getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    totalDays += diffDays;
  }

  return Math.floor(totalDays / (dates.length - 1));
}

/**
 * Delete password history for a specific entry
 *
 * @param entryId - The password entry ID
 */
export function deletePasswordHistory(entryId: number): void {
  const allHistory = getAllHistory();
  delete allHistory[entryId];
  saveAllHistory(allHistory);
}

/**
 * Clear all password history (useful for logout/cleanup)
 */
export function clearAllPasswordHistory(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(STORAGE_KEY);
}

/**
 * Get statistics about password history
 */
export function getPasswordHistoryStats(): {
  totalEntries: number;
  totalHistoryRecords: number;
  averageAge: number;
  oldestPassword: { entryId: number; age: number } | null;
} {
  const allHistory = getAllHistory();
  const entries = Object.values(allHistory);

  if (entries.length === 0) {
    return {
      totalEntries: 0,
      totalHistoryRecords: 0,
      averageAge: 0,
      oldestPassword: null,
    };
  }

  const totalHistoryRecords = entries.reduce((sum, entry) => sum + entry.history.length, 0);

  // Calculate average age
  const ages = entries
    .map(entry => {
      const lastChanged = new Date(entry.lastChanged);
      const now = new Date();
      return (now.getTime() - lastChanged.getTime()) / (1000 * 60 * 60 * 24);
    })
    .filter(age => !isNaN(age));

  const averageAge = ages.length > 0
    ? Math.floor(ages.reduce((sum, age) => sum + age, 0) / ages.length)
    : 0;

  // Find oldest password
  let oldestPassword: { entryId: number; age: number } | null = null;
  entries.forEach(entry => {
    const age = getPasswordAge(entry.entryId);
    if (age !== null && (!oldestPassword || age > oldestPassword.age)) {
      oldestPassword = { entryId: entry.entryId, age };
    }
  });

  return {
    totalEntries: entries.length,
    totalHistoryRecords,
    averageAge,
    oldestPassword,
  };
}
