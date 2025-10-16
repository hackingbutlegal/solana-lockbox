'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useAuth, useLockbox, usePassword, useSubscription, useCategory } from '../../contexts';
import { PasswordEntry, PasswordEntryType, TIER_INFO, LoginEntry } from '../../sdk/src/types-v2';
import { searchEntries, sortEntries, groupByCategory, checkPasswordStrength, analyzePasswordHealth } from '../../sdk/src/utils';
import { sanitizePasswordEntry } from '../../lib/input-sanitization-v2';
import { CategoryManager } from '../../lib/category-manager';
import { PasswordGeneratorModal } from '../modals/PasswordGeneratorModal';
import { PasswordEntryModal } from '../modals/PasswordEntryModal';
import { TOTPManagerModal } from '../modals/TOTPManagerModal';
import { HealthDashboardModal } from '../modals/HealthDashboardModal';
import { CategoryManagerModal } from '../modals/CategoryManagerModal';
import { StorageUsageBar } from '../ui/StorageUsageBar';
import { SubscriptionUpgradeModal } from '../modals/SubscriptionUpgradeModal';
import { OrphanedChunkRecovery } from '../ui/OrphanedChunkRecovery';
import { useToast } from '../ui/Toast';
import { useConfirm } from '../ui/ConfirmDialog';
import { SearchBar } from './SearchBar';
import { FilterPanel } from './FilterPanel';
import { VirtualizedPasswordList } from './VirtualizedPasswordList';
import { BatchOperationsToolbar } from './BatchOperationsToolbar';
import { BatchUpdateOperations, BatchUpdateProgress } from '../../lib/batch-update-operations';

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
  const toast = useToast();
  const { confirm } = useConfirm();
  const { publicKey } = useWallet();

  // Use specialized context hooks
  const { client, isSessionActive } = useAuth();
  const { masterLockbox, error: lockboxError } = useLockbox();
  const { entries, refreshEntries, createEntry, updateEntry, deleteEntry, loading, error } = usePassword();
  const { upgradeSubscription } = useSubscription();
  const { categories, createCategory, updateCategory, deleteCategory, getCategoryName } = useCategory();

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('lastModified');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [selectedType, setSelectedType] = useState<PasswordEntryType | null>(null);

  // Filter state for FilterPanel
  const [selectedTypes, setSelectedTypes] = useState<PasswordEntryType[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [showFavorites, setShowFavorites] = useState<boolean | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [showOldPasswords, setShowOldPasswords] = useState(false);

  // Batch operations state
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<number>>(new Set());
  const [isVirtualizedView, setIsVirtualizedView] = useState(false);

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<PasswordEntry | null>(null);
  const [showTOTPModal, setShowTOTPModal] = useState(false);
  const [showHealthModal, setShowHealthModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [entryModalMode, setEntryModalMode] = useState<'create' | 'edit' | 'view'>('create');
  const [showResetModal, setShowResetModal] = useState(false);

  // PasswordContext automatically triggers refreshEntries when masterLockbox loads
  // and handles session initialization as needed, so no manual trigger required here

  // Filtered and sorted entries
  const filteredEntries = useMemo(() => {
    let result = entries;

    // Search filter
    if (searchQuery) {
      result = searchEntries(result, searchQuery);
    }

    // Legacy single category/type filters (for sidebar compatibility)
    if (selectedCategory !== null) {
      result = result.filter(e => e.category === selectedCategory);
    }
    if (selectedType !== null) {
      result = result.filter(e => e.type === selectedType);
    }

    // New FilterPanel multi-select filters
    if (selectedTypes.length > 0) {
      result = result.filter(e => selectedTypes.includes(e.type));
    }
    if (selectedCategories.length > 0) {
      result = result.filter(e => e.category !== undefined && selectedCategories.includes(e.category));
    }

    // Favorites filter
    if (showFavorites !== null) {
      result = result.filter(e => e.favorite === showFavorites);
    }

    // Archived filter
    if (!showArchived) {
      result = result.filter(e => !e.archived);
    }

    // Old passwords filter (>90 days)
    if (showOldPasswords) {
      const ninetyDaysAgo = Date.now() / 1000 - (90 * 24 * 60 * 60);
      result = result.filter(e => {
        const lastMod = typeof e.lastModified === 'number' ? e.lastModified : (e.lastModified?.getTime() || 0) / 1000;
        return lastMod < ninetyDaysAgo;
      });
    }

    // Sort
    result = sortEntries(result, sortBy, sortOrder);

    return result;
  }, [entries, searchQuery, selectedCategory, selectedType, selectedTypes, selectedCategories, showFavorites, showArchived, showOldPasswords, sortBy, sortOrder]);

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
        toast.showSuccess(`Password saved successfully! Entry ID: ${entryId}`);
      } else {
        toast.showError('Failed to create password entry.');
      }
    } catch (err) {
      console.error('Failed to create entry:', err);

      // Check if this is a storage limit error
      // IMPORTANT: Storage limit validation happens in the SDK BEFORE creating any Solana transaction,
      // which means users are NEVER charged transaction fees when storage limits are exceeded.
      // The validation occurs at client-v2.ts:538-552, before any transaction is signed or sent.
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (errorMessage.includes('STORAGE_LIMIT_EXCEEDED')) {
        // Extract the tier info from error message
        const match = errorMessage.match(/your (\w+) tier/);
        const currentTier = match ? match[1] : 'Free';

        toast.showWarning(
          `Storage limit reached! Your ${currentTier} tier doesn't have enough space for this entry. ` +
          `Please upgrade your subscription or delete some entries to free up space.`,
          { duration: 8000 } // Show for 8 seconds
        );
      } else if (errorMessage.includes('AccountDidNotSerialize') || errorMessage.includes('0xbbc')) {
        toast.showError(
          `Program error: The master lockbox account needs more space to store chunk metadata. ` +
          `This is a limitation of the current program deployment. Please contact support or reset your account.`,
          { duration: 10000 }
        );
      } else {
        toast.showError(`Error: ${errorMessage}`);
      }
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

    const confirmed = await confirm({
      title: 'Delete Password',
      message: `Are you sure you want to delete "${entry.title}"? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      danger: true
    });

    if (!confirmed) return;

    try {
      // TODO: Get chunk index from entry metadata
      const chunkIndex = 0; // Placeholder - need to track this

      const success = await deleteEntry(chunkIndex, entry.id);

      if (success) {
        setShowDetailsModal(false);
        setSelectedEntry(null);
        toast.showSuccess('Password deleted successfully');
      }
    } catch (err) {
      console.error('Failed to delete entry:', err);
      toast.showError('Failed to delete password entry');
    }
  };

  // Handle subscription upgrade
  const handleUpgradeSubscription = async (newTier: number) => {
    try {
      await upgradeSubscription(newTier);
      const tierName = TIER_INFO[newTier as keyof typeof TIER_INFO]?.name || 'Unknown';
      toast.showSuccess(`Successfully upgraded to ${tierName} tier!`);
      setShowUpgradeModal(false);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to upgrade subscription';
      console.error('Upgrade failed:', err);
      toast.showError(`Upgrade failed: ${errorMsg}`);
    }
  };

  // Batch operation handlers
  const selectedEntries = useMemo(() => {
    return filteredEntries.filter(e => e.id && selectedEntryIds.has(e.id));
  }, [filteredEntries, selectedEntryIds]);

  const handleSelectAll = () => {
    const allIds = new Set(filteredEntries.filter(e => e.id).map(e => e.id!));
    setSelectedEntryIds(allIds);
  };

  const handleDeselectAll = () => {
    setSelectedEntryIds(new Set());
  };

  const handleDeleteSelected = async () => {
    const confirmed = await confirm({
      title: 'Delete Multiple Passwords',
      message: `Are you sure you want to delete ${selectedEntries.length} password(s)? This action cannot be undone.`,
      confirmText: 'Delete All',
      cancelText: 'Cancel',
      danger: true
    });

    if (!confirmed) return;

    let successCount = 0;
    let failCount = 0;

    for (const entry of selectedEntries) {
      if (!entry.id) continue;
      try {
        const chunkIndex = 0; // TODO: Get from metadata
        await deleteEntry(chunkIndex, entry.id);
        successCount++;
      } catch (err) {
        console.error(`Failed to delete entry ${entry.id}:`, err);
        failCount++;
      }
    }

    setSelectedEntryIds(new Set());

    if (failCount === 0) {
      toast.showSuccess(`Successfully deleted ${successCount} password(s)`);
    } else {
      toast.showWarning(`Deleted ${successCount} password(s), but ${failCount} failed`);
    }
  };

  const handleArchiveSelected = async () => {
    if (!client) return;

    const confirmed = await confirm({
      title: 'Archive Multiple Passwords',
      message: `Archive ${selectedEntries.length} password(s)? You can unarchive them later.`,
      confirmText: 'Archive All',
      cancelText: 'Cancel',
    });

    if (!confirmed) return;

    const batchOps = new BatchUpdateOperations(client);
    const entryIds = selectedEntries.filter(e => e.id).map(e => e.id!);

    toast.showInfo(`Archiving ${entryIds.length} passwords...`);

    try {
      const result = await batchOps.archiveEntries(entryIds);

      setSelectedEntryIds(new Set());

      if (result.totalFailed === 0) {
        toast.showSuccess(`Successfully archived ${result.totalSuccessful} password(s)`);
      } else {
        toast.showWarning(
          `Archived ${result.totalSuccessful} password(s), but ${result.totalFailed} failed`
        );
      }

      // Refresh entries
      await refreshEntries();
    } catch (err) {
      console.error('Batch archive error:', err);
      toast.showError('Failed to archive passwords');
    }
  };

  const handleUnarchiveSelected = async () => {
    if (!client) return;

    const batchOps = new BatchUpdateOperations(client);
    const entryIds = selectedEntries.filter(e => e.id).map(e => e.id!);

    toast.showInfo(`Unarchiving ${entryIds.length} passwords...`);

    try {
      const result = await batchOps.unarchiveEntries(entryIds);

      setSelectedEntryIds(new Set());

      if (result.totalFailed === 0) {
        toast.showSuccess(`Successfully unarchived ${result.totalSuccessful} password(s)`);
      } else {
        toast.showWarning(
          `Unarchived ${result.totalSuccessful} password(s), but ${result.totalFailed} failed`
        );
      }

      await refreshEntries();
    } catch (err) {
      console.error('Batch unarchive error:', err);
      toast.showError('Failed to unarchive passwords');
    }
  };

  const handleFavoriteSelected = async () => {
    if (!client) return;

    const batchOps = new BatchUpdateOperations(client);
    const entryIds = selectedEntries.filter(e => e.id).map(e => e.id!);

    toast.showInfo(`Marking ${entryIds.length} passwords as favorites...`);

    try {
      const result = await batchOps.favoriteEntries(entryIds);

      setSelectedEntryIds(new Set());

      if (result.totalFailed === 0) {
        toast.showSuccess(`Successfully marked ${result.totalSuccessful} password(s) as favorites`);
      } else {
        toast.showWarning(
          `Marked ${result.totalSuccessful} password(s) as favorites, but ${result.totalFailed} failed`
        );
      }

      await refreshEntries();
    } catch (err) {
      console.error('Batch favorite error:', err);
      toast.showError('Failed to mark passwords as favorites');
    }
  };

  const handleUnfavoriteSelected = async () => {
    if (!client) return;

    const batchOps = new BatchUpdateOperations(client);
    const entryIds = selectedEntries.filter(e => e.id).map(e => e.id!);

    toast.showInfo(`Unmarking ${entryIds.length} passwords as favorites...`);

    try {
      const result = await batchOps.unfavoriteEntries(entryIds);

      setSelectedEntryIds(new Set());

      if (result.totalFailed === 0) {
        toast.showSuccess(`Successfully unmarked ${result.totalSuccessful} password(s) as favorites`);
      } else {
        toast.showWarning(
          `Unmarked ${result.totalSuccessful} password(s) as favorites, but ${result.totalFailed} failed`
        );
      }

      await refreshEntries();
    } catch (err) {
      console.error('Batch unfavorite error:', err);
      toast.showError('Failed to unmark passwords as favorites');
    }
  };

  const handleAssignCategory = async (categoryId: number) => {
    if (!client) return;

    const batchOps = new BatchUpdateOperations(client);
    const entryIds = selectedEntries.filter(e => e.id).map(e => e.id!);
    const categoryName = getCategoryName(categoryId);

    toast.showInfo(`Assigning ${entryIds.length} passwords to category "${categoryName}"...`);

    try {
      const result = await batchOps.assignCategory(entryIds, categoryId);

      setSelectedEntryIds(new Set());

      if (result.totalFailed === 0) {
        toast.showSuccess(
          `Successfully assigned ${result.totalSuccessful} password(s) to "${categoryName}"`
        );
      } else {
        toast.showWarning(
          `Assigned ${result.totalSuccessful} password(s) to "${categoryName}", but ${result.totalFailed} failed`
        );
      }

      await refreshEntries();
    } catch (err) {
      console.error('Batch category assignment error:', err);
      toast.showError('Failed to assign category');
    }
  };

  const handleExportSelected = () => {
    // Export selected entries to JSON
    const entriesToExport = selectedEntries.map(entry => ({
      ...entry,
      // Convert dates to ISO strings for JSON serialization
      createdAt: entry.createdAt?.toISOString(),
      lastModified: entry.lastModified?.toISOString(),
    }));

    const dataStr = JSON.stringify(entriesToExport, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `lockbox-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);

    toast.showSuccess(`Exported ${selectedEntries.length} password(s) to JSON`);
  };

  const handleClearAllFilters = () => {
    setSelectedTypes([]);
    setSelectedCategories([]);
    setShowFavorites(null);
    setShowArchived(false);
    setShowOldPasswords(false);
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

          /* Mobile responsive */
          @media (max-width: 768px) {
            .pm-header {
              padding: 0.75rem;
            }

            .pm-header-content {
              padding: 0;
            }

            .pm-header h1 {
              font-size: 1.2rem;
            }

            .pm-connect-prompt {
              padding: 1rem;
            }

            .connect-card {
              padding: 2rem 1.5rem;
              max-width: 100%;
            }

            .connect-card h2 {
              font-size: 1.5rem;
            }

            .feature-list li {
              font-size: 1rem;
            }
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

            {(error || lockboxError) && (error?.includes('IDL not loaded') || lockboxError?.includes('IDL not loaded')) ? (
              <>
                <div className="info-message">
                  <p><strong>Status:</strong> ✅ Program Deployed to Devnet</p>
                  <p><strong>Program ID:</strong> 7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB</p>
                  <p>
                    The program is deployed with all security fixes, but the IDL (Interface Description Language) needs to be generated for the frontend to interact with it.
                  </p>
                </div>

                <div className="info-box">
                  <h3>What&apos;s Next?</h3>
                  <ul>
                    <li>✅ v2 Rust program code complete</li>
                    <li>✅ All critical security fixes applied</li>
                    <li>✅ Frontend dashboard complete</li>
                    <li>✅ SDK complete (client, types, utils)</li>
                    <li>✅ Deployed to devnet</li>
                    <li>⏳ Generate program IDL (blocked by anchor-syn version issue)</li>
                    <li>⏳ Full integration testing</li>
                  </ul>
                </div>

                <div className="info-box">
                  <h3>Technical Details:</h3>
                  <p>
                    The program binary was successfully built and deployed using cargo-build-sbf.
                    IDL generation failed due to a proc-macro2 incompatibility in anchor-syn 0.30.1.
                  </p>
                  <p>
                    <strong>Security Fixes Deployed:</strong>
                  </p>
                  <ul>
                    <li>✅ Fixed FEE_RECEIVER .unwrap() panic risk</li>
                    <li>✅ Added checked arithmetic for overflow prevention</li>
                    <li>✅ Added chunk validation and duplicate detection</li>
                  </ul>
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

                {/* Orphaned Chunk Recovery Component */}
                <OrphanedChunkRecovery
                  client={client}
                  onRecoveryComplete={() => {
                    toast.showSuccess('Recovery complete! Refreshing page...');
                    setTimeout(() => window.location.reload(), 2000);
                  }}
                  onCancel={() => {
                    // User cancelled, they can still try normal initialization
                  }}
                />

                <button
                  onClick={async () => {
                    if (client && !loading) {
                      try {
                        console.log('Creating password vault...');
                        await client.initializeMasterLockbox();
                        console.log('Vault created! Refreshing page...');
                        toast.showSuccess('Password vault created! Refreshing page...');
                        // Refresh to show new lockbox
                        setTimeout(() => window.location.reload(), 1000);
                      } catch (err: any) {
                        console.error('Failed to initialize:', err);

                        // Handle specific errors
                        if (err.message?.includes('already initialized') ||
                            err.message?.includes('already been processed')) {
                          toast.showInfo('Your password vault already exists! Refreshing page...');
                          window.location.reload();
                        } else if (err.message?.includes('orphaned')) {
                          // If orphaned chunks error, the recovery component should have shown
                          toast.showError('Please use the recovery button above to fix orphaned chunks first');
                        } else {
                          toast.showError(`Failed to create vault: ${err.message || 'Unknown error'}`);
                        }
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

          /* Mobile responsive */
          @media (max-width: 768px) {
            .pm-header {
              padding: 0.75rem;
            }

            .pm-header-content {
              padding: 0;
            }

            .pm-header h1 {
              font-size: 1.2rem;
            }

            .pm-setup-prompt {
              padding: 1rem;
            }

            .setup-card {
              padding: 2rem 1.5rem;
              max-width: 100%;
            }

            .setup-card h2 {
              font-size: 1.3rem;
            }

            .btn-primary {
              padding: 0.875rem 1.5rem;
              font-size: 1rem;
            }

            .info-box {
              padding: 1rem;
            }

            .info-box h3 {
              font-size: 1rem;
            }
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
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();

              // Force state change by toggling: first set to false, then to true
              // This ensures React sees a state change even if already true
              setShowCreateModal(false);
              setEntryModalMode('create');
              setSelectedEntry(null);

              // Use setTimeout to ensure the false state is applied first
              setTimeout(() => {
                setShowCreateModal(true);
              }, 0);
            }}
            disabled={loading}
          >
            + New Password
          </button>

          <div className="sidebar-section">
            <h3>Tools</h3>
            <button
              className="tool-btn"
              onClick={() => {
                setShowCategoryModal(false); // Ensure other modals are closed
                setShowHealthModal(true);
              }}
            >
              📊 Health Dashboard
            </button>
            <button
              className="tool-btn"
              onClick={() => setShowTOTPModal(true)}
              disabled={entries.filter(e => e.type === PasswordEntryType.Login && (e as any).totpSecret).length === 0}
            >
              🔐 2FA Codes ({entries.filter(e => e.type === PasswordEntryType.Login && (e as any).totpSecret).length})
            </button>
            <button
              className="tool-btn"
              onClick={() => {
                setShowHealthModal(false); // Ensure other modals are closed
                setShowCategoryModal(true);
              }}
            >
              📂 Categories
            </button>
          </div>

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
              {Array.from(categoryGroups.entries()).map(([category, categoryEntries]) => {
                const categoryName = getCategoryName(category);
                const categoryData = categories.find(c => c.id === category);
                const icon = categoryData ? CategoryManager.getIcon(categoryData.icon) : '📁';

                return (
                  <button
                    key={category}
                    className={`filter-btn ${selectedCategory === category ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedCategory(category);
                      setSelectedType(null);
                    }}
                  >
                    {icon} {categoryName} ({categoryEntries.length})
                  </button>
                );
              })}
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

          <div className="sidebar-section danger-zone">
            <h3>Danger Zone</h3>
            <button
              className="btn-danger"
              onClick={() => setShowResetModal(true)}
            >
              ⚠️ Reset Account
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="pm-main">
          {/* Storage Usage Bar */}
          <StorageUsageBar
            used={masterLockbox.storageUsed}
            total={tierInfo.maxCapacity}
            tier={masterLockbox.subscriptionTier}
            onUpgrade={() => setShowUpgradeModal(true)}
          />

          {/* Orphaned Chunk Recovery Component - Shows only if orphaned chunks detected */}
          <OrphanedChunkRecovery
            client={client}
            onRecoveryComplete={() => {
              toast.showSuccess('Recovery complete! Refreshing page...');
              setTimeout(() => window.location.reload(), 2000);
            }}
            onCancel={() => {
              // User cancelled, they can continue using the app
            }}
          />

          {/* Enhanced Search Bar */}
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            onClear={() => setSearchQuery('')}
            placeholder="Search passwords..."
            debounceMs={300}
            showFuzzyIndicator={true}
            disabled={loading}
            className="pm-search"
          />

          {/* Advanced Filter Panel */}
          <FilterPanel
            selectedTypes={selectedTypes}
            onTypesChange={setSelectedTypes}
            selectedCategories={selectedCategories}
            onCategoriesChange={setSelectedCategories}
            categories={categories.map(cat => ({
              id: cat.id,
              name: cat.name,
              count: entries.filter(e => e.category === cat.id).length
            }))}
            showFavorites={showFavorites}
            onShowFavoritesChange={setShowFavorites}
            showArchived={showArchived}
            onShowArchivedChange={setShowArchived}
            showOldPasswords={showOldPasswords}
            onShowOldPasswordsChange={setShowOldPasswords}
            onClearAll={handleClearAllFilters}
            className="pm-filters"
          />

          {/* Toolbar */}
          <div className="pm-toolbar">
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
                  onClick={() => {
                    setViewMode('list');
                    setIsVirtualizedView(false);
                  }}
                >
                  List
                </button>
                <button
                  className={viewMode === 'grid' ? 'active' : ''}
                  onClick={() => {
                    setViewMode('grid');
                    setIsVirtualizedView(false);
                  }}
                >
                  Grid
                </button>
                {filteredEntries.length > 100 && (
                  <button
                    className={isVirtualizedView ? 'active' : ''}
                    onClick={() => {
                      setIsVirtualizedView(true);
                      setViewMode('list');
                    }}
                    title="High-performance view for large lists"
                  >
                    Virtual
                  </button>
                )}
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
          ) : isVirtualizedView ? (
            <VirtualizedPasswordList
              entries={filteredEntries}
              onEntryClick={(entry) => {
                setSelectedEntry(entry);
                setEntryModalMode('view');
                setShowDetailsModal(true);
              }}
              onEntrySelect={(entry) => {
                const id = entry.id;
                if (!id) return;
                setSelectedEntryIds(prev => {
                  const next = new Set(prev);
                  if (next.has(id)) {
                    next.delete(id);
                  } else {
                    next.add(id);
                  }
                  return next;
                });
              }}
              selectedEntryIds={selectedEntryIds}
              height="calc(100vh - 400px)"
              className="virtualized-list"
            />
          ) : (
            <div className={`entry-${viewMode}`}>
              {filteredEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="entry-card"
                  onClick={() => {
                    setSelectedEntry(entry);
                    setEntryModalMode('view');
                    setShowDetailsModal(true);
                  }}
                >
                  <div className="entry-header">
                    <h3>{entry.title}</h3>
                    <div className="entry-badges">
                      <span className="entry-type">
                        {PasswordEntryType[entry.type]}
                      </span>
                      {entry.category && entry.category > 0 && (() => {
                        const categoryData = categories.find(c => c.id === entry.category);
                        const categoryName = getCategoryName(entry.category);
                        const icon = categoryData ? CategoryManager.getIcon(categoryData.icon) : '📁';
                        const color = categoryData ? CategoryManager.getColor(categoryData.color) : '#6B7280';

                        return (
                          <span className="entry-category" style={{ background: color }}>
                            {icon} {categoryName}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                  {entry.type === PasswordEntryType.Login && entry.username && (
                    <p className="entry-username">{entry.username}</p>
                  )}
                  {entry.type === PasswordEntryType.Login && entry.url && (
                    <p className="entry-url">{entry.url}</p>
                  )}
                  {entry.type === PasswordEntryType.SshKey && (
                    <p className="entry-username">{(entry as any).username}@{(entry as any).hostname}</p>
                  )}
                  {entry.type === PasswordEntryType.CreditCard && (
                    <p className="entry-username">{(entry as any).cardHolder}</p>
                  )}
                  {entry.type === PasswordEntryType.Identity && (
                    <p className="entry-username">{(entry as any).fullName}</p>
                  )}
                  {entry.type === PasswordEntryType.CryptoWallet && (
                    <p className="entry-username">{(entry as any).walletName}</p>
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

          {/* Batch Operations Toolbar */}
          <BatchOperationsToolbar
            selectedEntries={selectedEntries}
            totalEntries={filteredEntries.length}
            onSelectAll={handleSelectAll}
            onDeselectAll={handleDeselectAll}
            onDeleteSelected={handleDeleteSelected}
            onArchiveSelected={handleArchiveSelected}
            onUnarchiveSelected={handleUnarchiveSelected}
            onFavoriteSelected={handleFavoriteSelected}
            onUnfavoriteSelected={handleUnfavoriteSelected}
            onAssignCategory={handleAssignCategory}
            onExportSelected={handleExportSelected}
            categories={categories.map(cat => ({ id: cat.id, name: cat.name }))}
          />
        </main>
      </div>

      {/* Password Entry Modal (Create/Edit/View) */}
      {showCreateModal && entryModalMode === 'create' && (
        <PasswordEntryModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSave={handleCreateEntry}
          mode="create"
        />
      )}

      {showDetailsModal && selectedEntry && entryModalMode === 'view' && (
        <PasswordEntryModal
          isOpen={showDetailsModal}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedEntry(null);
          }}
          onSave={(entry) => {
            // Switch to edit mode when user wants to edit
            setEntryModalMode('edit');
            setShowEditModal(true);
            setShowDetailsModal(false);
          }}
          onDelete={() => handleDeleteEntry(selectedEntry)}
          entry={selectedEntry}
          mode="view"
        />
      )}

      {showEditModal && selectedEntry && entryModalMode === 'edit' && (
        <PasswordEntryModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedEntry(null);
            setEntryModalMode('view');
          }}
          onSave={handleUpdateEntry}
          entry={selectedEntry}
          mode="edit"
        />
      )}

      {/* TOTP Manager Modal */}
      <TOTPManagerModal
        isOpen={showTOTPModal}
        onClose={() => setShowTOTPModal(false)}
        entries={entries
          .filter((e): e is LoginEntry => e.type === PasswordEntryType.Login && !!e.totpSecret)
          .map(e => ({
            id: e.id || 0,
            title: e.title,
            secret: e.totpSecret || '',
            accountName: e.username,
            issuer: e.url ? new URL(e.url).hostname : undefined,
          }))}
      />

      {/* Health Dashboard Modal */}
      <HealthDashboardModal
        isOpen={showHealthModal}
        onClose={() => setShowHealthModal(false)}
        entries={entries
          .filter((e): e is LoginEntry => e.type === PasswordEntryType.Login)
          .map(e => ({
            id: e.id || 0,
            title: e.title,
            password: e.password,
            lastModified: typeof e.lastModified === 'number' ? e.lastModified : Math.floor((e.lastModified?.getTime() || Date.now()) / 1000),
            createdAt: typeof e.createdAt === 'number' ? e.createdAt : Math.floor((e.createdAt?.getTime() || Date.now()) / 1000),
            url: e.url,
            username: e.username,
          }))}
        onEditEntry={(entryId) => {
          const entry = entries.find(e => e.id === entryId);
          if (entry) {
            setSelectedEntry(entry);
            setEntryModalMode('edit');
            setShowEditModal(true);
            setShowHealthModal(false);
          }
        }}
      />

      {/* Category Manager Modal */}
      <CategoryManagerModal
        isOpen={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        categories={categories}
        onCreateCategory={createCategory}
        onUpdateCategory={updateCategory}
        onDeleteCategory={deleteCategory}
      />

      {/* Subscription Upgrade Modal */}
      {masterLockbox && (
        <SubscriptionUpgradeModal
          isOpen={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
          currentTier={masterLockbox.subscriptionTier}
          onUpgrade={handleUpgradeSubscription}
        />
      )}

      {/* Reset Account Modal */}
      {showResetModal && (
        <div className="modal-overlay" onClick={() => setShowResetModal(false)}>
          <div className="modal-content reset-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>⚠️ Reset Account</h2>
              <button className="modal-close" onClick={() => setShowResetModal(false)}>×</button>
            </div>

            <div className="modal-body">
              <div className="warning-box">
                <h3>🚨 Warning: Permanent Data Loss</h3>
                <p>
                  Resetting your account will permanently delete all stored passwords and cannot be undone.
                  Make sure you have backed up any important passwords before proceeding.
                </p>
              </div>

              <div className="account-info">
                <h3>Your Master Lockbox PDA</h3>
                <div className="pda-address-box">
                  <code className="pda-address">
                    {client?.masterLockboxPDA?.toString() || 'Not available'}
                  </code>
                  <button
                    className="btn-copy"
                    onClick={() => {
                      if (client?.masterLockboxPDA) {
                        navigator.clipboard.writeText(client.masterLockboxPDA.toString());
                        toast.showSuccess('PDA address copied to clipboard!');
                      }
                    }}
                  >
                    Copy
                  </button>
                </div>
              </div>

              <div className="instructions-box">
                <h3>Option 1: Permanent Account Closure</h3>
                <p>Permanently close your account and reclaim all rent (irreversible):</p>
                <button
                  className="btn-danger-action"
                  onClick={async () => {
                    if (!client) return;

                    const confirmed = await confirm({
                      title: 'Close Account',
                      message: 'WARNING: This will permanently delete ALL passwords and cannot be undone!\n\nAre you absolutely sure you want to close your account and reclaim rent?',
                      confirmText: 'Close Account',
                      cancelText: 'Cancel',
                      danger: true
                    });

                    if (!confirmed) return;

                    try {
                      setShowResetModal(false);

                      const signature = await client.closeMasterLockbox();

                      toast.showSuccess(`Account closed successfully! Transaction: ${signature}. Rent has been returned to your wallet. The page will now reload.`);

                      // Clear session and reload
                      sessionStorage.clear();
                      setTimeout(() => window.location.reload(), 1000);
                    } catch (error: any) {
                      console.error('Failed to close account:', error);

                      // Check if error is due to already processed transaction
                      if (error.message?.includes('already been processed') ||
                          error.message?.includes('AlreadyProcessed')) {
                        toast.showInfo('Your account may have already been closed. The page will reload to reflect the current state.');
                        sessionStorage.clear();
                        setTimeout(() => window.location.reload(), 1000);
                      } else if (error.message?.includes('AccountNotFound') ||
                                 error.message?.includes('not found')) {
                        toast.showInfo('Account is already closed. The page will reload.');
                        sessionStorage.clear();
                        setTimeout(() => window.location.reload(), 1000);
                      } else {
                        toast.showError(`Failed to close account: ${error.message || 'Unknown error'}. Please try refreshing the page.`);
                      }
                    }
                  }}
                >
                  ⚠️ Close Account & Reclaim Rent
                </button>

                <h3 style={{ marginTop: '1.5rem' }}>Option 2: Quick Reset (Session Only)</h3>
                <p>Clear your local session and start fresh (account remains on-chain):</p>
                <button
                  className="btn-reset"
                  onClick={async () => {
                    const confirmed = await confirm({
                      title: 'Clear Session',
                      message: 'Clear local session and reload? Your on-chain data will remain intact.',
                      confirmText: 'Clear & Reload',
                      cancelText: 'Cancel',
                      danger: false
                    });

                    if (confirmed) {
                      // Clear session storage
                      sessionStorage.clear();
                      // Reload page
                      window.location.reload();
                    }
                  }}
                >
                  Clear Session & Reload
                </button>
              </div>

              <div className="explorer-link">
                <a
                  href={`https://explorer.solana.com/address/${client?.masterLockboxPDA?.toString()}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-explorer"
                >
                  View on Solana Explorer ↗
                </a>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowResetModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .password-manager {
          min-height: 100vh;
          background: #f5f7fa;
        }

        .pm-header {
          background: white;
          border-bottom: 1px solid #e1e8ed;
          padding: 1rem;
          position: sticky;
          top: 0;
          z-index: 100;
        }

        .pm-header-content {
          max-width: 1400px;
          margin: 0 auto;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0 1rem;
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
          font-size: 0.85rem;
        }

        .storage-used {
          color: #7f8c8d;
        }

        .pm-container {
          max-width: 1400px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 280px 1fr;
          gap: 2rem;
          padding: 2rem;
          min-height: calc(100vh - 80px);
        }

        /* Tablet and below */
        @media (max-width: 1024px) {
          .pm-container {
            grid-template-columns: 1fr;
            padding: 1rem;
            gap: 1rem;
          }

          .pm-sidebar {
            order: 2;
            max-width: 100%;
          }

          .pm-main {
            order: 1;
          }
        }

        /* Mobile */
        @media (max-width: 768px) {
          .pm-header {
            padding: 0.75rem;
          }

          .pm-header-content {
            padding: 0;
          }

          .pm-header h1 {
            font-size: 1.2rem;
          }

          .header-actions {
            gap: 0.5rem;
            flex-wrap: wrap;
          }

          .storage-info {
            font-size: 0.75rem;
            flex-direction: column;
            align-items: flex-end;
            gap: 0.25rem;
          }

          .pm-container {
            padding: 0.75rem;
          }

          .pm-toolbar {
            flex-direction: column;
          }

          .toolbar-actions {
            width: 100%;
            flex-wrap: wrap;
          }
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

        .tool-btn {
          width: 100%;
          background: white;
          border: 1px solid #e1e8ed;
          text-align: left;
          padding: 0.75rem;
          border-radius: 8px;
          cursor: pointer;
          color: #2c3e50;
          font-size: 0.95rem;
          transition: all 0.2s;
          margin-bottom: 0.5rem;
          font-weight: 500;
        }

        .tool-btn:hover:not(:disabled) {
          background: #f8f9fa;
          border-color: #667eea;
          transform: translateX(2px);
        }

        .tool-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
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

        .pm-search {
          margin-bottom: 1rem;
        }

        .pm-filters {
          margin-bottom: 1rem;
        }

        .pm-toolbar {
          display: flex;
          gap: 1rem;
          margin-bottom: 1.5rem;
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

        .virtualized-list {
          margin-top: 1rem;
          border: 1px solid #e1e8ed;
          border-radius: 8px;
          overflow: hidden;
        }

        /* Mobile grid view */
        @media (max-width: 768px) {
          .entry-grid {
            grid-template-columns: 1fr;
          }

          .view-toggle {
            display: none; /* Hide grid/list toggle on mobile */
          }

          .virtualized-list {
            height: calc(100vh - 500px) !important;
          }
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

        .entry-badges {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .entry-type {
          background: #f8f9fa;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-size: 0.75rem;
          color: #7f8c8d;
        }

        .entry-category {
          color: white;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 600;
          white-space: nowrap;
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

        /* Danger Zone */
        .danger-zone {
          border-top: 2px solid #fee;
          padding-top: 1rem;
          margin-top: 1rem;
        }

        .danger-zone h3 {
          color: #e74c3c;
        }

        .btn-danger {
          width: 100%;
          background: #fee;
          color: #e74c3c;
          border: 1px solid #fcc;
          border-radius: 8px;
          padding: 0.75rem;
          font-size: 0.95rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-danger:hover {
          background: #fcc;
          border-color: #e74c3c;
        }

        /* Reset Modal */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
          padding: 1rem;
        }

        .modal-content {
          background: white;
          border-radius: 16px;
          max-width: 700px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }

        .reset-modal .modal-header {
          padding: 1.5rem;
          border-bottom: 1px solid #e1e8ed;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .reset-modal .modal-header h2 {
          margin: 0;
          font-size: 1.5rem;
          color: #e74c3c;
        }

        .modal-close {
          background: none;
          border: none;
          font-size: 2rem;
          color: #7f8c8d;
          cursor: pointer;
          padding: 0;
          width: 2rem;
          height: 2rem;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          transition: all 0.2s;
        }

        .modal-close:hover {
          background: #f8f9fa;
          color: #2c3e50;
        }

        .reset-modal .modal-body {
          padding: 1.5rem;
        }

        .warning-box {
          background: #fee;
          border: 2px solid #e74c3c;
          border-radius: 8px;
          padding: 1rem;
          margin-bottom: 1.5rem;
        }

        .warning-box h3 {
          margin: 0 0 0.5rem 0;
          color: #c0392b;
          font-size: 1.1rem;
        }

        .warning-box p {
          margin: 0;
          color: #e74c3c;
          line-height: 1.6;
        }

        .account-info {
          background: #f8f9fa;
          border-radius: 8px;
          padding: 1rem;
          margin-bottom: 1.5rem;
        }

        .account-info h3 {
          margin: 0 0 0.75rem 0;
          font-size: 1rem;
          color: #2c3e50;
        }

        .pda-address-box {
          display: flex;
          gap: 0.5rem;
          align-items: center;
        }

        .pda-address {
          flex: 1;
          background: white;
          padding: 0.75rem;
          border: 1px solid #e1e8ed;
          border-radius: 6px;
          font-family: 'Courier New', monospace;
          font-size: 0.85rem;
          color: #2c3e50;
          overflow-x: auto;
          white-space: nowrap;
        }

        .btn-copy {
          background: #667eea;
          color: white;
          border: none;
          border-radius: 6px;
          padding: 0.75rem 1rem;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.2s;
        }

        .btn-copy:hover {
          background: #5568d3;
        }

        .instructions-box {
          margin-bottom: 1.5rem;
        }

        .instructions-box h3 {
          margin: 0 0 0.5rem 0;
          font-size: 1rem;
          color: #2c3e50;
        }

        .instructions-box p {
          margin: 0.5rem 0;
          color: #7f8c8d;
          line-height: 1.6;
        }

        .code-block {
          background: #2c3e50;
          color: #ecf0f1;
          padding: 1rem;
          border-radius: 6px;
          overflow-x: auto;
          font-family: 'Courier New', monospace;
          font-size: 0.85rem;
          margin: 0.5rem 0;
        }

        .btn-danger-action {
          background: #e74c3c;
          color: white;
          border: none;
          border-radius: 8px;
          padding: 0.75rem 1.5rem;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          margin-top: 0.5rem;
          width: 100%;
        }

        .btn-danger-action:hover {
          background: #c0392b;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(231, 76, 60, 0.4);
        }

        .btn-reset {
          background: #f39c12;
          color: white;
          border: none;
          border-radius: 8px;
          padding: 0.75rem 1.5rem;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          margin-top: 0.5rem;
          width: 100%;
        }

        .btn-reset:hover {
          background: #e67e22;
        }

        .explorer-link {
          text-align: center;
        }

        .btn-explorer {
          display: inline-block;
          background: #667eea;
          color: white;
          text-decoration: none;
          padding: 0.75rem 1.5rem;
          border-radius: 8px;
          font-weight: 600;
          transition: all 0.2s;
        }

        .btn-explorer:hover {
          background: #5568d3;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }

        .reset-modal .modal-footer {
          padding: 1rem 1.5rem;
          border-top: 1px solid #e1e8ed;
          display: flex;
          justify-content: flex-end;
          gap: 0.5rem;
        }

        .btn-secondary {
          background: #95a5a6;
          color: white;
          border: none;
          border-radius: 8px;
          padding: 0.75rem 1.5rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-secondary:hover {
          background: #7f8c8d;
        }

        /* Mobile responsive for reset modal */
        @media (max-width: 768px) {
          .modal-overlay {
            padding: 0;
          }

          .modal-content {
            max-height: 100vh;
            border-radius: 0;
          }

          .reset-modal .modal-header h2 {
            font-size: 1.25rem;
          }

          .pda-address {
            font-size: 0.75rem;
          }

          .code-block {
            font-size: 0.75rem;
          }

          .reset-modal .modal-footer {
            flex-direction: column;
          }

          .btn-secondary,
          .btn-reset,
          .btn-explorer {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
