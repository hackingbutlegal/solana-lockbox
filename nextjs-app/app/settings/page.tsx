'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppHeader } from '../../components/layout/AppHeader';
import { AccountOverview } from '../../components/features/AccountOverview';
import { SubscriptionBillingPanel } from '../../components/features/SubscriptionBillingPanel';
import { SecuritySettingsPanel } from '../../components/features/SecuritySettingsPanel';
import { PreferencesPanel } from '../../components/features/PreferencesPanel';
import { ImportExportPanel } from '../../components/features/ImportExportPanel';
import { usePassword } from '../../contexts';
import { PasswordEntry } from '../../sdk/src/types-v2';

/**
 * Settings Page
 *
 * Comprehensive settings interface with tabbed navigation:
 * 1. Account - Wallet info, account stats
 * 2. Subscription - Current plan, upgrade options, billing history
 * 3. Usage & Storage - Storage breakdown, usage charts (future)
 * 4. Security - Recovery codes, security settings
 * 5. Import/Export - Bulk password operations
 * 6. Preferences - Display settings, theme
 */

type SettingsTab = 'account' | 'subscription' | 'usage' | 'security' | 'import-export' | 'preferences';

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { entries, createEntry, updateEntry, deleteEntry } = usePassword();

  // Get tab from URL query params, default to 'account'
  const [activeTab, setActiveTab] = useState<SettingsTab>('account');

  useEffect(() => {
    const tabParam = searchParams.get('tab') as SettingsTab;
    if (tabParam && ['account', 'subscription', 'usage', 'security', 'import-export', 'preferences'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  const handleTabChange = (tab: SettingsTab) => {
    setActiveTab(tab);
    // Update URL without page reload
    router.push(`/settings?tab=${tab}`);
  };

  const handleImport = async (importedEntries: PasswordEntry[]) => {
    // Import logic - create each entry
    for (const entry of importedEntries) {
      try {
        await createEntry(entry);
      } catch (error) {
        console.error('Failed to import entry:', entry.title, error);
      }
    }
  };

  return (
    <div className="settings-page">
      <AppHeader />

      <div className="settings-container">
        {/* Breadcrumb */}
        <div className="breadcrumb">
          <button onClick={() => router.push('/')} className="breadcrumb-link">
            Dashboard
          </button>
          <span className="breadcrumb-separator">→</span>
          <span className="breadcrumb-current">Settings</span>
        </div>

        {/* Page Header */}
        <div className="page-header">
          <h1>Settings</h1>
          <p>Manage your account, subscription, and preferences</p>
        </div>

        {/* Tab Navigation */}
        <div className="tabs-nav">
          <button
            className={`tab-btn ${activeTab === 'account' ? 'active' : ''}`}
            onClick={() => handleTabChange('account')}
          >
            <span className="tab-icon">🏠</span>
            <span className="tab-label">Account</span>
          </button>
          <button
            className={`tab-btn ${activeTab === 'subscription' ? 'active' : ''}`}
            onClick={() => handleTabChange('subscription')}
          >
            <span className="tab-icon">💳</span>
            <span className="tab-label">Subscription</span>
          </button>
          <button
            className={`tab-btn ${activeTab === 'usage' ? 'active' : ''}`}
            onClick={() => handleTabChange('usage')}
          >
            <span className="tab-icon">📊</span>
            <span className="tab-label">Usage</span>
          </button>
          <button
            className={`tab-btn ${activeTab === 'security' ? 'active' : ''}`}
            onClick={() => handleTabChange('security')}
          >
            <span className="tab-icon">🔐</span>
            <span className="tab-label">Security</span>
          </button>
          <button
            className={`tab-btn ${activeTab === 'import-export' ? 'active' : ''}`}
            onClick={() => handleTabChange('import-export')}
          >
            <span className="tab-icon">📦</span>
            <span className="tab-label">Import/Export</span>
          </button>
          <button
            className={`tab-btn ${activeTab === 'preferences' ? 'active' : ''}`}
            onClick={() => handleTabChange('preferences')}
          >
            <span className="tab-icon">⚙️</span>
            <span className="tab-label">Preferences</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="tab-content">
          {activeTab === 'account' && <AccountOverview />}
          {activeTab === 'subscription' && <SubscriptionBillingPanel />}
          {activeTab === 'usage' && (
            <div className="usage-panel">
              <h3>Usage & Storage</h3>
              <p className="coming-soon">
                📊 Detailed usage analytics and storage breakdown coming soon!
              </p>
            </div>
          )}
          {activeTab === 'security' && <SecuritySettingsPanel />}
          {activeTab === 'import-export' && (
            <div className="import-export-panel">
              <ImportExportPanel
                entries={entries}
                onImport={handleImport}
              />
            </div>
          )}
          {activeTab === 'preferences' && <PreferencesPanel />}
        </div>
      </div>

      <style jsx>{`
        .settings-page {
          min-height: 100vh;
          background: #f8f9fa;
        }

        .settings-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 2rem;
        }

        .breadcrumb {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 1.5rem;
          font-size: 0.9rem;
        }

        .breadcrumb-link {
          background: transparent;
          border: none;
          color: #667eea;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
        }

        .breadcrumb-link:hover {
          text-decoration: underline;
        }

        .breadcrumb-separator {
          color: #95a5a6;
        }

        .breadcrumb-current {
          color: #2c3e50;
          font-weight: 600;
        }

        .page-header {
          margin-bottom: 2rem;
        }

        .page-header h1 {
          margin: 0 0 0.5rem 0;
          font-size: 2.5rem;
          font-weight: 700;
          color: #2c3e50;
        }

        .page-header p {
          margin: 0;
          font-size: 1.1rem;
          color: #7f8c8d;
        }

        .tabs-nav {
          display: flex;
          gap: 0.5rem;
          border-bottom: 2px solid #e1e8ed;
          margin-bottom: 2rem;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }

        .tab-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1.25rem;
          border: none;
          background: transparent;
          color: #7f8c8d;
          font-size: 0.95rem;
          font-weight: 600;
          cursor: pointer;
          border-bottom: 3px solid transparent;
          transition: all 0.2s;
          white-space: nowrap;
        }

        .tab-btn:hover {
          color: #667eea;
          background: rgba(102, 126, 234, 0.05);
        }

        .tab-btn.active {
          color: #667eea;
          border-bottom-color: #667eea;
          background: rgba(102, 126, 234, 0.08);
        }

        .tab-icon {
          font-size: 1.2rem;
        }

        .tab-content {
          background: white;
          border-radius: 16px;
          padding: 2rem;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
          min-height: 400px;
        }

        .usage-panel h3,
        .import-export-panel h3 {
          margin: 0 0 1.5rem 0;
          color: #2c3e50;
          font-size: 1.5rem;
          font-weight: 700;
        }

        .coming-soon {
          text-align: center;
          color: #7f8c8d;
          font-size: 1.1rem;
          padding: 4rem 0;
        }

        @media (max-width: 768px) {
          .settings-container {
            padding: 1rem;
          }

          .page-header h1 {
            font-size: 2rem;
          }

          .tabs-nav {
            gap: 0.25rem;
          }

          .tab-btn {
            padding: 0.5rem 0.75rem;
            font-size: 0.85rem;
          }

          .tab-label {
            display: none;
          }

          .tab-icon {
            font-size: 1.5rem;
          }

          .tab-content {
            padding: 1.5rem;
          }
        }
      `}</style>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#f8f9fa',
      }}>
        <div style={{ color: '#2c3e50', fontSize: '1.25rem' }}>
          Loading Settings...
        </div>
      </div>
    }>
      <SettingsContent />
    </Suspense>
  );
}
