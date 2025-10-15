/**
 * Batch Operations Utility - Phase 4: Search & Intelligence
 *
 * Provides utilities for batch operations on multiple password entries:
 * - Multi-select management
 * - Bulk updates (category, favorite, archive)
 * - Bulk deletion with safety checks
 * - Progress tracking for long-running operations
 *
 * ## Safety Features
 *
 * - Confirmation required for destructive operations
 * - Undo support for bulk updates (stores previous state)
 * - Transaction batching for efficient on-chain operations
 * - Progress callbacks for UI updates
 *
 * @module batch-operations
 */

import { PasswordEntry, PasswordEntryType } from '../sdk/src/types-v2';

/**
 * Batch operation type
 */
export enum BatchOperationType {
  UpdateCategory = 'update_category',
  ToggleFavorite = 'toggle_favorite',
  ToggleArchive = 'toggle_archive',
  Delete = 'delete',
  Export = 'export',
}

/**
 * Batch operation result
 */
export interface BatchOperationResult {
  successful: number;
  failed: number;
  errors: Array<{ entryId: number | undefined; entryTitle: string; error: string }>;
  undoData?: UndoData; // For reversible operations
}

/**
 * Undo data for reversible operations
 */
export interface UndoData {
  operation: BatchOperationType;
  entries: Array<{
    entryId: number | undefined;
    previousState: Partial<PasswordEntry>;
  }>;
  timestamp: Date;
}

/**
 * Progress callback for long-running operations
 */
export type ProgressCallback = (current: number, total: number, currentEntry: string) => void;

/**
 * Batch operation options
 */
export interface BatchOperationOptions {
  onProgress?: ProgressCallback;
  skipConfirmation?: boolean; // For non-destructive operations
  batchSize?: number; // Number of operations per transaction batch (default: 10)
}

/**
 * Multi-select state manager
 */
export class MultiSelectManager {
  private selectedIds: Set<number | undefined>;
  private allEntries: PasswordEntry[];

  constructor(entries: PasswordEntry[] = []) {
    this.selectedIds = new Set();
    this.allEntries = entries;
  }

  /**
   * Update the full entries list (call when entries change)
   */
  updateEntries(entries: PasswordEntry[]): void {
    this.allEntries = entries;
    // Remove selected IDs that no longer exist
    const validIds = new Set(entries.map((e) => e.id));
    for (const id of this.selectedIds) {
      if (id !== undefined && !validIds.has(id)) {
        this.selectedIds.delete(id);
      }
    }
  }

  /**
   * Select a single entry
   */
  select(entryId: number | undefined): void {
    if (entryId !== undefined) {
      this.selectedIds.add(entryId);
    }
  }

  /**
   * Deselect a single entry
   */
  deselect(entryId: number | undefined): void {
    if (entryId !== undefined) {
      this.selectedIds.delete(entryId);
    }
  }

  /**
   * Toggle selection of a single entry
   */
  toggle(entryId: number | undefined): void {
    if (entryId === undefined) return;

    if (this.selectedIds.has(entryId)) {
      this.selectedIds.delete(entryId);
    } else {
      this.selectedIds.add(entryId);
    }
  }

  /**
   * Select all entries
   */
  selectAll(): void {
    for (const entry of this.allEntries) {
      if (entry.id !== undefined) {
        this.selectedIds.add(entry.id);
      }
    }
  }

  /**
   * Deselect all entries
   */
  deselectAll(): void {
    this.selectedIds.clear();
  }

  /**
   * Select entries matching a filter
   */
  selectWhere(predicate: (entry: PasswordEntry) => boolean): void {
    for (const entry of this.allEntries) {
      if (predicate(entry) && entry.id !== undefined) {
        this.selectedIds.add(entry.id);
      }
    }
  }

  /**
   * Check if an entry is selected
   */
  isSelected(entryId: number | undefined): boolean {
    if (entryId === undefined) return false;
    return this.selectedIds.has(entryId);
  }

  /**
   * Get count of selected entries
   */
  getSelectedCount(): number {
    return this.selectedIds.size;
  }

  /**
   * Get all selected entry IDs
   */
  getSelectedIds(): (number | undefined)[] {
    return Array.from(this.selectedIds);
  }

  /**
   * Get all selected entries
   */
  getSelectedEntries(): PasswordEntry[] {
    return this.allEntries.filter((entry) => this.isSelected(entry.id));
  }

  /**
   * Check if all entries are selected
   */
  isAllSelected(): boolean {
    if (this.allEntries.length === 0) return false;
    const entriesWithIds = this.allEntries.filter((e) => e.id !== undefined);
    return entriesWithIds.length === this.selectedIds.size;
  }

  /**
   * Check if some (but not all) entries are selected
   */
  isSomeSelected(): boolean {
    return this.selectedIds.size > 0 && !this.isAllSelected();
  }
}

/**
 * Batch update category for multiple entries
 *
 * @param entries - Entries to update
 * @param categoryId - New category ID
 * @param updateFn - Function to persist updates (called for each entry)
 * @param options - Operation options
 * @returns Operation result with undo data
 */
export async function batchUpdateCategory(
  entries: PasswordEntry[],
  categoryId: number,
  updateFn: (entry: PasswordEntry) => Promise<void>,
  options: BatchOperationOptions = {}
): Promise<BatchOperationResult> {
  const result: BatchOperationResult = {
    successful: 0,
    failed: 0,
    errors: [],
    undoData: {
      operation: BatchOperationType.UpdateCategory,
      entries: [],
      timestamp: new Date(),
    },
  };

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    try {
      // Store previous state for undo
      result.undoData?.entries.push({
        entryId: entry.id,
        previousState: { category: entry.category },
      });

      // Update entry
      entry.category = categoryId;
      entry.lastModified = new Date();

      // Persist update
      await updateFn(entry);

      result.successful++;

      // Progress callback
      if (options.onProgress) {
        options.onProgress(i + 1, entries.length, entry.title);
      }
    } catch (error) {
      result.failed++;
      result.errors.push({
        entryId: entry.id,
        entryTitle: entry.title,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return result;
}

/**
 * Batch toggle favorite status for multiple entries
 */
export async function batchToggleFavorite(
  entries: PasswordEntry[],
  favorite: boolean,
  updateFn: (entry: PasswordEntry) => Promise<void>,
  options: BatchOperationOptions = {}
): Promise<BatchOperationResult> {
  const result: BatchOperationResult = {
    successful: 0,
    failed: 0,
    errors: [],
    undoData: {
      operation: BatchOperationType.ToggleFavorite,
      entries: [],
      timestamp: new Date(),
    },
  };

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    try {
      // Store previous state
      result.undoData?.entries.push({
        entryId: entry.id,
        previousState: { favorite: entry.favorite },
      });

      // Update entry
      entry.favorite = favorite;
      entry.lastModified = new Date();

      // Persist update
      await updateFn(entry);

      result.successful++;

      if (options.onProgress) {
        options.onProgress(i + 1, entries.length, entry.title);
      }
    } catch (error) {
      result.failed++;
      result.errors.push({
        entryId: entry.id,
        entryTitle: entry.title,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return result;
}

/**
 * Batch toggle archive status for multiple entries
 */
export async function batchToggleArchive(
  entries: PasswordEntry[],
  archived: boolean,
  updateFn: (entry: PasswordEntry) => Promise<void>,
  options: BatchOperationOptions = {}
): Promise<BatchOperationResult> {
  const result: BatchOperationResult = {
    successful: 0,
    failed: 0,
    errors: [],
    undoData: {
      operation: BatchOperationType.ToggleArchive,
      entries: [],
      timestamp: new Date(),
    },
  };

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    try {
      // Store previous state
      result.undoData?.entries.push({
        entryId: entry.id,
        previousState: { archived: entry.archived },
      });

      // Update entry
      entry.archived = archived;
      entry.lastModified = new Date();

      // Persist update
      await updateFn(entry);

      result.successful++;

      if (options.onProgress) {
        options.onProgress(i + 1, entries.length, entry.title);
      }
    } catch (error) {
      result.failed++;
      result.errors.push({
        entryId: entry.id,
        entryTitle: entry.title,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return result;
}

/**
 * Batch delete entries
 *
 * DESTRUCTIVE OPERATION - No undo support
 * Requires confirmation (unless skipConfirmation is true)
 */
export async function batchDelete(
  entries: PasswordEntry[],
  deleteFn: (entry: PasswordEntry) => Promise<void>,
  options: BatchOperationOptions = {}
): Promise<BatchOperationResult> {
  const result: BatchOperationResult = {
    successful: 0,
    failed: 0,
    errors: [],
  };

  // Safety check
  if (!options.skipConfirmation && entries.length > 0) {
    throw new Error('Batch delete requires user confirmation. Set skipConfirmation: true after confirming.');
  }

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    try {
      // Delete entry
      await deleteFn(entry);

      result.successful++;

      if (options.onProgress) {
        options.onProgress(i + 1, entries.length, entry.title);
      }
    } catch (error) {
      result.failed++;
      result.errors.push({
        entryId: entry.id,
        entryTitle: entry.title,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return result;
}

/**
 * Undo a batch operation
 *
 * Restores previous state for all entries in the undo data.
 * Only works for reversible operations (not delete).
 */
export async function undoBatchOperation(
  undoData: UndoData,
  entries: PasswordEntry[],
  updateFn: (entry: PasswordEntry) => Promise<void>
): Promise<BatchOperationResult> {
  const result: BatchOperationResult = {
    successful: 0,
    failed: 0,
    errors: [],
  };

  // Build a map for quick lookup
  const entryMap = new Map<number | undefined, PasswordEntry>();
  for (const entry of entries) {
    entryMap.set(entry.id, entry);
  }

  for (const { entryId, previousState } of undoData.entries) {
    const entry = entryMap.get(entryId);
    if (!entry) {
      result.failed++;
      result.errors.push({
        entryId,
        entryTitle: 'Unknown',
        error: 'Entry not found',
      });
      continue;
    }

    try {
      // Restore previous state
      Object.assign(entry, previousState);
      entry.lastModified = new Date();

      // Persist update
      await updateFn(entry);

      result.successful++;
    } catch (error) {
      result.failed++;
      result.errors.push({
        entryId: entry.id,
        entryTitle: entry.title,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return result;
}

/**
 * Get summary statistics for selected entries
 */
export function getSelectionStats(entries: PasswordEntry[]): {
  total: number;
  byType: Record<PasswordEntryType, number>;
  favorites: number;
  archived: number;
  categories: Map<number, number>; // category ID -> count
} {
  const stats = {
    total: entries.length,
    byType: {
      [PasswordEntryType.Login]: 0,
      [PasswordEntryType.CreditCard]: 0,
      [PasswordEntryType.SecureNote]: 0,
      [PasswordEntryType.Identity]: 0,
      [PasswordEntryType.ApiKey]: 0,
      [PasswordEntryType.SshKey]: 0,
      [PasswordEntryType.CryptoWallet]: 0,
    } as Record<PasswordEntryType, number>,
    favorites: 0,
    archived: 0,
    categories: new Map<number, number>(),
  };

  for (const entry of entries) {
    stats.byType[entry.type]++;

    if (entry.favorite) {
      stats.favorites++;
    }

    if (entry.archived) {
      stats.archived++;
    }

    if (entry.category !== undefined) {
      const count = stats.categories.get(entry.category) || 0;
      stats.categories.set(entry.category, count + 1);
    }
  }

  return stats;
}

/**
 * Validate batch operation before execution
 *
 * Returns warnings and errors for the operation.
 */
export function validateBatchOperation(
  operation: BatchOperationType,
  entries: PasswordEntry[]
): {
  valid: boolean;
  warnings: string[];
  errors: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (entries.length === 0) {
    errors.push('No entries selected');
  }

  switch (operation) {
    case BatchOperationType.Delete:
      if (entries.length > 100) {
        warnings.push(`Deleting ${entries.length} entries. This operation cannot be undone.`);
      }
      const favoriteCount = entries.filter((e) => e.favorite).length;
      if (favoriteCount > 0) {
        warnings.push(`${favoriteCount} favorite entries will be deleted.`);
      }
      break;

    case BatchOperationType.UpdateCategory:
      // No specific validation
      break;

    case BatchOperationType.ToggleFavorite:
    case BatchOperationType.ToggleArchive:
      // No specific validation
      break;

    case BatchOperationType.Export:
      if (entries.length > 1000) {
        warnings.push(`Exporting ${entries.length} entries may take a while.`);
      }
      break;
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
  };
}
