'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useAuth } from './AuthContext';
import { MasterLockbox } from '../sdk/src/types-v2';

/**
 * Lockbox Context - Lockbox Metadata
 *
 * Provides access to master lockbox account data:
 * - Master lockbox account data
 * - Lockbox existence checking
 * - Lockbox initialization
 * - Lockbox refresh
 */

export interface LockboxContextType {
  // Master Lockbox
  masterLockbox: MasterLockbox | null;
  exists: boolean;

  // Operations
  refreshLockbox: () => Promise<void>;
  initializeLockbox: () => Promise<void>;

  // Loading/Error
  loading: boolean;
  error: string | null;
}

const LockboxContext = createContext<LockboxContextType | null>(null);

export function useLockbox() {
  const context = useContext(LockboxContext);
  if (!context) {
    throw new Error('useLockbox must be used within LockboxProvider');
  }
  return context;
}

interface LockboxProviderProps {
  children: React.ReactNode;
}

export function LockboxProvider({ children }: LockboxProviderProps) {
  const { publicKey } = useWallet();
  const { client } = useAuth();

  // State
  const [masterLockbox, setMasterLockbox] = useState<MasterLockbox | null>(null);
  const [exists, setExists] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refresh master lockbox data
  const refreshLockbox = useCallback(async () => {
    if (!client) return;

    try {
      setLoading(true);
      setError(null);

      // Check if lockbox exists first
      const lockboxExists = await client.exists();
      setExists(lockboxExists);

      if (!lockboxExists) {
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
        setExists(false);
        setError(null); // Clear any previous error
      } else {
        setError(errorMsg);
        setMasterLockbox(null);
        setExists(false);
      }
    } finally {
      setLoading(false);
    }
  }, [client]);

  // Initialize lockbox
  const initializeLockbox = useCallback(async () => {
    if (!client) {
      throw new Error('Client not initialized');
    }

    try {
      setLoading(true);
      setError(null);

      await client.initializeMasterLockbox();

      // Refresh to get the new lockbox data
      await refreshLockbox();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to initialize lockbox';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [client, refreshLockbox]);

  // Auto-refresh master lockbox when wallet connects
  // NOTE: refreshLockbox not in deps because it only depends on client (already included)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (publicKey && client) {
      refreshLockbox();
    }
  }, [publicKey, client]);

  const contextValue: LockboxContextType = {
    masterLockbox,
    exists,
    refreshLockbox,
    initializeLockbox,
    loading,
    error,
  };

  return (
    <LockboxContext.Provider value={contextValue}>
      {children}
    </LockboxContext.Provider>
  );
}
