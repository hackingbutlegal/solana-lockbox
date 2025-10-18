'use client';

import React from 'react';

/**
 * Preferences Panel
 *
 * Extracted from SettingsModal for use in /settings page
 * Includes:
 * - Display preferences (view mode, theme)
 * - UI customization options
 */

export function PreferencesPanel() {
  return (
    <div className="preferences-panel">
      <h3>Display Preferences</h3>
      <div className="settings-section">
        <div className="setting-item">
          <label>
            Default view mode:
            <select defaultValue="list">
              <option value="list">List</option>
              <option value="grid">Grid</option>
              <option value="virtual">Virtual (for large vaults)</option>
            </select>
          </label>
        </div>
        <div className="setting-item">
          <label>
            Theme:
            <select defaultValue="system">
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </select>
          </label>
        </div>
        <div className="setting-item">
          <label>
            <input type="checkbox" defaultChecked />
            <span>Show entry previews in list view</span>
          </label>
        </div>
        <div className="setting-item">
          <label>
            <input type="checkbox" defaultChecked />
            <span>Compact mode (higher density)</span>
          </label>
        </div>
      </div>

      <style jsx>{`
        .preferences-panel h3 {
          margin: 0 0 1.5rem 0;
          color: #2c3e50;
          font-size: 1.25rem;
        }

        .settings-section {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .setting-item {
          padding: 0.75rem;
          border-radius: 8px;
          background: #f8f9fa;
        }

        .setting-item label {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          cursor: pointer;
        }

        .setting-item input[type="checkbox"] {
          width: 18px;
          height: 18px;
          cursor: pointer;
        }

        .setting-item select {
          padding: 0.5rem;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          margin-left: 0.5rem;
        }
      `}</style>
    </div>
  );
}
