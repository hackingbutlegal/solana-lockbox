'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { useLockbox } from './LockboxContext';
import { PasswordEntry } from '../sdk/src/types-v2';
import { PendingChangesManager, PendingChange, ChangeStats } from '../lib/pending-changes-manager';
import { withConflictHandling, isConflictError, getConflictMessage } from '../lib/conflict-handler';

/**
 * Password Context - Password Operations
 *
 * Provides password CRUD operations:
 * - Password entries state
 * - CRUD operations (create, read, update, delete)
 * - Entry refresh
 * - Error handling for password operations
 * - Batched updates for blockchain efficiency
 */

export interface PasswordContextType {
  // Password Entries
  entries: PasswordEntry[];

  // Immediate Operations (sends transaction immediately)
  refreshEntries: () => Promise<void>;
  createEntry: (entry: PasswordEntry) => Promise<number | null>;
  updateEntry: (chunkIndex: number, entryId: number, entry: PasswordEntry) => Promise<boolean>;
  deleteEntry: (chunkIndex: number, entryId: number) => Promise<boolean>;

  // Batched Operations (queues locally, syncs later)
  queueUpdate: (chunkIndex: number, entryId: number, entry: PasswordEntry) => void;
  queueDelete: (chunkIndex: number, entryId: number) => void;
  syncPendingChanges: () => Promise<boolean>;
  discardPendingChanges: () => void;

  // Pending Changes State
  pendingChanges: PendingChange[];
  pendingStats: ChangeStats;
  hasPendingChanges: boolean;

  // Loading/Error
  loading: boolean;
  syncing: boolean;
  error: string | null;
}

const PasswordContext = createContext<PasswordContextType | null>(null);

export function usePassword() {
  const context = useContext(PasswordContext);
  if (!context) {
    throw new Error('usePassword must be used within PasswordProvider');
  }
  return context;
}

interface PasswordProviderProps {
  children: React.ReactNode;
}

export function PasswordProvider({ children }: PasswordProviderProps) {
  const {
    client,
    isSessionActive,
    initializeSession,
    updateActivity,
    clearSession,
    checkSessionTimeout: checkAuthTimeout
  } = useAuth();
  const { masterLockbox } = useLockbox();

  // State
  const [entries, setEntries] = useState<PasswordEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track if we've already initialized to prevent multiple calls
  const hasInitialized = useRef(false);

  // Pending changes manager (persists across renders)
  const pendingChangesManager = useRef(new PendingChangesManager()).current;

  // Pending changes state (triggers re-renders)
  const [pendingChangesVersion, setPendingChangesVersion] = useState(0);

  // Derived state from pending changes
  const pendingChanges = useMemo(() =>
    pendingChangesManager.getAllChanges(),
    [pendingChangesManager, pendingChangesVersion]
  );

  const pendingStats = useMemo(() =>
    pendingChangesManager.getStats(),
    [pendingChangesManager, pendingChangesVersion]
  );

  const hasPendingChanges = useMemo(() =>
    pendingChangesManager.hasPendingChanges(),
    [pendingChangesManager, pendingChangesVersion]
  );

  // Trigger re-render when pending changes update
  const notifyPendingChanges = useCallback(() => {
    setPendingChangesVersion(v => v + 1);
  }, []);

  // SECURITY: Check session timeout before sensitive operations
  const checkSessionTimeout = useCallback(async (): Promise<boolean> => {
    try {
      // First check if session has timed out
      checkAuthTimeout();

      // If session is not active, initialize it
      if (!isSessionActive) {
        const initialized = await initializeSession();
        if (!initialized) {
          setError('Failed to initialize session');
          return false;
        }
      }
      return true;
    } catch (err) {
      // Session timeout error
      const errorMsg = err instanceof Error ? err.message : 'Session expired';
      setError(errorMsg);
      return false;
    }
  }, [checkAuthTimeout, isSessionActive, initializeSession]);

  // Refresh password entries
  const refreshEntries = useCallback(async () => {
    if (!client) {
      return;
    }

    // If session is not active, try to initialize it first
    if (!isSessionActive) {
      const initialized = await initializeSession();
      if (!initialized) {
        setError('Please sign the message to decrypt your passwords');
        return;
      }
    }

    try {
      setLoading(true);
      setError(null);

      const result = await client.listPasswords();

      // Handle new return format with errors
      setEntries(result.entries);

      // Surface decryption errors to user
      if (result.errors && result.errors.length > 0) {
        console.warn(`${result.errors.length} entries could not be decrypted:`, result.errors);

        // Show warning to user (non-blocking)
        const errorSummary = `Warning: ${result.errors.length} password(s) could not be loaded. This may indicate data corruption or a wrong encryption key.`;
        setError(errorSummary);

        // Store detailed errors for debugging
        (window as any).__lockboxDecryptionErrors = result.errors;
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch entries';
      setError(errorMsg);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [client, isSessionActive, initializeSession]);

  // Create new password entry
  const createEntry = useCallback(async (entry: PasswordEntry): Promise<number | null> => {
    if (!client) {
      setError('Client not initialized');
      return null;
    }

    // Check session and initialize if needed
    const sessionValid = await checkSessionTimeout();
    if (!sessionValid) {
      return null;
    }

    // Update activity timestamp
    updateActivity();

    try {
      setLoading(true);
      setError(null);

      // Wrap with conflict handling and auto-retry
      const result = await withConflictHandling(
        () => client.storePassword(entry),
        refreshEntries, // Auto-refresh on conflict
        3 // Max 3 retries
      );

      // Refresh entries after creation
      await refreshEntries();

      return result.entryId;
    } catch (err) {
      // Check if it's a conflict error
      if (isConflictError(err)) {
        const conflictMsg = getConflictMessage(err as any);
        setError(conflictMsg);
        throw new Error(conflictMsg);
      }

      const errorMsg = err instanceof Error ? err.message : 'Failed to create entry';
      setError(errorMsg);
      // Re-throw error so calling component can handle it with UI feedback
      throw err;
    } finally {
      setLoading(false);
    }
  }, [client, checkSessionTimeout, updateActivity, refreshEntries]);

  // Update existing password entry
  const updateEntry = useCallback(async (
    chunkIndex: number,
    entryId: number,
    entry: PasswordEntry
  ): Promise<boolean> => {
    if (!client) {
      setError('Client not initialized');
      return false;
    }

    // Check session and initialize if needed
    const sessionValid = await checkSessionTimeout();
    if (!sessionValid) {
      return false;
    }

    // Update activity timestamp
    updateActivity();

    try {
      setLoading(true);
      setError(null);

      // Wrap with conflict handling and auto-retry
      await withConflictHandling(
        () => client.updatePassword(chunkIndex, entryId, entry),
        refreshEntries, // Auto-refresh on conflict
        3 // Max 3 retries
      );

      // Refresh entries after update
      await refreshEntries();

      return true;
    } catch (err) {
      // Check if it's a conflict error
      if (isConflictError(err)) {
        const conflictMsg = getConflictMessage(err as any);
        setError(conflictMsg);
        return false;
      }

      const errorMsg = err instanceof Error ? err.message : 'Failed to update entry';
      setError(errorMsg);
      return false;
    } finally {
      setLoading(false);
    }
  }, [client, checkSessionTimeout, updateActivity, refreshEntries]);

  // Delete password entry
  const deleteEntry = useCallback(async (
    chunkIndex: number,
    entryId: number
  ): Promise<boolean> => {
    if (!client) {
      setError('Client not initialized');
      return false;
    }

    // Check session and initialize if needed
    const sessionValid = await checkSessionTimeout();
    if (!sessionValid) {
      return false;
    }

    // Update activity timestamp
    updateActivity();

    try {
      setLoading(true);
      setError(null);

      // Wrap with conflict handling and auto-retry
      await withConflictHandling(
        () => client.deletePassword(chunkIndex, entryId),
        refreshEntries, // Auto-refresh on conflict
        3 // Max 3 retries
      );

      // Refresh entries after deletion
      await refreshEntries();

      return true;
    } catch (err) {
      // Check if it's a conflict error
      if (isConflictError(err)) {
        const conflictMsg = getConflictMessage(err as any);
        setError(conflictMsg);
        return false;
      }

      const errorMsg = err instanceof Error ? err.message : 'Failed to delete entry';
      setError(errorMsg);
      return false;
    } finally {
      setLoading(false);
    }
  }, [client, checkSessionTimeout, updateActivity, refreshEntries]);

  // ============================================================================
  // BATCHED OPERATIONS
  // ============================================================================

  /**
   * Queue an update locally (doesn't send transaction)
   * Changes are applied optimistically to the UI
   */
  const queueUpdate = useCallback((
    chunkIndex: number,
    entryId: number,
    entry: PasswordEntry
  ) => {
    // Find original entry for rollback
    const originalEntry = entries.find(e => e.id === entryId);

    // Add to pending changes
    pendingChangesManager.addUpdate(chunkIndex, entryId, entry, originalEntry);
    notifyPendingChanges();

    // Apply optimistically to UI
    setEntries(prevEntries =>
      prevEntries.map(e => e.id === entryId ? { ...entry, id: entryId } : e)
    );
  }, [entries, pendingChangesManager, notifyPendingChanges]);

  /**
   * Queue a delete locally (doesn't send transaction)
   * Changes are applied optimistically to the UI
   */
  const queueDelete = useCallback((
    chunkIndex: number,
    entryId: number
  ) => {
    // Find original entry for rollback
    const originalEntry = entries.find(e => e.id === entryId);

    // Add to pending changes
    pendingChangesManager.addDelete(chunkIndex, entryId, originalEntry);
    notifyPendingChanges();

    // Apply optimistically to UI
    setEntries(prevEntries => prevEntries.filter(e => e.id !== entryId));
  }, [entries, pendingChangesManager, notifyPendingChanges]);

  /**
   * Sync all pending changes to blockchain in a batched transaction
   */
  const syncPendingChanges = useCallback(async (): Promise<boolean> => {
    if (!client) {
      setError('Client not initialized');
      return false;
    }

    if (!pendingChangesManager.hasPendingChanges()) {
      return true; // Nothing to sync
    }

    // Validate changes before syncing
    const validation = pendingChangesManager.validateChanges();
    if (!validation.valid) {
      setError(`Invalid changes: ${validation.errors.join(', ')}`);
      return false;
    }

    // Check session and initialize if needed
    const sessionValid = await checkSessionTimeout();
    if (!sessionValid) {
      return false;
    }

    // Update activity timestamp
    updateActivity();

    try {
      setSyncing(true);
      setError(null);

      const changes = pendingChangesManager.getAllChanges();
      console.log(`[PasswordContext] Syncing ${changes.length} pending changes...`);

      // Separate changes by type
      const updates = changes.filter(c => c.type === 'update');
      const deletes = changes.filter(c => c.type === 'delete');
      const creates = changes.filter(c => c.type === 'create');

      let successCount = 0;
      let failCount = 0;
      const failedChanges: any[] = []; // Track which specific changes failed for retry

      // BATCH UPDATES: Send all updates in a single transaction (max 10 per batch)
      if (updates.length > 0) {
        console.log(`📦 Batching ${updates.length} updates into single transaction(s)...`);

        // Split into batches of 10 (Solana transaction size limit)
        const updateBatches = [];
        for (let i = 0; i < updates.length; i += 10) {
          updateBatches.push(updates.slice(i, i + 10));
        }

        for (const batch of updateBatches) {
          try {
            const batchUpdates = batch
              .filter(c => c.chunkIndex !== undefined && c.entryId !== undefined && c.entry)
              .map(c => ({
                chunkIndex: c.chunkIndex!,
                entryId: c.entryId!,
                updatedEntry: c.entry!,
              }));

            if (batchUpdates.length > 0) {
              await client.batchUpdatePasswords(batchUpdates);
              successCount += batchUpdates.length;
              console.log(`✅ Batch of ${batchUpdates.length} updates succeeded`);
            }
          } catch (err) {
            console.error(`[PasswordContext] Failed to sync batch of updates:`, err);
            failCount += batch.length;
            // BUGFIX: Track which entries failed so they can be retried
            failedChanges.push(...batch);
          }
        }
      }

      // DELETES: Process sequentially (can't batch deletes easily in one tx)
      for (const change of deletes) {
        try {
          if (change.chunkIndex !== undefined && change.entryId !== undefined) {
            await client.deletePassword(change.chunkIndex, change.entryId);
            successCount++;
          }
        } catch (err) {
          console.error(`[PasswordContext] Failed to delete entry ${change.entryId}:`, err);
          failCount++;
          // BUGFIX: Track which entries failed so they can be retried
          failedChanges.push(change);
        }
      }

      // CREATES: Process sequentially (each needs new chunk allocation check)
      for (const change of creates) {
        try {
          if (change.entry) {
            await client.storePassword(change.entry);
            successCount++;
          }
        } catch (err) {
          console.error(`[PasswordContext] Failed to create entry:`, err);
          failCount++;
          // BUGFIX: Track which entries failed so they can be retried
          failedChanges.push(change);
        }
      }

      console.log(`[PasswordContext] Sync complete: ${successCount} success, ${failCount} failed`);

      // BUGFIX: Clear only successful changes, keep failed ones for retry
      if (failCount === 0) {
        // All operations succeeded - clear everything
        pendingChangesManager.clearAll();
        notifyPendingChanges();

        // Refresh entries from blockchain
        await refreshEntries();

        return true;
      } else {
        // Partial failure - keep only failed changes for retry
        // Remove all changes first, then re-add only the failed ones
        const failedChangeIds = new Set(failedChanges.map(c => c.id));
        const allChanges = pendingChangesManager.getAllChanges();

        pendingChangesManager.clearAll();

        // Re-add only the changes that failed
        for (const change of allChanges) {
          if (failedChangeIds.has(change.id)) {
            // Re-add the failed change
            if (change.type === 'create' && change.entry) {
              pendingChangesManager.addChange('create', undefined, undefined, change.entry);
            } else if (change.type === 'update' && change.chunkIndex !== undefined && change.entryId !== undefined && change.entry) {
              pendingChangesManager.addChange('update', change.chunkIndex, change.entryId, change.entry, change.originalEntry);
            } else if (change.type === 'delete' && change.chunkIndex !== undefined && change.entryId !== undefined) {
              pendingChangesManager.addChange('delete', change.chunkIndex, change.entryId, undefined, change.originalEntry);
            }
          }
        }

        notifyPendingChanges();

        // Partial success - refresh to show successful changes
        await refreshEntries();

        setError(
          `Sync partially completed: ${successCount} operations succeeded, ${failCount} failed. ` +
          `Failed operations have been retained and will be retried on next sync.`
        );
        return false;
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to sync changes';
      setError(errorMsg);
      return false;
    } finally {
      setSyncing(false);
    }
  }, [client, pendingChangesManager, checkSessionTimeout, updateActivity, refreshEntries, notifyPendingChanges]);

  /**
   * Discard all pending changes and revert to blockchain state
   */
  const discardPendingChanges = useCallback(async () => {
    pendingChangesManager.clearAll();
    notifyPendingChanges();

    // Refresh from blockchain to revert optimistic updates
    await refreshEntries();
  }, [pendingChangesManager, notifyPendingChanges, refreshEntries]);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Refresh entries when master lockbox is loaded (only once)
  // Session will be initialized automatically if needed by refreshEntries
  useEffect(() => {
    if (masterLockbox && !hasInitialized.current) {
      hasInitialized.current = true;
      refreshEntries();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [masterLockbox]); // Only depend on masterLockbox, not refreshEntries

  const contextValue: PasswordContextType = {
    entries,
    refreshEntries,
    createEntry,
    updateEntry,
    deleteEntry,
    queueUpdate,
    queueDelete,
    syncPendingChanges,
    discardPendingChanges,
    pendingChanges,
    pendingStats,
    hasPendingChanges,
    loading,
    syncing,
    error,
  };

  return (
    <PasswordContext.Provider value={contextValue}>
      {children}
    </PasswordContext.Provider>
  );
}
