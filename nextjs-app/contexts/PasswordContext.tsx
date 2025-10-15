'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useLockbox } from './LockboxContext';
import { PasswordEntry } from '../sdk/src/types-v2';

/**
 * Password Context - Password Operations
 *
 * Provides password CRUD operations:
 * - Password entries state
 * - CRUD operations (create, read, update, delete)
 * - Entry refresh
 * - Error handling for password operations
 */

export interface PasswordContextType {
  // Password Entries
  entries: PasswordEntry[];

  // Operations
  refreshEntries: () => Promise<void>;
  createEntry: (entry: PasswordEntry) => Promise<number | null>;
  updateEntry: (chunkIndex: number, entryId: number, entry: PasswordEntry) => Promise<boolean>;
  deleteEntry: (chunkIndex: number, entryId: number) => Promise<boolean>;

  // Loading/Error
  loading: boolean;
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
  const { client, isSessionActive, initializeSession, updateActivity, clearSession } = useAuth();
  const { masterLockbox } = useLockbox();

  // State
  const [entries, setEntries] = useState<PasswordEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Helper to check session timeout
  const checkSessionTimeout = useCallback(async (): Promise<boolean> => {
    if (!isSessionActive) {
      const initialized = await initializeSession();
      if (!initialized) {
        setError('Failed to initialize session');
        return false;
      }
    }
    return true;
  }, [isSessionActive, initializeSession]);

  // Refresh password entries
  const refreshEntries = useCallback(async () => {
    if (!client || !isSessionActive) return;

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
  }, [client, isSessionActive]);

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

      const result = await client.storePassword(entry);

      // Refresh entries after creation
      await refreshEntries();

      return result.entryId;
    } catch (err) {
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

      await client.updatePassword(chunkIndex, entryId, entry);

      // Refresh entries after update
      await refreshEntries();

      return true;
    } catch (err) {
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

      await client.deletePassword(chunkIndex, entryId);

      // Refresh entries after deletion
      await refreshEntries();

      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to delete entry';
      setError(errorMsg);
      return false;
    } finally {
      setLoading(false);
    }
  }, [client, checkSessionTimeout, updateActivity, refreshEntries]);

  // Refresh entries when master lockbox is loaded and session is active
  useEffect(() => {
    if (masterLockbox && isSessionActive) {
      refreshEntries();
    }
  }, [masterLockbox, isSessionActive, refreshEntries]);

  const contextValue: PasswordContextType = {
    entries,
    refreshEntries,
    createEntry,
    updateEntry,
    deleteEntry,
    loading,
    error,
  };

  return (
    <PasswordContext.Provider value={contextValue}>
      {children}
    </PasswordContext.Provider>
  );
}
