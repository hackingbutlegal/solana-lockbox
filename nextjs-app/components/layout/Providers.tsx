/**
 * Client-side Providers Wrapper
 *
 * Wraps the entire app with all necessary providers and AppHeader
 */

'use client';

import React, { useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { clusterApiUrl, PublicKey } from '@solana/web3.js';
import { AuthProvider, LockboxProvider, PasswordProvider, SubscriptionProvider, CategoryProvider, RecoveryProvider } from '../../contexts';
import { ErrorBoundary, ContextErrorBoundary } from '../ui';
import { ToastProvider } from '../ui/Toast';
import { ConfirmProvider } from '../ui/ConfirmDialog';
import { AppHeader } from './AppHeader';

// Import wallet adapter styles
import '@solana/wallet-adapter-react-ui/styles.css';

const PROGRAM_ID = '7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB';
const TREASURY_WALLET = new PublicKey('465Av5qxktim1iN9p54k41MbRGPe2nqCfyVYwB2EF84J');

// Inner component that safely renders AppHeader after contexts are ready
function AppWithProviders({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <>
      {mounted && <AppHeader />}
      {children}
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
      <ConnectionProvider endpoint={endpoint}>
        <WalletProvider wallets={wallets} autoConnect>
          <WalletModalProvider>
            <ToastProvider>
              <ConfirmProvider>
                <ContextErrorBoundary onError={(error, errorInfo) => {
                  console.error('Context initialization error:', error, errorInfo);
                }}>
                  <AuthProvider programId={PROGRAM_ID} treasuryWallet={TREASURY_WALLET}>
                    <LockboxProvider>
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
                    </LockboxProvider>
                  </AuthProvider>
                </ContextErrorBoundary>
              </ConfirmProvider>
            </ToastProvider>
          </WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </ErrorBoundary>
  );
};
