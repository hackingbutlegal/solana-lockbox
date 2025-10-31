'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
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
import { SettingsModal } from '../modals/SettingsModal';
import { PasswordRotationModal } from '../modals/PasswordRotationModal';
import { ActivityLogModal } from '../modals/ActivityLogModal';
import { PasswordPolicyModal } from '../modals/PasswordPolicyModal';
// Subscription removed - using one-time storage expansion instead
// import { SubscriptionUpgradeModal } from '../modals/SubscriptionUpgradeModal';
import { OrphanedChunkRecovery } from '../ui/OrphanedChunkRecovery';
import { useToast } from '../ui/Toast';
import { useConfirm } from '../ui/ConfirmDialog';
import { KeyboardShortcutsHelp } from '../ui/KeyboardShortcutsHelp';
import { SignaturePrompt } from '../ui/SignaturePrompt';
// import { BatchModeToggle } from '../ui/BatchModeToggle'; // REMOVED: Batch mode feature
import { SearchBar } from './SearchBar';
import { FilterPanel } from './FilterPanel';
import { VirtualizedPasswordList } from './VirtualizedPasswordList';
// import { BatchOperationsToolbar } from './BatchOperationsToolbar'; // REMOVED: Batch mode feature
import { FavoritesSidebar } from './FavoritesSidebar';
import { FAQ } from '../layout/FAQ';
import { Dashboard } from './Dashboard';
import { ShareManagementModal } from '../modals/ShareManagementModal';
// import { BatchUpdateOperations, BatchUpdateProgress } from '../../lib/batch-update-operations'; // REMOVED: Batch mode feature
// import { BatchProgressModal } from '../modals/BatchProgressModal'; // REMOVED: Batch mode feature
import { useHotkeys } from 'react-hotkeys-hook';
import { logActivity, ActivityType } from '../../lib/activity-logger';

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
  const { client, isSessionActive, initializeSession, loading: authLoading, error: authError } = useAuth();
  const { masterLockbox, error: lockboxError } = useLockbox();
  const { entries, refreshEntries, createEntry, updateEntry, deleteEntry, queueUpdate, loading, error } = usePassword();
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

  // Batch operations state - REMOVED: Feature deemed functionally useless
  // Keeping state defined to prevent runtime errors, but UI components removed
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<number>>(new Set());
  const [isVirtualizedView, setIsVirtualizedView] = useState(false);

  // Batch progress modal state - REMOVED: Feature deemed functionally useless
  // const [showBatchProgress, setShowBatchProgress] = useState(false);
  // const [batchOperation, setBatchOperation] = useState<string>('');
  // const [batchProgress, setBatchProgress] = useState<BatchUpdateProgress | null>(null);
  // const [batchTotalItems, setBatchTotalItems] = useState(0);
  // const [batchSuccessCount, setBatchSuccessCount] = useState(0);
  // const [batchFailureCount, setBatchFailureCount] = useState(0);

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<PasswordEntry | null>(null);
  const [showTOTPModal, setShowTOTPModal] = useState(false);
  const [showHealthModal, setShowHealthModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showRotationModal, setShowRotationModal] = useState(false);
  const [showActivityLogModal, setShowActivityLogModal] = useState(false);
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [showFAQModal, setShowFAQModal] = useState(false);
  // Subscription removed - using one-time storage expansion instead
  // const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [entryModalMode, setEntryModalMode] = useState<'create' | 'edit' | 'view'>('create');
  const [showFavoritesSidebar, setShowFavoritesSidebar] = useState(false);
  const [currentView, setCurrentView] = useState<'list' | 'dashboard'>('list');
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareEntry, setShareEntry] = useState<PasswordEntry | undefined>(undefined);
  const [showPasswordGeneratorModal, setShowPasswordGeneratorModal] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState<string>('');
  // const [isBatchMode, setIsBatchMode] = useState(false); // Batch mode toggle - REMOVED: Feature deemed functionally useless

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

        // Log activity
        logActivity(
          ActivityType.CREATE,
          `Created password entry: ${sanitized.title}`,
          {
            entryId,
            entryTitle: sanitized.title,
            severity: 'info',
          }
        );
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

      // Batch mode removed - always save immediately to blockchain
      const success = await updateEntry(chunkIndex, selectedEntry.id, sanitized as PasswordEntry);

      if (success) {
        setShowEditModal(false);
        setSelectedEntry(null);
        toast.showSuccess('Password saved to blockchain');

        // Log activity
        logActivity(
          ActivityType.UPDATE,
          `Updated password entry: ${sanitized.title}`,
          {
            entryId: selectedEntry.id,
            entryTitle: sanitized.title,
            severity: 'info',
          }
        );
      }
    } catch (err) {
      console.error('Failed to update entry:', err);
      toast.showError('Failed to save password');
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

        // Log activity
        logActivity(
          ActivityType.DELETE,
          `Deleted password entry: ${entry.title}`,
          {
            entryId: entry.id,
            entryTitle: entry.title,
            severity: 'warning',
          }
        );
      }
    } catch (err) {
      console.error('Failed to delete entry:', err);
      toast.showError('Failed to delete password entry');
    }
  };

  // Handle copy password to clipboard
  const handleCopyPassword = async (entry: PasswordEntry) => {
    try {
      if ('password' in entry && entry.password) {
        await navigator.clipboard.writeText(entry.password);
        toast.showSuccess('Password copied to clipboard');

        // Log activity
        logActivity(
          ActivityType.ACCESS,
          `Copied password for: ${entry.title}`,
          {
            entryId: entry.id,
            entryTitle: entry.title,
            action: 'copy_password',
          }
        );
      }
    } catch (err) {
      console.error('Failed to copy password:', err);
      toast.showError('Failed to copy password');
    }
  };

  // Handle copy username to clipboard
  const handleCopyUsername = async (entry: PasswordEntry) => {
    try {
      if ('username' in entry && entry.username) {
        await navigator.clipboard.writeText(entry.username);
        toast.showSuccess('Username copied to clipboard');

        // Log activity
        logActivity(
          ActivityType.ACCESS,
          `Copied username for: ${entry.title}`,
          {
            entryId: entry.id,
            entryTitle: entry.title,
            action: 'copy_username',
          }
        );
      }
    } catch (err) {
      console.error('Failed to copy username:', err);
      toast.showError('Failed to copy username');
    }
  };

  // Handle subscription upgrade
  // Subscription removed - using one-time storage expansion instead
  // const handleUpgradeSubscription = async (newTier: number) => {
  //   try {
  //     await upgradeSubscription(newTier);
  //     const tierName = TIER_INFO[newTier as keyof typeof TIER_INFO]?.name || 'Unknown';
  //     toast.showSuccess(`Successfully upgraded to ${tierName} tier!`);
  //     setShowUpgradeModal(false);
  //   } catch (err) {
  //     const errorMsg = err instanceof Error ? err.message : 'Failed to upgrade subscription';
  //     console.error('Upgrade failed:', err);
  //     toast.showError(`Upgrade failed: ${errorMsg}`);
  //   }
  // };

  // Batch operation handlers - REMOVED: Batch mode feature from UI
  // Keeping handlers defined to prevent runtime errors
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

  // Keyboard shortcuts for batch operations - REMOVED: Batch mode UI
  // Keeping shortcuts functional but hidden (no UI to trigger)
  useHotkeys('ctrl+a, meta+a', (e) => {
    e.preventDefault();
    if (selectedEntries.length === filteredEntries.length) {
      handleDeselectAll();
    } else {
      handleSelectAll();
    }
  }, { enableOnFormTags: false }, [selectedEntries, filteredEntries]);

  useHotkeys('ctrl+d, meta+d', (e) => {
    e.preventDefault();
    handleDeselectAll();
  }, { enableOnFormTags: false });

  useHotkeys('delete', (e) => {
    if (selectedEntries.length > 0) {
      e.preventDefault();
      handleDeleteSelected();
    }
  }, { enableOnFormTags: false }, [selectedEntries]);

  useHotkeys('ctrl+shift+a, meta+shift+a', (e) => {
    if (selectedEntries.length > 0) {
      e.preventDefault();
      handleArchiveSelected();
    }
  }, { enableOnFormTags: false }, [selectedEntries]);

  useHotkeys('ctrl+e, meta+e', (e) => {
    if (selectedEntries.length > 0) {
      e.preventDefault();
      handleExportSelected();
    }
  }, { enableOnFormTags: false }, [selectedEntries]);

  useHotkeys('escape', () => {
    if (selectedEntries.length > 0) {
      handleDeselectAll();
    }
  }, { enableOnFormTags: false }, [selectedEntries]);

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

    const entryIds = selectedEntries.filter(e => e.id).map(e => e.id!);

    // Initialize progress modal
    setBatchOperation('Archive');
    setBatchTotalItems(entryIds.length);
    setBatchSuccessCount(0);
    setBatchFailureCount(0);
    setBatchProgress(null);
    setShowBatchProgress(true);

    const batchOps = new BatchUpdateOperations(client);

    try {
      const result = await batchOps.archiveEntries(entryIds, (progress) => {
        setBatchProgress(progress);
        if (progress.status === 'success') {
          setBatchSuccessCount(prev => prev + 1);
        } else if (progress.status === 'failed') {
          setBatchFailureCount(prev => prev + 1);
        }
      });

      setSelectedEntryIds(new Set());

      // Refresh entries after completion
      await refreshEntries();
    } catch (err) {
      console.error('Batch archive error:', err);
      toast.showError('Failed to archive passwords');
      setShowBatchProgress(false);
    }
  };

  const handleUnarchiveSelected = async () => {
    if (!client) return;

    const confirmed = await confirm({
      title: 'Unarchive Multiple Passwords',
      message: `Unarchive ${selectedEntries.length} password(s)?`,
      confirmText: 'Unarchive All',
      cancelText: 'Cancel',
    });

    if (!confirmed) return;

    const entryIds = selectedEntries.filter(e => e.id).map(e => e.id!);

    // Initialize progress modal
    setBatchOperation('Unarchive');
    setBatchTotalItems(entryIds.length);
    setBatchSuccessCount(0);
    setBatchFailureCount(0);
    setBatchProgress(null);
    setShowBatchProgress(true);

    const batchOps = new BatchUpdateOperations(client);

    try {
      const result = await batchOps.unarchiveEntries(entryIds, (progress) => {
        setBatchProgress(progress);
        if (progress.status === 'success') {
          setBatchSuccessCount(prev => prev + 1);
        } else if (progress.status === 'failed') {
          setBatchFailureCount(prev => prev + 1);
        }
      });

      setSelectedEntryIds(new Set());
      await refreshEntries();
    } catch (err) {
      console.error('Batch unarchive error:', err);
      toast.showError('Failed to unarchive passwords');
      setShowBatchProgress(false);
    }
  };

  const handleFavoriteSelected = async () => {
    if (!client) return;

    const entryIds = selectedEntries.filter(e => e.id).map(e => e.id!);

    // Initialize progress modal
    setBatchOperation('Favorite');
    setBatchTotalItems(entryIds.length);
    setBatchSuccessCount(0);
    setBatchFailureCount(0);
    setBatchProgress(null);
    setShowBatchProgress(true);

    const batchOps = new BatchUpdateOperations(client);

    try {
      const result = await batchOps.favoriteEntries(entryIds, (progress) => {
        setBatchProgress(progress);
        if (progress.status === 'success') {
          setBatchSuccessCount(prev => prev + 1);
        } else if (progress.status === 'failed') {
          setBatchFailureCount(prev => prev + 1);
        }
      });

      setSelectedEntryIds(new Set());
      await refreshEntries();
    } catch (err) {
      console.error('Batch favorite error:', err);
      toast.showError('Failed to mark passwords as favorites');
      setShowBatchProgress(false);
    }
  };

  const handleUnfavoriteSelected = async () => {
    if (!client) return;

    const entryIds = selectedEntries.filter(e => e.id).map(e => e.id!);

    // Initialize progress modal
    setBatchOperation('Unfavorite');
    setBatchTotalItems(entryIds.length);
    setBatchSuccessCount(0);
    setBatchFailureCount(0);
    setBatchProgress(null);
    setShowBatchProgress(true);

    const batchOps = new BatchUpdateOperations(client);

    try {
      const result = await batchOps.unfavoriteEntries(entryIds, (progress) => {
        setBatchProgress(progress);
        if (progress.status === 'success') {
          setBatchSuccessCount(prev => prev + 1);
        } else if (progress.status === 'failed') {
          setBatchFailureCount(prev => prev + 1);
        }
      });

      setSelectedEntryIds(new Set());
      await refreshEntries();
    } catch (err) {
      console.error('Batch unfavorite error:', err);
      toast.showError('Failed to unmark passwords as favorites');
      setShowBatchProgress(false);
    }
  };

  const handleAssignCategory = async (categoryId: number) => {
    if (!client) return;

    const entryIds = selectedEntries.filter(e => e.id).map(e => e.id!);
    const categoryName = getCategoryName(categoryId);

    // Initialize progress modal
    setBatchOperation(`Assign to "${categoryName}"`);
    setBatchTotalItems(entryIds.length);
    setBatchSuccessCount(0);
    setBatchFailureCount(0);
    setBatchProgress(null);
    setShowBatchProgress(true);

    const batchOps = new BatchUpdateOperations(client);

    try {
      const result = await batchOps.assignCategory(entryIds, categoryId, (progress) => {
        setBatchProgress(progress);
        if (progress.status === 'success') {
          setBatchSuccessCount(prev => prev + 1);
        } else if (progress.status === 'failed') {
          setBatchFailureCount(prev => prev + 1);
        }
      });

      setSelectedEntryIds(new Set());
      await refreshEntries();
    } catch (err) {
      console.error('Batch category assignment error:', err);
      toast.showError('Failed to assign category');
      setShowBatchProgress(false);
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

  const handleBulkImport = async (entriesToImport: PasswordEntry[]) => {
    if (!createEntry) {
      toast.showError('Cannot import: createEntry function not available');
      return;
    }

    const confirmed = await confirm({
      title: 'Import Passwords',
      message: `Import ${entriesToImport.length} password(s)? This will create new entries.`,
      confirmText: 'Import All',
      cancelText: 'Cancel',
    });

    if (!confirmed) return;

    // Initialize progress modal
    setBatchOperation('Import');
    setBatchTotalItems(entriesToImport.length);
    setBatchSuccessCount(0);
    setBatchFailureCount(0);
    setBatchProgress(null);
    setShowBatchProgress(true);
    setShowSettingsModal(false); // Close settings modal

    for (let i = 0; i < entriesToImport.length; i++) {
      const entry = entriesToImport[i];

      // Update progress
      setBatchProgress({
        current: i + 1,
        total: entriesToImport.length,
        entryId: i,
        status: 'pending',
      });

      try {
        // Create entry using SDK
        await createEntry(entry);
        setBatchSuccessCount(prev => prev + 1);
        setBatchProgress(prev => prev ? { ...prev, status: 'success' } : null);
      } catch (err) {
        console.error(`Failed to import entry ${i}:`, err);
        setBatchFailureCount(prev => prev + 1);
        setBatchProgress(prev => prev ? { ...prev, status: 'failed' } : null);
      }

      // 500ms delay between operations to avoid nonce conflicts
      if (i < entriesToImport.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Refresh entries after import
    await refreshEntries();
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
        <div className="pm-connect-prompt">
          <div className="connect-card">
            <div className="logo-container">
              <div className="logo-icon">🔐</div>
              <h2>Solana Lockbox</h2>
            </div>
            <div className="security-warning-banner" style={{
              background: '#ff9800',
              border: '2px solid #f57c00',
              borderRadius: '8px',
              padding: '12px 16px',
              marginBottom: '24px',
              color: '#000'
            }}>
              <strong>⚠️ TESTNET DEMO - NOT PROFESSIONALLY AUDITED</strong>
              <div style={{ fontSize: '14px', marginTop: '4px' }}>
                Pre-production software on Devnet. Do not use for sensitive data. Security audit pending.
              </div>
            </div>
            <p className="tagline">Open-source password manager on Solana</p>
            <div className="features-grid">
              <div className="feature-item">
                <span className="feature-icon">🔒</span>
                <div className="feature-content">
                  <h4>Client-Side Encryption</h4>
                  <p>XChaCha20-Poly1305 AEAD • Your data stays private, always</p>
                </div>
              </div>
              <div className="feature-item">
                <span className="feature-icon">⚡</span>
                <div className="feature-content">
                  <h4>Lightning Fast Sync</h4>
                  <p>Powered by Solana • Access from anywhere, instantly</p>
                </div>
              </div>
              <div className="feature-item">
                <span className="feature-icon">🛡️</span>
                <div className="feature-content">
                  <h4>Blockchain-Secured</h4>
                  <p>Open-source, auditable code • Data stored on Solana blockchain</p>
                </div>
              </div>
              <div className="feature-item">
                <span className="feature-icon">💰</span>
                <div className="feature-content">
                  <h4>No Monthly Subscriptions</h4>
                  <p>One-time storage fees per chunk • Rent is refundable</p>
                </div>
              </div>
            </div>
            <div className="cta-section">
              <p className="connect-instruction">Connect your Solana wallet to get started</p>
              <p className="privacy-note">No signup required • You own your data • Open-source & auditable</p>
            </div>
          </div>

          {/* FAQ Section */}
          <div className="faq-section-wrapper">
            <FAQ />
          </div>
        </div>

        <style jsx>{`
          .password-manager {
            min-height: calc(100vh - 80px);
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          }

          .pm-connect-prompt {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            padding: 2rem;
            gap: 3rem;
          }

          .faq-section-wrapper {
            width: 100%;
            max-width: 900px;
            padding: 0 2rem 3rem;
          }

          .connect-card {
            background: white;
            border-radius: 24px;
            padding: 3rem;
            max-width: 700px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05);
            animation: slideInUp 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
          }

          @keyframes slideInUp {
            from {
              opacity: 0;
              transform: translateY(30px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          .logo-container {
            text-align: center;
            margin-bottom: 2rem;
          }

          .logo-icon {
            font-size: 4rem;
            margin-bottom: 1rem;
            animation: float 3s ease-in-out infinite;
          }

          @keyframes float {
            0%, 100% {
              transform: translateY(0);
            }
            50% {
              transform: translateY(-10px);
            }
          }

          .logo-container h2 {
            margin: 0;
            font-size: 2.5rem;
            font-weight: 800;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            letter-spacing: -0.03em;
          }

          .tagline {
            text-align: center;
            color: #6b7280;
            font-size: 1.125rem;
            margin-bottom: 3rem;
            font-weight: 500;
          }

          .features-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 1.5rem;
            margin-bottom: 3rem;
          }

          .feature-item {
            display: flex;
            gap: 1rem;
            text-align: left;
            padding: 1.5rem;
            background: linear-gradient(135deg, #fafbfc 0%, #f8f9fa 100%);
            border-radius: 16px;
            border: 1px solid #e5e7eb;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          }

          .feature-item:hover {
            transform: translateY(-4px);
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
            border-color: #d1d5db;
          }

          .feature-icon {
            font-size: 2rem;
            flex-shrink: 0;
          }

          .feature-content h4 {
            margin: 0 0 0.5rem 0;
            font-size: 1rem;
            font-weight: 700;
            color: #1f2937;
            letter-spacing: -0.01em;
          }

          .feature-content p {
            margin: 0;
            font-size: 0.875rem;
            color: #6b7280;
            line-height: 1.5;
          }

          .cta-section {
            text-align: center;
          }

          .connect-instruction {
            color: #667eea;
            font-size: 1.1rem;
            font-weight: 600;
            margin: 1rem 0 0.5rem 0;
          }

          .privacy-note {
            margin-top: 0.5rem;
            font-size: 0.875rem;
            color: #9ca3af;
            font-weight: 500;
          }

          /* Mobile responsive */
          @media (max-width: 768px) {
            .pm-connect-prompt {
              padding: 1rem;
            }

            .connect-card {
              padding: 2rem 1.5rem;
              max-width: 100%;
              border-radius: 16px;
            }

            .logo-icon {
              font-size: 3rem;
            }

            .logo-container h2 {
              font-size: 2rem;
            }

            .tagline {
              font-size: 1rem;
            }

            .features-grid {
              grid-template-columns: 1fr;
              gap: 1rem;
            }

            .feature-item {
              padding: 1.25rem;
            }

            .feature-icon {
              font-size: 1.75rem;
            }

            .feature-content h4 {
              font-size: 0.9375rem;
            }

            .feature-content p {
              font-size: 0.8125rem;
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

  // Handle signature prompt retry
  const handleSignatureRetry = async () => {
    await initializeSession();
  };

  // Show signature prompt if:
  // 1. Session is not active AND
  // 2. Either there's an auth error OR we're trying to load auth
  const showSignaturePrompt = !isSessionActive && (!!authError || authLoading);

  return (
    <div className="password-manager">
      {/* Signature Prompt - Beautiful modal for sign requests */}
      <SignaturePrompt
        isOpen={showSignaturePrompt}
        onRetry={handleSignatureRetry}
        error={authError}
        isLoading={authLoading}
      />

      <div className="pm-container">
        {/* Sidebar */}
        <aside className="pm-sidebar">
          <button
            className="btn-new-entry new-password-button"
            aria-label="Create new password entry"
            role="button"
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

          {/* Batch Mode Toggle - REMOVED: Feature deemed functionally useless */}
          {/* <div className="sidebar-section batch-mode-section">
            <BatchModeToggle
              isBatchMode={isBatchMode}
              onToggle={setIsBatchMode}
            />
          </div> */}

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
              onClick={() => setShowRotationModal(true)}
            >
              🔄 Password Rotation
            </button>
            <button
              className="tool-btn"
              onClick={() => setShowActivityLogModal(true)}
            >
              📋 Activity Log
            </button>
            <button
              className="tool-btn"
              onClick={() => setShowPolicyModal(true)}
            >
              🔒 Password Policy
            </button>
            <button
              className="tool-btn"
              onClick={() => {
                setShareEntry(undefined);
                setShowShareModal(true);
              }}
            >
              🔗 Share Manager
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
            <button
              className="tool-btn"
              onClick={() => setShowSettingsModal(true)}
            >
              ⚙️ Settings
            </button>
            <button
              className="tool-btn"
              onClick={() => setShowFAQModal(true)}
            >
              ❓ Help & FAQ
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
        </aside>

        {/* Main Content */}
        <main className="pm-main">
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

          {/* Dashboard View */}
          {currentView === 'dashboard' && (
            <Dashboard
              entries={entries}
              onEntryClick={(entry) => {
                setSelectedEntry(entry);
                setEntryModalMode('view');
                setShowDetailsModal(true);
              }}
              onQuickAction={(action) => {
                switch (action) {
                  case 'add':
                    setShowCreateModal(false);
                    setEntryModalMode('create');
                    setSelectedEntry(null);
                    setTimeout(() => setShowCreateModal(true), 0);
                    break;
                  case 'generate':
                    setShowPasswordGeneratorModal(true);
                    break;
                  case 'health':
                    setShowHealthModal(true);
                    break;
                }
              }}
            />
          )}

          {/* List View */}
          {currentView === 'list' && (
            <>
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
              <div className="empty-icon">🔍</div>
              <h2>
                {searchQuery || selectedType !== null || selectedCategory !== null
                  ? 'No passwords match your search'
                  : 'Your vault is empty'}
              </h2>
              <p>
                {searchQuery || selectedType !== null || selectedCategory !== null
                  ? 'Try adjusting your filters or search terms'
                  : 'Start securing your digital life by adding your first password'}
              </p>
              {!searchQuery && selectedType === null && selectedCategory === null && (
                <button
                  className="btn-add-first"
                  onClick={() => {
                    setShowCreateModal(false);
                    setEntryModalMode('create');
                    setSelectedEntry(null);
                    setTimeout(() => setShowCreateModal(true), 0);
                  }}
                >
                  Add Your First Password
                </button>
              )}
            </div>
          ) : isVirtualizedView ? (
            <VirtualizedPasswordList
              entries={filteredEntries}
              onEntryClick={(entry) => {
                setSelectedEntry(entry);
                setEntryModalMode('view');
                setShowDetailsModal(true);
              }}
              // Batch mode UI removed but keeping props to prevent errors
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
              onCopyPassword={handleCopyPassword}
              onCopyUsername={handleCopyUsername}
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

          {/* Batch Operations Toolbar - REMOVED: Feature deemed functionally useless */}
          {/* <BatchOperationsToolbar
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
          /> */}
            </>
          )}
        </main>
      </div>

      {/* Password Entry Modal (Create/Edit/View) */}
      {showCreateModal && entryModalMode === 'create' && (
        <PasswordEntryModal
          isOpen={showCreateModal}
          onClose={() => {
            setShowCreateModal(false);
            setSelectedEntry(null); // Clear any pre-filled data
          }}
          onSave={handleCreateEntry}
          mode="create"
          entry={selectedEntry} // Pass entry for pre-filling (e.g., generated password)
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
          isBatchMode={isBatchMode}
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

      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        entries={entries}
        onImport={handleBulkImport}
      />

      {/* Password Rotation Modal */}
      <PasswordRotationModal
        isOpen={showRotationModal}
        onClose={() => setShowRotationModal(false)}
        entries={entries}
        onEditEntry={(entryId) => {
          const entry = entries.find(e => e.id === entryId);
          if (entry) {
            setSelectedEntry(entry);
            setEntryModalMode('edit');
            setShowEditModal(true);
            setShowRotationModal(false);
          }
        }}
      />

      {/* Activity Log Modal */}
      <ActivityLogModal
        isOpen={showActivityLogModal}
        onClose={() => setShowActivityLogModal(false)}
      />

      {/* Password Policy Modal */}
      <PasswordPolicyModal
        isOpen={showPolicyModal}
        onClose={() => setShowPolicyModal(false)}
      />

      {/* Share Management Modal */}
      <ShareManagementModal
        isOpen={showShareModal}
        onClose={() => {
          setShowShareModal(false);
          setShareEntry(undefined);
        }}
        entry={shareEntry}
        walletAddress={publicKey?.toBase58() || ''}
      />

      {/* FAQ Modal */}
      {showFAQModal && (
        <div className="modal-overlay" onClick={() => setShowFAQModal(false)}>
          <div className="modal-content faq-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Help & FAQ</h2>
              <button className="close-btn" onClick={() => setShowFAQModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <FAQ />
            </div>
          </div>
        </div>
      )}

      {/* Password Generator Modal (Standalone) */}
      <PasswordGeneratorModal
        isOpen={showPasswordGeneratorModal}
        onClose={() => setShowPasswordGeneratorModal(false)}
        onSelect={(password) => {
          setGeneratedPassword(password);
          setShowPasswordGeneratorModal(false);

          // Copy to clipboard
          navigator.clipboard.writeText(password)
            .then(() => {
              toast.showSuccess('Password copied to clipboard!');

              // Ask if user wants to create an entry with this password
              setTimeout(() => {
                const createEntry = window.confirm(
                  'Would you like to create a password entry with this generated password?'
                );
                if (createEntry) {
                  // Pre-fill the password field by setting it before opening modal
                  setSelectedEntry({
                    title: '',
                    username: '',
                    password: password,
                    url: '',
                    notes: '',
                    type: PasswordEntryType.Login,
                    category: 0,
                    favorite: false,
                    tags: [],
                  } as PasswordEntry);
                  setEntryModalMode('create');
                  setShowCreateModal(true);
                }
              }, 300);
            })
            .catch(() => {
              toast.showError('Failed to copy to clipboard');
            });
        }}
      />

      {/* Subscription Upgrade Modal - REMOVED: Using one-time storage expansion */}
      {/* {masterLockbox && (
        <SubscriptionUpgradeModal
          isOpen={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
          currentTier={masterLockbox.subscriptionTier}
          onUpgrade={handleUpgradeSubscription}
        />
      )} */}

      {/* Batch Progress Modal - REMOVED: Feature deemed functionally useless */}
      {/* <BatchProgressModal
        isOpen={showBatchProgress}
        operation={batchOperation}
        progress={batchProgress}
        totalItems={batchTotalItems}
        successCount={batchSuccessCount}
        failureCount={batchFailureCount}
        onClose={() => setShowBatchProgress(false)}
        canCancel={false}
      /> */}

      {/* Keyboard Shortcuts Help */}
      <KeyboardShortcutsHelp />

      <style jsx>{`
        .password-manager {
          min-height: 100vh;
          background: linear-gradient(to bottom, #f8f9fa 0%, #e9ecef 100%);
          position: relative;
        }

        .password-manager::before {
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

        .pm-header {
          background: linear-gradient(180deg, #ffffff 0%, #fafbfc 100%);
          border-bottom: 1px solid #e5e7eb;
          padding: 1rem;
          position: sticky;
          top: 0;
          z-index: 100;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
          backdrop-filter: blur(8px);
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
          font-size: 1.625rem;
          font-weight: 800;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          letter-spacing: -0.03em;
        }

        .header-actions {
          display: flex;
          gap: 1rem;
          align-items: center;
        }

        .view-switcher {
          display: flex;
          gap: 0.5rem;
          padding: 0.25rem;
          background: #f8f9fa;
          border-radius: 8px;
        }

        .view-btn {
          padding: 0.5rem 0.75rem;
          border: none;
          background: transparent;
          border-radius: 6px;
          cursor: pointer;
          font-size: 1.25rem;
          transition: all 0.2s;
        }

        .view-btn:hover {
          background: white;
        }

        .view-btn.active {
          background: white;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
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
          position: relative;
          z-index: 1;
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
          border-radius: 16px;
          padding: 1.5rem;
          height: fit-content;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(0, 0, 0, 0.04);
          border: 1px solid #f3f4f6;
        }

        .btn-new-entry {
          width: 100%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 12px;
          padding: 1rem;
          font-size: 1.0625rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          margin-bottom: 1.5rem;
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.25);
          letter-spacing: -0.01em;
        }

        .btn-new-entry:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(102, 126, 234, 0.35);
        }

        .btn-new-entry:active:not(:disabled) {
          transform: translateY(0);
        }

        .btn-new-entry:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        .sidebar-section {
          margin-bottom: 1.5rem;
        }

        .sidebar-section.batch-mode-section {
          margin-bottom: 2rem;
          padding: 0;
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

        .loading-state {
          text-align: center;
          padding: 6rem 2rem;
          color: #6b7280;
        }

        .loading-state p {
          font-size: 1.125rem;
          font-weight: 500;
          animation: pulse 2s ease-in-out infinite;
        }

        .empty-state {
          text-align: center;
          padding: 6rem 2rem;
          max-width: 600px;
          margin: 0 auto;
          animation: fadeIn 0.4s ease-out;
        }

        .empty-icon {
          font-size: 5rem;
          margin-bottom: 1.5rem;
          opacity: 0.5;
          animation: float 3s ease-in-out infinite;
        }

        .empty-state h2 {
          margin: 0 0 1rem 0;
          font-size: 1.75rem;
          font-weight: 700;
          color: #1f2937;
          letter-spacing: -0.02em;
        }

        .empty-state p {
          margin: 0 0 2rem 0;
          font-size: 1.125rem;
          color: #6b7280;
          line-height: 1.6;
        }

        .btn-add-first {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 12px;
          padding: 1rem 2rem;
          font-size: 1.125rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 8px 20px rgba(102, 126, 234, 0.3);
        }

        .btn-add-first:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 28px rgba(102, 126, 234, 0.4);
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
          border: 2px solid #e5e7eb;
          border-radius: 16px;
          padding: 1.25rem;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
        }

        .entry-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .entry-card:hover {
          border-color: #667eea;
          box-shadow: 0 8px 24px rgba(102, 126, 234, 0.2);
          transform: translateY(-2px);
        }

        .entry-card:hover::before {
          opacity: 1;
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

        /* FAQ Modal */
        .faq-modal {
          max-width: 900px;
        }

        .faq-modal .modal-header {
          padding: 1.5rem 2rem;
          border-bottom: 1px solid #e1e8ed;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }

        .faq-modal .modal-header h2 {
          margin: 0;
          font-size: 1.75rem;
          color: white;
          font-weight: 700;
        }

        .faq-modal .close-btn {
          background: rgba(255, 255, 255, 0.2);
          border: none;
          font-size: 2rem;
          color: white;
          cursor: pointer;
          padding: 0;
          width: 2.5rem;
          height: 2.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          transition: all 0.2s;
        }

        .faq-modal .close-btn:hover {
          background: rgba(255, 255, 255, 0.3);
        }

        .faq-modal .modal-body {
          padding: 0;
          max-height: calc(90vh - 100px);
          overflow-y: auto;
        }
      `}</style>

      {/* Favorites Sidebar */}
      <FavoritesSidebar
        entries={entries}
        onEntryClick={(entry) => {
          setSelectedEntry(entry);
          setEntryModalMode('view');
          setShowDetailsModal(true);
        }}
        isOpen={showFavoritesSidebar}
        onToggle={() => setShowFavoritesSidebar(!showFavoritesSidebar)}
      />
    </div>
  );
}
