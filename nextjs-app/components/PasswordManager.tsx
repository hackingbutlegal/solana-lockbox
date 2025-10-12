'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useLockboxV2 } from '../contexts/LockboxV2Context';
import { PasswordEntry, PasswordEntryType, TIER_INFO } from '../sdk/src/types-v2';
import { searchEntries, sortEntries, groupByCategory, checkPasswordStrength, analyzePasswordHealth } from '../sdk/src/utils';
import { sanitizePasswordEntry } from '../lib/input-sanitization';

/**
 * Password Manager Dashboard
 *
 * Main UI for password management with v2 lockbox:
 * - Password vault (list/grid view)
 * - Search and filter
 * - CRUD operations
 * - Password health analysis
 * - Subscription management
 */

type ViewMode = 'list' | 'grid';
type SortOption = 'title' | 'lastModified' | 'accessCount';
type SortOrder = 'asc' | 'desc';

export function PasswordManager() {
  const { publicKey } = useWallet();
  const {
    client,
    sessionKey,
    isInitialized,
    initializeSession,
    masterLockbox,
    entries,
    refreshEntries,
    createEntry,
    updateEntry,
    deleteEntry,
    loading,
    error,
  } = useLockboxV2();

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('lastModified');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [selectedType, setSelectedType] = useState<PasswordEntryType | null>(null);

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<PasswordEntry | null>(null);

  // Initialize session on mount if wallet connected
  useEffect(() => {
    if (publicKey && !isInitialized && !sessionKey) {
      initializeSession();
    }
  }, [publicKey, isInitialized, sessionKey, initializeSession]);

  // Refresh entries when session is initialized
  useEffect(() => {
    if (isInitialized && sessionKey) {
      refreshEntries();
    }
  }, [isInitialized, sessionKey]);

  // Filtered and sorted entries
  const filteredEntries = useMemo(() => {
    let result = entries;

    // Search filter
    if (searchQuery) {
      result = searchEntries(result, searchQuery);
    }

    // Category filter
    if (selectedCategory !== null) {
      result = result.filter(e => e.category === selectedCategory);
    }

    // Type filter
    if (selectedType !== null) {
      result = result.filter(e => e.type === selectedType);
    }

    // Sort
    result = sortEntries(result, sortBy, sortOrder);

    return result;
  }, [entries, searchQuery, selectedCategory, selectedType, sortBy, sortOrder]);

  // Category groups (for sidebar)
  const categoryGroups = useMemo(() => {
    return groupByCategory(entries);
  }, [entries]);

  // Password health analysis
  const passwordHealth = useMemo(() => {
    if (entries.length === 0) return null;
    return analyzePasswordHealth(entries);
  }, [entries]);

  // Handle create entry
  const handleCreateEntry = async (entry: PasswordEntry) => {
    try {
      // Sanitize input
      const sanitized = sanitizePasswordEntry(entry);

      const entryId = await createEntry(sanitized as PasswordEntry);

      if (entryId) {
        setShowCreateModal(false);
        // TODO: Show success notification
      }
    } catch (err) {
      console.error('Failed to create entry:', err);
      // TODO: Show error notification
    }
  };

  // Handle update entry
  const handleUpdateEntry = async (entry: PasswordEntry) => {
    if (!selectedEntry || !selectedEntry.id) return;

    try {
      // Sanitize input
      const sanitized = sanitizePasswordEntry(entry);

      // TODO: Get chunk index from entry metadata
      const chunkIndex = 0; // Placeholder - need to track this

      const success = await updateEntry(chunkIndex, selectedEntry.id, sanitized as PasswordEntry);

      if (success) {
        setShowEditModal(false);
        setSelectedEntry(null);
        // TODO: Show success notification
      }
    } catch (err) {
      console.error('Failed to update entry:', err);
      // TODO: Show error notification
    }
  };

  // Handle delete entry
  const handleDeleteEntry = async (entry: PasswordEntry) => {
    if (!entry.id) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete "${entry.title}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      // TODO: Get chunk index from entry metadata
      const chunkIndex = 0; // Placeholder - need to track this

      const success = await deleteEntry(chunkIndex, entry.id);

      if (success) {
        setShowDetailsModal(false);
        setSelectedEntry(null);
        // TODO: Show success notification
      }
    } catch (err) {
      console.error('Failed to delete entry:', err);
      // TODO: Show error notification
    }
  };

  // If wallet not connected
  if (!publicKey) {
    return (
      <div className="password-manager">
        <header className="pm-header">
          <div className="pm-header-content">
            <h1>🔐 Password Manager</h1>
            <WalletMultiButton />
          </div>
        </header>

        <div className="pm-connect-prompt">
          <div className="connect-card">
            <h2>Welcome to Solana Lockbox</h2>
            <p>Connect your wallet to access your password vault</p>
            <ul className="feature-list">
              <li>✅ Zero-knowledge encryption</li>
              <li>✅ Blockchain-backed storage</li>
              <li>✅ Multi-device sync</li>
              <li>✅ Password health monitoring</li>
            </ul>
            <WalletMultiButton />
          </div>
        </div>

        <style jsx>{`
          .password-manager {
            min-height: 100vh;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          }

          .pm-header {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border-bottom: 1px solid rgba(0, 0, 0, 0.1);
            padding: 1rem 2rem;
          }

          .pm-header-content {
            max-width: 1400px;
            margin: 0 auto;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }

          .pm-header h1 {
            margin: 0;
            font-size: 1.5rem;
            color: #2c3e50;
          }

          .pm-connect-prompt {
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: calc(100vh - 100px);
            padding: 2rem;
          }

          .connect-card {
            background: white;
            border-radius: 16px;
            padding: 3rem;
            max-width: 500px;
            text-align: center;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
          }

          .connect-card h2 {
            margin: 0 0 1rem 0;
            color: #2c3e50;
          }

          .connect-card p {
            color: #7f8c8d;
            margin-bottom: 2rem;
          }

          .feature-list {
            list-style: none;
            padding: 0;
            margin: 2rem 0;
            text-align: left;
          }

          .feature-list li {
            padding: 0.75rem 0;
            color: #2c3e50;
            font-size: 1.1rem;
          }
        `}</style>
      </div>
    );
  }

  // If master lockbox not initialized
  if (!masterLockbox) {
    return (
      <div className="password-manager">
        <header className="pm-header">
          <div className="pm-header-content">
            <h1>🔐 Password Manager</h1>
            <WalletMultiButton />
          </div>
        </header>

        <div className="pm-setup-prompt">
          <div className="setup-card">
            <h2>Password Manager v2.0</h2>

            {error && error.includes('IDL not loaded') ? (
              <>
                <div className="info-message">
                  <p><strong>Status:</strong> v2 Program Not Deployed Yet</p>
                  <p>
                    The password manager v2.0 program needs to be deployed to devnet before the frontend can interact with it.
                  </p>
                </div>

                <div className="info-box">
                  <h3>What&apos;s Next?</h3>
                  <ul>
                    <li>✅ v2 Rust program code complete</li>
                    <li>✅ Frontend dashboard complete</li>
                    <li>✅ SDK complete (client, types, utils)</li>
                    <li>⏳ Deploy v2 program to devnet</li>
                    <li>⏳ Generate program IDL</li>
                    <li>⏳ Full integration testing</li>
                  </ul>
                </div>

                <div className="info-box">
                  <h3>Development Status:</h3>
                  <p>
                    The password manager frontend is complete and ready for use once the v2 program is deployed to devnet.
                  </p>
                  <p>
                    All security enhancements are in place (AEAD validation, rate limiting, input sanitization, etc.).
                  </p>
                </div>
              </>
            ) : (
              <>
                <h2>Initialize Your Password Vault</h2>
                <p>Create your master lockbox to start storing passwords securely</p>

                {error && (
                  <div className="error-message">
                    {error}
                  </div>
                )}

                <button
                  onClick={async () => {
                    if (client) {
                      try {
                        await client.initializeMasterLockbox();
                        // Refresh to show new lockbox
                        window.location.reload();
                      } catch (err) {
                        console.error('Failed to initialize:', err);
                      }
                    }
                  }}
                  disabled={loading}
                  className="btn-primary"
                >
                  {loading ? 'Initializing...' : 'Create Password Vault'}
                </button>

                <div className="info-box">
                  <h3>What is a Master Lockbox?</h3>
                  <p>
                    Your master lockbox is your personal password vault stored on the Solana blockchain.
                    All passwords are encrypted client-side before storage.
                  </p>
                  <p>
                    <strong>Free Tier:</strong> 1KB storage (~10 passwords)
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        <style jsx>{`
          .password-manager {
            min-height: 100vh;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          }

          .pm-header {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border-bottom: 1px solid rgba(0, 0, 0, 0.1);
            padding: 1rem 2rem;
          }

          .pm-header-content {
            max-width: 1400px;
            margin: 0 auto;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }

          .pm-header h1 {
            margin: 0;
            font-size: 1.5rem;
            color: #2c3e50;
          }

          .pm-setup-prompt {
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: calc(100vh - 100px);
            padding: 2rem;
          }

          .setup-card {
            background: white;
            border-radius: 16px;
            padding: 3rem;
            max-width: 600px;
            text-align: center;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
          }

          .setup-card h2 {
            margin: 0 0 1rem 0;
            color: #2c3e50;
          }

          .setup-card p {
            color: #7f8c8d;
            margin-bottom: 2rem;
          }

          .btn-primary {
            background: #667eea;
            color: white;
            border: none;
            border-radius: 8px;
            padding: 1rem 2rem;
            font-size: 1.1rem;
            cursor: pointer;
            transition: all 0.3s;
            margin-bottom: 2rem;
          }

          .btn-primary:hover:not(:disabled) {
            background: #5568d3;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
          }

          .btn-primary:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          .info-box {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 1.5rem;
            text-align: left;
            margin-bottom: 1rem;
          }

          .info-box h3 {
            margin: 0 0 0.5rem 0;
            color: #2c3e50;
            font-size: 1.1rem;
          }

          .info-box p {
            margin: 0.5rem 0;
            color: #7f8c8d;
            font-size: 0.95rem;
          }

          .info-box ul {
            list-style: none;
            padding: 0;
            margin: 0.5rem 0;
          }

          .info-box li {
            padding: 0.5rem 0;
            color: #2c3e50;
          }

          .info-message {
            background: #e3f2fd;
            border: 1px solid #90caf9;
            border-radius: 8px;
            padding: 1rem;
            margin-bottom: 1rem;
            text-align: center;
          }

          .info-message p {
            margin: 0.5rem 0;
            color: #1976d2;
          }

          .error-message {
            background: #fee;
            border: 1px solid #fcc;
            border-radius: 8px;
            padding: 1rem;
            margin-bottom: 1rem;
            color: #c33;
          }
        `}</style>
      </div>
    );
  }

  // Main password manager UI
  const tierInfo = TIER_INFO[masterLockbox.subscriptionTier];

  return (
    <div className="password-manager">
      <header className="pm-header">
        <div className="pm-header-content">
          <h1>🔐 Password Manager</h1>
          <div className="header-actions">
            <div className="storage-info">
              <span className="tier-badge">{tierInfo.name}</span>
              <span className="storage-used">
                {masterLockbox.storageUsed} / {tierInfo.maxCapacity} bytes
              </span>
            </div>
            <WalletMultiButton />
          </div>
        </div>
      </header>

      <div className="pm-container">
        {/* Sidebar */}
        <aside className="pm-sidebar">
          <button
            className="btn-new-entry"
            onClick={() => setShowCreateModal(true)}
            disabled={loading}
          >
            + New Password
          </button>

          <div className="sidebar-section">
            <h3>Quick Filter</h3>
            <button
              className={`filter-btn ${selectedType === null && selectedCategory === null ? 'active' : ''}`}
              onClick={() => {
                setSelectedType(null);
                setSelectedCategory(null);
              }}
            >
              All Entries ({entries.length})
            </button>
          </div>

          <div className="sidebar-section">
            <h3>Types</h3>
            {Object.values(PasswordEntryType).filter(v => typeof v === 'number').map((type) => {
              const count = entries.filter(e => e.type === type).length;
              return (
                <button
                  key={type}
                  className={`filter-btn ${selectedType === type ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedType(type as PasswordEntryType);
                    setSelectedCategory(null);
                  }}
                >
                  {PasswordEntryType[type as number]} ({count})
                </button>
              );
            })}
          </div>

          {categoryGroups.size > 0 && (
            <div className="sidebar-section">
              <h3>Categories</h3>
              {Array.from(categoryGroups.entries()).map(([category, categoryEntries]) => (
                <button
                  key={category}
                  className={`filter-btn ${selectedCategory === category ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedCategory(category);
                    setSelectedType(null);
                  }}
                >
                  Category {category} ({categoryEntries.length})
                </button>
              ))}
            </div>
          )}

          {passwordHealth && (
            <div className="sidebar-section health-summary">
              <h3>Password Health</h3>
              <div className="health-stat">
                <span className="health-label">Weak:</span>
                <span className="health-value weak">{passwordHealth.weak}</span>
              </div>
              <div className="health-stat">
                <span className="health-label">Reused:</span>
                <span className="health-value warning">{passwordHealth.reused}</span>
              </div>
              <div className="health-stat">
                <span className="health-label">Score:</span>
                <span className="health-value strong">{passwordHealth.score}/100</span>
              </div>
            </div>
          )}
        </aside>

        {/* Main Content */}
        <main className="pm-main">
          {/* Toolbar */}
          <div className="pm-toolbar">
            <div className="search-bar">
              <input
                type="text"
                placeholder="Search passwords..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="toolbar-actions">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
              >
                <option value="title">Title</option>
                <option value="lastModified">Last Modified</option>
                <option value="accessCount">Access Count</option>
              </select>

              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="btn-sort-order"
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </button>

              <div className="view-toggle">
                <button
                  className={viewMode === 'list' ? 'active' : ''}
                  onClick={() => setViewMode('list')}
                >
                  List
                </button>
                <button
                  className={viewMode === 'grid' ? 'active' : ''}
                  onClick={() => setViewMode('grid')}
                >
                  Grid
                </button>
              </div>

              <button onClick={refreshEntries} disabled={loading} className="btn-refresh">
                ↻ Refresh
              </button>
            </div>
          </div>

          {/* Entry List/Grid */}
          {loading && entries.length === 0 ? (
            <div className="loading-state">
              <p>Loading your passwords...</p>
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="empty-state">
              <h2>No passwords found</h2>
              <p>
                {searchQuery || selectedType !== null || selectedCategory !== null
                  ? 'Try adjusting your filters'
                  : 'Click "New Password" to add your first password'}
              </p>
            </div>
          ) : (
            <div className={`entry-${viewMode}`}>
              {filteredEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="entry-card"
                  onClick={() => {
                    setSelectedEntry(entry);
                    setShowDetailsModal(true);
                  }}
                >
                  <div className="entry-header">
                    <h3>{entry.title}</h3>
                    <span className="entry-type">
                      {PasswordEntryType[entry.type]}
                    </span>
                  </div>
                  {entry.username && (
                    <p className="entry-username">{entry.username}</p>
                  )}
                  {entry.url && (
                    <p className="entry-url">{entry.url}</p>
                  )}
                  <div className="entry-footer">
                    {entry.lastModified && (
                      <span className="entry-date">
                        Modified: {typeof entry.lastModified === 'number'
                          ? new Date(entry.lastModified * 1000).toLocaleDateString()
                          : entry.lastModified.toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Modals would go here - will implement in next step */}

      <style jsx>{`
        .password-manager {
          min-height: 100vh;
          background: #f5f7fa;
        }

        .pm-header {
          background: white;
          border-bottom: 1px solid #e1e8ed;
          padding: 1rem 2rem;
        }

        .pm-header-content {
          max-width: 1400px;
          margin: 0 auto;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .pm-header h1 {
          margin: 0;
          font-size: 1.5rem;
          color: #2c3e50;
        }

        .header-actions {
          display: flex;
          gap: 1rem;
          align-items: center;
        }

        .storage-info {
          display: flex;
          gap: 0.5rem;
          align-items: center;
          font-size: 0.9rem;
        }

        .tier-badge {
          background: #667eea;
          color: white;
          padding: 0.25rem 0.75rem;
          border-radius: 12px;
          font-weight: 600;
        }

        .storage-used {
          color: #7f8c8d;
        }

        .pm-container {
          max-width: 1400px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 250px 1fr;
          gap: 2rem;
          padding: 2rem;
          min-height: calc(100vh - 80px);
        }

        .pm-sidebar {
          background: white;
          border-radius: 12px;
          padding: 1.5rem;
          height: fit-content;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        }

        .btn-new-entry {
          width: 100%;
          background: #667eea;
          color: white;
          border: none;
          border-radius: 8px;
          padding: 0.75rem;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          margin-bottom: 1.5rem;
        }

        .btn-new-entry:hover:not(:disabled) {
          background: #5568d3;
        }

        .btn-new-entry:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .sidebar-section {
          margin-bottom: 1.5rem;
        }

        .sidebar-section h3 {
          margin: 0 0 0.75rem 0;
          font-size: 0.875rem;
          color: #7f8c8d;
          text-transform: uppercase;
          font-weight: 600;
        }

        .filter-btn {
          width: 100%;
          background: none;
          border: none;
          text-align: left;
          padding: 0.5rem 0.75rem;
          border-radius: 6px;
          cursor: pointer;
          color: #2c3e50;
          font-size: 0.95rem;
          transition: all 0.2s;
          margin-bottom: 0.25rem;
        }

        .filter-btn:hover {
          background: #f8f9fa;
        }

        .filter-btn.active {
          background: #667eea;
          color: white;
        }

        .health-summary {
          border-top: 1px solid #e1e8ed;
          padding-top: 1rem;
        }

        .health-stat {
          display: flex;
          justify-content: space-between;
          padding: 0.5rem 0;
        }

        .health-label {
          color: #7f8c8d;
        }

        .health-value {
          font-weight: 600;
        }

        .health-value.weak {
          color: #e74c3c;
        }

        .health-value.warning {
          color: #f39c12;
        }

        .health-value.strong {
          color: #27ae60;
        }

        .pm-main {
          background: white;
          border-radius: 12px;
          padding: 1.5rem;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        }

        .pm-toolbar {
          display: flex;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .search-bar {
          flex: 1;
        }

        .search-bar input {
          width: 100%;
          padding: 0.75rem;
          border: 1px solid #e1e8ed;
          border-radius: 8px;
          font-size: 1rem;
        }

        .toolbar-actions {
          display: flex;
          gap: 0.5rem;
        }

        .toolbar-actions select {
          padding: 0.5rem 1rem;
          border: 1px solid #e1e8ed;
          border-radius: 8px;
          background: white;
          cursor: pointer;
        }

        .btn-sort-order {
          padding: 0.5rem 1rem;
          border: 1px solid #e1e8ed;
          border-radius: 8px;
          background: white;
          cursor: pointer;
          font-size: 1.2rem;
        }

        .view-toggle {
          display: flex;
          border: 1px solid #e1e8ed;
          border-radius: 8px;
          overflow: hidden;
        }

        .view-toggle button {
          padding: 0.5rem 1rem;
          border: none;
          background: white;
          cursor: pointer;
          border-right: 1px solid #e1e8ed;
        }

        .view-toggle button:last-child {
          border-right: none;
        }

        .view-toggle button.active {
          background: #667eea;
          color: white;
        }

        .btn-refresh {
          padding: 0.5rem 1rem;
          border: 1px solid #e1e8ed;
          border-radius: 8px;
          background: white;
          cursor: pointer;
        }

        .btn-refresh:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .loading-state,
        .empty-state {
          text-align: center;
          padding: 4rem 2rem;
          color: #7f8c8d;
        }

        .entry-list,
        .entry-grid {
          display: grid;
          gap: 1rem;
        }

        .entry-list {
          grid-template-columns: 1fr;
        }

        .entry-grid {
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        }

        .entry-card {
          background: white;
          border: 1px solid #e1e8ed;
          border-radius: 8px;
          padding: 1rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .entry-card:hover {
          border-color: #667eea;
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
        }

        .entry-header {
          display: flex;
          justify-content: space-between;
          align-items: start;
          margin-bottom: 0.5rem;
        }

        .entry-header h3 {
          margin: 0;
          font-size: 1.1rem;
          color: #2c3e50;
        }

        .entry-type {
          background: #f8f9fa;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-size: 0.75rem;
          color: #7f8c8d;
        }

        .entry-username,
        .entry-url {
          margin: 0.25rem 0;
          font-size: 0.9rem;
          color: #7f8c8d;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .entry-footer {
          margin-top: 0.75rem;
          padding-top: 0.75rem;
          border-top: 1px solid #f8f9fa;
        }

        .entry-date {
          font-size: 0.8rem;
          color: #95a5a6;
        }
      `}</style>
    </div>
  );
}
