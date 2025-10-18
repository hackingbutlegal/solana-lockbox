'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { LockboxV2Client } from '../sdk/src/client-v2';
import { generateChallenge, createSessionKeyFromSignature, wipeSensitiveData } from '../lib/crypto';

/**
 * Auth Context - Session Management
 *
 * Provides secure session key management with timeout tracking:
 * - Session key storage (WeakMap for security)
 * - Session initialization from wallet signature
 * - Session timeout tracking (15 min absolute, 5 min inactivity)
 * - Activity tracking
 * - Session clearing/cleanup
 * - Client instance creation
 */

export interface AuthContextType {
  // Client
  client: LockboxV2Client | null;

  // Session State
  isSessionActive: boolean;
  sessionTimeRemaining: number | null; // seconds remaining until timeout

  // Session Management
  initializeSession: () => Promise<boolean>;
  clearSession: () => void;
  updateActivity: () => void;
  checkSessionTimeout: () => void; // SECURITY: Immediate timeout check for sensitive operations

  // Loading/Error
  loading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: React.ReactNode;
  programId: string;
  treasuryWallet?: PublicKey; // Optional treasury wallet for subscription fees
}

export function AuthProvider({ children, programId, treasuryWallet }: AuthProviderProps) {
  const wallet = useWallet();
  const { publicKey, signMessage, signTransaction } = wallet;
  const { connection } = useConnection();

  // SECURITY FIX (C-2): Secure session key storage using class-based encapsulation
  // This prevents session key exposure in React DevTools and provides proper memory isolation
  const sessionKeyStore = useMemo(() => {
    class SessionKeyStore {
      private key: Uint8Array | null = null;

      set(newKey: Uint8Array | null): void {
        // Wipe previous key before replacing
        if (this.key) {
          wipeSensitiveData(this.key);
        }
        this.key = newKey;
      }

      get(): Uint8Array | null {
        return this.key;
      }

      clear(): void {
        if (this.key) {
          wipeSensitiveData(this.key);
          this.key = null;
        }
      }
    }
    return new SessionKeyStore();
  }, []);

  // Helper to get session key from secure storage
  const getSessionKey = useCallback((): Uint8Array | null => {
    return sessionKeyStore.get();
  }, [sessionKeyStore]);

  // Helper to set session key in secure storage
  const setSessionKey = useCallback((key: Uint8Array | null) => {
    sessionKeyStore.set(key);
  }, [sessionKeyStore]);

  // State
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialization lock to prevent multiple simultaneous sign requests
  const initializationLock = useRef<Promise<boolean> | null>(null);

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

  // Calculate time remaining until session timeout
  const sessionTimeRemaining = useMemo((): number | null => {
    if (!sessionStartTime || !lastActivityTime) {
      return null;
    }

    const now = Date.now();
    const sessionAge = now - sessionStartTime;
    const inactivityTime = now - lastActivityTime;

    // Time until absolute timeout
    const absoluteTimeRemaining = Math.max(0, SESSION_TIMEOUT_MS - sessionAge);

    // Time until inactivity timeout
    const inactivityTimeRemaining = Math.max(0, INACTIVITY_TIMEOUT_MS - inactivityTime);

    // Return the smaller of the two (whichever will happen first)
    const remainingMs = Math.min(absoluteTimeRemaining, inactivityTimeRemaining);

    return Math.floor(remainingMs / 1000); // Convert to seconds
  }, [sessionStartTime, lastActivityTime]);

  // SECURITY FIX (C-3): Update last activity timestamp
  const updateActivity = useCallback(() => {
    setLastActivityTime(Date.now());
  }, []);

  // Clear session and wipe sensitive data
  // NOTE: Must be defined before checkSessionTimeout to avoid circular dependency
  const clearSession = useCallback(() => {
    // SECURITY FIX (C-2): Use secure storage with automatic cleanup
    sessionKeyStore.clear();
    setIsSessionActive(false);

    // SECURITY FIX (C-3): Clear session timestamps
    setSessionStartTime(null);
    setLastActivityTime(null);
  }, [sessionKeyStore]);

  // SECURITY: Immediate session timeout check for sensitive operations
  // This prevents race conditions where operations could proceed after timeout
  // but before the 30-second polling interval detects it
  const checkSessionTimeout = useCallback(() => {
    if (isSessionTimedOut()) {
      clearSession();
      throw new Error('Session expired. Please sign in again to continue.');
    }
  }, [isSessionTimedOut, clearSession]);

  // Create client instance (memoized)
  const client = useMemo(() => {
    console.log('Client creation check:', {
      hasPublicKey: !!publicKey,
      hasConnection: !!connection,
      hasWallet: !!wallet,
      publicKey: publicKey?.toBase58()
    });

    // Only require publicKey and connection - wallet adapter will provide signTransaction when needed
    if (!publicKey || !connection) {
      console.warn('Client not created - missing publicKey or connection');
      return null;
    }

    try {
      // Use the actual wallet from useWallet hook
      // The wallet adapter provides signTransaction/signMessage on-demand
      const newClient = new LockboxV2Client({
        connection,
        wallet: wallet as any,
        programId: new PublicKey(programId),
        treasuryWallet: treasuryWallet, // Optional treasury wallet for fees
      });
      console.log('✅ LockboxV2Client created successfully');
      return newClient;
    } catch (err) {
      console.error('❌ Failed to create LockboxV2Client:', err);
      return null;
    }
  }, [publicKey, connection, wallet, programId, treasuryWallet]);

  // Initialize session key from wallet signature
  const initializeSession = useCallback(async (): Promise<boolean> => {
    if (!publicKey || !signMessage) {
      setError('Wallet not connected');
      return false;
    }

    // SECURITY FIX (C-2): Use secure storage accessor
    const existingKey = getSessionKey();
    if (existingKey) {
      return true; // Already initialized
    }

    // CRITICAL FIX: Prevent multiple simultaneous sign requests
    // If initialization is already in progress, wait for it to complete
    if (initializationLock.current) {
      console.log('⏳ Session initialization already in progress, waiting...');
      return await initializationLock.current;
    }

    // Create the initialization promise
    const initPromise = (async () => {
      try {
        setLoading(true);
        setError(null);

        console.log('🔐 Requesting wallet signature for session key...');

        // Generate challenge and get signature
        const challenge = generateChallenge(publicKey);
        const signature = await signMessage(challenge);

        console.log('✅ Signature received, deriving session key...');

        // Derive session key
        const { sessionKey: derivedKey } = await createSessionKeyFromSignature(
          publicKey,
          signature
        );

        // SECURITY FIX (C-2): Store in secure WeakMap storage
        setSessionKey(derivedKey);
        setIsSessionActive(true);

        // SECURITY FIX (C-3): Set session timestamps
        const now = Date.now();
        setSessionStartTime(now);
        setLastActivityTime(now);

        console.log('✅ Session initialized successfully');
        return true;
      } catch (err) {
        // Handle user rejection gracefully
        const errorMsg = err instanceof Error ? err.message : 'Failed to initialize session';

        // Check if user rejected the signature request
        if (errorMsg.includes('User rejected') ||
            errorMsg.includes('rejected the request') ||
            errorMsg.includes('User denied')) {
          console.log('ℹ️ User declined signature request');
          setError('Signature required to decrypt your passwords. Please approve the request to continue.');
        } else {
          console.error('❌ Session initialization failed:', errorMsg);
          setError(`Failed to initialize session: ${errorMsg}`);
        }
        return false;
      } finally {
        setLoading(false);
        // Clear the lock when done
        initializationLock.current = null;
      }
    })();

    // Store the promise in the lock
    initializationLock.current = initPromise;

    return await initPromise;
  }, [publicKey, signMessage, getSessionKey, setSessionKey]);

  // SECURITY FIX (C-3): Automatic session timeout checking
  // Poll every 30 seconds to check for timeout
  useEffect(() => {
    if (!isSessionActive) return;

    const intervalId = setInterval(() => {
      if (isSessionTimedOut()) {
        clearSession();
        setError('Session expired due to inactivity. Please sign in again.');
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(intervalId);
  }, [isSessionActive, isSessionTimedOut, clearSession]);

  // Clear session when wallet disconnects
  useEffect(() => {
    if (!publicKey) {
      clearSession();
    }
  }, [publicKey, clearSession]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // SECURITY FIX (C-2): Automatic cleanup on unmount
      sessionKeyStore.clear();
    };
  }, [sessionKeyStore]);

  const contextValue: AuthContextType = {
    client,
    isSessionActive,
    sessionTimeRemaining,
    initializeSession,
    clearSession,
    updateActivity,
    checkSessionTimeout,
    loading,
    error,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}
