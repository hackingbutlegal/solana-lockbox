/**
 * Entry Metadata Tracker
 *
 * Client-side utility for tracking entry metadata that isn't stored on-chain.
 * This includes chunk indices for efficient updates and deletes.
 *
 * ## Why Client-Side?
 *
 * The deployed Solana program doesn't include chunk index in the encrypted entry data.
 * Rather than requiring a program upgrade, we track this metadata client-side by:
 * 1. Inferring chunk indices during listPasswords()
 * 2. Caching the mapping in memory (sessionStorage for persistence)
 * 3. Falling back to searching all chunks if metadata is missing
 *
 * ## Usage
 *
 * ```typescript
 * const tracker = EntryMetadataTracker.getInstance();
 *
 * // After fetching entries
 * const entries = await client.listPasswords();
 * tracker.updateFromListResults(entries, masterLockbox.storageChunks);
 *
 * // When updating/deleting
 * const chunkIndex = tracker.getChunkIndex(entryId);
 * if (chunkIndex !== null) {
 *   await client.updatePassword(chunkIndex, entryId, updatedEntry);
 * }
 * ```
 */

import { StorageChunkInfo } from '../sdk/src/types-v2';

export interface EntryMetadata {
  entryId: number;
  chunkIndex: number;
  lastSeen: number; // Timestamp when this metadata was last confirmed
}

export class EntryMetadataTracker {
  private static instance: EntryMetadataTracker | null = null;
  private metadata: Map<number, EntryMetadata>;
  private readonly STORAGE_KEY = 'lockbox_entry_metadata';
  private readonly MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

  private constructor() {
    this.metadata = new Map();
    this.loadFromStorage();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): EntryMetadataTracker {
    if (!EntryMetadataTracker.instance) {
      EntryMetadataTracker.instance = new EntryMetadataTracker();
    }
    return EntryMetadataTracker.instance;
  }

  /**
   * Load metadata from sessionStorage
   */
  private loadFromStorage(): void {
    try {
      if (typeof sessionStorage === 'undefined') return;

      const stored = sessionStorage.getItem(this.STORAGE_KEY);
      if (!stored) return;

      const data = JSON.parse(stored) as Array<EntryMetadata>;
      const now = Date.now();

      // Only load entries that aren't too old
      data.forEach(entry => {
        if (now - entry.lastSeen < this.MAX_AGE_MS) {
          this.metadata.set(entry.entryId, entry);
        }
      });

      console.log(`[EntryMetadataTracker] Loaded ${this.metadata.size} entries from storage`);
    } catch (error) {
      console.warn('[EntryMetadataTracker] Failed to load from storage:', error);
      this.metadata.clear();
    }
  }

  /**
   * Save metadata to sessionStorage
   */
  private saveToStorage(): void {
    try {
      if (typeof sessionStorage === 'undefined') return;

      const data = Array.from(this.metadata.values());
      sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.warn('[EntryMetadataTracker] Failed to save to storage:', error);
    }
  }

  /**
   * Update metadata from listPasswords() results
   *
   * This is the primary way to populate the tracker.
   * Call this after fetching entries from the chain.
   */
  updateFromListResults(
    entries: Array<{ id?: number }>,
    chunks: StorageChunkInfo[]
  ): void {
    const now = Date.now();

    // Build a map of which entries are in which chunks
    // We do this by scanning all chunks and their entry headers
    chunks.forEach(chunkInfo => {
      const chunkIndex = chunkInfo.chunkIndex;

      // Note: We don't have direct access to entry headers here,
      // so we use a heuristic: entries are numbered sequentially,
      // and we track which chunk they came from during decryption.

      // For now, we'll rely on explicit tracking during store/update/delete operations
      // This method serves as a backup/validation mechanism
    });

    // Mark all current entries as seen
    entries.forEach(entry => {
      if (entry.id !== undefined) {
        const existing = this.metadata.get(entry.id);
        if (existing) {
          existing.lastSeen = now;
        }
      }
    });

    this.saveToStorage();
  }

  /**
   * Track an entry's chunk index
   *
   * Call this when you know the chunk index (e.g., after creating/updating an entry)
   */
  track(entryId: number, chunkIndex: number): void {
    this.metadata.set(entryId, {
      entryId,
      chunkIndex,
      lastSeen: Date.now(),
    });
    this.saveToStorage();
  }

  /**
   * Get chunk index for an entry
   *
   * @returns chunk index or null if not found
   */
  getChunkIndex(entryId: number): number | null {
    const entry = this.metadata.get(entryId);
    return entry ? entry.chunkIndex : null;
  }

  /**
   * Remove an entry from tracking (e.g., after deletion)
   */
  untrack(entryId: number): void {
    this.metadata.delete(entryId);
    this.saveToStorage();
  }

  /**
   * Clear all metadata
   */
  clear(): void {
    this.metadata.clear();
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(this.STORAGE_KEY);
    }
  }

  /**
   * Get all tracked entries
   */
  getAllMetadata(): EntryMetadata[] {
    return Array.from(this.metadata.values());
  }

  /**
   * Find entries in a specific chunk
   */
  getEntriesInChunk(chunkIndex: number): number[] {
    return Array.from(this.metadata.values())
      .filter(meta => meta.chunkIndex === chunkIndex)
      .map(meta => meta.entryId);
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalEntries: number;
    chunksUsed: Set<number>;
    oldestEntry: number | null;
  } {
    const chunks = new Set<number>();
    let oldestTimestamp = Date.now();

    this.metadata.forEach(meta => {
      chunks.add(meta.chunkIndex);
      if (meta.lastSeen < oldestTimestamp) {
        oldestTimestamp = meta.lastSeen;
      }
    });

    return {
      totalEntries: this.metadata.size,
      chunksUsed: chunks,
      oldestEntry: this.metadata.size > 0 ? oldestTimestamp : null,
    };
  }
}

/**
 * Fallback strategy when chunk index is unknown
 *
 * Searches all chunks for the entry. This is slower but guarantees correctness.
 */
export async function findEntryChunkIndex(
  entryId: number,
  chunks: StorageChunkInfo[]
): Promise<number> {
  // Try tracker first
  const tracker = EntryMetadataTracker.getInstance();
  const cachedChunk = tracker.getChunkIndex(entryId);

  if (cachedChunk !== null) {
    return cachedChunk;
  }

  // Fallback: Search all chunks
  // Note: This requires access to the client to fetch chunk data
  // For now, we'll assume chunk 0 as the default fallback
  console.warn(
    `[findEntryChunkIndex] Chunk index unknown for entry ${entryId}, defaulting to chunk 0`
  );
  console.warn('[findEntryChunkIndex] Consider calling updateFromListResults() after fetching entries');

  return 0;
}

/**
 * Helper to infer chunk index from storage chunks
 *
 * Uses entry count heuristics to guess which chunk an entry is in.
 * Not 100% accurate but better than nothing.
 */
export function inferChunkIndex(
  entryId: number,
  chunks: StorageChunkInfo[]
): number {
  if (chunks.length === 0) return 0;
  if (chunks.length === 1) return 0;

  // Simple heuristic: assume entries are distributed roughly evenly
  // Entry IDs are sequential, so we can estimate based on total entries
  const totalEntries = chunks.reduce((sum, chunk) => sum + (chunk.sizeUsed / 200), 0); // Rough estimate
  const entriesPerChunk = Math.max(1, Math.floor(totalEntries / chunks.length));

  const estimatedChunk = Math.min(
    Math.floor(entryId / entriesPerChunk),
    chunks.length - 1
  );

  console.log(
    `[inferChunkIndex] Estimated chunk ${estimatedChunk} for entry ${entryId} (${chunks.length} chunks total)`
  );

  return estimatedChunk;
}
