'use client';

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import {
  clientSideSearch,
  ClientSearchFilters,
  ClientSearchResult,
  filterByType,
  filterByCategory,
  getFavorites,
  getRecentlyAccessed,
  getOldPasswords,
  getArchived,
} from '../lib/search-manager';
import { PasswordEntry, PasswordEntryType } from '../sdk/src/types-v2';
import { MultiSelectManager } from '../lib/batch-operations';

/**
 * Search Context - Phase 4: Search & Intelligence
 *
 * Provides centralized state management for:
 * - Search queries and results
 * - Filter state (type, category, favorites, etc.)
 * - Multi-select state for batch operations
 * - Search history (client-side only)
 * - Quick filters (recently accessed, old passwords, etc.)
 */

export interface SearchContextType {
  // Search State
  query: string;
  setQuery: (query: string) => void;
  searchResults: ClientSearchResult[];
  isSearchActive: boolean;

  // Filter State
  filters: ClientSearchFilters;
  setFilters: (filters: ClientSearchFilters) => void;
  updateFilter: <K extends keyof ClientSearchFilters>(key: K, value: ClientSearchFilters[K]) => void;
  clearFilters: () => void;

  // Quick Filters
  showFavoritesOnly: boolean;
  setShowFavoritesOnly: (value: boolean) => void;
  showRecentlyAccessed: boolean;
  setShowRecentlyAccessed: (value: boolean) => void;
  showOldPasswords: boolean;
  setShowOldPasswords: (value: boolean) => void;
  showArchived: boolean;
  setShowArchived: (value: boolean) => void;

  // Multi-Select State
  multiSelectManager: MultiSelectManager;
  isMultiSelectMode: boolean;
  setMultiSelectMode: (enabled: boolean) => void;
  selectedCount: number;

  // Search History
  searchHistory: string[];
  addToSearchHistory: (query: string) => void;
  clearSearchHistory: () => void;

  // Computed Results
  filteredEntries: PasswordEntry[];
  performSearch: (entries: PasswordEntry[]) => void;
}

const SearchContext = createContext<SearchContextType | null>(null);

export function useSearch() {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error('useSearch must be used within SearchProvider');
  }
  return context;
}

interface SearchProviderProps {
  children: React.ReactNode;
}

const MAX_SEARCH_HISTORY = 10;

export function SearchProvider({ children }: SearchProviderProps) {
  // Search state
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ClientSearchResult[]>([]);
  const [filters, setFilters] = useState<ClientSearchFilters>({});

  // Quick filters
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showRecentlyAccessed, setShowRecentlyAccessed] = useState(false);
  const [showOldPasswords, setShowOldPasswords] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  // Multi-select state
  const [multiSelectManager] = useState(() => new MultiSelectManager());
  const [isMultiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedCount, setSelectedCount] = useState(0);

  // Search history (stored in component state, not persisted)
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  // Computed properties
  const isSearchActive = query.trim().length > 0;

  // Update filter helper
  const updateFilter = useCallback(
    <K extends keyof ClientSearchFilters>(key: K, value: ClientSearchFilters[K]) => {
      setFilters((prev) => ({
        ...prev,
        [key]: value,
      }));
    },
    []
  );

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilters({});
    setShowFavoritesOnly(false);
    setShowRecentlyAccessed(false);
    setShowOldPasswords(false);
    setShowArchived(false);
  }, []);

  // Add to search history
  const addToSearchHistory = useCallback((searchQuery: string) => {
    const trimmed = searchQuery.trim();
    if (trimmed.length === 0) return;

    setSearchHistory((prev) => {
      // Remove duplicate if exists
      const filtered = prev.filter((q) => q !== trimmed);
      // Add to front
      const updated = [trimmed, ...filtered];
      // Limit to MAX_SEARCH_HISTORY
      return updated.slice(0, MAX_SEARCH_HISTORY);
    });
  }, []);

  // Clear search history
  const clearSearchHistory = useCallback(() => {
    setSearchHistory([]);
  }, []);

  // Update multi-select count when manager changes
  const updateSelectedCount = useCallback(() => {
    setSelectedCount(multiSelectManager.getSelectedCount());
  }, [multiSelectManager]);

  // Wrap multi-select manager methods to update count
  const wrappedMultiSelectManager = useMemo(() => {
    const originalSelect = multiSelectManager.select.bind(multiSelectManager);
    const originalDeselect = multiSelectManager.deselect.bind(multiSelectManager);
    const originalToggle = multiSelectManager.toggle.bind(multiSelectManager);
    const originalSelectAll = multiSelectManager.selectAll.bind(multiSelectManager);
    const originalDeselectAll = multiSelectManager.deselectAll.bind(multiSelectManager);

    return {
      ...multiSelectManager,
      select: (entryId: number | undefined) => {
        originalSelect(entryId);
        updateSelectedCount();
      },
      deselect: (entryId: number | undefined) => {
        originalDeselect(entryId);
        updateSelectedCount();
      },
      toggle: (entryId: number | undefined) => {
        originalToggle(entryId);
        updateSelectedCount();
      },
      selectAll: () => {
        originalSelectAll();
        updateSelectedCount();
      },
      deselectAll: () => {
        originalDeselectAll();
        updateSelectedCount();
      },
    };
  }, [multiSelectManager, updateSelectedCount]);

  // Perform search with current query and filters
  const performSearch = useCallback(
    (entries: PasswordEntry[]) => {
      // Update multi-select manager with current entries
      multiSelectManager.updateEntries(entries);

      // Start with all entries
      let filteredEntries = [...entries];

      // Apply quick filters first
      if (showFavoritesOnly) {
        filteredEntries = getFavorites(filteredEntries);
      }

      if (showRecentlyAccessed) {
        filteredEntries = getRecentlyAccessed(filteredEntries, 20);
      }

      if (showOldPasswords) {
        filteredEntries = getOldPasswords(filteredEntries);
      }

      if (showArchived) {
        filteredEntries = getArchived(filteredEntries);
      } else {
        // By default, exclude archived entries unless explicitly shown
        filteredEntries = filteredEntries.filter((e) => !e.archived);
      }

      // If search query is active, perform fuzzy search
      if (isSearchActive) {
        const results = clientSideSearch(filteredEntries, query, filters);
        setSearchResults(results);
      } else {
        // No search query, just apply filters
        // Convert to search results format (with score 0)
        const results: ClientSearchResult[] = filteredEntries.map((entry) => ({
          entry,
          score: 0,
          matchedFields: [],
        }));
        setSearchResults(results);
      }
    },
    [query, filters, showFavoritesOnly, showRecentlyAccessed, showOldPasswords, showArchived, isSearchActive, multiSelectManager]
  );

  // Computed filtered entries (without search, just filters)
  const filteredEntries = useMemo(() => {
    return searchResults.map((result) => result.entry);
  }, [searchResults]);

  // Exit multi-select mode when disabled
  const setMultiSelectModeWrapped = useCallback(
    (enabled: boolean) => {
      setMultiSelectMode(enabled);
      if (!enabled) {
        multiSelectManager.deselectAll();
        updateSelectedCount();
      }
    },
    [multiSelectManager, updateSelectedCount]
  );

  const contextValue: SearchContextType = {
    query,
    setQuery,
    searchResults,
    isSearchActive,
    filters,
    setFilters,
    updateFilter,
    clearFilters,
    showFavoritesOnly,
    setShowFavoritesOnly,
    showRecentlyAccessed,
    setShowRecentlyAccessed,
    showOldPasswords,
    setShowOldPasswords,
    showArchived,
    setShowArchived,
    multiSelectManager: wrappedMultiSelectManager as MultiSelectManager,
    isMultiSelectMode,
    setMultiSelectMode: setMultiSelectModeWrapped,
    selectedCount,
    searchHistory,
    addToSearchHistory,
    clearSearchHistory,
    filteredEntries,
    performSearch,
  };

  return <SearchContext.Provider value={contextValue}>{children}</SearchContext.Provider>;
}
