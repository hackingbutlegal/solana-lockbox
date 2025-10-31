'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AccountOverview } from '../../components/features/AccountOverview';
import { SubscriptionBillingPanel } from '../../components/features/SubscriptionBillingPanel';
import { SecuritySettingsPanel } from '../../components/features/SecuritySettingsPanel';
import { PreferencesPanel } from '../../components/features/PreferencesPanel';
import { ImportExportPanel } from '../../components/features/ImportExportPanel';
import { DangerZonePanel } from '../../components/features/DangerZonePanel';
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
 * 7. Danger Zone - Account reset, closure
 */

type SettingsTab = 'account' | 'storage' | 'import-export' | 'preferences' | 'danger-zone';

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Import/Export functionality
  const { entries, createEntry } = usePassword();

  // Get tab from URL query params, default to 'account'
  const [activeTab, setActiveTab] = useState<SettingsTab>('account');

  useEffect(() => {
    const tabParam = searchParams.get('tab') as SettingsTab;
    if (tabParam && ['account', 'storage', 'import-export', 'preferences', 'danger-zone'].includes(tabParam)) {
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

      <div className="settings-container">
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
            className={`tab-btn ${activeTab === 'storage' ? 'active' : ''}`}
            onClick={() => handleTabChange('storage')}
          >
            <span className="tab-icon">💾</span>
            <span className="tab-label">Storage</span>
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
          <button
            className={`tab-btn ${activeTab === 'danger-zone' ? 'active' : ''}`}
            onClick={() => handleTabChange('danger-zone')}
          >
            <span className="tab-icon">⚠️</span>
            <span className="tab-label">Danger Zone</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="tab-content">
          {activeTab === 'account' && <AccountOverview />}
          {activeTab === 'storage' && <SubscriptionBillingPanel />}
          {activeTab === 'import-export' && (
            <div className="import-export-panel">
              <ImportExportPanel
                entries={entries}
                onImport={handleImport}
              />
            </div>
          )}
          {activeTab === 'preferences' && <PreferencesPanel />}
          {activeTab === 'danger-zone' && <DangerZonePanel />}
        </div>
      </div>

      <style jsx>{`
        .settings-page {
          min-height: 100vh;
          background: linear-gradient(to bottom, #f8f9fa 0%, #e9ecef 100%);
          position: relative;
        }

        .settings-page::before {
          content: '';
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 300px;
          background: linear-gradient(135deg, rgba(102, 126, 234, 0.03) 0%, rgba(118, 75, 162, 0.03) 100%);
          z-index: 0;
          pointer-events: none;
        }

        .settings-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 2rem;
          position: relative;
          z-index: 1;
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
          margin-bottom: 2.5rem;
          animation: fadeInDown 0.5s ease-out;
        }

        @keyframes fadeInDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .page-header h1 {
          margin: 0 0 0.75rem 0;
          font-size: 2.75rem;
          font-weight: 800;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          letter-spacing: -0.03em;
        }

        .page-header p {
          margin: 0;
          font-size: 1.15rem;
          color: #6b7280;
          font-weight: 500;
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
          padding: 0.85rem 1.5rem;
          border: none;
          background: transparent;
          color: #7f8c8d;
          font-size: 0.95rem;
          font-weight: 600;
          cursor: pointer;
          border-bottom: 3px solid transparent;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          white-space: nowrap;
          position: relative;
          overflow: hidden;
        }

        .tab-btn::before {
          content: '';
          position: absolute;
          bottom: 0;
          left: 50%;
          width: 0;
          height: 3px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          transform: translateX(-50%);
        }

        .tab-btn:hover {
          color: #667eea;
          background: rgba(102, 126, 234, 0.06);
        }

        .tab-btn.active {
          color: #667eea;
          background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
          font-weight: 700;
        }

        .tab-btn.active::before {
          width: 100%;
        }

        .tab-icon {
          font-size: 1.2rem;
        }

        .tab-content {
          background: white;
          border-radius: 20px;
          padding: 2.5rem;
          box-shadow:
            0 4px 20px rgba(0, 0, 0, 0.08),
            0 0 0 1px rgba(0, 0, 0, 0.03);
          min-height: 400px;
          animation: fadeIn 0.4s ease-out;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
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
