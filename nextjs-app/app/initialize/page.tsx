'use client';

import dynamic from 'next/dynamic';
import { LoadingState } from '../../components/ui/LoadingState';

// Dynamically import InitializeVault with no SSR
const InitializeVault = dynamic(
  () => import('../../components/features/InitializeVault').then(mod => ({ default: mod.InitializeVault })),
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
        <LoadingState variant="pulse" size="lg" />
      </div>
    ),
  }
);

export default function InitializePage() {
  return <InitializeVault />;
}
