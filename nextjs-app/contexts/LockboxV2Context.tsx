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
  // SECURITY FIX (C-2): sessionKey no longer exposed in context
  // Use isInitialized to check session status
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
  const wallet = useWallet();
  const { publicKey, signMessage, signTransaction } = wallet;
  const { connection } = useConnection();

  // SECURITY FIX (C-2): Use secure session key storage
  // WeakMap prevents session key from being exposed in React DevTools
  // and provides better memory isolation from browser extensions
  const sessionKeyStorage = useMemo(() => new WeakMap<symbol, Uint8Array>(), []);
  const [sessionKeyRef] = useState(() => Symbol('sessionKey'));

  // Helper to get session key from secure storage
  const getSessionKey = useCallback((): Uint8Array | null => {
    return sessionKeyStorage.get(sessionKeyRef) || null;
  }, [sessionKeyStorage, sessionKeyRef]);

  // Helper to set session key in secure storage
  const setSessionKey = useCallback((key: Uint8Array | null) => {
    if (key === null) {
      sessionKeyStorage.delete(sessionKeyRef);
    } else {
      sessionKeyStorage.set(sessionKeyRef, key);
    }
  }, [sessionKeyStorage, sessionKeyRef]);

  // State
  const [isInitialized, setIsInitialized] = useState(false);
  const [masterLockbox, setMasterLockbox] = useState<MasterLockbox | null>(null);
  const [entries, setEntries] = useState<PasswordEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // SECURITY FIX (C-3): Session timeout management
  // Track session creation time and last activity for timeout enforcement
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [lastActivityTime, setLastActivityTime] = useState<number | null>(null);

  // SECURITY FIX (C-3): Session timeout constants
  const SESSION_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
  const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes of inactivity

  // SECURITY FIX (C-3): Check if session has timed out
  const isSessionTimedOut = useCallback((): boolean => {
    if (!sessionStartTime || !lastActivityTime) {
      return false; // No session active
    }

    const now = Date.now();
    const sessionAge = now - sessionStartTime;
    const inactivityTime = now - lastActivityTime;

    // Check absolute timeout (15 minutes from session start)
    if (sessionAge > SESSION_TIMEOUT_MS) {
      return true;
    }

    // Check inactivity timeout (5 minutes since last activity)
    if (inactivityTime > INACTIVITY_TIMEOUT_MS) {
      return true;
    }

    return false;
  }, [sessionStartTime, lastActivityTime]);

  // SECURITY FIX (C-3): Update last activity timestamp
  const updateActivity = useCallback(() => {
    setLastActivityTime(Date.now());
  }, []);

  // Create client instance (memoized)
  const client = useMemo(() => {
    if (!publicKey || !connection || !signTransaction) return null;

    try {
      // Use the actual wallet from useWallet hook
      return new LockboxV2Client({
        connection,
        wallet: wallet as any,
        programId: new PublicKey(programId),
      });
    } catch (err) {
      console.error('Failed to create LockboxV2Client:', err);
      return null;
    }
  }, [publicKey, connection, signTransaction, wallet, programId]);

  // Initialize session key from wallet signature
  const initializeSession = useCallback(async (): Promise<boolean> => {
    if (!publicKey || !signMessage) {
      setError('Wallet not connected');
      return false;
    }

    // SECURITY FIX (C-2): Use secure storage accessor
    if (getSessionKey()) {
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

      // SECURITY FIX (C-2): Store in secure WeakMap storage
      setSessionKey(derivedKey);
      setIsInitialized(true);

      // SECURITY FIX (C-3): Set session timestamps
      const now = Date.now();
      setSessionStartTime(now);
      setLastActivityTime(now);

      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to initialize session';
      setError(errorMsg);
      return false;
    } finally {
      setLoading(false);
    }
  }, [publicKey, signMessage, getSessionKey, setSessionKey]);

  // Clear session and wipe sensitive data
  const clearSession = useCallback(() => {
    // SECURITY FIX (C-2): Use secure storage accessor
    const key = getSessionKey();
    if (key) {
      wipeSensitiveData(key);
    }
    setSessionKey(null);
    setIsInitialized(false);
    setEntries([]);
    setMasterLockbox(null);

    // SECURITY FIX (C-3): Clear session timestamps
    setSessionStartTime(null);
    setLastActivityTime(null);
  }, [getSessionKey, setSessionKey]);

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

      // If master lockbox not found, that's expected - don't show as error
      if (errorMsg.includes('not found') || errorMsg.includes('call initializeMasterLockbox')) {
        setMasterLockbox(null);
        setError(null); // Clear any previous error
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
    // SECURITY FIX (C-2): Use secure storage accessor
    const key = getSessionKey();
    if (!client || !key) return;

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
  }, [client, getSessionKey]);

  // Create new password entry
  const createEntry = useCallback(async (entry: PasswordEntry): Promise<number | null> => {
    if (!client) {
      setError('Client not initialized');
      return null;
    }

    // SECURITY FIX (C-3): Check for session timeout
    if (getSessionKey() && isSessionTimedOut()) {
      clearSession();
      setError('Session expired. Please sign in again.');
      return null;
    }

    // SECURITY FIX (C-2): Use secure storage accessor
    // Initialize session if needed (will prompt for signature ONCE)
    if (!getSessionKey()) {
      const initialized = await initializeSession();
      if (!initialized) {
        setError('Failed to initialize session');
        return null;
      }
    }

    // SECURITY FIX (C-3): Update activity timestamp
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
      return null;
    } finally {
      setLoading(false);
    }
  }, [client, getSessionKey, refreshEntries, initializeSession, isSessionTimedOut, clearSession, updateActivity]);

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

    // SECURITY FIX (C-3): Check for session timeout
    if (getSessionKey() && isSessionTimedOut()) {
      clearSession();
      setError('Session expired. Please sign in again.');
      return false;
    }

    // SECURITY FIX (C-2): Use secure storage accessor
    // Initialize session if needed (will prompt for signature ONCE)
    if (!getSessionKey()) {
      const initialized = await initializeSession();
      if (!initialized) {
        setError('Failed to initialize session');
        return false;
      }
    }

    // SECURITY FIX (C-3): Update activity timestamp
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
  }, [client, getSessionKey, refreshEntries, initializeSession, isSessionTimedOut, clearSession, updateActivity]);

  // Delete password entry
  const deleteEntry = useCallback(async (
    chunkIndex: number,
    entryId: number
  ): Promise<boolean> => {
    if (!client) {
      setError('Client not initialized');
      return false;
    }

    // SECURITY FIX (C-3): Check for session timeout
    if (getSessionKey() && isSessionTimedOut()) {
      clearSession();
      setError('Session expired. Please sign in again.');
      return false;
    }

    // SECURITY FIX (C-2): Use secure storage accessor
    // Initialize session if needed (will prompt for signature ONCE)
    if (!getSessionKey()) {
      const initialized = await initializeSession();
      if (!initialized) {
        setError('Failed to initialize session');
        return false;
      }
    }

    // SECURITY FIX (C-3): Update activity timestamp
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
  }, [client, getSessionKey, refreshEntries, initializeSession, isSessionTimedOut, clearSession, updateActivity]);

  // SECURITY FIX (C-3): Automatic session timeout checking
  // Poll every 30 seconds to check for timeout
  useEffect(() => {
    if (!isInitialized) return;

    const intervalId = setInterval(() => {
      if (isSessionTimedOut()) {
        clearSession();
        setError('Session expired due to inactivity. Please sign in again.');
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(intervalId);
  }, [isInitialized, isSessionTimedOut, clearSession]);

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
      // SECURITY FIX (C-2): Use secure storage accessor
      const key = getSessionKey();
      if (key) {
        wipeSensitiveData(key);
      }
    };
  }, [getSessionKey]);

  const contextValue: LockboxV2ContextType = {
    client,
    // SECURITY FIX (C-2): sessionKey no longer exposed in context
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
