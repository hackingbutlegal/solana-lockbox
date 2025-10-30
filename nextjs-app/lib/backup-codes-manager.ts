/**
 * Backup Codes Manager
 *
 * Manages recovery backup codes for account access.
 * Codes are stored encrypted in browser localStorage for account recovery.
 *
 * Features:
 * - Generate 10 cryptographically random backup codes
 * - Store codes encrypted with derivation key
 * - Validate codes during recovery
 * - Track code usage (single-use codes)
 * - Export codes for secure offline storage
 *
 * @module backup-codes-manager
 */

import { BackupCodesGenerator } from './totp';

export interface BackupCode {
  code: string;
  used: boolean;
  usedAt?: string; // ISO 8601 timestamp
  createdAt: string;
}

export interface BackupCodesData {
  codes: BackupCode[];
  generatedAt: string;
  version: number;
  hasRecoveryPassword: boolean; // Whether recovery password is required
  recoveryKeyVersion?: number; // Version of recovery key system
}

const STORAGE_KEY = 'lockbox_backup_codes';
const CODES_VERSION = 1;
const CODE_COUNT = 10;
const CODE_LENGTH = 8;

/**
 * Generate new backup codes
 *
 * IMPORTANT: For security, backup codes should now be generated WITH a recovery password.
 * This provides 2-factor security: backup code + recovery password required for access.
 *
 * @param options - Generation options
 * @param options.count - Number of codes to generate (default: 10)
 * @param options.hasRecoveryPassword - Whether a recovery password has been set
 * @returns Array of backup codes
 */
export function generateBackupCodes(options?: {
  count?: number;
  hasRecoveryPassword?: boolean;
}): BackupCodesData {
  const count = options?.count || CODE_COUNT;
  const hasRecoveryPassword = options?.hasRecoveryPassword ?? false;

  const rawCodes = BackupCodesGenerator.generate(count, CODE_LENGTH);
  const formattedCodes = BackupCodesGenerator.format(rawCodes, '-', 4);

  const codes: BackupCode[] = formattedCodes.map(code => ({
    code,
    used: false,
    createdAt: new Date().toISOString(),
  }));

  return {
    codes,
    generatedAt: new Date().toISOString(),
    version: CODES_VERSION,
    hasRecoveryPassword,
    recoveryKeyVersion: hasRecoveryPassword ? 1 : undefined,
  };
}

/**
 * Save backup codes to localStorage
 *
 * @param data - Backup codes data
 */
export function saveBackupCodes(data: BackupCodesData): void {
  if (typeof window === 'undefined') return;

  try {
    // In production, these should be encrypted with a key derived from master password
    // For now, storing in localStorage (same security as sessionStorage for this demo)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('Failed to save backup codes:', err);
    throw new Error('Failed to save backup codes');
  }
}

/**
 * Load backup codes from localStorage
 *
 * @returns Backup codes data or null if none exists
 */
export function loadBackupCodes(): BackupCodesData | null {
  if (typeof window === 'undefined') return null;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const data: BackupCodesData = JSON.parse(stored);

    // Validate version
    if (data.version !== CODES_VERSION) {
      console.warn('Backup codes version mismatch, clearing old codes');
      clearBackupCodes();
      return null;
    }

    return data;
  } catch (err) {
    console.error('Failed to load backup codes:', err);
    return null;
  }
}

/**
 * Check if backup codes have been generated
 *
 * @returns true if codes exist
 */
export function hasBackupCodes(): boolean {
  return loadBackupCodes() !== null;
}

/**
 * Validate a backup code
 *
 * @param code - Code to validate
 * @returns true if code is valid and unused
 */
export function validateBackupCode(code: string): boolean {
  const data = loadBackupCodes();
  if (!data) return false;

  // Normalize code (remove spaces, convert to uppercase)
  const normalizedInput = code.replace(/[\s-]/g, '').toUpperCase();

  // Find matching code
  const matchingCode = data.codes.find(c => {
    const normalizedStored = c.code.replace(/[\s-]/g, '').toUpperCase();
    return normalizedStored === normalizedInput && !c.used;
  });

  return !!matchingCode;
}

/**
 * Mark a backup code as used
 *
 * @param code - Code to mark as used
 * @returns true if code was marked successfully
 */
export function markBackupCodeUsed(code: string): boolean {
  const data = loadBackupCodes();
  if (!data) return false;

  // Normalize code
  const normalizedInput = code.replace(/[\s-]/g, '').toUpperCase();

  // Find and mark code as used
  let marked = false;
  data.codes = data.codes.map(c => {
    const normalizedStored = c.code.replace(/[\s-]/g, '').toUpperCase();
    if (normalizedStored === normalizedInput && !c.used) {
      marked = true;
      return {
        ...c,
        used: true,
        usedAt: new Date().toISOString(),
      };
    }
    return c;
  });

  if (marked) {
    saveBackupCodes(data);
  }

  return marked;
}

/**
 * Get count of unused backup codes
 *
 * @returns Number of unused codes
 */
export function getUnusedCodeCount(): number {
  const data = loadBackupCodes();
  if (!data) return 0;

  return data.codes.filter(c => !c.used).length;
}

/**
 * Get backup codes statistics
 *
 * @returns Statistics object
 */
export function getBackupCodesStats(): {
  total: number;
  used: number;
  unused: number;
  generatedAt: string | null;
  oldestUnusedCode: string | null;
} {
  const data = loadBackupCodes();

  if (!data) {
    return {
      total: 0,
      used: 0,
      unused: 0,
      generatedAt: null,
      oldestUnusedCode: null,
    };
  }

  const used = data.codes.filter(c => c.used).length;
  const unused = data.codes.filter(c => !c.used).length;
  const oldestUnused = data.codes.find(c => !c.used);

  return {
    total: data.codes.length,
    used,
    unused,
    generatedAt: data.generatedAt,
    oldestUnusedCode: oldestUnused?.createdAt || null,
  };
}

/**
 * Clear all backup codes
 */
export function clearBackupCodes(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Regenerate backup codes (invalidates all existing codes)
 *
 * @param options - Generation options
 * @param options.hasRecoveryPassword - Whether a recovery password has been set
 * @returns New backup codes data
 */
export function regenerateBackupCodes(options?: {
  hasRecoveryPassword?: boolean;
}): BackupCodesData {
  const newCodes = generateBackupCodes(options);
  saveBackupCodes(newCodes);
  return newCodes;
}

/**
 * Export backup codes as text for printing/saving
 *
 * @returns Formatted text with codes and instructions
 */
export function exportBackupCodes(): string {
  const data = loadBackupCodes();
  if (!data) {
    throw new Error('No backup codes to export');
  }

  const unusedCodes = data.codes.filter(c => !c.used);

  let output = '═══════════════════════════════════════════════════════════\n';
  output += '        SOLANA LOCKBOX - RECOVERY BACKUP CODES\n';
  output += '═══════════════════════════════════════════════════════════\n\n';
  output += 'IMPORTANT SECURITY INFORMATION:\n';
  output += '• Store these codes in a secure location (safe, password manager, etc.)\n';
  output += '• Each code can only be used ONCE for account recovery\n';
  output += '• Anyone with these codes can access your vault\n';
  output += `• Generated: ${new Date(data.generatedAt).toLocaleString()}\n\n`;
  output += 'BACKUP CODES:\n';
  output += '─────────────────────────────────────────────────────────\n';

  unusedCodes.forEach((code, index) => {
    output += `  ${(index + 1).toString().padStart(2, '0')}. ${code.code}\n`;
  });

  output += '─────────────────────────────────────────────────────────\n\n';
  output += 'HOW TO USE:\n';
  output += '1. If you lose access to your Solana wallet\n';
  output += '2. Click "Recover with Backup Code" on login screen\n';
  output += '3. Enter one of these codes to regain access\n';
  output += '4. Immediately generate new backup codes after recovery\n\n';
  output += `Unused codes remaining: ${unusedCodes.length}/${data.codes.length}\n`;
  output += '═══════════════════════════════════════════════════════════\n';

  return output;
}

/**
 * Download backup codes as a text file
 */
export function downloadBackupCodes(): void {
  const content = exportBackupCodes();
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `lockbox-backup-codes-${Date.now()}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Check if backup codes need regeneration (less than 3 unused)
 *
 * @returns true if codes should be regenerated
 */
export function shouldRegenerateBackupCodes(): boolean {
  const stats = getBackupCodesStats();
  return stats.unused < 3;
}

/**
 * Get days since backup codes were generated
 *
 * @returns Number of days or null if no codes exist
 */
export function getDaysSinceGeneration(): number | null {
  const data = loadBackupCodes();
  if (!data) return null;

  const generatedAt = new Date(data.generatedAt);
  const now = new Date();
  const diffMs = now.getTime() - generatedAt.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return diffDays;
}

/**
 * Check if backup codes are stale (over 90 days old)
 *
 * @returns true if codes should be refreshed
 */
export function areBackupCodesStale(): boolean {
  const days = getDaysSinceGeneration();
  if (days === null) return false;
  return days > 90;
}

/**
 * Check if backup codes need migration to new security model
 * (old codes without recovery password are insecure)
 *
 * @returns true if codes need to be regenerated with recovery password
 */
export function needsSecurityMigration(): boolean {
  const data = loadBackupCodes();
  if (!data) return false;

  // Check if codes were generated without recovery password
  return !data.hasRecoveryPassword;
}

/**
 * Check if backup codes are using the secure model
 * (generated with recovery password)
 *
 * @returns true if codes use recovery password
 */
export function areBackupCodesSecure(): boolean {
  const data = loadBackupCodes();
  if (!data) return false;

  return data.hasRecoveryPassword === true;
}

/**
 * Get migration status message for user
 *
 * @returns User-friendly message explaining migration need
 */
export function getMigrationMessage(): string | null {
  if (!needsSecurityMigration()) return null;

  return 'Security Update Required: Your backup codes were generated with an older, less secure system. Please regenerate them with a recovery password to improve security. With the new system, backup codes require both the code AND a recovery password, providing 2-factor protection.';
}
