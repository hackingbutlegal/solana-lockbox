'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useSubscription } from '../../contexts';
import { SubscriptionTier } from '../../sdk/src/types-v2';

/**
 * App Header Component
 *
 * Persistent sticky header with:
 * - Logo/branding
 * - Storage usage indicator (always visible, clickable)
 * - Navigation links
 * - Wallet connection button
 * - Upgrade button (when not on Enterprise tier)
 */

export function AppHeader() {
  const router = useRouter();
  const {
    currentTier,
    storageUsed,
    storageLimit,
    storagePercentage
  } = useSubscription();

  const formatBytes = (bytes: number): string => {
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)}MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)}KB`;
    return `${bytes}B`;
  };

  // Determine storage bar color based on percentage
  const getStorageColor = (): string => {
    if (storagePercentage >= 90) return '#e74c3c'; // Red
    if (storagePercentage >= 70) return '#f39c12'; // Yellow/Orange
    return '#27ae60'; // Green
  };

  const handleStorageClick = () => {
    router.push('/settings?tab=subscription');
  };

  const handleUpgradeClick = () => {
    router.push('/settings?tab=subscription');
  };

  const handleNavigateDashboard = () => {
    router.push('/');
  };

  const handleNavigateSettings = () => {
    router.push('/settings');
  };

  const showUpgradeButton = currentTier !== SubscriptionTier.Enterprise;

  return (
    <header className="app-header">
      <div className="header-content">
        {/* Logo/Branding */}
        <div className="logo-section" onClick={handleNavigateDashboard}>
          <div className="logo-icon">🔒</div>
          <div className="logo-text">
            <h1>Solana Lockbox</h1>
            <span className="logo-tagline">Decentralized Password Manager</span>
          </div>
        </div>

        {/* Storage Usage Indicator */}
        <div
          className="storage-indicator"
          onClick={handleStorageClick}
          title="Click to upgrade storage"
        >
          <div className="storage-label">Storage</div>
          <div className="storage-bar-container">
            <div
              className="storage-bar-fill"
              style={{
                width: `${storagePercentage}%`,
                background: getStorageColor()
              }}
            />
          </div>
          <div className="storage-text">
            {formatBytes(storageUsed)} / {formatBytes(storageLimit)} ({storagePercentage}%)
          </div>
        </div>

        {/* Navigation */}
        <nav className="header-nav">
          <button onClick={handleNavigateDashboard} className="nav-link">
            Dashboard
          </button>
          <button onClick={handleNavigateSettings} className="nav-link">
            Settings
          </button>
        </nav>

        {/* Right Section */}
        <div className="header-actions">
          {showUpgradeButton && (
            <button
              className="btn-upgrade-header"
              onClick={handleUpgradeClick}
            >
              ⬆️ Upgrade
            </button>
          )}
          <WalletMultiButton />
        </div>
      </div>

      <style jsx>{`
        .app-header {
          position: sticky;
          top: 0;
          left: 0;
          right: 0;
          z-index: 1000;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-bottom: 2px solid rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }

        .header-content {
          max-width: 1400px;
          margin: 0 auto;
          padding: 0.75rem 1.5rem;
          display: flex;
          align-items: center;
          gap: 2rem;
        }

        .logo-section {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          cursor: pointer;
          transition: transform 0.2s;
        }

        .logo-section:hover {
          transform: translateY(-2px);
        }

        .logo-icon {
          font-size: 2rem;
          line-height: 1;
        }

        .logo-text h1 {
          margin: 0;
          font-size: 1.25rem;
          font-weight: 700;
          color: white;
          line-height: 1.2;
        }

        .logo-tagline {
          font-size: 0.7rem;
          color: rgba(255, 255, 255, 0.8);
          font-weight: 400;
        }

        .storage-indicator {
          flex: 1;
          max-width: 320px;
          padding: 0.5rem 1rem;
          background: rgba(255, 255, 255, 0.15);
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .storage-indicator:hover {
          background: rgba(255, 255, 255, 0.2);
          transform: translateY(-2px);
        }

        .storage-label {
          font-size: 0.75rem;
          color: rgba(255, 255, 255, 0.9);
          font-weight: 600;
          margin-bottom: 0.25rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .storage-bar-container {
          width: 100%;
          height: 8px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 0.25rem;
        }

        .storage-bar-fill {
          height: 100%;
          border-radius: 4px;
          transition: all 0.3s ease;
          box-shadow: 0 0 8px rgba(255, 255, 255, 0.3);
        }

        .storage-text {
          font-size: 0.75rem;
          color: white;
          font-weight: 500;
        }

        .header-nav {
          display: flex;
          gap: 1rem;
        }

        .nav-link {
          background: transparent;
          border: none;
          color: white;
          font-size: 0.95rem;
          font-weight: 600;
          cursor: pointer;
          padding: 0.5rem 1rem;
          border-radius: 8px;
          transition: all 0.2s;
        }

        .nav-link:hover {
          background: rgba(255, 255, 255, 0.15);
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-left: auto;
        }

        .btn-upgrade-header {
          padding: 0.5rem 1.25rem;
          background: white;
          color: #667eea;
          border: none;
          border-radius: 8px;
          font-size: 0.95rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .btn-upgrade-header:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }

        @media (max-width: 1024px) {
          .header-content {
            gap: 1rem;
          }

          .logo-tagline {
            display: none;
          }

          .storage-indicator {
            max-width: 200px;
          }

          .storage-text {
            font-size: 0.7rem;
          }
        }

        @media (max-width: 768px) {
          .header-content {
            flex-wrap: wrap;
            padding: 0.5rem 1rem;
          }

          .logo-text h1 {
            font-size: 1rem;
          }

          .storage-indicator {
            order: 3;
            flex: 1 1 100%;
            max-width: 100%;
            margin-top: 0.5rem;
          }

          .header-nav {
            display: none; // Hide on mobile, use hamburger menu if needed
          }

          .btn-upgrade-header {
            font-size: 0.85rem;
            padding: 0.4rem 1rem;
          }
        }
      `}</style>
    </header>
  );
}
