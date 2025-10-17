/**
 * Password Sharing System
 *
 * Secure client-side password sharing with:
 * - End-to-end encryption using Web Crypto API
 * - Time-limited shares with expiration
 * - One-time access (burn after reading)
 * - Share management and revocation
 * - Activity logging
 */

import { PasswordEntry } from '../sdk/src/types-v2';
import { logActivity, ActivityType } from './activity-logger';

/**
 * Share types
 */
export enum ShareType {
  ONE_TIME = 'one_time',
  TIME_LIMITED = 'time_limited',
  UNLIMITED = 'unlimited',
}

/**
 * Share access level
 */
export enum ShareAccessLevel {
  VIEW_ONLY = 'view_only',
  COPY_PASSWORD = 'copy_password',
  FULL_ACCESS = 'full_access',
}

/**
 * Encrypted share data
 */
export interface PasswordShare {
  id: string;
  entryId: number;
  entryTitle: string;
  shareType: ShareType;
  accessLevel: ShareAccessLevel;
  encryptedData: string;
  encryptionKey: string; // Base64 encoded key
  createdAt: Date;
  expiresAt?: Date;
  accessCount: number;
  maxAccess?: number;
  revoked: boolean;
  createdBy: string; // Wallet address
}

/**
 * Share link metadata
 */
export interface ShareLink {
  shareId: string;
  url: string;
  expiresAt?: Date;
  accessCount: number;
  maxAccess?: number;
}

/**
 * Shared entry data (decrypted)
 */
export interface SharedEntryData {
  title: string;
  username?: string;
  password?: string;
  url?: string;
  notes?: string;
  type: string;
  accessLevel: ShareAccessLevel;
}

const SHARES_STORAGE_KEY = 'lockbox_password_shares';
const SHARE_BASE_URL = typeof window !== 'undefined' ? `${window.location.origin}/share` : '';

/**
 * Generate a random encryption key
 */
async function generateEncryptionKey(): Promise<CryptoKey> {
  return await crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Export key to base64 string
 */
async function exportKey(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('raw', key);
  return btoa(String.fromCharCode(...new Uint8Array(exported)));
}

/**
 * Import key from base64 string
 */
async function importKey(keyString: string): Promise<CryptoKey> {
  const keyData = Uint8Array.from(atob(keyString), c => c.charCodeAt(0));
  return await crypto.subtle.importKey(
    'raw',
    keyData,
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt data with AES-GCM
 */
async function encryptData(data: string, key: CryptoKey): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    dataBuffer
  );

  // Combine IV and encrypted data
  const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encryptedBuffer), iv.length);

  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt data with AES-GCM
 */
async function decryptData(encryptedString: string, key: CryptoKey): Promise<string> {
  const combined = Uint8Array.from(atob(encryptedString), c => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const encryptedData = combined.slice(12);

  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    encryptedData
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}

/**
 * Load all shares from storage
 */
export function loadShares(): PasswordShare[] {
  try {
    const stored = localStorage.getItem(SHARES_STORAGE_KEY);
    if (stored) {
      const shares = JSON.parse(stored);
      return shares.map((s: any) => ({
        ...s,
        createdAt: new Date(s.createdAt),
        expiresAt: s.expiresAt ? new Date(s.expiresAt) : undefined,
      }));
    }
  } catch (error) {
    console.error('Failed to load shares:', error);
  }
  return [];
}

/**
 * Save shares to storage
 */
export function saveShares(shares: PasswordShare[]): void {
  try {
    localStorage.setItem(SHARES_STORAGE_KEY, JSON.stringify(shares));
  } catch (error) {
    console.error('Failed to save shares:', error);
  }
}

/**
 * Create a new password share
 */
export async function createShare(
  entry: PasswordEntry,
  shareType: ShareType,
  accessLevel: ShareAccessLevel,
  walletAddress: string,
  expiresIn?: number, // Minutes
  maxAccess?: number
): Promise<ShareLink> {
  // Prepare data to share based on access level
  const sharedData: SharedEntryData = {
    title: entry.title,
    type: entry.type.toString(),
    accessLevel,
  };

  if (accessLevel === ShareAccessLevel.COPY_PASSWORD || accessLevel === ShareAccessLevel.FULL_ACCESS) {
    if (entry.type === 'login') {
      sharedData.username = entry.username;
      sharedData.password = entry.password;
      sharedData.url = entry.url;
    }
  }

  if (accessLevel === ShareAccessLevel.FULL_ACCESS) {
    sharedData.notes = entry.notes;
  }

  // Generate encryption key
  const key = await generateEncryptionKey();
  const keyString = await exportKey(key);

  // Encrypt the data
  const encryptedData = await encryptData(JSON.stringify(sharedData), key);

  // Calculate expiration
  let expiresAt: Date | undefined;
  if (expiresIn) {
    expiresAt = new Date(Date.now() + expiresIn * 60 * 1000);
  }

  // Create share
  const share: PasswordShare = {
    id: crypto.randomUUID(),
    entryId: entry.id!,
    entryTitle: entry.title,
    shareType,
    accessLevel,
    encryptedData,
    encryptionKey: keyString,
    createdAt: new Date(),
    expiresAt,
    accessCount: 0,
    maxAccess: shareType === ShareType.ONE_TIME ? 1 : maxAccess,
    revoked: false,
    createdBy: walletAddress,
  };

  // Save share
  const shares = loadShares();
  shares.push(share);
  saveShares(shares);

  // Log activity
  logActivity(
    ActivityType.EXPORT,
    `Created ${shareType} share for: ${entry.title}`,
    {
      entryId: entry.id,
      entryTitle: entry.title,
      severity: 'info',
      metadata: {
        shareType,
        accessLevel,
        expiresAt: expiresAt?.toISOString(),
      },
    }
  );

  // Generate share link
  const shareUrl = `${SHARE_BASE_URL}/${share.id}#${keyString}`;

  return {
    shareId: share.id,
    url: shareUrl,
    expiresAt,
    accessCount: 0,
    maxAccess,
  };
}

/**
 * Access a shared password
 */
export async function accessShare(shareId: string, encryptionKey: string): Promise<SharedEntryData | null> {
  const shares = loadShares();
  const share = shares.find(s => s.id === shareId);

  if (!share) {
    return null;
  }

  // Check if revoked
  if (share.revoked) {
    throw new Error('This share has been revoked');
  }

  // Check expiration
  if (share.expiresAt && new Date() > share.expiresAt) {
    throw new Error('This share has expired');
  }

  // Check access count
  if (share.maxAccess && share.accessCount >= share.maxAccess) {
    throw new Error('This share has reached its maximum access count');
  }

  // Decrypt data
  try {
    const key = await importKey(encryptionKey);
    const decryptedJson = await decryptData(share.encryptedData, key);
    const sharedData = JSON.parse(decryptedJson) as SharedEntryData;

    // Increment access count
    share.accessCount++;
    saveShares(shares);

    // Log access
    logActivity(
      ActivityType.ACCESS,
      `Shared password accessed: ${share.entryTitle}`,
      {
        entryId: share.entryId,
        entryTitle: share.entryTitle,
        severity: 'info',
        metadata: {
          shareId: share.id,
          accessCount: share.accessCount,
        },
      }
    );

    return sharedData;
  } catch (error) {
    throw new Error('Failed to decrypt share. Invalid or corrupted link.');
  }
}

/**
 * Revoke a share
 */
export function revokeShare(shareId: string): boolean {
  const shares = loadShares();
  const share = shares.find(s => s.id === shareId);

  if (!share) {
    return false;
  }

  share.revoked = true;
  saveShares(shares);

  logActivity(
    ActivityType.DELETE,
    `Revoked share for: ${share.entryTitle}`,
    {
      entryId: share.entryId,
      entryTitle: share.entryTitle,
      severity: 'warning',
      metadata: {
        shareId: share.id,
      },
    }
  );

  return true;
}

/**
 * Delete a share
 */
export function deleteShare(shareId: string): boolean {
  const shares = loadShares();
  const filteredShares = shares.filter(s => s.id !== shareId);

  if (filteredShares.length === shares.length) {
    return false;
  }

  saveShares(filteredShares);
  return true;
}

/**
 * Get shares for a specific entry
 */
export function getEntryShares(entryId: number): PasswordShare[] {
  const shares = loadShares();
  return shares.filter(s => s.entryId === entryId && !s.revoked);
}

/**
 * Get all active shares
 */
export function getActiveShares(): PasswordShare[] {
  const shares = loadShares();
  const now = new Date();

  return shares.filter(s => {
    if (s.revoked) return false;
    if (s.expiresAt && now > s.expiresAt) return false;
    if (s.maxAccess && s.accessCount >= s.maxAccess) return false;
    return true;
  });
}

/**
 * Clean up expired shares
 */
export function cleanupExpiredShares(): number {
  const shares = loadShares();
  const now = new Date();

  const activeShares = shares.filter(s => {
    if (s.expiresAt && now > s.expiresAt) return false;
    if (s.maxAccess && s.accessCount >= s.maxAccess) return false;
    return true;
  });

  const removedCount = shares.length - activeShares.length;
  if (removedCount > 0) {
    saveShares(activeShares);
  }

  return removedCount;
}

/**
 * Get share statistics
 */
export function getShareStatistics(): {
  total: number;
  active: number;
  expired: number;
  revoked: number;
  accessed: number;
} {
  const shares = loadShares();
  const now = new Date();

  let active = 0;
  let expired = 0;
  let revoked = 0;
  let accessed = 0;

  for (const share of shares) {
    if (share.revoked) {
      revoked++;
    } else if (share.expiresAt && now > share.expiresAt) {
      expired++;
    } else if (share.maxAccess && share.accessCount >= share.maxAccess) {
      expired++;
    } else {
      active++;
    }

    if (share.accessCount > 0) {
      accessed++;
    }
  }

  return {
    total: shares.length,
    active,
    expired,
    revoked,
    accessed,
  };
}
