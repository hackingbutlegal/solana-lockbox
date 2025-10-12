/**
 * Utility functions for Lockbox v2.0
 */

import crypto from 'crypto';
import { PasswordEntry, PasswordHealth } from './types-v2';

/**
 * Password strength checker
 */
export function checkPasswordStrength(password: string): {
  score: number; // 0-4
  feedback: string[];
} {
  const feedback: string[] = [];
  let score = 0;

  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  if (password.length < 8) {
    feedback.push('Password should be at least 8 characters');
  }
  if (!/[A-Z]/.test(password)) {
    feedback.push('Add uppercase letters');
  }
  if (!/[a-z]/.test(password)) {
    feedback.push('Add lowercase letters');
  }
  if (!/\d/.test(password)) {
    feedback.push('Add numbers');
  }
  if (!/[^a-zA-Z0-9]/.test(password)) {
    feedback.push('Add special characters');
  }

  // Common patterns
  if (/^(.)\1+$/.test(password)) {
    feedback.push('Avoid repeating characters');
    score = Math.min(score, 1);
  }
  if (/^(012|123|234|345|456|567|678|789|890|abc|bcd|cde|def)/.test(password.toLowerCase())) {
    feedback.push('Avoid sequential patterns');
    score = Math.min(score, 2);
  }

  return { score: Math.min(score, 4), feedback };
}

/**
 * Generate a strong random password
 */
export function generatePassword(options: {
  length?: number;
  uppercase?: boolean;
  lowercase?: boolean;
  numbers?: boolean;
  symbols?: boolean;
}): string {
  const {
    length = 16,
    uppercase = true,
    lowercase = true,
    numbers = true,
    symbols = true,
  } = options;

  let charset = '';
  if (uppercase) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (lowercase) charset += 'abcdefghijklmnopqrstuvwxyz';
  if (numbers) charset += '0123456789';
  if (symbols) charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';

  if (charset.length === 0) {
    throw new Error('At least one character type must be selected');
  }

  const randomBytes = crypto.randomBytes(length);
  let password = '';

  for (let i = 0; i < length; i++) {
    password += charset[randomBytes[i] % charset.length];
  }

  return password;
}

/**
 * Analyze password health across all entries
 */
export function analyzePasswordHealth(entries: PasswordEntry[]): PasswordHealth {
  const passwords = new Map<string, number>();
  const ages = new Map<number, Date>();
  let weak = 0;
  let reused = 0;
  let old = 0;
  const compromised = 0; // Would require breach database lookup

  const now = new Date();
  const SIX_MONTHS = 180 * 24 * 60 * 60 * 1000;

  // Analyze each password
  for (const entry of entries) {
    if (!entry.password || !entry.id) continue;

    // Check weakness
    const strength = checkPasswordStrength(entry.password);
    if (strength.score < 3) {
      weak++;
    }

    // Check reuse
    const count = passwords.get(entry.password) || 0;
    passwords.set(entry.password, count + 1);

    // Check age
    if (entry.lastModified) {
      const age = now.getTime() - entry.lastModified.getTime();
      if (age > SIX_MONTHS) {
        old++;
      }
    }
  }

  // Count reused passwords
  for (const count of passwords.values()) {
    if (count > 1) {
      reused += count;
    }
  }

  // Calculate overall score
  const total = entries.length;
  const issues = weak + reused + old + compromised;
  const score = total > 0 ? Math.max(0, Math.min(100, 100 - (issues / total) * 100)) : 100;

  return {
    weak,
    reused,
    old,
    compromised,
    score: Math.round(score),
  };
}

/**
 * Search entries by title, username, or URL
 */
export function searchEntries(entries: PasswordEntry[], query: string): PasswordEntry[] {
  const lowerQuery = query.toLowerCase();

  return entries.filter(entry => {
    return (
      entry.title?.toLowerCase().includes(lowerQuery) ||
      entry.username?.toLowerCase().includes(lowerQuery) ||
      entry.url?.toLowerCase().includes(lowerQuery) ||
      entry.notes?.toLowerCase().includes(lowerQuery) ||
      entry.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  });
}

/**
 * Group entries by category
 */
export function groupByCategory(entries: PasswordEntry[]): Map<number, PasswordEntry[]> {
  const grouped = new Map<number, PasswordEntry[]>();

  for (const entry of entries) {
    const category = entry.category || 0;
    if (!grouped.has(category)) {
      grouped.set(category, []);
    }
    grouped.get(category)!.push(entry);
  }

  return grouped;
}

/**
 * Group entries by type
 */
export function groupByType(entries: PasswordEntry[]): Map<number, PasswordEntry[]> {
  const grouped = new Map<number, PasswordEntry[]>();

  for (const entry of entries) {
    const type = entry.type;
    if (!grouped.has(type)) {
      grouped.set(type, []);
    }
    grouped.get(type)!.push(entry);
  }

  return grouped;
}

/**
 * Filter entries by tags
 */
export function filterByTags(entries: PasswordEntry[], tags: string[]): PasswordEntry[] {
  const lowerTags = tags.map(t => t.toLowerCase());

  return entries.filter(entry => {
    if (!entry.tags || entry.tags.length === 0) return false;
    return entry.tags.some(tag => lowerTags.includes(tag.toLowerCase()));
  });
}

/**
 * Get favorite entries
 */
export function getFavorites(entries: PasswordEntry[]): PasswordEntry[] {
  return entries.filter(entry => entry.favorite === true);
}

/**
 * Get archived entries
 */
export function getArchived(entries: PasswordEntry[]): PasswordEntry[] {
  return entries.filter(entry => entry.archived === true);
}

/**
 * Sort entries
 */
export function sortEntries(
  entries: PasswordEntry[],
  by: 'title' | 'createdAt' | 'lastModified' | 'accessCount',
  order: 'asc' | 'desc' = 'asc'
): PasswordEntry[] {
  const sorted = [...entries];

  sorted.sort((a, b) => {
    let aVal: any;
    let bVal: any;

    switch (by) {
      case 'title':
        aVal = a.title?.toLowerCase() || '';
        bVal = b.title?.toLowerCase() || '';
        break;
      case 'createdAt':
        aVal = a.createdAt?.getTime() || 0;
        bVal = b.createdAt?.getTime() || 0;
        break;
      case 'lastModified':
        aVal = a.lastModified?.getTime() || 0;
        bVal = b.lastModified?.getTime() || 0;
        break;
      case 'accessCount':
        aVal = a.accessCount || 0;
        bVal = b.accessCount || 0;
        break;
    }

    if (aVal < bVal) return order === 'asc' ? -1 : 1;
    if (aVal > bVal) return order === 'asc' ? 1 : -1;
    return 0;
  });

  return sorted;
}

/**
 * Estimate entry size in bytes
 */
export function estimateEntrySize(entry: PasswordEntry): number {
  const json = JSON.stringify(entry);
  return new TextEncoder().encode(json).length + 24 + 16; // + nonce + auth tag
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Format date relative to now
 */
export function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 30) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months} month${months > 1 ? 's' : ''} ago`;
  }

  const years = Math.floor(diffDays / 365);
  return `${years} year${years > 1 ? 's' : ''} ago`;
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract domain from URL
 */
export function extractDomain(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return null;
  }
}

/**
 * Generate default category IDs
 */
export const DEFAULT_CATEGORIES = {
  PERSONAL: 0,
  WORK: 1,
  FINANCE: 2,
  SOCIAL: 3,
  SHOPPING: 4,
  DEVELOPMENT: 5,
  OTHER: 99,
};

/**
 * Get category name
 */
export function getCategoryName(id: number): string {
  const names: Record<number, string> = {
    0: 'Personal',
    1: 'Work',
    2: 'Finance',
    3: 'Social',
    4: 'Shopping',
    5: 'Development',
    99: 'Other',
  };

  return names[id] || `Category ${id}`;
}

/**
 * Export utilities
 */
export const passwordUtils = {
  checkStrength: checkPasswordStrength,
  generate: generatePassword,
  analyzeHealth: analyzePasswordHealth,
};

export const entryUtils = {
  search: searchEntries,
  groupByCategory,
  groupByType,
  filterByTags,
  getFavorites,
  getArchived,
  sort: sortEntries,
  estimateSize: estimateEntrySize,
};

export const formatUtils = {
  bytes: formatBytes,
  relativeDate: formatRelativeDate,
  domain: extractDomain,
  isValidUrl,
  getCategoryName,
};
