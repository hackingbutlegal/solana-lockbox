'use client';

import React, { useState } from 'react';

/**
 * KeyboardShortcutsHelp Component
 *
 * Displays a floating help button that shows available keyboard shortcuts.
 * Modal appears when clicked, showing all shortcuts in an organized table.
 */

interface Shortcut {
  keys: string;
  description: string;
  category: string;
}

const SHORTCUTS: Shortcut[] = [
  { keys: 'Ctrl/⌘ + A', description: 'Select all / Deselect all', category: 'Selection' },
  { keys: 'Ctrl/⌘ + D', description: 'Deselect all entries', category: 'Selection' },
  { keys: 'Escape', description: 'Clear selection', category: 'Selection' },
  { keys: 'Delete', description: 'Delete selected entries', category: 'Batch Operations' },
  { keys: 'Ctrl/⌘ + Shift + A', description: 'Archive selected entries', category: 'Batch Operations' },
  { keys: 'Ctrl/⌘ + E', description: 'Export selected entries', category: 'Batch Operations' },
];

export function KeyboardShortcutsHelp() {
  const [isOpen, setIsOpen] = useState(false);

  const categories = Array.from(new Set(SHORTCUTS.map(s => s.category)));

  return (
    <>
      {/* Floating Help Button */}
      <button
        className="shortcuts-help-button"
        onClick={() => setIsOpen(true)}
        title="Keyboard Shortcuts (? key)"
        aria-label="Show keyboard shortcuts"
      >
        <span className="help-icon">⌨️</span>
        <span className="help-text">?</span>
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="shortcuts-modal-overlay" onClick={() => setIsOpen(false)}>
          <div className="shortcuts-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="shortcuts-modal-header">
              <h2>Keyboard Shortcuts</h2>
              <button
                className="shortcuts-modal-close"
                onClick={() => setIsOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="shortcuts-modal-body">
              {categories.map((category) => (
                <div key={category} className="shortcuts-category">
                  <h3>{category}</h3>
                  <div className="shortcuts-list">
                    {SHORTCUTS.filter(s => s.category === category).map((shortcut, idx) => (
                      <div key={idx} className="shortcut-item">
                        <kbd className="shortcut-keys">{shortcut.keys}</kbd>
                        <span className="shortcut-description">{shortcut.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <div className="shortcuts-note">
                <strong>Note:</strong> Shortcuts are disabled when typing in input fields.
              </div>
            </div>

            <div className="shortcuts-modal-footer">
              <button
                className="btn-close-modal"
                onClick={() => setIsOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .shortcuts-help-button {
          position: fixed;
          bottom: 2rem;
          right: 2rem;
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.25rem;
          font-size: 1.5rem;
          transition: all 0.3s;
          z-index: 1000;
        }

        .shortcuts-help-button:hover {
          transform: translateY(-2px) scale(1.05);
          box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
        }

        .shortcuts-help-button:active {
          transform: translateY(0) scale(1);
        }

        .help-icon {
          font-size: 1.2rem;
        }

        .help-text {
          font-weight: 700;
          font-size: 1.3rem;
        }

        .shortcuts-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          backdrop-filter: blur(4px);
          padding: 1rem;
          animation: fadeIn 0.2s ease-out;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .shortcuts-modal-content {
          background: white;
          border-radius: 16px;
          width: 100%;
          max-width: 600px;
          max-height: 85vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          animation: slideUp 0.3s ease-out;
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .shortcuts-modal-header {
          padding: 1.5rem;
          border-bottom: 2px solid #e1e8ed;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .shortcuts-modal-header h2 {
          margin: 0;
          font-size: 1.5rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .shortcuts-modal-close {
          background: rgba(255, 255, 255, 0.2);
          border: none;
          color: white;
          font-size: 1.5rem;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .shortcuts-modal-close:hover {
          background: rgba(255, 255, 255, 0.3);
          transform: rotate(90deg);
        }

        .shortcuts-modal-body {
          flex: 1;
          overflow-y: auto;
          padding: 1.5rem;
        }

        .shortcuts-category {
          margin-bottom: 2rem;
        }

        .shortcuts-category:last-of-type {
          margin-bottom: 1rem;
        }

        .shortcuts-category h3 {
          margin: 0 0 1rem 0;
          color: #2c3e50;
          font-size: 1.1rem;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .shortcuts-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .shortcut-item {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 0.75rem;
          background: #f8f9fa;
          border-radius: 8px;
          transition: all 0.2s;
        }

        .shortcut-item:hover {
          background: #e9ecef;
          transform: translateX(4px);
        }

        .shortcut-keys {
          background: white;
          border: 2px solid #d1d5db;
          border-radius: 6px;
          padding: 0.4rem 0.75rem;
          font-family: 'SF Mono', 'Monaco', 'Cascadia Code', 'Courier New', monospace;
          font-size: 0.875rem;
          font-weight: 600;
          color: #4a5568;
          box-shadow: 0 2px 0 #d1d5db;
          min-width: 140px;
          text-align: center;
          white-space: nowrap;
        }

        .shortcut-description {
          flex: 1;
          color: #4a5568;
          font-size: 0.95rem;
        }

        .shortcuts-note {
          margin-top: 1.5rem;
          padding: 1rem;
          background: #fffbeb;
          border-left: 4px solid #f59e0b;
          border-radius: 4px;
          font-size: 0.875rem;
          color: #92400e;
        }

        .shortcuts-note strong {
          color: #78350f;
        }

        .shortcuts-modal-footer {
          padding: 1rem 1.5rem;
          border-top: 2px solid #e1e8ed;
          display: flex;
          justify-content: flex-end;
        }

        .btn-close-modal {
          padding: 0.75rem 2rem;
          border: none;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          transition: all 0.2s;
        }

        .btn-close-modal:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }

        @media (max-width: 768px) {
          .shortcuts-help-button {
            width: 56px;
            height: 56px;
            bottom: 1.5rem;
            right: 1.5rem;
            font-size: 1.3rem;
          }

          .shortcuts-modal-content {
            max-width: 95%;
            max-height: 90vh;
          }

          .shortcut-keys {
            min-width: 120px;
            font-size: 0.8rem;
            padding: 0.35rem 0.6rem;
          }

          .shortcut-description {
            font-size: 0.9rem;
          }
        }
      `}</style>
    </>
  );
}
