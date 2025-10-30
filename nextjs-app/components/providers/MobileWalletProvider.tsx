'use client';

import { useEffect } from 'react';
import {
  createDefaultAuthorizationCache,
  createDefaultChainSelector,
  createDefaultWalletNotFoundHandler,
  registerMwa,
} from '@solana-mobile/wallet-standard-mobile';

/**
 * Mobile Wallet Adapter Provider
 *
 * Registers the Mobile Wallet Adapter for Solana Seeker and mobile devices.
 * This enables wallet connections on Android Chrome using Android Intents.
 *
 * Features:
 * - Automatic wallet detection on mobile
 * - Authorization caching for persistent sessions
 * - Support for mainnet and devnet
 * - QR code fallback for desktop
 */

export function MobileWalletProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Only register on client-side (not SSR)
    if (typeof window === 'undefined') return;

    try {
      registerMwa({
        appIdentity: {
          name: 'Solana Lockbox',
          uri: typeof window !== 'undefined' ? window.location.origin : 'https://solana-lockbox.com',
          icon: '/icon-192x192.png',
        },
        authorizationCache: createDefaultAuthorizationCache(),
        chains: ['solana:mainnet', 'solana:devnet', 'solana:testnet'],
        chainSelector: createDefaultChainSelector(),
        onWalletNotFound: createDefaultWalletNotFoundHandler(),
      });
    } catch (error) {
      // Silent fail - MWA registration errors shouldn't break the app
      if (process.env.NODE_ENV === 'development') {
        console.warn('Failed to register Mobile Wallet Adapter:', error);
      }
    }
  }, []);

  return <>{children}</>;
}
