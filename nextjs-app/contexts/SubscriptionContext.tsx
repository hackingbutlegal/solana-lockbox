'use client';

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { useLockbox } from './LockboxContext';
import { SubscriptionTier, TIER_INFO } from '../sdk/src/types-v2';

/**
 * Subscription Context - Subscription Management
 *
 * Provides subscription tier management:
 * - Current subscription tier
 * - Storage usage stats
 * - Subscription upgrade/downgrade/renew
 * - Subscription expiry tracking
 */

export interface SubscriptionContextType {
  // Subscription Info
  currentTier: SubscriptionTier;
  storageUsed: number;
  storageLimit: number;
  subscriptionExpiry: Date | null;
  isActive: boolean;

  // Computed Properties
  tierName: string;
  storagePercentage: number;
  isNearLimit: boolean; // True if > 80% storage used

  // Operations
  upgradeSubscription: (tier: SubscriptionTier) => Promise<void>;
  renewSubscription: () => Promise<void>;
  downgradeSubscription: () => Promise<void>;

  // Loading/Error
  loading: boolean;
  error: string | null;
}

const SubscriptionContext = createContext<SubscriptionContextType | null>(null);

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within SubscriptionProvider');
  }
  return context;
}

interface SubscriptionProviderProps {
  children: React.ReactNode;
}

export function SubscriptionProvider({ children }: SubscriptionProviderProps) {
  const { client, updateActivity } = useAuth();
  const { masterLockbox, refreshLockbox } = useLockbox();

  // State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Computed properties from master lockbox
  const currentTier = useMemo(() => {
    return masterLockbox?.subscriptionTier ?? SubscriptionTier.Free;
  }, [masterLockbox]);

  const storageUsed = useMemo(() => {
    return masterLockbox?.storageUsed ?? 0;
  }, [masterLockbox]);

  const storageLimit = useMemo(() => {
    const tierInfo = TIER_INFO[currentTier];
    return tierInfo.maxCapacity;
  }, [currentTier]);

  const subscriptionExpiry = useMemo(() => {
    if (!masterLockbox?.subscriptionExpires) return null;

    // Convert Unix timestamp to Date
    if (typeof masterLockbox.subscriptionExpires === 'number') {
      return new Date(masterLockbox.subscriptionExpires * 1000);
    }

    return masterLockbox.subscriptionExpires;
  }, [masterLockbox]);

  const isActive = useMemo(() => {
    if (!subscriptionExpiry) return currentTier === SubscriptionTier.Free;
    return subscriptionExpiry > new Date();
  }, [subscriptionExpiry, currentTier]);

  const tierName = useMemo(() => {
    return TIER_INFO[currentTier].name;
  }, [currentTier]);

  const storagePercentage = useMemo(() => {
    if (storageLimit === 0) return 0;
    return Math.round((storageUsed / storageLimit) * 100);
  }, [storageUsed, storageLimit]);

  const isNearLimit = useMemo(() => {
    return storagePercentage > 80;
  }, [storagePercentage]);

  // Upgrade subscription tier
  const upgradeSubscription = useCallback(async (newTier: SubscriptionTier): Promise<void> => {
    console.log('upgradeSubscription called with:', { newTier, client: !!client });
    if (!client) {
      const errorMsg = 'Wallet not connected or client not initialized. Please reconnect your wallet.';
      setError(errorMsg);
      throw new Error(errorMsg);
    }

    // Update activity timestamp
    updateActivity();

    try {
      setLoading(true);
      setError(null);

      await client.upgradeSubscription(newTier);

      // Refresh master lockbox after upgrade to get updated tier info
      await refreshLockbox();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to upgrade subscription';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [client, updateActivity, refreshLockbox]);

  // Renew subscription (extend expiry)
  const renewSubscription = useCallback(async (): Promise<void> => {
    if (!client) {
      setError('Client not initialized');
      throw new Error('Client not initialized');
    }

    // Update activity timestamp
    updateActivity();

    try {
      setLoading(true);
      setError(null);

      // Renew by upgrading to the same tier
      await client.upgradeSubscription(currentTier);

      // Refresh master lockbox after renewal
      await refreshLockbox();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to renew subscription';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [client, updateActivity, currentTier, refreshLockbox]);

  // Downgrade subscription (to Free tier)
  const downgradeSubscription = useCallback(async (): Promise<void> => {
    if (!client) {
      setError('Client not initialized');
      throw new Error('Client not initialized');
    }

    // Update activity timestamp
    updateActivity();

    try {
      setLoading(true);
      setError(null);

      // Downgrade to Free tier
      await client.upgradeSubscription(SubscriptionTier.Free);

      // Refresh master lockbox after downgrade
      await refreshLockbox();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to downgrade subscription';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [client, updateActivity, refreshLockbox]);

  const contextValue: SubscriptionContextType = {
    currentTier,
    storageUsed,
    storageLimit,
    subscriptionExpiry,
    isActive,
    tierName,
    storagePercentage,
    isNearLimit,
    upgradeSubscription,
    renewSubscription,
    downgradeSubscription,
    loading,
    error,
  };

  return (
    <SubscriptionContext.Provider value={contextValue}>
      {children}
    </SubscriptionContext.Provider>
  );
}
