'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useLockbox } from './LockboxContext';

/**
 * Lock Context - App Lock/Unlock
 *
 * Provides app-level locking functionality with multiple unlock methods:
 * - Wallet signature unlock (default)
 * - WebAuthn biometric unlock (optional setup)
 * - Auto-lock after inactivity timeout
 *
 * Security Features:
 * - Clears session data when locked
 * - Requires re-authentication to unlock
 * - Tracks last activity for auto-lock
 */

export interface LockContextType {
  // Lock State
  isLocked: boolean;
  autoLockEnabled: boolean;
  autoLockTimeout: number; // in minutes
  hasBiometricSetup: boolean;

  // Lock/Unlock Actions
  lockApp: () => void;
  clearLock: () => void;
  unlockWithWallet: () => Promise<boolean>;
  unlockWithBiometric: () => Promise<boolean>;

  // Configuration
  setAutoLockEnabled: (enabled: boolean) => void;
  setAutoLockTimeout: (minutes: number) => void;

  // Biometric Setup
  setupBiometric: () => Promise<boolean>;
  removeBiometric: () => void;

  // Activity Tracking
  updateActivity: () => void;
}

const LockContext = createContext<LockContextType | null>(null);

export function useLock() {
  const context = useContext(LockContext);
  if (!context) {
    throw new Error('useLock must be used within LockProvider');
  }
  return context;
}

interface LockProviderProps {
  children: React.ReactNode;
}

// Storage keys
const STORAGE_KEYS = {
  AUTO_LOCK_ENABLED: 'lockbox_auto_lock_enabled',
  AUTO_LOCK_TIMEOUT: 'lockbox_auto_lock_timeout',
  BIOMETRIC_CREDENTIAL: 'lockbox_biometric_credential',
};

// Default auto-lock timeout: 5 minutes
const DEFAULT_AUTO_LOCK_TIMEOUT = 5;

export function LockProvider({ children }: LockProviderProps) {
  const { clearSession, isSessionActive, initializeSession, wallet, client } = useAuth();
  const { masterLockbox } = useLockbox();

  // Lock state
  const [isLocked, setIsLocked] = useState(false);
  const [autoLockEnabled, setAutoLockEnabledState] = useState(() => {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem(STORAGE_KEYS.AUTO_LOCK_ENABLED);
    return stored !== null ? stored === 'true' : true;
  });
  const [autoLockTimeout, setAutoLockTimeoutState] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_AUTO_LOCK_TIMEOUT;
    const stored = localStorage.getItem(STORAGE_KEYS.AUTO_LOCK_TIMEOUT);
    return stored ? parseInt(stored, 10) : DEFAULT_AUTO_LOCK_TIMEOUT;
  });
  const [hasBiometricSetup, setHasBiometricSetup] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEYS.BIOMETRIC_CREDENTIAL) !== null;
  });

  // Activity tracking
  const lastActivityRef = useRef(Date.now());
  const autoLockTimerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Lock the app and clear session
   */
  const lockApp = useCallback(() => {
    console.log('🔒 Locking app...');
    setIsLocked(true);
    clearSession();
  }, [clearSession]);

  /**
   * Clear lock state (used for account closure and logout)
   */
  const clearLock = useCallback(() => {
    console.log('🔓 Clearing lock state...');
    setIsLocked(false);
  }, []);

  /**
   * Unlock app with wallet signature
   */
  const unlockWithWallet = useCallback(async (): Promise<boolean> => {
    if (!wallet) {
      console.error('No wallet connected');
      return false;
    }

    try {
      console.log('🔓 Unlocking with wallet signature...');

      // Re-initialize session (will prompt for signature)
      const success = await initializeSession();

      if (success) {
        setIsLocked(false);
        lastActivityRef.current = Date.now();
        console.log('✅ Unlocked successfully');
        return true;
      }

      return false;
    } catch (error) {
      console.error('Failed to unlock with wallet:', error);
      return false;
    }
  }, [wallet, initializeSession]);

  /**
   * Unlock app with biometric authentication (WebAuthn)
   */
  const unlockWithBiometric = useCallback(async (): Promise<boolean> => {
    if (!hasBiometricSetup) {
      console.error('Biometric authentication not set up');
      return false;
    }

    if (typeof window === 'undefined' || !window.navigator.credentials) {
      console.error('WebAuthn not supported');
      return false;
    }

    try {
      console.log('🔓 Unlocking with biometric...');

      const credentialId = localStorage.getItem(STORAGE_KEYS.BIOMETRIC_CREDENTIAL);
      if (!credentialId) {
        console.error('No biometric credential found');
        return false;
      }

      // Request biometric authentication
      const credential = await navigator.credentials.get({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          allowCredentials: [
            {
              id: Uint8Array.from(atob(credentialId), c => c.charCodeAt(0)),
              type: 'public-key',
            },
          ],
          userVerification: 'required',
          timeout: 60000,
        },
      });

      if (credential) {
        // Biometric authentication successful
        // Now unlock with wallet to restore session
        const success = await unlockWithWallet();
        return success;
      }

      return false;
    } catch (error) {
      console.error('Biometric authentication failed:', error);
      return false;
    }
  }, [hasBiometricSetup, unlockWithWallet]);

  /**
   * Setup biometric authentication (WebAuthn)
   */
  const setupBiometric = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !window.navigator.credentials) {
      console.error('WebAuthn not supported');
      return false;
    }

    if (!wallet?.publicKey) {
      console.error('No wallet connected');
      return false;
    }

    try {
      console.log('🔐 Setting up biometric authentication...');

      // Create WebAuthn credential
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rp: {
            name: 'Solana Lockbox',
            id: window.location.hostname,
          },
          user: {
            id: crypto.getRandomValues(new Uint8Array(16)),
            name: wallet.publicKey.toBase58(),
            displayName: 'Lockbox User',
          },
          pubKeyCredParams: [
            { alg: -7, type: 'public-key' }, // ES256
            { alg: -257, type: 'public-key' }, // RS256
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
          },
          timeout: 60000,
          attestation: 'none',
        },
      }) as PublicKeyCredential | null;

      if (!credential) {
        console.error('Failed to create credential');
        return false;
      }

      // Store credential ID
      const credentialId = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
      localStorage.setItem(STORAGE_KEYS.BIOMETRIC_CREDENTIAL, credentialId);
      setHasBiometricSetup(true);

      console.log('✅ Biometric authentication setup successful');
      return true;
    } catch (error) {
      console.error('Failed to setup biometric authentication:', error);
      return false;
    }
  }, [wallet]);

  /**
   * Remove biometric authentication
   */
  const removeBiometric = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.BIOMETRIC_CREDENTIAL);
    setHasBiometricSetup(false);
    console.log('🗑️ Biometric authentication removed');
  }, []);

  /**
   * Update last activity timestamp
   */
  const updateActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  /**
   * Set auto-lock enabled
   */
  const setAutoLockEnabled = useCallback((enabled: boolean) => {
    setAutoLockEnabledState(enabled);
    localStorage.setItem(STORAGE_KEYS.AUTO_LOCK_ENABLED, enabled.toString());
  }, []);

  /**
   * Set auto-lock timeout
   */
  const setAutoLockTimeout = useCallback((minutes: number) => {
    setAutoLockTimeoutState(minutes);
    localStorage.setItem(STORAGE_KEYS.AUTO_LOCK_TIMEOUT, minutes.toString());
  }, []);

  /**
   * Auto-lock timer effect
   */
  useEffect(() => {
    if (!autoLockEnabled || isLocked || !isSessionActive) {
      return;
    }

    // Clear existing timer
    if (autoLockTimerRef.current) {
      clearInterval(autoLockTimerRef.current);
    }

    // Check for inactivity every 30 seconds
    autoLockTimerRef.current = setInterval(() => {
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivityRef.current;
      const timeoutMs = autoLockTimeout * 60 * 1000;

      if (timeSinceLastActivity >= timeoutMs) {
        console.log('⏰ Auto-lock triggered due to inactivity');
        lockApp();
      }
    }, 30000); // Check every 30 seconds

    return () => {
      if (autoLockTimerRef.current) {
        clearInterval(autoLockTimerRef.current);
      }
    };
  }, [autoLockEnabled, autoLockTimeout, isLocked, isSessionActive, lockApp]);

  /**
   * Track user activity
   */
  useEffect(() => {
    if (!autoLockEnabled || isLocked) {
      return;
    }

    const handleActivity = () => {
      updateActivity();
    };

    // Track various activity events
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach(event => {
      window.addEventListener(event, handleActivity);
    });

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [autoLockEnabled, isLocked, updateActivity]);

  /**
   * Auto-lock when session becomes inactive
   * Only lock if client exists (wallet is connected with publicKey) AND user has a vault
   * This prevents locking on initial page load and for users without vaults
   */
  useEffect(() => {
    if (!isSessionActive && !isLocked && client && masterLockbox) {
      console.log('🔒 Session expired, locking app');
      setIsLocked(true);
    }
  }, [isSessionActive, isLocked, client, masterLockbox]);

  const value: LockContextType = {
    isLocked,
    autoLockEnabled,
    autoLockTimeout,
    hasBiometricSetup,
    lockApp,
    clearLock,
    unlockWithWallet,
    unlockWithBiometric,
    setAutoLockEnabled,
    setAutoLockTimeout,
    setupBiometric,
    removeBiometric,
    updateActivity,
  };

  return <LockContext.Provider value={value}>{children}</LockContext.Provider>;
}
