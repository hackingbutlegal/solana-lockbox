/**
 * Client-side Providers Wrapper
 *
 * Wraps the entire app with all necessary providers and AppHeader
 */

'use client';

import React, { useMemo } from 'react';
import { ConnectionProvider, WalletProvider, useWallet } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { clusterApiUrl, PublicKey } from '@solana/web3.js';
import { AuthProvider, LockboxProvider, PasswordProvider, SubscriptionProvider, CategoryProvider, RecoveryProvider, useLockbox } from '../../contexts';
import { LockProvider, useLock } from '../../contexts/LockContext';
import { ErrorBoundary, ContextErrorBoundary } from '../ui';
import { ToastProvider } from '../ui/Toast';
import { ConfirmProvider } from '../ui/ConfirmDialog';
import { AppHeader } from './AppHeader';
import { Footer } from './Footer';
import { LockScreen } from '../ui/LockScreen';
import { MobileWalletProvider } from '../providers/MobileWalletProvider';
import { useRouter, usePathname } from 'next/navigation';

// Import wallet adapter styles
import '@solana/wallet-adapter-react-ui/styles.css';

const PROGRAM_ID = '7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB';
const TREASURY_WALLET = new PublicKey('465Av5qxktim1iN9p54k41MbRGPe2nqCfyVYwB2EF84J');

// Inner component that safely renders AppHeader after contexts are ready
function AppWithProviders({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(false);
  const { isLocked } = useLock();
  const { masterLockbox } = useLockbox();
  const { publicKey } = useWallet();
  const router = useRouter();
  const pathname = usePathname();
  const previousPublicKey = React.useRef(publicKey);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Redirect to homepage when wallet is disconnected
  React.useEffect(() => {
    // Only redirect if we had a wallet connected before and now it's disconnected
    // AND we're not already on the homepage
    if (mounted && previousPublicKey.current && !publicKey && pathname !== '/') {
      console.log('Wallet disconnected, redirecting to homepage');
      sessionStorage.clear(); // Clear any session data
      // Use replace instead of push to avoid adding to browser history
      router.replace('/');
    }

    // Update the previous value
    previousPublicKey.current = publicKey;
  }, [publicKey, mounted, router, pathname]);

  // Show lock screen if app is locked AND user has a vault
  // Don't show lock screen for new users without a vault - they should see home/initialize page
  if (mounted && isLocked && masterLockbox) {
    return <LockScreen />;
  }

  return (
    <>
      {mounted && <AppHeader />}
      <div style={{ minHeight: 'calc(100vh - 180px)' }}>
        {children}
      </div>
      {mounted && <Footer />}
    </>
  );
}

export const Providers: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const network = WalletAdapterNetwork.Devnet;
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);

  const wallets = useMemo(
    () => [
      new SolflareWalletAdapter(),
      // Phantom auto-detected via Standard Wallet protocol
    ],
    []
  );

  return (
    <ErrorBoundary>
      <MobileWalletProvider>
        <ConnectionProvider endpoint={endpoint}>
          <WalletProvider wallets={wallets} autoConnect>
            <WalletModalProvider>
              <ToastProvider>
                <ConfirmProvider>
                  <ContextErrorBoundary onError={(error, errorInfo) => {
                    if (process.env.NODE_ENV === 'development') {
                      console.error('Context initialization error:', error, errorInfo);
                    }
                  }}>
                    <AuthProvider programId={PROGRAM_ID} treasuryWallet={TREASURY_WALLET}>
                      <LockboxProvider>
                        <LockProvider>
                          <CategoryProvider>
                            <PasswordProvider>
                              <SubscriptionProvider>
                                <RecoveryProvider>
                                  <ErrorBoundary>
                                    <AppWithProviders>
                                      {children}
                                    </AppWithProviders>
                                  </ErrorBoundary>
                                </RecoveryProvider>
                              </SubscriptionProvider>
                            </PasswordProvider>
                          </CategoryProvider>
                        </LockProvider>
                      </LockboxProvider>
                    </AuthProvider>
                  </ContextErrorBoundary>
                </ConfirmProvider>
              </ToastProvider>
            </WalletModalProvider>
          </WalletProvider>
        </ConnectionProvider>
      </MobileWalletProvider>
    </ErrorBoundary>
  );
};
