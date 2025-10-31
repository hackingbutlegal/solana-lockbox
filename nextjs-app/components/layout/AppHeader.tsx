'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useSubscription, useLockbox } from '../../contexts';
import { SubscriptionTier } from '../../sdk/src/types-v2';

/**
 * App Header Component
 *
 * Persistent sticky header with:
 * - Logo/branding
 * - Storage usage indicator (only when wallet connected AND vault initialized)
 * - Navigation links (only when wallet connected AND vault initialized)
 * - Wallet connection button (always visible)
 */

export function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { publicKey } = useWallet();
  const { masterLockbox } = useLockbox();
  const {
    currentTier,
    storageUsed,
    storageLimit,
    storagePercentage
  } = useSubscription();

  // Only show navigation and storage when wallet is connected AND vault is initialized
  const isVaultInitialized = !!publicKey && !!masterLockbox;

  // Hide navigation and storage on /initialize page to prevent navigation during vault creation
  const shouldShowNavigation = isVaultInitialized && pathname !== '/initialize';
  const shouldShowStorage = isVaultInitialized && pathname !== '/initialize';

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
    router.push('/settings?tab=storage');
  };

  const handleNavigateDashboard = () => {
    router.push('/');
  };

  const handleNavigateSettings = () => {
    router.push('/settings');
  };

  return (
    <header className="app-header">
      <div className="header-content">
        {/* Logo/Branding */}
        <div
          className={`logo-section ${isVaultInitialized ? 'clickable' : ''}`}
          onClick={isVaultInitialized ? handleNavigateDashboard : undefined}
        >
          <div className="logo-icon">🔒</div>
          <div className="logo-text">
            <h1>Solana Lockbox</h1>
            <span className="logo-tagline">Blockchain Password Manager</span>
          </div>
        </div>

        {/* Storage Usage Indicator - Only show when vault initialized and not on /initialize page */}
        {shouldShowStorage && (
          <div
            className="storage-indicator"
            onClick={handleStorageClick}
            title="Click to expand storage"
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
        )}

        {/* Navigation - Only show when vault initialized and not on /initialize page */}
        {shouldShowNavigation && (
          <nav className="header-nav">
            <button onClick={handleNavigateDashboard} className="nav-link">
              Dashboard
            </button>
            <button onClick={handleNavigateSettings} className="nav-link">
              Settings
            </button>
          </nav>
        )}

        {/* Right Section */}
        <div className="header-actions">
          {!publicKey && (
            <button
              onClick={() => router.push('/recovery')}
              className="btn-recovery"
              title="Access your vault using backup codes"
            >
              🔑 Recovery
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
          border-bottom: 1px solid rgba(255, 255, 255, 0.15);
          backdrop-filter: blur(20px) saturate(180%);
          box-shadow:
            0 4px 20px rgba(102, 126, 234, 0.25),
            0 8px 40px rgba(118, 75, 162, 0.15),
            inset 0 -1px 0 rgba(255, 255, 255, 0.1);
          animation: slideDown 0.3s ease-out;
        }

        @keyframes slideDown {
          from {
            transform: translateY(-100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .header-content {
          max-width: 1400px;
          margin: 0 auto;
          padding: 1rem 2rem;
          display: flex;
          align-items: center;
          gap: 2rem;
        }

        .logo-section {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .logo-section.clickable {
          cursor: pointer;
        }

        .logo-section.clickable:hover {
          transform: translateY(-2px) scale(1.02);
        }

        .logo-section.clickable:active {
          transform: translateY(0) scale(0.98);
        }

        .logo-icon {
          font-size: 2.25rem;
          line-height: 1;
          filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.2));
          animation: pulseGlow 3s ease-in-out infinite;
        }

        @keyframes pulseGlow {
          0%, 100% {
            filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.2));
          }
          50% {
            filter: drop-shadow(0 4px 16px rgba(255, 255, 255, 0.4));
          }
        }

        .logo-text h1 {
          margin: 0;
          font-size: 1.4rem;
          font-weight: 800;
          color: white;
          line-height: 1.2;
          text-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
          letter-spacing: -0.02em;
        }

        .logo-tagline {
          font-size: 0.75rem;
          color: rgba(255, 255, 255, 0.9);
          font-weight: 500;
          letter-spacing: 0.3px;
        }

        .storage-indicator {
          flex: 1;
          max-width: 340px;
          padding: 0.65rem 1.25rem;
          background: rgba(255, 255, 255, 0.15);
          border-radius: 14px;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          backdrop-filter: blur(10px);
        }

        .storage-indicator:hover {
          background: rgba(255, 255, 255, 0.25);
          transform: translateY(-2px) scale(1.02);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
          border-color: rgba(255, 255, 255, 0.3);
        }

        .storage-indicator:active {
          transform: translateY(0) scale(0.98);
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
          gap: 0.5rem;
        }

        .nav-link {
          background: transparent;
          border: none;
          color: white;
          font-size: 0.95rem;
          font-weight: 600;
          cursor: pointer;
          padding: 0.65rem 1.25rem;
          border-radius: 10px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
        }

        .nav-link::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(255, 255, 255, 0.2);
          transform: scaleX(0);
          transform-origin: left;
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          z-index: -1;
        }

        .nav-link:hover::before {
          transform: scaleX(1);
        }

        .nav-link:hover {
          text-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }

        .nav-link:active {
          transform: scale(0.95);
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-left: auto;
        }

        .btn-recovery {
          padding: 0.65rem 1.25rem;
          background: rgba(255, 255, 255, 0.2);
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.3);
          border-radius: 10px;
          font-size: 0.95rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          backdrop-filter: blur(10px);
        }

        .btn-recovery:hover {
          background: rgba(255, 255, 255, 0.3);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .btn-recovery:active {
          transform: translateY(0) scale(0.98);
        }

        .btn-upgrade-header {
          padding: 0.65rem 1.5rem;
          background: linear-gradient(135deg, #ffffff 0%, #f0f0f0 100%);
          color: #667eea;
          border: none;
          border-radius: 10px;
          font-size: 0.95rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow:
            0 4px 12px rgba(0, 0, 0, 0.15),
            inset 0 1px 0 rgba(255, 255, 255, 0.8);
          position: relative;
          overflow: hidden;
        }

        .btn-upgrade-header::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
          transition: left 0.5s;
        }

        .btn-upgrade-header:hover::before {
          left: 100%;
        }

        .btn-upgrade-header:hover {
          transform: translateY(-2px) scale(1.05);
          box-shadow:
            0 8px 20px rgba(0, 0, 0, 0.2),
            inset 0 1px 0 rgba(255, 255, 255, 1);
        }

        .btn-upgrade-header:active {
          transform: translateY(0) scale(0.98);
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
          .app-header {
            position: sticky;
            top: 0;
          }

          .header-content {
            flex-wrap: wrap;
            padding: 0.75rem 0.75rem 0.5rem 0.75rem;
            gap: 0.75rem;
          }

          .logo-section {
            flex-shrink: 0;
          }

          .logo-icon {
            font-size: 1.75rem;
          }

          .logo-text h1 {
            font-size: 0.95rem;
          }

          .storage-indicator {
            order: 3;
            flex: 1 1 100%;
            max-width: 100%;
            margin-top: 0;
            padding: 0.5rem 0.75rem;
          }

          .storage-label {
            font-size: 0.7rem;
          }

          .storage-bar-container {
            height: 6px;
          }

          .storage-text {
            font-size: 0.65rem;
          }

          .header-nav {
            display: none;
          }

          .header-actions {
            gap: 0.5rem;
            margin-left: auto;
          }

          .btn-recovery {
            padding: 0.5rem 0.875rem;
            font-size: 0.85rem;
          }

          .btn-upgrade-header {
            font-size: 0.85rem;
            padding: 0.5rem 0.875rem;
          }

          /* Optimize wallet button for mobile */
          :global(.wallet-adapter-button) {
            padding: 0.5rem 0.875rem !important;
            font-size: 0.85rem !important;
            height: auto !important;
            min-height: 44px !important; /* iOS touch target minimum */
          }

          :global(.wallet-adapter-button-start-icon) {
            width: 20px !important;
            height: 20px !important;
          }
        }

        @media (max-width: 480px) {
          .header-content {
            padding: 0.5rem 0.5rem 0.4rem 0.5rem;
          }

          .logo-icon {
            font-size: 1.5rem;
          }

          .logo-text h1 {
            font-size: 0.875rem;
          }

          .storage-indicator {
            padding: 0.4rem 0.6rem;
          }

          .btn-recovery {
            padding: 0.45rem 0.75rem;
            font-size: 0.8rem;
          }

          /* Make wallet button text shorter on very small screens */
          :global(.wallet-adapter-button) {
            padding: 0.45rem 0.75rem !important;
            font-size: 0.8rem !important;
          }
        }
      `}</style>
    </header>
  );
}
