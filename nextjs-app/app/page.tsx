'use client';
// Build: v2.2.0 - 2025-10-12

import dynamic from 'next/dynamic';

// Dynamically import LockboxApp with no SSR to avoid hydration issues with wallet adapter
const LockboxApp = dynamic(() => import('./src/App').then(mod => mod.default), {
  ssr: false,
  loading: () => (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    }}>
      <div style={{ color: 'white', fontSize: '1.5rem' }}>Loading Lockbox...</div>
    </div>
  ),
});

export default function Home() {
  return <LockboxApp />;
}
