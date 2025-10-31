'use client';
// Build: v2.0.0 - Password Manager - 2025-10-12

import dynamic from 'next/dynamic';
import { LoadingState } from '../components/ui/LoadingState';

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
        <LoadingState variant="pulse" size="lg" />
      </div>
    ),
  }
);

export default function Home() {
  return <PasswordManager />;
}
