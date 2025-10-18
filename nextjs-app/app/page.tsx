'use client';
// Build: v2.0.0 - Password Manager - 2025-10-12

import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { clusterApiUrl, PublicKey } from '@solana/web3.js';
import { AuthProvider, LockboxProvider, PasswordProvider, SubscriptionProvider, CategoryProvider, RecoveryProvider } from '../contexts';
import { ErrorBoundary, ContextErrorBoundary } from '../components/ui';
import { AppHeader } from '../components/layout';

// Import wallet adapter styles
import '@solana/wallet-adapter-react-ui/styles.css';

// Dynamically import PasswordManager with no SSR
const PasswordManager = dynamic(
  () => import('../components/features/PasswordManager').then(mod => ({ default: mod.PasswordManager })),
  {
    ssr: false,
    loading: () => (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}>
        <div style={{ color: 'white', fontSize: '1.5rem' }}>
          Loading Password Manager...
        </div>
      </div>
    ),
  }
);

const PROGRAM_ID = '7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB';
const TREASURY_WALLET = new PublicKey('465Av5qxktim1iN9p54k41MbRGPe2nqCfyVYwB2EF84J');

export default function Home() {
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
                            <AppHeader />
                            <PasswordManager />
                          </ErrorBoundary>
                        </RecoveryProvider>
                      </SubscriptionProvider>
                    </PasswordProvider>
                  </CategoryProvider>
                </LockboxProvider>
              </AuthProvider>
            </ContextErrorBoundary>
          </WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </ErrorBoundary>
  );
}
