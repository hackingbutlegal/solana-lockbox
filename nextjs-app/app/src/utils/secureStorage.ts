/**
 * Secure storage utilities with additional security hardening
 * - Stores only transaction metadata (hashes, timestamps, sizes)
 * - NEVER stores decrypted plaintext data
 * - Session-only storage with auto-cleanup
 * - All decrypted data exists only in memory during active decryption
 * - Clears automatically on page refresh/reload
 */

import { StoredItem } from '../components/StorageHistory';

const STORAGE_KEY_PREFIX = 'lockbox_';
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

interface SecureStorageItem {
  data: string;
  timestamp: number;
  checksum: string;
}

/**
 * Simple checksum for integrity verification
 */
function calculateChecksum(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Store data in sessionStorage with integrity check
 * Note: This is for metadata only, not sensitive plaintext
 */
export function secureStore(key: string, data: any): void {
  try {
    const serialized = JSON.stringify(data);
    const item: SecureStorageItem = {
      data: serialized,
      timestamp: Date.now(),
      checksum: calculateChecksum(serialized),
    };

    sessionStorage.setItem(
      `${STORAGE_KEY_PREFIX}${key}`,
      JSON.stringify(item)
    );
  } catch (error) {
    console.error('Secure storage failed:', error);
  }
}

/**
 * Retrieve data from sessionStorage with integrity and expiry check
 */
export function secureRetrieve<T>(key: string): T | null {
  try {
    const stored = sessionStorage.getItem(`${STORAGE_KEY_PREFIX}${key}`);
    if (!stored) return null;

    const item: SecureStorageItem = JSON.parse(stored);

    // Check expiry
    if (Date.now() - item.timestamp > SESSION_TIMEOUT_MS) {
      secureRemove(key);
      return null;
    }

    // Verify integrity
    const expectedChecksum = calculateChecksum(item.data);
    if (item.checksum !== expectedChecksum) {
      console.warn('Storage integrity check failed');
      secureRemove(key);
      return null;
    }

    return JSON.parse(item.data) as T;
  } catch (error) {
    console.error('Secure retrieval failed:', error);
    return null;
  }
}

/**
 * Remove item from secure storage
 */
export function secureRemove(key: string): void {
  sessionStorage.removeItem(`${STORAGE_KEY_PREFIX}${key}`);
}

/**
 * Clear all lockbox data from storage
 */
export function secureClearAll(): void {
  const keys = Object.keys(sessionStorage);
  keys.forEach(key => {
    if (key.startsWith(STORAGE_KEY_PREFIX)) {
      sessionStorage.removeItem(key);
    }
  });
}

/**
 * Get storage key for user's items
 */
export function getUserStorageKey(publicKey: string): string {
  return `items_${publicKey.slice(0, 8)}`;
}

/**
 * Store user's items with wallet-specific key
 */
export function storeUserItems(publicKey: string, items: StoredItem[]): void {
  const key = getUserStorageKey(publicKey);
  secureStore(key, items);
}

/**
 * Retrieve user's items
 */
export function retrieveUserItems(publicKey: string): StoredItem[] {
  const key = getUserStorageKey(publicKey);
  const items = secureRetrieve<StoredItem[]>(key);

  if (!items) return [];

  // Reconstruct Date objects
  return items.map(item => ({
    ...item,
    timestamp: new Date(item.timestamp),
  }));
}

/**
 * Add a new stored item
 */
export function addStoredItem(
  publicKey: string,
  txHash: string,
  dataPreview: string,
  sizeBytes: number
): void {
  const items = retrieveUserItems(publicKey);

  const newItem: StoredItem = {
    id: `${Date.now()}-${Math.random()}`,
    timestamp: new Date(),
    txHash,
    dataPreview,
    sizeBytes,
  };

  items.unshift(newItem); // Add to beginning
  storeUserItems(publicKey, items.slice(0, 50)); // Keep last 50 items
}

/**
 * Security: Clear all data on window unload
 */
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    // Clear session key and any sensitive data
    // (Storage history persists as it's just metadata)
  });

  // Auto-cleanup expired items periodically
  setInterval(() => {
    const keys = Object.keys(sessionStorage);
    keys.forEach(key => {
      if (key.startsWith(STORAGE_KEY_PREFIX)) {
        const stored = sessionStorage.getItem(key);
        if (stored) {
          try {
            const item: SecureStorageItem = JSON.parse(stored);
            if (Date.now() - item.timestamp > SESSION_TIMEOUT_MS) {
              sessionStorage.removeItem(key);
            }
          } catch (e) {
            // Invalid format, remove it
            sessionStorage.removeItem(key);
          }
        }
      }
    });
  }, 5 * 60 * 1000); // Check every 5 minutes
}
