'use client';
// Build: v2.0.0 - Password Manager - 2025-10-12

import dynamic from 'next/dynamic';

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

export default function Home() {
  return <PasswordManager />;
}
