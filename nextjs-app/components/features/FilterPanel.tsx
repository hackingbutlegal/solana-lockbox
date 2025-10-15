'use client';

import React, { useState } from 'react';
import { PasswordEntryType } from '../../sdk/src/types-v2';

/**
 * FilterPanel Component
 *
 * Advanced filtering for password entries:
 * - Entry type filtering (Login, Credit Card, etc.)
 * - Category filtering
 * - Favorites toggle
 * - Archived items toggle
 * - Old passwords filter (>90 days)
 * - Active filter indicators
 */

export interface FilterPanelProps {
  selectedTypes: PasswordEntryType[];
  onTypesChange: (types: PasswordEntryType[]) => void;
  selectedCategories: number[];
  onCategoriesChange: (categories: number[]) => void;
  categories: Array<{ id: number; name: string; count?: number }>;
  showFavorites: boolean | null;
  onShowFavoritesChange: (show: boolean | null) => void;
  showArchived: boolean;
  onShowArchivedChange: (show: boolean) => void;
  showOldPasswords: boolean;
  onShowOldPasswordsChange: (show: boolean) => void;
  onClearAll?: () => void;
  className?: string;
}

const ENTRY_TYPE_LABELS: Record<PasswordEntryType, string> = {
  [PasswordEntryType.Login]: 'Login',
  [PasswordEntryType.CreditCard]: 'Credit Card',
  [PasswordEntryType.SecureNote]: 'Secure Note',
  [PasswordEntryType.Identity]: 'Identity',
  [PasswordEntryType.ApiKey]: 'API Key',
  [PasswordEntryType.SshKey]: 'SSH Key',
  [PasswordEntryType.CryptoWallet]: 'Crypto Wallet',
};

export function FilterPanel({
  selectedTypes,
  onTypesChange,
  selectedCategories,
  onCategoriesChange,
  categories,
  showFavorites,
  onShowFavoritesChange,
  showArchived,
  onShowArchivedChange,
  showOldPasswords,
  onShowOldPasswordsChange,
  onClearAll,
  className = '',
}: FilterPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleType = (type: PasswordEntryType) => {
    if (selectedTypes.includes(type)) {
      onTypesChange(selectedTypes.filter(t => t !== type));
    } else {
      onTypesChange([...selectedTypes, type]);
    }
  };

  const toggleCategory = (categoryId: number) => {
    if (selectedCategories.includes(categoryId)) {
      onCategoriesChange(selectedCategories.filter(c => c !== categoryId));
    } else {
      onCategoriesChange([...selectedCategories, categoryId]);
    }
  };

  const hasActiveFilters =
    selectedTypes.length > 0 ||
    selectedCategories.length > 0 ||
    showFavorites !== null ||
    showArchived ||
    showOldPasswords;

  const activeFilterCount =
    selectedTypes.length +
    selectedCategories.length +
    (showFavorites !== null ? 1 : 0) +
    (showArchived ? 1 : 0) +
    (showOldPasswords ? 1 : 0);

  return (
    <div className={`filter-panel ${isExpanded ? 'expanded' : ''} ${className}`}>
      <div className="filter-header">
        <button
          className="filter-toggle"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-label={isExpanded ? 'Collapse filters' : 'Expand filters'}
        >
          <svg
            className={`chevron ${isExpanded ? 'rotated' : ''}`}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
          <span>Filters</span>
          {activeFilterCount > 0 && (
            <span className="filter-count">{activeFilterCount}</span>
          )}
        </button>

        {hasActiveFilters && (
          <button className="clear-filters-btn" onClick={onClearAll}>
            Clear All
          </button>
        )}
      </div>

      {isExpanded && (
        <div className="filter-content">
          {/* Entry Type Filters */}
          <div className="filter-section">
            <h4>Entry Type</h4>
            <div className="filter-chips">
              {Object.entries(ENTRY_TYPE_LABELS).map(([type, label]) => {
                const typeNum = parseInt(type) as PasswordEntryType;
                const isSelected = selectedTypes.includes(typeNum);
                return (
                  <button
                    key={type}
                    className={`filter-chip ${isSelected ? 'selected' : ''}`}
                    onClick={() => toggleType(typeNum)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Category Filters */}
          {categories.length > 0 && (
            <div className="filter-section">
              <h4>Categories</h4>
              <div className="filter-chips">
                {categories.map((category) => {
                  const isSelected = selectedCategories.includes(category.id);
                  return (
                    <button
                      key={category.id}
                      className={`filter-chip ${isSelected ? 'selected' : ''}`}
                      onClick={() => toggleCategory(category.id)}
                    >
                      {category.name}
                      {category.count !== undefined && (
                        <span className="count">({category.count})</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick Filters */}
          <div className="filter-section">
            <h4>Quick Filters</h4>
            <div className="filter-toggles">
              <label className="filter-toggle-item">
                <input
                  type="checkbox"
                  checked={showFavorites === true}
                  onChange={(e) => onShowFavoritesChange(e.target.checked ? true : null)}
                />
                <span>Favorites Only</span>
              </label>

              <label className="filter-toggle-item">
                <input
                  type="checkbox"
                  checked={showArchived}
                  onChange={(e) => onShowArchivedChange(e.target.checked)}
                />
                <span>Show Archived</span>
              </label>

              <label className="filter-toggle-item">
                <input
                  type="checkbox"
                  checked={showOldPasswords}
                  onChange={(e) => onShowOldPasswordsChange(e.target.checked)}
                />
                <span>Old Passwords (90+ days)</span>
              </label>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .filter-panel {
          background: white;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
          overflow: hidden;
          transition: all 0.2s;
        }

        .filter-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: #f9fafb;
          border-bottom: 1px solid #e5e7eb;
        }

        .filter-toggle {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          background: white;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 500;
          color: #374151;
          transition: all 0.2s;
        }

        .filter-toggle:hover {
          background: #f9fafb;
          border-color: #9ca3af;
        }

        .chevron {
          width: 16px;
          height: 16px;
          transition: transform 0.2s;
        }

        .chevron.rotated {
          transform: rotate(180deg);
        }

        .filter-count {
          background: #667eea;
          color: white;
          font-size: 11px;
          padding: 2px 6px;
          border-radius: 10px;
          font-weight: 600;
        }

        .clear-filters-btn {
          padding: 6px 12px;
          background: transparent;
          border: none;
          color: #dc2626;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          border-radius: 4px;
          transition: all 0.2s;
        }

        .clear-filters-btn:hover {
          background: #fef2f2;
        }

        .filter-content {
          padding: 16px;
        }

        .filter-section {
          margin-bottom: 20px;
        }

        .filter-section:last-child {
          margin-bottom: 0;
        }

        .filter-section h4 {
          margin: 0 0 10px 0;
          font-size: 13px;
          font-weight: 600;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .filter-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .filter-chip {
          padding: 6px 12px;
          background: #f3f4f6;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
          color: #374151;
        }

        .filter-chip:hover {
          background: #e5e7eb;
        }

        .filter-chip.selected {
          background: #667eea;
          border-color: #667eea;
          color: white;
          font-weight: 500;
        }

        .filter-chip .count {
          margin-left: 4px;
          opacity: 0.7;
          font-size: 11px;
        }

        .filter-toggles {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .filter-toggle-item {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          padding: 8px;
          border-radius: 6px;
          transition: background 0.2s;
        }

        .filter-toggle-item:hover {
          background: #f9fafb;
        }

        .filter-toggle-item input[type="checkbox"] {
          width: 18px;
          height: 18px;
          cursor: pointer;
        }

        .filter-toggle-item span {
          font-size: 14px;
          color: #374151;
        }

        @media (max-width: 640px) {
          .filter-chips {
            gap: 6px;
          }

          .filter-chip {
            font-size: 12px;
            padding: 5px 10px;
          }
        }
      `}</style>
    </div>
  );
}
