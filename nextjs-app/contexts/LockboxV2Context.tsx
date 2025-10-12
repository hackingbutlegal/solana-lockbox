'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import { LockboxV2Client } from '../sdk/src/client-v2';
import { PasswordEntry, MasterLockbox, SubscriptionTier } from '../sdk/src/types-v2';
import { generateChallenge, createSessionKeyFromSignature, wipeSensitiveData } from '../lib/crypto';

/**
 * Lockbox V2 Context - Password Manager State Management
 *
 * Provides access to:
 * - Lockbox V2 client instance
 * - Password entries (cached, refreshable)
 * - Master lockbox metadata
 * - Session key management
 * - Loading states
 */

interface LockboxV2ContextType {
  // Client
  client: LockboxV2Client | null;

  // Session
  sessionKey: Uint8Array | null;
  isInitialized: boolean;
  initializeSession: () => Promise<boolean>;
  clearSession: () => void;

  // Master Lockbox
  masterLockbox: MasterLockbox | null;
  refreshMasterLockbox: () => Promise<void>;

  // Password Entries
  entries: PasswordEntry[];
  refreshEntries: () => Promise<void>;

  // CRUD Operations
  createEntry: (entry: PasswordEntry) => Promise<number | null>;
  updateEntry: (chunkIndex: number, entryId: number, entry: PasswordEntry) => Promise<boolean>;
  deleteEntry: (chunkIndex: number, entryId: number) => Promise<boolean>;

  // Loading States
  loading: boolean;
  error: string | null;
}

const LockboxV2Context = createContext<LockboxV2ContextType | null>(null);

export function useLockboxV2() {
  const context = useContext(LockboxV2Context);
  if (!context) {
    throw new Error('useLockboxV2 must be used within LockboxV2Provider');
  }
  return context;
}

interface LockboxV2ProviderProps {
  children: React.ReactNode;
  programId: string;
}

export function LockboxV2Provider({ children, programId }: LockboxV2ProviderProps) {
  const { publicKey, signMessage } = useWallet();
  const { connection } = useConnection();

  // State
  const [sessionKey, setSessionKey] = useState<Uint8Array | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [masterLockbox, setMasterLockbox] = useState<MasterLockbox | null>(null);
  const [entries, setEntries] = useState<PasswordEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create client instance (memoized)
  const client = useMemo(() => {
    if (!publicKey || !connection) return null;

    try {
      // Create minimal wallet interface for client
      const wallet = {
        publicKey,
        signTransaction: async (tx: any) => tx, // Not needed for most operations
        signAllTransactions: async (txs: any[]) => txs,
      };

      // Create client with options
      return new LockboxV2Client({
        connection,
        wallet: wallet as any,
        programId: new PublicKey(programId),
      });
    } catch (err) {
      console.error('Failed to create LockboxV2Client:', err);
      return null;
    }
  }, [publicKey, connection, programId]);

  // Initialize session key from wallet signature
  const initializeSession = useCallback(async (): Promise<boolean> => {
    if (!publicKey || !signMessage) {
      setError('Wallet not connected');
      return false;
    }

    if (sessionKey) {
      return true; // Already initialized
    }

    try {
      setLoading(true);
      setError(null);

      // Generate challenge and get signature
      const challenge = generateChallenge(publicKey);
      const signature = await signMessage(challenge);

      // Derive session key
      const { sessionKey: derivedKey } = await createSessionKeyFromSignature(
        publicKey,
        signature
      );

      setSessionKey(derivedKey);
      setIsInitialized(true);

      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to initialize session';
      setError(errorMsg);
      return false;
    } finally {
      setLoading(false);
    }
  }, [publicKey, signMessage, sessionKey]);

  // Clear session and wipe sensitive data
  const clearSession = useCallback(() => {
    if (sessionKey) {
      wipeSensitiveData(sessionKey);
    }
    setSessionKey(null);
    setIsInitialized(false);
    setEntries([]);
    setMasterLockbox(null);
  }, [sessionKey]);

  // Refresh master lockbox data
  const refreshMasterLockbox = useCallback(async () => {
    if (!client) return;

    try {
      setLoading(true);
      setError(null);

      // Check if lockbox exists first
      const exists = await client.exists();

      if (!exists) {
        setMasterLockbox(null);
        setLoading(false);
        return;
      }

      const lockbox = await client.getMasterLockbox();
      setMasterLockbox(lockbox);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch master lockbox';
      console.error('Failed to refresh master lockbox:', errorMsg);

      // Program not properly initialized - this is expected for v2
      if (errorMsg.includes('program') || errorMsg.includes('masterLockbox') || errorMsg.includes('undefined')) {
        setError('v2 Program IDL not loaded. Using v1 lockbox for now.');
        setMasterLockbox(null);
      } else {
        setError(errorMsg);
        setMasterLockbox(null);
      }
    } finally {
      setLoading(false);
    }
  }, [client]);

  // Refresh password entries
  const refreshEntries = useCallback(async () => {
    if (!client || !sessionKey) return;

    try {
      setLoading(true);
      setError(null);

      const fetchedEntries = await client.listPasswords();
      setEntries(fetchedEntries);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch entries';
      setError(errorMsg);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [client, sessionKey]);

  // Create new password entry
  const createEntry = useCallback(async (entry: PasswordEntry): Promise<number | null> => {
    if (!client || !sessionKey) {
      setError('Session not initialized');
      return null;
    }

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
      return null;
    } finally {
      setLoading(false);
    }
  }, [client, sessionKey, refreshEntries]);

  // Update existing password entry
  const updateEntry = useCallback(async (
    chunkIndex: number,
    entryId: number,
    entry: PasswordEntry
  ): Promise<boolean> => {
    if (!client || !sessionKey) {
      setError('Session not initialized');
      return false;
    }

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
  }, [client, sessionKey, refreshEntries]);

  // Delete password entry
  const deleteEntry = useCallback(async (
    chunkIndex: number,
    entryId: number
  ): Promise<boolean> => {
    if (!client || !sessionKey) {
      setError('Session not initialized');
      return false;
    }

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
  }, [client, sessionKey, refreshEntries]);

  // Auto-refresh master lockbox when wallet connects
  useEffect(() => {
    if (publicKey && client) {
      refreshMasterLockbox();
    }
  }, [publicKey, client]);

  // Clear session when wallet disconnects
  useEffect(() => {
    if (!publicKey) {
      clearSession();
    }
  }, [publicKey, clearSession]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sessionKey) {
        wipeSensitiveData(sessionKey);
      }
    };
  }, []);

  const contextValue: LockboxV2ContextType = {
    client,
    sessionKey,
    isInitialized,
    initializeSession,
    clearSession,
    masterLockbox,
    refreshMasterLockbox,
    entries,
    refreshEntries,
    createEntry,
    updateEntry,
    deleteEntry,
    loading,
    error,
  };

  return (
    <LockboxV2Context.Provider value={contextValue}>
      {children}
    </LockboxV2Context.Provider>
  );
}
