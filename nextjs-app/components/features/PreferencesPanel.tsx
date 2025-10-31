'use client';

import React, { useState, useEffect } from 'react';
import { useToast } from '../ui/Toast';

/**
 * Preferences Panel
 *
 * Extracted from SettingsModal for use in /settings page
 * Includes:
 * - Display preferences (view mode, theme)
 * - UI customization options
 * - Save/Cancel functionality
 */

interface Preferences {
  viewMode: 'list' | 'grid' | 'virtual';
  showPreviews: boolean;
  compactMode: boolean;
}

const DEFAULT_PREFERENCES: Preferences = {
  viewMode: 'list',
  showPreviews: true,
  compactMode: false,
};

function loadPreferences(): Preferences {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCES;

  try {
    const saved = localStorage.getItem('lockbox_preferences');
    if (saved) {
      return { ...DEFAULT_PREFERENCES, ...JSON.parse(saved) };
    }
  } catch (err) {
    console.error('Failed to load preferences:', err);
  }
  return DEFAULT_PREFERENCES;
}

function savePreferences(prefs: Preferences): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem('lockbox_preferences', JSON.stringify(prefs));
  } catch (err) {
    console.error('Failed to save preferences:', err);
  }
}

// Theme feature removed - not implemented

export function PreferencesPanel() {
  const toast = useToast();
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [hasChanges, setHasChanges] = useState(false);
  const [savedPreferences, setSavedPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);

  // Load preferences on mount
  useEffect(() => {
    const loaded = loadPreferences();
    setPreferences(loaded);
    setSavedPreferences(loaded);
  }, []);

  // Track changes
  useEffect(() => {
    const changed = JSON.stringify(preferences) !== JSON.stringify(savedPreferences);
    setHasChanges(changed);
  }, [preferences, savedPreferences]);

  const handleViewModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setPreferences({ ...preferences, viewMode: e.target.value as 'list' | 'grid' | 'virtual' });
  };

  const handleShowPreviewsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPreferences({ ...preferences, showPreviews: e.target.checked });
  };

  const handleCompactModeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPreferences({ ...preferences, compactMode: e.target.checked });
  };

  const handleSave = () => {
    savePreferences(preferences);
    setSavedPreferences(preferences);
    setHasChanges(false);
    toast.showSuccess('Preferences saved successfully');
  };

  const handleCancel = () => {
    setPreferences(savedPreferences);
    setHasChanges(false);
    toast.showInfo('Changes discarded');
  };

  return (
    <div className="preferences-panel">
      <div className="settings-section">
        <div className="setting-item">
          <label>
            Default view mode:
            <select value={preferences.viewMode} onChange={handleViewModeChange}>
              <option value="list">List</option>
              <option value="grid">Grid</option>
              <option value="virtual">Virtual (for large vaults)</option>
            </select>
          </label>
        </div>
        <div className="setting-item">
          <label>
            <input
              type="checkbox"
              checked={preferences.showPreviews}
              onChange={handleShowPreviewsChange}
            />
            <span>Show entry previews in list view</span>
          </label>
        </div>
        <div className="setting-item">
          <label>
            <input
              type="checkbox"
              checked={preferences.compactMode}
              onChange={handleCompactModeChange}
            />
            <span>Compact mode (higher density)</span>
          </label>
        </div>
      </div>

      {hasChanges && (
        <div className="action-buttons">
          <button className="btn-cancel" onClick={handleCancel}>
            Cancel
          </button>
          <button className="btn-save" onClick={handleSave}>
            Save Changes
          </button>
        </div>
      )}

      <style jsx>{`
        .preferences-panel h3 {
          margin: 0 0 1.5rem 0;
          color: var(--color-text-primary);
          font-size: 1.25rem;
        }

        .settings-section {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .setting-item {
          padding: 0.75rem;
          border-radius: 8px;
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
        }

        .setting-item label {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          cursor: pointer;
          color: var(--color-text-primary);
        }

        .setting-description {
          margin: 0.5rem 0 0 0;
          font-size: 0.85rem;
          color: var(--color-text-secondary);
          font-style: italic;
        }

        .setting-item input[type="checkbox"] {
          width: 18px;
          height: 18px;
          cursor: pointer;
        }

        .setting-item select {
          padding: 0.5rem;
          border: 1px solid var(--color-border);
          border-radius: 6px;
          margin-left: 0.5rem;
          background: var(--color-bg-primary);
          color: var(--color-text-primary);
        }

        .action-buttons {
          display: flex;
          gap: 1rem;
          justify-content: flex-end;
          padding-top: 1.5rem;
          border-top: 2px solid var(--color-border);
        }

        .btn-cancel,
        .btn-save {
          padding: 0.75rem 1.5rem;
          border-radius: 8px;
          font-weight: 600;
          font-size: 0.95rem;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
        }

        .btn-cancel {
          background: var(--color-bg-secondary);
          color: var(--color-text-primary);
          border: 1px solid var(--color-border);
        }

        .btn-cancel:hover {
          background: var(--color-bg-tertiary);
          transform: translateY(-1px);
        }

        .btn-save {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .btn-save:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
        }
      `}</style>
    </div>
  );
}
