/**
 * Batch Update Operations
 *
 * Client-side batch update utilities for password entries.
 * Handles batch archive, favorite, category assignment operations.
 *
 * ## Architecture
 *
 * Since the deployed Solana program doesn't have a dedicated batch update instruction,
 * we implement batch operations client-side by:
 * 1. Fetching current entry data
 * 2. Applying updates to multiple entries
 * 3. Sending individual update transactions
 * 4. Tracking success/failure for each entry
 *
 * ## Performance Considerations
 *
 * - Operations are sequential (one tx at a time) to avoid nonce conflicts
 * - Each operation requires ~0.000005 SOL in fees
 * - Large batches (50+ entries) may take 30+ seconds
 * - Failed operations can be retried individually
 *
 * ## Usage
 *
 * ```typescript
 * import { BatchUpdateOperations } from '@/lib/batch-update-operations';
 *
 * const batchOps = new BatchUpdateOperations(client);
 *
 * // Archive multiple entries
 * const result = await batchOps.archiveEntries([1, 2, 3, 4, 5]);
 * console.log(`Archived ${result.successful.length} entries`);
 * console.log(`Failed: ${result.failed.length} entries`);
 *
 * // Assign category to multiple entries
 * await batchOps.assignCategory([1, 2, 3], 5); // categoryId = 5
 * ```
 */

import { PasswordEntry } from '../sdk/src/types-v2';
import { EntryMetadataTracker, inferChunkIndex } from './entry-metadata-tracker';

export interface BatchOperationResult {
  successful: number[];
  failed: Array<{
    entryId: number;
    error: string;
  }>;
  totalAttempted: number;
  totalSuccessful: number;
  totalFailed: number;
}

export interface BatchUpdateProgress {
  current: number;
  total: number;
  entryId: number;
  status: 'pending' | 'success' | 'failed';
}

export type BatchProgressCallback = (progress: BatchUpdateProgress) => void;

export class BatchUpdateOperations {
  private client: any; // LockboxV2Client
  private tracker: EntryMetadataTracker;

  constructor(client: any) {
    this.client = client;
    this.tracker = EntryMetadataTracker.getInstance();
  }

  /**
   * Archive multiple entries
   */
  async archiveEntries(
    entryIds: number[],
    onProgress?: BatchProgressCallback
  ): Promise<BatchOperationResult> {
    return this.batchUpdate(
      entryIds,
      (entry) => ({ ...entry, archived: true }),
      'archive',
      onProgress
    );
  }

  /**
   * Unarchive multiple entries
   */
  async unarchiveEntries(
    entryIds: number[],
    onProgress?: BatchProgressCallback
  ): Promise<BatchOperationResult> {
    return this.batchUpdate(
      entryIds,
      (entry) => ({ ...entry, archived: false }),
      'unarchive',
      onProgress
    );
  }

  /**
   * Mark multiple entries as favorites
   */
  async favoriteEntries(
    entryIds: number[],
    onProgress?: BatchProgressCallback
  ): Promise<BatchOperationResult> {
    return this.batchUpdate(
      entryIds,
      (entry) => ({ ...entry, favorite: true }),
      'favorite',
      onProgress
    );
  }

  /**
   * Unmark multiple entries as favorites
   */
  async unfavoriteEntries(
    entryIds: number[],
    onProgress?: BatchProgressCallback
  ): Promise<BatchOperationResult> {
    return this.batchUpdate(
      entryIds,
      (entry) => ({ ...entry, favorite: false }),
      'unfavorite',
      onProgress
    );
  }

  /**
   * Assign category to multiple entries
   */
  async assignCategory(
    entryIds: number[],
    categoryId: number,
    onProgress?: BatchProgressCallback
  ): Promise<BatchOperationResult> {
    return this.batchUpdate(
      entryIds,
      (entry) => ({ ...entry, category: categoryId }),
      `assign category ${categoryId}`,
      onProgress
    );
  }

  /**
   * Generic batch update operation
   *
   * @param entryIds - Array of entry IDs to update
   * @param updateFn - Function that transforms each entry
   * @param operationName - Name for logging
   * @param onProgress - Optional progress callback
   */
  private async batchUpdate(
    entryIds: number[],
    updateFn: (entry: PasswordEntry) => Partial<PasswordEntry>,
    operationName: string,
    onProgress?: BatchProgressCallback
  ): Promise<BatchOperationResult> {
    const result: BatchOperationResult = {
      successful: [],
      failed: [],
      totalAttempted: entryIds.length,
      totalSuccessful: 0,
      totalFailed: 0,
    };

    console.log(`[BatchUpdate] Starting batch ${operationName} for ${entryIds.length} entries`);

    // Fetch all current entries
    const { entries } = await this.client.listPasswords();
    const entryMap = new Map<number, PasswordEntry>();
    entries.forEach((entry: PasswordEntry) => {
      if (entry.id !== undefined) {
        entryMap.set(entry.id, entry);
      }
    });

    // Get master lockbox for chunk info
    const master = await this.client.getMasterLockbox();

    // Process each entry sequentially to avoid nonce conflicts
    for (let i = 0; i < entryIds.length; i++) {
      const entryId = entryIds[i];

      // Notify progress
      if (onProgress) {
        onProgress({
          current: i + 1,
          total: entryIds.length,
          entryId,
          status: 'pending',
        });
      }

      try {
        // Get current entry data
        const currentEntry = entryMap.get(entryId);
        if (!currentEntry) {
          throw new Error(`Entry ${entryId} not found`);
        }

        // Apply update
        const updates = updateFn(currentEntry);
        const updatedEntry: PasswordEntry = {
          ...currentEntry,
          ...updates,
        };

        // Get chunk index (try tracker first, fallback to inference)
        let chunkIndex = this.tracker.getChunkIndex(entryId);
        if (chunkIndex === null) {
          chunkIndex = inferChunkIndex(entryId, master.storageChunks);
          console.warn(
            `[BatchUpdate] Chunk index unknown for entry ${entryId}, using inferred chunk ${chunkIndex}`
          );
        }

        // Update on-chain
        const success = await this.client.updatePassword(chunkIndex, entryId, updatedEntry);

        if (success) {
          result.successful.push(entryId);
          result.totalSuccessful++;

          if (onProgress) {
            onProgress({
              current: i + 1,
              total: entryIds.length,
              entryId,
              status: 'success',
            });
          }
        } else {
          throw new Error('Update returned false');
        }
      } catch (error: any) {
        console.error(`[BatchUpdate] Failed to ${operationName} entry ${entryId}:`, error);

        result.failed.push({
          entryId,
          error: error.message || 'Unknown error',
        });
        result.totalFailed++;

        if (onProgress) {
          onProgress({
            current: i + 1,
            total: entryIds.length,
            entryId,
            status: 'failed',
          });
        }
      }

      // Small delay between transactions to avoid overwhelming the RPC
      if (i < entryIds.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500)); // 500ms between txs
      }
    }

    console.log(
      `[BatchUpdate] Batch ${operationName} complete: ${result.totalSuccessful} successful, ${result.totalFailed} failed`
    );

    return result;
  }

  /**
   * Delete multiple entries
   *
   * Note: This is already implemented in the UI, but included here for completeness
   */
  async deleteEntries(
    entryIds: number[],
    onProgress?: BatchProgressCallback
  ): Promise<BatchOperationResult> {
    const result: BatchOperationResult = {
      successful: [],
      failed: [],
      totalAttempted: entryIds.length,
      totalSuccessful: 0,
      totalFailed: 0,
    };

    console.log(`[BatchUpdate] Starting batch delete for ${entryIds.length} entries`);

    // Get master lockbox for chunk info
    const master = await this.client.getMasterLockbox();

    // Process each entry sequentially
    for (let i = 0; i < entryIds.length; i++) {
      const entryId = entryIds[i];

      if (onProgress) {
        onProgress({
          current: i + 1,
          total: entryIds.length,
          entryId,
          status: 'pending',
        });
      }

      try {
        // Get chunk index
        let chunkIndex = this.tracker.getChunkIndex(entryId);
        if (chunkIndex === null) {
          chunkIndex = inferChunkIndex(entryId, master.storageChunks);
        }

        // Delete on-chain
        const success = await this.client.deletePassword(chunkIndex, entryId);

        if (success) {
          result.successful.push(entryId);
          result.totalSuccessful++;

          // Remove from tracker
          this.tracker.untrack(entryId);

          if (onProgress) {
            onProgress({
              current: i + 1,
              total: entryIds.length,
              entryId,
              status: 'success',
            });
          }
        } else {
          throw new Error('Delete returned false');
        }
      } catch (error: any) {
        console.error(`[BatchUpdate] Failed to delete entry ${entryId}:`, error);

        result.failed.push({
          entryId,
          error: error.message || 'Unknown error',
        });
        result.totalFailed++;

        if (onProgress) {
          onProgress({
            current: i + 1,
            total: entryIds.length,
            entryId,
            status: 'failed',
          });
        }
      }

      // Small delay between transactions
      if (i < entryIds.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(
      `[BatchUpdate] Batch delete complete: ${result.totalSuccessful} successful, ${result.totalFailed} failed`
    );

    return result;
  }
}
