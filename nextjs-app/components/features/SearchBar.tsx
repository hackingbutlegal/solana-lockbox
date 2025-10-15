'use client';

import React, { useState, useCallback, useEffect } from 'react';

/**
 * Enhanced SearchBar Component
 *
 * Features:
 * - Real-time search with debouncing
 * - Search mode indicators (fuzzy, exact)
 * - Clear button
 * - Keyboard shortcuts
 * - Search suggestions/history (future)
 */

export interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  placeholder?: string;
  debounceMs?: number;
  showFuzzyIndicator?: boolean;
  disabled?: boolean;
  className?: string;
}

export function SearchBar({
  value,
  onChange,
  onClear,
  placeholder = 'Search passwords...',
  debounceMs = 300,
  showFuzzyIndicator = true,
  disabled = false,
  className = '',
}: SearchBarProps) {
  const [localValue, setLocalValue] = useState(value);
  const [isFocused, setIsFocused] = useState(false);

  // Sync with external value changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Debounced onChange
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localValue !== value) {
        onChange(localValue);
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [localValue, value, onChange, debounceMs]);

  const handleClear = useCallback(() => {
    setLocalValue('');
    onChange('');
    onClear?.();
  }, [onChange, onClear]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClear();
    }
  }, [handleClear]);

  return (
    <div className={`search-bar-container ${isFocused ? 'focused' : ''} ${className}`}>
      <div className="search-bar-wrapper">
        <svg
          className="search-icon"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>

        <input
          type="text"
          className="search-input"
          placeholder={placeholder}
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          aria-label="Search passwords"
        />

        {localValue && (
          <button
            type="button"
            className="search-clear-btn"
            onClick={handleClear}
            aria-label="Clear search"
            tabIndex={-1}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {showFuzzyIndicator && localValue && (
        <div className="search-hints">
          <span className="search-hint fuzzy">
            🔍 Fuzzy search active
          </span>
        </div>
      )}

      <style jsx>{`
        .search-bar-container {
          width: 100%;
          position: relative;
        }

        .search-bar-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .search-icon {
          position: absolute;
          left: 12px;
          width: 20px;
          height: 20px;
          color: #9ca3af;
          pointer-events: none;
          z-index: 1;
        }

        .search-input {
          width: 100%;
          padding: 10px 40px 10px 40px;
          font-size: 14px;
          border: 2px solid #e5e7eb;
          border-radius: 8px;
          background: white;
          transition: all 0.2s;
          outline: none;
        }

        .search-input:focus {
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .search-input:disabled {
          background: #f3f4f6;
          cursor: not-allowed;
          opacity: 0.6;
        }

        .search-clear-btn {
          position: absolute;
          right: 8px;
          width: 24px;
          height: 24px;
          padding: 4px;
          border: none;
          background: transparent;
          color: #9ca3af;
          cursor: pointer;
          border-radius: 4px;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .search-clear-btn:hover {
          background: #f3f4f6;
          color: #6b7280;
        }

        .search-clear-btn svg {
          width: 16px;
          height: 16px;
        }

        .search-hints {
          display: flex;
          gap: 8px;
          margin-top: 6px;
          padding: 0 4px;
        }

        .search-hint {
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 4px;
          background: #eff6ff;
          color: #1e40af;
          font-weight: 500;
        }

        .search-hint.fuzzy {
          background: #f0fdf4;
          color: #15803d;
        }

        .focused .search-bar-wrapper {
          position: relative;
        }

        @media (max-width: 640px) {
          .search-input {
            font-size: 16px; /* Prevents zoom on iOS */
          }

          .search-hints {
            flex-wrap: wrap;
          }
        }
      `}</style>
    </div>
  );
}
