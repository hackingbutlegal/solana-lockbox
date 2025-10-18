'use client';

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { useAuth } from './AuthContext';
import { setupRecovery, GuardianInfo, RecoverySetup } from '@/lib/recovery-client-v2';

/**
 * Recovery Context - Social Recovery Management
 *
 * Provides social recovery functionality:
 * - Recovery configuration status
 * - Guardian management
 * - Recovery setup and initiation
 * - Emergency access
 */

export interface Guardian {
  pubkey: PublicKey;
  nickname: string;
  shareIndex: number;
  shareCommitment: Uint8Array;
  status: 'pending' | 'active' | 'inactive';
  addedAt: number;
}

export interface RecoveryConfig {
  isInitialized: boolean;
  threshold: number;
  totalGuardians: number;
  recoveryDelay: number; // seconds
  guardians: Guardian[];
  masterSecretHash?: Uint8Array;
  lastRequestId: number;
}

export interface RecoveryRequest {
  requestId: number;
  requester: PublicKey;
  newOwner: PublicKey;
  initiatedAt: number;
  readyAt: number;
  expiresAt: number;
  status: 'pending' | 'ready' | 'completed' | 'cancelled' | 'expired';
  participatingGuardians: PublicKey[];
  encryptedChallenge: Uint8Array;
  challengeHash: Uint8Array;
}

export interface RecoveryContextType {
  // Recovery Configuration
  recoveryConfig: RecoveryConfig | null;
  isRecoverySetup: boolean;
  hasGuardians: boolean;

  // Active Requests
  activeRequests: RecoveryRequest[];
  hasPendingRequests: boolean;

  // Operations
  initializeRecovery: (
    threshold: number,
    recoveryDelay: number,
    guardians: GuardianInfo[],
    masterSecret: Uint8Array
  ) => Promise<void>;

  addGuardian: (
    pubkey: PublicKey,
    nickname: string,
    shareData: Uint8Array,
    shareCommitment: Uint8Array
  ) => Promise<void>;

  removeGuardian: (pubkey: PublicKey) => Promise<void>;

  refreshRecoveryConfig: () => Promise<void>;

  // Recovery Initiation (Guardian Side)
  initiateRecovery: (
    owner: PublicKey,
    newOwner: PublicKey,
    masterSecret: Uint8Array
  ) => Promise<void>;

  confirmParticipation: (owner: PublicKey, requestId: number) => Promise<void>;

  completeRecovery: (
    owner: PublicKey,
    requestId: number,
    proof: Uint8Array
  ) => Promise<void>;

  cancelRecovery: (requestId: number) => Promise<void>;

  // Loading/Error
  loading: boolean;
  error: string | null;
  clearError: () => void;
}

const RecoveryContext = createContext<RecoveryContextType | null>(null);

export function useRecovery() {
  const context = useContext(RecoveryContext);
  if (!context) {
    throw new Error('useRecovery must be used within RecoveryProvider');
  }
  return context;
}

interface RecoveryProviderProps {
  children: React.ReactNode;
}

export function RecoveryProvider({ children }: RecoveryProviderProps) {
  const { client, isSessionActive } = useAuth();
  const { publicKey } = useWallet();

  // State
  const [recoveryConfig, setRecoveryConfig] = useState<RecoveryConfig | null>(null);
  const [activeRequests, setActiveRequests] = useState<RecoveryRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Computed properties
  const isRecoverySetup = useMemo(() => {
    return recoveryConfig?.isInitialized ?? false;
  }, [recoveryConfig]);

  const hasGuardians = useMemo(() => {
    return (recoveryConfig?.totalGuardians ?? 0) > 0;
  }, [recoveryConfig]);

  const hasPendingRequests = useMemo(() => {
    return activeRequests.some(r => r.status === 'pending' || r.status === 'ready');
  }, [activeRequests]);

  // Fetch recovery configuration from blockchain
  const refreshRecoveryConfig = useCallback(async () => {
    if (!client || !isSessionActive) return;

    try {
      setLoading(true);
      setError(null);

      // Fetch from blockchain using SDK
      const config = await client.getRecoveryConfigV2();

      if (config) {
        // TODO: Parse config data properly once deserialization is implemented
        // For now, set a placeholder
        setRecoveryConfig({
          isInitialized: true,
          threshold: 0, // Parse from config.data
          totalGuardians: 0, // Parse from config.data
          recoveryDelay: 0, // Parse from config.data
          guardians: [], // Parse from config.data
          lastRequestId: 0,
        });
      } else {
        setRecoveryConfig({
          isInitialized: false,
          threshold: 0,
          totalGuardians: 0,
          recoveryDelay: 0,
          guardians: [],
          lastRequestId: 0,
        });
      }
    } catch (err: any) {
      console.error('Error fetching recovery config:', err);
      setError(err.message || 'Failed to fetch recovery configuration');
    } finally {
      setLoading(false);
    }
  }, [client, isSessionActive]);

  // Initialize recovery configuration
  const initializeRecovery = useCallback(async (
    threshold: number,
    recoveryDelay: number,
    guardians: GuardianInfo[],
    masterSecret: Uint8Array
  ) => {
    if (!client) {
      throw new Error('Client not initialized');
    }

    try {
      setLoading(true);
      setError(null);

      // Generate recovery setup (client-side)
      const setup: RecoverySetup = await setupRecovery(masterSecret, guardians, threshold);

      // Initialize on-chain
      await client.initializeRecoveryConfigV2(
        threshold,
        recoveryDelay,
        setup.masterSecretHash
      );

      // Add each guardian
      for (let i = 0; i < guardians.length; i++) {
        const guardian = guardians[i];
        const commitment = setup.guardianCommitments[i];

        // Encrypt nickname (TODO: implement proper encryption)
        const nicknameEncrypted = new TextEncoder().encode('Guardian ' + (i + 1));

        await client.addGuardianV2(
          guardian.pubkey,
          guardian.shareIndex,
          commitment.commitment,
          nicknameEncrypted
        );
      }

      // Refresh config
      await refreshRecoveryConfig();

      console.log('Recovery initialized successfully');
    } catch (err: any) {
      console.error('Error initializing recovery:', err);
      setError(err.message || 'Failed to initialize recovery');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [client, refreshRecoveryConfig]);

  // Add guardian
  const addGuardian = useCallback(async (
    pubkey: PublicKey,
    nickname: string,
    shareData: Uint8Array,
    shareCommitment: Uint8Array
  ) => {
    if (!client) {
      throw new Error('Client not initialized');
    }

    try {
      setLoading(true);
      setError(null);

      const nextIndex = (recoveryConfig?.totalGuardians ?? 0) + 1;

      // Encrypt nickname
      const nicknameEncrypted = new TextEncoder().encode(nickname);

      await client.addGuardianV2(
        pubkey,
        nextIndex,
        shareCommitment,
        nicknameEncrypted
      );

      await refreshRecoveryConfig();

      console.log('Guardian added successfully');
    } catch (err: any) {
      console.error('Error adding guardian:', err);
      setError(err.message || 'Failed to add guardian');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [client, recoveryConfig, refreshRecoveryConfig]);

  // Remove guardian
  const removeGuardian = useCallback(async (pubkey: PublicKey) => {
    if (!client) {
      throw new Error('Client not initialized');
    }

    try {
      setLoading(true);
      setError(null);

      // TODO: Implement remove_guardian_v2 instruction
      console.log('Remove guardian:', pubkey.toBase58());

      await refreshRecoveryConfig();
    } catch (err: any) {
      console.error('Error removing guardian:', err);
      setError(err.message || 'Failed to remove guardian');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [client, refreshRecoveryConfig]);

  // Initiate recovery (Guardian)
  const initiateRecovery = useCallback(async (
    owner: PublicKey,
    newOwner: PublicKey,
    masterSecret: Uint8Array
  ) => {
    if (!client) {
      throw new Error('Client not initialized');
    }

    try {
      setLoading(true);
      setError(null);

      // Generate challenge
      const { default: { generateRecoveryChallenge } } = await import('@/lib/recovery-client-v2');
      const challenge = await generateRecoveryChallenge();

      // Get next request ID (TODO: fetch from on-chain config)
      const requestId = 1;

      // Format challenge to 80 bytes
      const encryptedChallenge = new Uint8Array(80);
      encryptedChallenge.set(challenge.encrypted.slice(0, 80));

      await client.initiateRecoveryV2(
        owner,
        requestId,
        encryptedChallenge,
        challenge.hash,
        newOwner
      );

      console.log('Recovery initiated successfully');
    } catch (err: any) {
      console.error('Error initiating recovery:', err);
      setError(err.message || 'Failed to initiate recovery');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [client]);

  // Confirm participation (Guardian)
  const confirmParticipation = useCallback(async (
    owner: PublicKey,
    requestId: number
  ) => {
    if (!client) {
      throw new Error('Client not initialized');
    }

    try {
      setLoading(true);
      setError(null);

      await client.confirmParticipationV2(owner, requestId);

      console.log('Participation confirmed');
    } catch (err: any) {
      console.error('Error confirming participation:', err);
      setError(err.message || 'Failed to confirm participation');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [client]);

  // Complete recovery with proof (Requester)
  const completeRecovery = useCallback(async (
    owner: PublicKey,
    requestId: number,
    proof: Uint8Array
  ) => {
    if (!client) {
      throw new Error('Client not initialized');
    }

    try {
      setLoading(true);
      setError(null);

      await client.completeRecoveryWithProof(owner, requestId, proof);

      console.log('Recovery completed successfully');
    } catch (err: any) {
      console.error('Error completing recovery:', err);
      setError(err.message || 'Failed to complete recovery');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [client]);

  // Cancel recovery (Owner)
  const cancelRecovery = useCallback(async (requestId: number) => {
    if (!client) {
      throw new Error('Client not initialized');
    }

    try {
      setLoading(true);
      setError(null);

      // TODO: Implement cancel_recovery_v2 instruction
      console.log('Cancel recovery:', requestId);

      // Refresh requests
      // await refreshActiveRequests();
    } catch (err: any) {
      console.error('Error cancelling recovery:', err);
      setError(err.message || 'Failed to cancel recovery');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [client]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Load recovery config on mount and when wallet changes
  useEffect(() => {
    if (isSessionActive && publicKey) {
      refreshRecoveryConfig();
    }
  }, [isSessionActive, publicKey, refreshRecoveryConfig]);

  const value: RecoveryContextType = {
    // Config
    recoveryConfig,
    isRecoverySetup,
    hasGuardians,

    // Requests
    activeRequests,
    hasPendingRequests,

    // Operations
    initializeRecovery,
    addGuardian,
    removeGuardian,
    refreshRecoveryConfig,
    initiateRecovery,
    confirmParticipation,
    completeRecovery,
    cancelRecovery,

    // State
    loading,
    error,
    clearError,
  };

  return (
    <RecoveryContext.Provider value={value}>
      {children}
    </RecoveryContext.Provider>
  );
}

export default RecoveryContext;
