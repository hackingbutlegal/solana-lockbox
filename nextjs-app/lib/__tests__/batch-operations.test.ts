/**
 * Batch Operations Tests
 * 
 * Tests for batch operations functionality including:
 * - Multi-select management (O(1) operations)
 * - Batch updates (category, favorite, archive)
 * - Batch deletion with safety checks
 * - Undo system
 * - Progress tracking
 * - Validation and error handling
 */

import {
  MultiSelectManager,
  BatchOperationType,
  batchUpdateCategory,
  batchToggleFavorite,
  batchToggleArchive,
  batchDelete,
  undoBatchOperation,
  getSelectionStats,
  validateBatchOperation,
  BatchOperationResult,
  UndoData,
} from '../batch-operations';
import { PasswordEntry, PasswordEntryType } from '../../sdk/src/types-v2';

describe('Batch Operations', () => {
  // Helper to create test entries
  const createTestEntry = (
    id: number,
    title: string,
    options: Partial<PasswordEntry> = {}
  ): PasswordEntry => ({
    type: PasswordEntryType.Login,
    title,
    username: 'user@example.com',
    password: 'password123',
    createdAt: new Date(),
    lastModified: new Date(),
    id,
    ...options,
  });

  describe('MultiSelectManager', () => {
    let manager: MultiSelectManager;
    let entries: PasswordEntry[];

    beforeEach(() => {
      entries = [
        createTestEntry(1, 'Entry 1'),
        createTestEntry(2, 'Entry 2'),
        createTestEntry(3, 'Entry 3'),
      ];
      manager = new MultiSelectManager(entries);
    });

    describe('Selection Management', () => {
      it('should initialize with no selections', () => {
        expect(manager.getSelectedCount()).toBe(0);
        expect(manager.getSelectedIds()).toEqual([]);
      });

      it('should select a single entry', () => {
        manager.select(1);
        
        expect(manager.isSelected(1)).toBe(true);
        expect(manager.getSelectedCount()).toBe(1);
      });

      it('should deselect a single entry', () => {
        manager.select(1);
        manager.deselect(1);
        
        expect(manager.isSelected(1)).toBe(false);
        expect(manager.getSelectedCount()).toBe(0);
      });

      it('should toggle entry selection', () => {
        manager.toggle(1);
        expect(manager.isSelected(1)).toBe(true);
        
        manager.toggle(1);
        expect(manager.isSelected(1)).toBe(false);
      });

      it('should handle undefined entry IDs gracefully', () => {
        manager.select(undefined);
        manager.deselect(undefined);
        manager.toggle(undefined);
        
        expect(manager.getSelectedCount()).toBe(0);
      });

      it('should select all entries', () => {
        manager.selectAll();
        
        expect(manager.getSelectedCount()).toBe(3);
        expect(manager.isAllSelected()).toBe(true);
      });

      it('should deselect all entries', () => {
        manager.selectAll();
        manager.deselectAll();
        
        expect(manager.getSelectedCount()).toBe(0);
        expect(manager.isAllSelected()).toBe(false);
      });

      it('should detect when some (but not all) entries are selected', () => {
        manager.select(1);
        
        expect(manager.isSomeSelected()).toBe(true);
        expect(manager.isAllSelected()).toBe(false);
      });

      it('should get selected entries', () => {
        manager.select(1);
        manager.select(3);
        
        const selected = manager.getSelectedEntries();
        
        expect(selected.length).toBe(2);
        expect(selected[0].id).toBe(1);
        expect(selected[1].id).toBe(3);
      });
    });

    describe('Conditional Selection', () => {
      it('should select entries matching a predicate', () => {
        const entriesWithFavorite = [
          createTestEntry(1, 'Fav 1', { favorite: true }),
          createTestEntry(2, 'Not Fav', { favorite: false }),
          createTestEntry(3, 'Fav 2', { favorite: true }),
        ];
        manager = new MultiSelectManager(entriesWithFavorite);
        
        manager.selectWhere((entry) => entry.favorite === true);
        
        expect(manager.getSelectedCount()).toBe(2);
        expect(manager.isSelected(1)).toBe(true);
        expect(manager.isSelected(2)).toBe(false);
        expect(manager.isSelected(3)).toBe(true);
      });

      it('should select entries by type', () => {
        const mixedEntries = [
          createTestEntry(1, 'Login', { type: PasswordEntryType.Login }),
          createTestEntry(2, 'Note', { type: PasswordEntryType.SecureNote }),
          createTestEntry(3, 'Login 2', { type: PasswordEntryType.Login }),
        ];
        manager = new MultiSelectManager(mixedEntries);
        
        manager.selectWhere((entry) => entry.type === PasswordEntryType.Login);
        
        expect(manager.getSelectedCount()).toBe(2);
      });

      it('should select archived entries', () => {
        const entriesWithArchived = [
          createTestEntry(1, 'Active', { archived: false }),
          createTestEntry(2, 'Archived 1', { archived: true }),
          createTestEntry(3, 'Archived 2', { archived: true }),
        ];
        manager = new MultiSelectManager(entriesWithArchived);
        
        manager.selectWhere((entry) => entry.archived === true);
        
        expect(manager.getSelectedCount()).toBe(2);
      });
    });

    describe('Entry Updates', () => {
      it('should update entries list', () => {
        const newEntries = [
          createTestEntry(1, 'Entry 1'),
          createTestEntry(4, 'Entry 4'),
        ];
        
        manager.select(1);
        manager.select(2);
        
        manager.updateEntries(newEntries);
        
        // Entry 2 should be removed from selection (doesn't exist anymore)
        expect(manager.isSelected(1)).toBe(true);
        expect(manager.isSelected(2)).toBe(false);
      });

      it('should preserve valid selections after update', () => {
        manager.select(1);
        manager.select(3);
        
        const updatedEntries = [
          createTestEntry(1, 'Updated Entry 1'),
          createTestEntry(3, 'Updated Entry 3'),
        ];
        manager.updateEntries(updatedEntries);
        
        expect(manager.getSelectedCount()).toBe(2);
        expect(manager.isSelected(1)).toBe(true);
        expect(manager.isSelected(3)).toBe(true);
      });
    });

    describe('Edge Cases', () => {
      it('should handle empty entries list', () => {
        manager = new MultiSelectManager([]);
        
        expect(manager.getSelectedCount()).toBe(0);
        expect(manager.isAllSelected()).toBe(false);
      });

      it('should handle entries without IDs', () => {
        const entriesNoIds: PasswordEntry[] = [
          { ...createTestEntry(1, 'Entry 1'), id: undefined },
        ];
        manager = new MultiSelectManager(entriesNoIds);
        
        manager.selectAll();
        
        expect(manager.getSelectedCount()).toBe(0);
      });

      it('should use Set for O(1) lookup performance', () => {
        // Create many entries
        const manyEntries = Array.from({ length: 1000 }, (_, i) =>
          createTestEntry(i, `Entry ${i}`)
        );
        manager = new MultiSelectManager(manyEntries);
        
        manager.selectAll();
        
        // Should complete quickly (O(1) per check)
        const start = Date.now();
        for (let i = 0; i < 100; i++) {
          manager.isSelected(i);
        }
        const elapsed = Date.now() - start;
        
        // Should be very fast (<10ms for 100 lookups)
        expect(elapsed).toBeLessThan(10);
      });
    });
  });

  describe('Batch Update Category', () => {
    it('should update category for all entries', async () => {
      const entries = [
        createTestEntry(1, 'Entry 1', { category: 1 }),
        createTestEntry(2, 'Entry 2', { category: 1 }),
      ];
      
      const updateFn = jest.fn().mockResolvedValue(undefined);
      
      const result = await batchUpdateCategory(entries, 2, updateFn);
      
      expect(result.successful).toBe(2);
      expect(result.failed).toBe(0);
      expect(entries[0].category).toBe(2);
      expect(entries[1].category).toBe(2);
      expect(updateFn).toHaveBeenCalledTimes(2);
    });

    it('should provide undo data', async () => {
      const entries = [
        createTestEntry(1, 'Entry 1', { category: 1 }),
        createTestEntry(2, 'Entry 2', { category: 2 }),
      ];
      
      const updateFn = jest.fn().mockResolvedValue(undefined);
      
      const result = await batchUpdateCategory(entries, 3, updateFn);
      
      expect(result.undoData).toBeDefined();
      expect(result.undoData?.operation).toBe(BatchOperationType.UpdateCategory);
      expect(result.undoData?.entries.length).toBe(2);
      expect(result.undoData?.entries[0].previousState.category).toBe(1);
      expect(result.undoData?.entries[1].previousState.category).toBe(2);
    });

    it('should call progress callback', async () => {
      const entries = [
        createTestEntry(1, 'Entry 1'),
        createTestEntry(2, 'Entry 2'),
      ];
      
      const updateFn = jest.fn().mockResolvedValue(undefined);
      const progressFn = jest.fn();
      
      await batchUpdateCategory(entries, 1, updateFn, {
        onProgress: progressFn,
      });
      
      expect(progressFn).toHaveBeenCalledTimes(2);
      expect(progressFn).toHaveBeenCalledWith(1, 2, 'Entry 1');
      expect(progressFn).toHaveBeenCalledWith(2, 2, 'Entry 2');
    });

    it('should handle errors gracefully', async () => {
      const entries = [
        createTestEntry(1, 'Entry 1'),
        createTestEntry(2, 'Entry 2'),
      ];
      
      const updateFn = jest.fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Update failed'));
      
      const result = await batchUpdateCategory(entries, 1, updateFn);
      
      expect(result.successful).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0].error).toBe('Update failed');
    });

    it('should update lastModified timestamp', async () => {
      const oldDate = new Date('2024-01-01');
      const entries = [
        createTestEntry(1, 'Entry 1', { lastModified: oldDate }),
      ];
      
      const updateFn = jest.fn().mockResolvedValue(undefined);
      
      await batchUpdateCategory(entries, 1, updateFn);
      
      expect(entries[0].lastModified.getTime()).toBeGreaterThan(oldDate.getTime());
    });
  });

  describe('Batch Toggle Favorite', () => {
    it('should toggle favorite for all entries', async () => {
      const entries = [
        createTestEntry(1, 'Entry 1', { favorite: false }),
        createTestEntry(2, 'Entry 2', { favorite: false }),
      ];
      
      const updateFn = jest.fn().mockResolvedValue(undefined);
      
      const result = await batchToggleFavorite(entries, true, updateFn);
      
      expect(result.successful).toBe(2);
      expect(entries[0].favorite).toBe(true);
      expect(entries[1].favorite).toBe(true);
    });

    it('should provide undo data', async () => {
      const entries = [
        createTestEntry(1, 'Entry 1', { favorite: false }),
        createTestEntry(2, 'Entry 2', { favorite: true }),
      ];
      
      const updateFn = jest.fn().mockResolvedValue(undefined);
      
      const result = await batchToggleFavorite(entries, true, updateFn);
      
      expect(result.undoData?.entries[0].previousState.favorite).toBe(false);
      expect(result.undoData?.entries[1].previousState.favorite).toBe(true);
    });
  });

  describe('Batch Toggle Archive', () => {
    it('should toggle archive for all entries', async () => {
      const entries = [
        createTestEntry(1, 'Entry 1', { archived: false }),
        createTestEntry(2, 'Entry 2', { archived: false }),
      ];
      
      const updateFn = jest.fn().mockResolvedValue(undefined);
      
      const result = await batchToggleArchive(entries, true, updateFn);
      
      expect(result.successful).toBe(2);
      expect(entries[0].archived).toBe(true);
      expect(entries[1].archived).toBe(true);
    });

    it('should provide undo data', async () => {
      const entries = [
        createTestEntry(1, 'Entry 1', { archived: false }),
      ];
      
      const updateFn = jest.fn().mockResolvedValue(undefined);
      
      const result = await batchToggleArchive(entries, true, updateFn);
      
      expect(result.undoData?.operation).toBe(BatchOperationType.ToggleArchive);
      expect(result.undoData?.entries[0].previousState.archived).toBe(false);
    });
  });

  describe('Batch Delete', () => {
    it('should require confirmation by default', async () => {
      const entries = [createTestEntry(1, 'Entry 1')];
      const deleteFn = jest.fn().mockResolvedValue(undefined);
      
      await expect(batchDelete(entries, deleteFn)).rejects.toThrow(
        'Batch delete requires user confirmation'
      );
    });

    it('should delete entries when confirmation skipped', async () => {
      const entries = [
        createTestEntry(1, 'Entry 1'),
        createTestEntry(2, 'Entry 2'),
      ];
      
      const deleteFn = jest.fn().mockResolvedValue(undefined);
      
      const result = await batchDelete(entries, deleteFn, {
        skipConfirmation: true,
      });
      
      expect(result.successful).toBe(2);
      expect(deleteFn).toHaveBeenCalledTimes(2);
    });

    it('should not provide undo data (destructive operation)', async () => {
      const entries = [createTestEntry(1, 'Entry 1')];
      const deleteFn = jest.fn().mockResolvedValue(undefined);
      
      const result = await batchDelete(entries, deleteFn, {
        skipConfirmation: true,
      });
      
      expect(result.undoData).toBeUndefined();
    });

    it('should handle deletion errors', async () => {
      const entries = [
        createTestEntry(1, 'Entry 1'),
        createTestEntry(2, 'Entry 2'),
      ];
      
      const deleteFn = jest.fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Delete failed'));
      
      const result = await batchDelete(entries, deleteFn, {
        skipConfirmation: true,
      });
      
      expect(result.successful).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors[0].error).toBe('Delete failed');
    });

    it('should call progress callback', async () => {
      const entries = [createTestEntry(1, 'Entry 1')];
      const deleteFn = jest.fn().mockResolvedValue(undefined);
      const progressFn = jest.fn();
      
      await batchDelete(entries, deleteFn, {
        skipConfirmation: true,
        onProgress: progressFn,
      });
      
      expect(progressFn).toHaveBeenCalledWith(1, 1, 'Entry 1');
    });

    it('should allow empty array with confirmation', async () => {
      const deleteFn = jest.fn().mockResolvedValue(undefined);
      
      const result = await batchDelete([], deleteFn, {
        skipConfirmation: true,
      });
      
      expect(result.successful).toBe(0);
      expect(deleteFn).not.toHaveBeenCalled();
    });
  });

  describe('Undo Operations', () => {
    it('should restore previous state', async () => {
      const entries = [
        createTestEntry(1, 'Entry 1', { category: 1 }),
        createTestEntry(2, 'Entry 2', { category: 1 }),
      ];
      
      const updateFn = jest.fn().mockResolvedValue(undefined);
      
      // Perform batch update
      const result = await batchUpdateCategory(entries, 2, updateFn);
      
      // Undo the update
      const undoResult = await undoBatchOperation(
        result.undoData!,
        entries,
        updateFn
      );
      
      expect(undoResult.successful).toBe(2);
      expect(entries[0].category).toBe(1);
      expect(entries[1].category).toBe(1);
    });

    it('should handle undo errors gracefully', async () => {
      const entries = [createTestEntry(1, 'Entry 1', { category: 1 })];
      const updateFn = jest.fn().mockResolvedValue(undefined);
      
      const result = await batchUpdateCategory(entries, 2, updateFn);
      
      // Mock update failure on undo
      updateFn.mockRejectedValueOnce(new Error('Undo failed'));
      
      const undoResult = await undoBatchOperation(
        result.undoData!,
        entries,
        updateFn
      );
      
      expect(undoResult.failed).toBe(1);
      expect(undoResult.errors[0].error).toBe('Undo failed');
    });

    it('should handle missing entries during undo', async () => {
      const undoData: UndoData = {
        operation: BatchOperationType.UpdateCategory,
        entries: [
          { entryId: 999, previousState: { category: 1 } },
        ],
        timestamp: new Date(),
      };
      
      const entries: PasswordEntry[] = [];
      const updateFn = jest.fn().mockResolvedValue(undefined);
      
      const result = await undoBatchOperation(undoData, entries, updateFn);
      
      expect(result.failed).toBe(1);
      expect(result.errors[0].error).toBe('Entry not found');
    });

    it('should update lastModified on undo', async () => {
      const entries = [createTestEntry(1, 'Entry 1', { category: 1 })];
      const updateFn = jest.fn().mockResolvedValue(undefined);
      
      const result = await batchUpdateCategory(entries, 2, updateFn);
      
      const beforeUndo = entries[0].lastModified.getTime();
      
      await undoBatchOperation(result.undoData!, entries, updateFn);
      
      expect(entries[0].lastModified.getTime()).toBeGreaterThanOrEqual(beforeUndo);
    });
  });

  describe('Selection Statistics', () => {
    it('should calculate total count', () => {
      const entries = [
        createTestEntry(1, 'Entry 1'),
        createTestEntry(2, 'Entry 2'),
      ];
      
      const stats = getSelectionStats(entries);
      
      expect(stats.total).toBe(2);
    });

    it('should count by type', () => {
      const entries = [
        createTestEntry(1, 'Login', { type: PasswordEntryType.Login }),
        createTestEntry(2, 'Note', { type: PasswordEntryType.SecureNote }),
        createTestEntry(3, 'Login 2', { type: PasswordEntryType.Login }),
      ];
      
      const stats = getSelectionStats(entries);
      
      expect(stats.byType[PasswordEntryType.Login]).toBe(2);
      expect(stats.byType[PasswordEntryType.SecureNote]).toBe(1);
    });

    it('should count favorites', () => {
      const entries = [
        createTestEntry(1, 'Fav', { favorite: true }),
        createTestEntry(2, 'Not Fav', { favorite: false }),
      ];
      
      const stats = getSelectionStats(entries);
      
      expect(stats.favorites).toBe(1);
    });

    it('should count archived', () => {
      const entries = [
        createTestEntry(1, 'Archived', { archived: true }),
        createTestEntry(2, 'Active', { archived: false }),
      ];
      
      const stats = getSelectionStats(entries);
      
      expect(stats.archived).toBe(1);
    });

    it('should count by category', () => {
      const entries = [
        createTestEntry(1, 'Cat 1', { category: 1 }),
        createTestEntry(2, 'Cat 1 also', { category: 1 }),
        createTestEntry(3, 'Cat 2', { category: 2 }),
      ];
      
      const stats = getSelectionStats(entries);
      
      expect(stats.categories.get(1)).toBe(2);
      expect(stats.categories.get(2)).toBe(1);
    });

    it('should handle entries without categories', () => {
      const entries = [
        createTestEntry(1, 'No Cat', { category: undefined }),
        createTestEntry(2, 'Has Cat', { category: 1 }),
      ];
      
      const stats = getSelectionStats(entries);
      
      expect(stats.categories.get(1)).toBe(1);
      expect(stats.categories.has(undefined as any)).toBe(false);
    });
  });

  describe('Operation Validation', () => {
    it('should fail validation for empty selection', () => {
      const validation = validateBatchOperation(
        BatchOperationType.Delete,
        []
      );
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('No entries selected');
    });

    it('should warn about large deletions', () => {
      const entries = Array.from({ length: 150 }, (_, i) =>
        createTestEntry(i, `Entry ${i}`)
      );
      
      const validation = validateBatchOperation(
        BatchOperationType.Delete,
        entries
      );
      
      expect(validation.warnings.length).toBeGreaterThan(0);
      expect(validation.warnings[0]).toContain('cannot be undone');
    });

    it('should warn about deleting favorites', () => {
      const entries = [
        createTestEntry(1, 'Fav', { favorite: true }),
      ];
      
      const validation = validateBatchOperation(
        BatchOperationType.Delete,
        entries
      );
      
      expect(validation.warnings.some(w => w.includes('favorite'))).toBe(true);
    });

    it('should warn about large exports', () => {
      const entries = Array.from({ length: 1500 }, (_, i) =>
        createTestEntry(i, `Entry ${i}`)
      );
      
      const validation = validateBatchOperation(
        BatchOperationType.Export,
        entries
      );
      
      expect(validation.warnings.some(w => w.includes('may take a while'))).toBe(true);
    });

    it('should pass validation for safe operations', () => {
      const entries = [createTestEntry(1, 'Entry 1')];
      
      const validation = validateBatchOperation(
        BatchOperationType.UpdateCategory,
        entries
      );
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toEqual([]);
    });
  });
});
