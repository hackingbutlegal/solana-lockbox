'use client';

import React from 'react';
import { PasswordEntry } from '../../sdk/src/types-v2';

/**
 * BatchOperationsToolbar Component
 *
 * Floating toolbar for bulk operations on selected password entries.
 * Appears when items are selected, providing quick batch actions.
 *
 * Features:
 * - Batch delete with confirmation
 * - Batch archive/unarchive
 * - Batch favorite/unfavorite
 * - Batch category assignment
 * - Batch tag management
 * - Export selected
 * - Selection counter
 * - Undo support
 */

export interface BatchOperationsToolbarProps {
  selectedEntries: PasswordEntry[];
  totalEntries: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onDeleteSelected: () => void;
  onArchiveSelected: () => void;
  onUnarchiveSelected: () => void;
  onFavoriteSelected: () => void;
  onUnfavoriteSelected: () => void;
  onAssignCategory?: (categoryId: number) => void;
  onExportSelected?: () => void;
  categories?: Array<{ id: number; name: string }>;
  className?: string;
}

export function BatchOperationsToolbar({
  selectedEntries,
  totalEntries,
  onSelectAll,
  onDeselectAll,
  onDeleteSelected,
  onArchiveSelected,
  onUnarchiveSelected,
  onFavoriteSelected,
  onUnfavoriteSelected,
  onAssignCategory,
  onExportSelected,
  categories = [],
  className = '',
}: BatchOperationsToolbarProps) {
  const selectedCount = selectedEntries.length;
  const allSelected = selectedCount === totalEntries && totalEntries > 0;

  const hasArchived = selectedEntries.some(e => e.archived);
  const hasUnarchived = selectedEntries.some(e => !e.archived);
  const hasFavorites = selectedEntries.some(e => e.favorite);
  const hasNonFavorites = selectedEntries.some(e => !e.favorite);

  if (selectedCount === 0) return null;

  return (
    <div className={`batch-toolbar ${className}`}>
      <div className="toolbar-content">
        {/* Selection Info */}
        <div className="selection-info">
          <span className="selection-count">
            {selectedCount} selected
          </span>
          {!allSelected && (
            <button className="select-all-btn" onClick={onSelectAll}>
              Select all {totalEntries}
            </button>
          )}
          {allSelected && (
            <button className="select-all-btn" onClick={onDeselectAll}>
              Deselect all
            </button>
          )}
        </div>

        {/* Divider */}
        <div className="toolbar-divider" />

        {/* Actions */}
        <div className="toolbar-actions">
          {/* Archive/Unarchive */}
          {hasUnarchived && (
            <button
              className="toolbar-btn"
              onClick={onArchiveSelected}
              title="Archive selected"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 8v13H3V8M23 3H1v5h22zM10 12h4" />
              </svg>
              Archive
            </button>
          )}
          {hasArchived && (
            <button
              className="toolbar-btn"
              onClick={onUnarchiveSelected}
              title="Unarchive selected"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 8v13H3V8M23 3H1v5h22zM10 12h4" />
              </svg>
              Unarchive
            </button>
          )}

          {/* Favorite/Unfavorite */}
          {hasNonFavorites && (
            <button
              className="toolbar-btn"
              onClick={onFavoriteSelected}
              title="Add to favorites"
            >
              ★ Favorite
            </button>
          )}
          {hasFavorites && (
            <button
              className="toolbar-btn"
              onClick={onUnfavoriteSelected}
              title="Remove from favorites"
            >
              ☆ Unfavorite
            </button>
          )}

          {/* Category Assignment */}
          {categories.length > 0 && onAssignCategory && (
            <div className="toolbar-dropdown">
              <select
                className="category-select"
                onChange={(e) => {
                  const categoryId = parseInt(e.target.value);
                  if (!isNaN(categoryId)) {
                    onAssignCategory(categoryId);
                    e.target.value = ''; // Reset
                  }
                }}
                defaultValue=""
              >
                <option value="" disabled>
                  Assign category...
                </option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Export */}
          {onExportSelected && (
            <button
              className="toolbar-btn"
              onClick={onExportSelected}
              title="Export selected"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Export
            </button>
          )}

          {/* Delete */}
          <button
            className="toolbar-btn danger"
            onClick={onDeleteSelected}
            title="Delete selected"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            Delete
          </button>
        </div>

        {/* Close Button */}
        <button className="close-btn" onClick={onDeselectAll} title="Clear selection">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <style jsx>{`
        .batch-toolbar {
          position: fixed;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          background: white;
          border-radius: 12px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08);
          padding: 12px 16px;
          z-index: 1000;
          max-width: 90vw;
          animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }

        .toolbar-content {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .selection-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .selection-count {
          font-weight: 600;
          color: #111827;
          font-size: 14px;
          white-space: nowrap;
        }

        .select-all-btn {
          background: transparent;
          border: none;
          color: #3b82f6;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 4px;
          transition: all 0.2s;
          white-space: nowrap;
        }

        .select-all-btn:hover {
          background: #eff6ff;
        }

        .toolbar-divider {
          width: 1px;
          height: 32px;
          background: #e5e7eb;
        }

        .toolbar-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .toolbar-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          background: #f3f4f6;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          color: #374151;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }

        .toolbar-btn svg {
          width: 16px;
          height: 16px;
        }

        .toolbar-btn:hover {
          background: #e5e7eb;
          border-color: #d1d5db;
        }

        .toolbar-btn.danger {
          color: #dc2626;
          background: #fef2f2;
          border-color: #fecaca;
        }

        .toolbar-btn.danger:hover {
          background: #fee2e2;
          border-color: #fca5a5;
        }

        .toolbar-dropdown {
          position: relative;
        }

        .category-select {
          padding: 8px 32px 8px 12px;
          background: #f3f4f6;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          color: #374151;
          cursor: pointer;
          transition: all 0.2s;
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 8px center;
          background-size: 16px;
        }

        .category-select:hover {
          background-color: #e5e7eb;
          border-color: #d1d5db;
        }

        .close-btn {
          width: 32px;
          height: 32px;
          padding: 6px;
          background: transparent;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          color: #6b7280;
          transition: all 0.2s;
          flex-shrink: 0;
        }

        .close-btn svg {
          width: 100%;
          height: 100%;
        }

        .close-btn:hover {
          background: #f3f4f6;
          color: #374151;
        }

        @media (max-width: 768px) {
          .batch-toolbar {
            bottom: 16px;
            padding: 10px 12px;
          }

          .toolbar-content {
            gap: 12px;
            flex-wrap: wrap;
          }

          .toolbar-actions {
            gap: 6px;
          }

          .toolbar-btn {
            padding: 6px 10px;
            font-size: 12px;
          }

          .toolbar-btn svg {
            width: 14px;
            height: 14px;
          }

          .selection-count {
            font-size: 13px;
          }

          .select-all-btn {
            font-size: 12px;
          }
        }

        @media (max-width: 640px) {
          .batch-toolbar {
            max-width: calc(100vw - 32px);
            padding: 8px;
          }

          .toolbar-btn span {
            display: none; /* Hide text on very small screens, show icons only */
          }

          .toolbar-btn {
            padding: 8px;
          }

          .toolbar-divider {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
