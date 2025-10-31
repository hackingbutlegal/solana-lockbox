'use client';

import React, { useState } from 'react';
import { PasswordEntry, PasswordEntryType } from '../../sdk/src/types-v2';

interface FavoritesSidebarProps {
  entries: PasswordEntry[];
  onEntryClick: (entry: PasswordEntry) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export function FavoritesSidebar({
  entries,
  onEntryClick,
  isOpen,
  onToggle,
}: FavoritesSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter favorite entries
  const favoriteEntries = entries.filter(e => e.favorite);

  // Filter by search query
  const filteredFavorites = favoriteEntries.filter(entry =>
    entry.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getEntryIcon = (type: PasswordEntryType): string => {
    switch (type) {
      case PasswordEntryType.Login: return '🔑';
      case PasswordEntryType.CreditCard: return '💳';
      case PasswordEntryType.SecureNote: return '📝';
      case PasswordEntryType.Identity: return '👤';
      case PasswordEntryType.ApiKey: return '🔐';
      case PasswordEntryType.SshKey: return '🖥️';
      case PasswordEntryType.CryptoWallet: return '💰';
      default: return '📄';
    }
  };

  const getRecentAccessTime = (entry: PasswordEntry): string => {
    if (!entry.lastModified) return 'Never';

    const lastMod = typeof entry.lastModified === 'number'
      ? new Date(entry.lastModified * 1000)
      : entry.lastModified;

    const now = new Date();
    const diff = now.getTime() - lastMod.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return `${Math.floor(days / 30)}mo ago`;
  };

  return (
    <>
      {/* Toggle Button */}
      <button
        className={`favorites-toggle ${isOpen ? 'open' : ''}`}
        onClick={onToggle}
        title={isOpen ? 'Close Favorites' : 'Open Favorites'}
      >
        <span className="toggle-icon">⭐</span>
        <span className="toggle-count">{favoriteEntries.length}</span>
      </button>

      {/* Sidebar */}
      <div className={`favorites-sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="header-title">
            <span className="title-icon">⭐</span>
            <h3>Favorites</h3>
            <span className="favorites-count">{favoriteEntries.length}</span>
          </div>
          <button className="close-btn" onClick={onToggle}>
            ✕
          </button>
        </div>

        {favoriteEntries.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">⭐</div>
            <h4>No Favorites Yet</h4>
            <p>Mark entries as favorites for quick access</p>
          </div>
        ) : (
          <>
            {/* Search */}
            <div className="sidebar-search">
              <input
                type="text"
                placeholder="Search favorites..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
              {searchQuery && (
                <button
                  className="clear-search"
                  onClick={() => setSearchQuery('')}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Favorites List */}
            <div className="favorites-list">
              {filteredFavorites.length === 0 ? (
                <div className="no-results">
                  <p>No favorites match &quot;{searchQuery}&quot;</p>
                </div>
              ) : (
                filteredFavorites.map((entry) => (
                  <button
                    key={entry.id}
                    className="favorite-item"
                    onClick={() => onEntryClick(entry)}
                  >
                    <div className="item-icon">{getEntryIcon(entry.type)}</div>
                    <div className="item-content">
                      <div className="item-title">{entry.title}</div>
                      <div className="item-meta">
                        {(entry as any).url && (
                          <span className="item-url">{(entry as any).url}</span>
                        )}
                        {(entry as any).username && (
                          <span className="item-username">{(entry as any).username}</span>
                        )}
                        <span className="item-time">{getRecentAccessTime(entry)}</span>
                      </div>
                    </div>
                    <div className="item-star">⭐</div>
                  </button>
                ))
              )}
            </div>

            {/* Quick Stats */}
            <div className="sidebar-footer">
              <div className="quick-stat">
                <span className="stat-label">Total Favorites:</span>
                <span className="stat-value">{favoriteEntries.length}</span>
              </div>
              {searchQuery && filteredFavorites.length < favoriteEntries.length && (
                <div className="quick-stat">
                  <span className="stat-label">Showing:</span>
                  <span className="stat-value">{filteredFavorites.length}</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Overlay */}
      {isOpen && <div className="favorites-overlay" onClick={onToggle} />}

      <style jsx>{`
        .favorites-toggle {
          position: fixed;
          left: 0;
          top: 50%;
          transform: translateY(-50%);
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border: none;
          border-radius: 0 8px 8px 0;
          padding: 12px 8px;
          cursor: pointer;
          box-shadow: 2px 0 8px rgba(0, 0, 0, 0.2);
          z-index: 998;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          transition: all 0.3s ease;
        }

        .favorites-toggle:hover {
          padding-left: 12px;
          box-shadow: 2px 0 12px rgba(0, 0, 0, 0.3);
        }

        .favorites-toggle.open {
          left: 320px;
        }

        .toggle-icon {
          font-size: 20px;
          line-height: 1;
        }

        .toggle-count {
          font-size: 12px;
          font-weight: 700;
          color: white;
          background: rgba(255, 255, 255, 0.2);
          padding: 2px 6px;
          border-radius: 10px;
          min-width: 20px;
          text-align: center;
        }

        .favorites-sidebar {
          position: fixed;
          left: -320px;
          top: 0;
          bottom: 0;
          width: 320px;
          background: white;
          box-shadow: 2px 0 12px rgba(0, 0, 0, 0.1);
          z-index: 999;
          display: flex;
          flex-direction: column;
          transition: left 0.3s ease;
        }

        .favorites-sidebar.open {
          left: 0;
        }

        .sidebar-header {
          padding: 16px;
          border-bottom: 2px solid #e5e7eb;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .header-title {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .title-icon {
          font-size: 24px;
          line-height: 1;
        }

        .header-title h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 700;
        }

        .favorites-count {
          background: rgba(255, 255, 255, 0.2);
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 700;
        }

        .close-btn {
          background: none;
          border: none;
          color: white;
          font-size: 24px;
          cursor: pointer;
          padding: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          transition: background 0.2s;
        }

        .close-btn:hover {
          background: rgba(255, 255, 255, 0.2);
        }

        .empty-state {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 32px;
          text-align: center;
          color: #6b7280;
        }

        .empty-icon {
          font-size: 64px;
          opacity: 0.3;
          margin-bottom: 16px;
        }

        .empty-state h4 {
          margin: 0 0 8px 0;
          font-size: 16px;
          font-weight: 600;
          color: #374151;
        }

        .empty-state p {
          margin: 0;
          font-size: 14px;
        }

        .sidebar-search {
          padding: 12px 16px;
          border-bottom: 1px solid #e5e7eb;
          position: relative;
        }

        .search-input {
          width: 100%;
          padding: 8px 32px 8px 12px;
          border: 2px solid #e5e7eb;
          border-radius: 8px;
          font-size: 14px;
          transition: border-color 0.2s;
        }

        .search-input:focus {
          outline: none;
          border-color: #667eea;
        }

        .clear-search {
          position: absolute;
          right: 24px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: #9ca3af;
          cursor: pointer;
          padding: 4px;
          font-size: 14px;
        }

        .clear-search:hover {
          color: #374151;
        }

        .favorites-list {
          flex: 1;
          overflow-y: auto;
          padding: 8px;
        }

        .no-results {
          padding: 32px 16px;
          text-align: center;
          color: #6b7280;
          font-size: 14px;
        }

        .favorite-item {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          border: none;
          background: white;
          border-radius: 8px;
          cursor: pointer;
          text-align: left;
          transition: all 0.2s;
          margin-bottom: 4px;
        }

        .favorite-item:hover {
          background: #f9fafb;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .item-icon {
          font-size: 24px;
          line-height: 1;
          flex-shrink: 0;
        }

        .item-content {
          flex: 1;
          min-width: 0;
        }

        .item-title {
          font-size: 14px;
          font-weight: 600;
          color: #1f2937;
          margin-bottom: 4px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .item-meta {
          display: flex;
          flex-direction: column;
          gap: 2px;
          font-size: 12px;
          color: #6b7280;
        }

        .item-url,
        .item-username {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .item-time {
          font-size: 11px;
          color: #9ca3af;
        }

        .item-star {
          font-size: 16px;
          flex-shrink: 0;
          opacity: 0.6;
        }

        .favorite-item:hover .item-star {
          opacity: 1;
        }

        .sidebar-footer {
          padding: 12px 16px;
          border-top: 1px solid #e5e7eb;
          background: #f9fafb;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .quick-stat {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
        }

        .stat-label {
          color: #6b7280;
          font-weight: 500;
        }

        .stat-value {
          color: #1f2937;
          font-weight: 700;
        }

        .favorites-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 998;
        }

        @media (max-width: 768px) {
          .favorites-sidebar {
            width: 280px;
            left: -280px;
            max-width: 85vw;
          }

          .favorites-toggle.open {
            left: 280px;
          }

          .sidebar-header {
            padding: 12px;
          }

          .header-title h3 {
            font-size: 16px;
          }

          .title-icon {
            font-size: 20px;
          }
        }

        @media (max-width: 480px) {
          .favorites-sidebar {
            width: 260px;
            left: -260px;
            max-width: 80vw;
          }

          .favorites-toggle.open {
            left: 260px;
          }

          .sidebar-search {
            padding: 10px 12px;
          }

          .search-input {
            font-size: 13px;
            padding: 6px 28px 6px 10px;
          }

          .favorites-list {
            padding: 6px;
          }

          .favorite-item {
            padding: 10px;
            gap: 10px;
          }

          .item-icon {
            font-size: 20px;
          }

          .item-title {
            font-size: 13px;
          }

          .item-meta {
            font-size: 11px;
          }

          .sidebar-footer {
            padding: 10px 12px;
          }

          .quick-stat {
            font-size: 12px;
          }
        }
      `}</style>
    </>
  );
}
