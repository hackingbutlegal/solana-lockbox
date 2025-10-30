/**
 * Recovery Key Manager
 *
 * Manages the recovery key system for backup codes.
 * This prevents backup codes from providing direct wallet access.
 *
 * Security Model:
 * 1. User creates a "recovery password" when generating backup codes
 * 2. A "recovery key" is generated and encrypted with the recovery password
 * 3. The recovery key can decrypt passwords (read-only access)
 * 4. Backup codes + recovery password → Recovery Console (no wallet access)
 *
 * This ensures that even if backup codes are compromised, attacker still needs
 * the recovery password to access passwords. And they can't modify data since
 * they don't have the wallet.
 */

import { encryptAEAD, decryptAEAD } from './crypto';

export interface RecoveryKeyData {
  encryptedRecoveryKey: string; // Recovery key encrypted with recovery password
  salt: string; // Salt for recovery password PBKDF2
  iv: string; // IV for encryption
  createdAt: number;
  version: number;
}

const STORAGE_KEY = 'lockbox_recovery_key';
const PBKDF2_ITERATIONS = 100000;

/**
 * Derive a key from recovery password using PBKDF2
 */
async function deriveKeyFromPassword(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const passwordData = encoder.encode(password);

  // Import password as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordData,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  // Derive key using PBKDF2
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    256 // 256 bits = 32 bytes
  );

  return new Uint8Array(derivedBits);
}

/**
 * Generate a new recovery key and encrypt it with recovery password
 */
export async function generateRecoveryKey(
  recoveryPassword: string,
  sessionKey: Uint8Array
): Promise<RecoveryKeyData> {
  // Generate random salt for password derivation
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Derive encryption key from recovery password
  const passwordKey = await deriveKeyFromPassword(recoveryPassword, salt);

  // Encrypt the session key (recovery key) with the password-derived key
  const { ciphertext, nonce } = encryptAEAD(sessionKey, passwordKey);

  const recoveryKeyData: RecoveryKeyData = {
    encryptedRecoveryKey: Buffer.from(ciphertext).toString('base64'),
    salt: Buffer.from(salt).toString('base64'),
    iv: Buffer.from(nonce).toString('base64'), // Store nonce as "iv" for compatibility
    createdAt: Date.now(),
    version: 1
  };

  // Store recovery key data
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recoveryKeyData));

  return recoveryKeyData;
}

/**
 * Decrypt recovery key using recovery password
 */
export async function decryptRecoveryKey(
  recoveryPassword: string
): Promise<Uint8Array | null> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      console.error('No recovery key found');
      return null;
    }

    const recoveryKeyData: RecoveryKeyData = JSON.parse(stored);

    // Derive encryption key from password
    const salt = Buffer.from(recoveryKeyData.salt, 'base64');
    const passwordKey = await deriveKeyFromPassword(recoveryPassword, salt);

    // Decrypt recovery key
    const ciphertext = Buffer.from(recoveryKeyData.encryptedRecoveryKey, 'base64');
    const nonce = Buffer.from(recoveryKeyData.iv, 'base64');
    const decrypted = decryptAEAD(ciphertext, nonce, passwordKey);

    return decrypted;
  } catch (err) {
    console.error('Failed to decrypt recovery key:', err);
    return null;
  }
}

/**
 * Check if recovery key exists
 */
export function hasRecoveryKey(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(STORAGE_KEY) !== null;
}

/**
 * Get recovery key metadata (without decrypting)
 */
export function getRecoveryKeyMetadata(): RecoveryKeyData | null {
  if (typeof window === 'undefined') return null;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    return JSON.parse(stored);
  } catch (err) {
    console.error('Failed to load recovery key metadata:', err);
    return null;
  }
}

/**
 * Delete recovery key
 */
export function deleteRecoveryKey(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Validate recovery password strength
 */
export function validateRecoveryPassword(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 12) {
    errors.push('Password must be at least 12 characters long');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
