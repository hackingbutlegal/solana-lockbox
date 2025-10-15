/**
 * Pending Changes Manager
 * 
 * Manages local changes to password entries before syncing to blockchain.
 * Enables batching multiple updates into a single transaction.
 * 
 * ## Features
 * - Queue local changes without blockchain writes
 * - Batch multiple operations into one transaction
 * - Conflict detection and resolution
 * - Change history and rollback support
 * - Optimistic UI updates
 * 
 * ## Usage
 * ```typescript
 * const manager = new PendingChangesManager();
 * 
 * // Queue changes
 * manager.addChange({ type: 'update', chunkIndex: 0, entryId: 1, entry: {...} });
 * manager.addChange({ type: 'update', chunkIndex: 0, entryId: 2, entry: {...} });
 * 
 * // Get pending count
 * const count = manager.getPendingCount(); // 2
 * 
 * // Sync all changes
 * await syncAll(manager.getAllChanges());
 * manager.clearAll();
 * ```
 */

import { PasswordEntry } from '../sdk/src/types-v2';

export enum ChangeType {
  Create = 'create',
  Update = 'update',
  Delete = 'delete',
}

export interface PendingChange {
  id: string; // Unique change ID
  type: ChangeType;
  timestamp: number; // When change was made
  
  // For update/delete
  chunkIndex?: number;
  entryId?: number;
  
  // For create/update
  entry?: PasswordEntry;
  
  // Original entry (for rollback)
  originalEntry?: PasswordEntry;
}

export interface ChangeStats {
  total: number;
  creates: number;
  updates: number;
  deletes: number;
  affectedEntries: number;
}

/**
 * Pending Changes Manager
 */
export class PendingChangesManager {
  private changes: Map<string, PendingChange>;
  private changeOrder: string[]; // Maintain insertion order
  
  constructor() {
    this.changes = new Map();
    this.changeOrder = [];
  }

  /**
   * Generate unique change ID
   */
  private generateChangeId(type: ChangeType, chunkIndex?: number, entryId?: number): string {
    if (type === ChangeType.Create) {
      return `create-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    return `${type}-${chunkIndex}-${entryId}`;
  }

  /**
   * Add a pending change
   * 
   * If an update/delete already exists for this entry, it replaces the previous change.
   */
  addChange(change: Omit<PendingChange, 'id' | 'timestamp'>): string {
    const id = this.generateChangeId(change.type, change.chunkIndex, change.entryId);
    
    // If this entry already has a pending change, remove it
    if (this.changes.has(id)) {
      this.changeOrder = this.changeOrder.filter(cid => cid !== id);
    }
    
    const pendingChange: PendingChange = {
      ...change,
      id,
      timestamp: Date.now(),
    };
    
    this.changes.set(id, pendingChange);
    this.changeOrder.push(id);
    
    return id;
  }

  /**
   * Add a create operation
   */
  addCreate(entry: PasswordEntry): string {
    return this.addChange({
      type: ChangeType.Create,
      entry,
    });
  }

  /**
   * Add an update operation
   */
  addUpdate(
    chunkIndex: number,
    entryId: number,
    entry: PasswordEntry,
    originalEntry?: PasswordEntry
  ): string {
    return this.addChange({
      type: ChangeType.Update,
      chunkIndex,
      entryId,
      entry,
      originalEntry,
    });
  }

  /**
   * Add a delete operation
   */
  addDelete(chunkIndex: number, entryId: number, originalEntry?: PasswordEntry): string {
    return this.addChange({
      type: ChangeType.Delete,
      chunkIndex,
      entryId,
      originalEntry,
    });
  }

  /**
   * Remove a specific change
   */
  removeChange(changeId: string): boolean {
    if (!this.changes.has(changeId)) {
      return false;
    }
    
    this.changes.delete(changeId);
    this.changeOrder = this.changeOrder.filter(id => id !== changeId);
    return true;
  }

  /**
   * Clear all pending changes
   */
  clearAll(): void {
    this.changes.clear();
    this.changeOrder = [];
  }

  /**
   * Get a specific change
   */
  getChange(changeId: string): PendingChange | undefined {
    return this.changes.get(changeId);
  }

  /**
   * Get all pending changes (in order)
   */
  getAllChanges(): PendingChange[] {
    return this.changeOrder.map(id => this.changes.get(id)!).filter(Boolean);
  }

  /**
   * Get changes by type
   */
  getChangesByType(type: ChangeType): PendingChange[] {
    return this.getAllChanges().filter(change => change.type === type);
  }

  /**
   * Get pending count
   */
  getPendingCount(): number {
    return this.changes.size;
  }

  /**
   * Check if there are pending changes
   */
  hasPendingChanges(): boolean {
    return this.changes.size > 0;
  }

  /**
   * Check if a specific entry has pending changes
   */
  hasChangeForEntry(chunkIndex: number, entryId: number): boolean {
    const updateId = this.generateChangeId(ChangeType.Update, chunkIndex, entryId);
    const deleteId = this.generateChangeId(ChangeType.Delete, chunkIndex, entryId);
    return this.changes.has(updateId) || this.changes.has(deleteId);
  }

  /**
   * Get pending change for a specific entry
   */
  getChangeForEntry(chunkIndex: number, entryId: number): PendingChange | undefined {
    const updateId = this.generateChangeId(ChangeType.Update, chunkIndex, entryId);
    const deleteId = this.generateChangeId(ChangeType.Delete, chunkIndex, entryId);
    return this.changes.get(updateId) || this.changes.get(deleteId);
  }

  /**
   * Get statistics about pending changes
   */
  getStats(): ChangeStats {
    const creates = this.getChangesByType(ChangeType.Create).length;
    const updates = this.getChangesByType(ChangeType.Update).length;
    const deletes = this.getChangesByType(ChangeType.Delete).length;
    
    // Count unique affected entries
    const affectedEntries = new Set<string>();
    this.getAllChanges().forEach(change => {
      if (change.chunkIndex !== undefined && change.entryId !== undefined) {
        affectedEntries.add(`${change.chunkIndex}-${change.entryId}`);
      }
    });
    
    return {
      total: this.changes.size,
      creates,
      updates,
      deletes,
      affectedEntries: affectedEntries.size,
    };
  }

  /**
   * Get summary text for UI display
   */
  getSummary(): string {
    const stats = this.getStats();
    const parts: string[] = [];
    
    if (stats.creates > 0) {
      parts.push(`${stats.creates} new`);
    }
    if (stats.updates > 0) {
      parts.push(`${stats.updates} updated`);
    }
    if (stats.deletes > 0) {
      parts.push(`${stats.deletes} deleted`);
    }
    
    if (parts.length === 0) {
      return 'No pending changes';
    }
    
    return parts.join(', ');
  }

  /**
   * Validate all changes before syncing
   */
  validateChanges(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    this.getAllChanges().forEach((change, index) => {
      // Validate create operations
      if (change.type === ChangeType.Create) {
        if (!change.entry) {
          errors.push(`Change ${index + 1}: Create operation missing entry data`);
        }
        if (change.entry && !change.entry.title) {
          errors.push(`Change ${index + 1}: Entry missing required title`);
        }
      }
      
      // Validate update operations
      if (change.type === ChangeType.Update) {
        if (change.chunkIndex === undefined || change.entryId === undefined) {
          errors.push(`Change ${index + 1}: Update operation missing chunkIndex or entryId`);
        }
        if (!change.entry) {
          errors.push(`Change ${index + 1}: Update operation missing entry data`);
        }
      }
      
      // Validate delete operations
      if (change.type === ChangeType.Delete) {
        if (change.chunkIndex === undefined || change.entryId === undefined) {
          errors.push(`Change ${index + 1}: Delete operation missing chunkIndex or entryId`);
        }
      }
    });
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Export changes for debugging
   */
  exportChanges(): string {
    return JSON.stringify({
      changes: this.getAllChanges(),
      stats: this.getStats(),
      timestamp: Date.now(),
    }, null, 2);
  }

  /**
   * Get rollback data for undo functionality
   */
  getRollbackData(): Map<string, PasswordEntry> {
    const rollbackData = new Map<string, PasswordEntry>();
    
    this.getAllChanges().forEach(change => {
      if (change.originalEntry && change.chunkIndex !== undefined && change.entryId !== undefined) {
        const key = `${change.chunkIndex}-${change.entryId}`;
        rollbackData.set(key, change.originalEntry);
      }
    });
    
    return rollbackData;
  }
}
