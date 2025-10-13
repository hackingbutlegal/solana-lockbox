'use client';

import React, { useState, useEffect } from 'react';
import { PasswordGenerator } from '../lib/password-generator';

interface PasswordGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (password: string) => void;
}

export function PasswordGeneratorModal({ isOpen, onClose, onSelect }: PasswordGeneratorModalProps) {
  const [password, setPassword] = useState('');
  const [strength, setStrength] = useState<any>(null);
  const [options, setOptions] = useState({
    length: 16,
    includeUppercase: true,
    includeLowercase: true,
    includeNumbers: true,
    includeSymbols: true,
    excludeAmbiguous: true,
  });
  const [mode, setMode] = useState<'password' | 'passphrase'>('password');

  // Generate password on mount and options change
  useEffect(() => {
    if (isOpen) {
      generatePassword();
    }
  }, [isOpen, options, mode]);

  const generatePassword = () => {
    try {
      const newPassword =
        mode === 'password'
          ? PasswordGenerator.generate(options)
          : PasswordGenerator.generatePassphrase(4, '-', true);

      setPassword(newPassword);
      const passwordStrength = PasswordGenerator.assessStrength(newPassword);
      setStrength(passwordStrength);
    } catch (error) {
      console.error('Failed to generate password:', error);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(password);
      alert('Password copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleSelect = () => {
    onSelect(password);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Password Generator</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          {/* Mode Toggle */}
          <div className="mode-toggle">
            <button
              className={mode === 'password' ? 'active' : ''}
              onClick={() => setMode('password')}
            >
              Password
            </button>
            <button
              className={mode === 'passphrase' ? 'active' : ''}
              onClick={() => setMode('passphrase')}
            >
              Passphrase
            </button>
          </div>

          {/* Generated Password Display */}
          <div className="password-display">
            <div className="password-text">{password}</div>
            <div className="password-actions">
              <button onClick={generatePassword} className="btn-regenerate">
                🔄 Regenerate
              </button>
              <button onClick={copyToClipboard} className="btn-copy">
                📋 Copy
              </button>
            </div>
          </div>

          {/* Strength Indicator */}
          {strength && (
            <div className="strength-indicator">
              <div className="strength-bar-container">
                <div
                  className={`strength-bar strength-${strength.score}`}
                  style={{ width: `${(strength.score / 5) * 100}%` }}
                />
              </div>
              <div className="strength-info">
                <span className="strength-label">{strength.label}</span>
                <span className="strength-entropy">{strength.entropy.toFixed(1)} bits</span>
              </div>
              {strength.suggestions.length > 0 && (
                <ul className="strength-suggestions">
                  {strength.suggestions.slice(0, 3).map((suggestion: string, i: number) => (
                    <li key={i}>{suggestion}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Options (only for password mode) */}
          {mode === 'password' && (
            <div className="generator-options">
              <h3>Options</h3>

              <div className="option-row">
                <label>
                  Length: {options.length}
                  <input
                    type="range"
                    min="8"
                    max="64"
                    value={options.length}
                    onChange={(e) =>
                      setOptions({ ...options, length: parseInt(e.target.value) })
                    }
                  />
                </label>
              </div>

              <div className="option-row">
                <label>
                  <input
                    type="checkbox"
                    checked={options.includeUppercase}
                    onChange={(e) =>
                      setOptions({ ...options, includeUppercase: e.target.checked })
                    }
                  />
                  Uppercase (A-Z)
                </label>
              </div>

              <div className="option-row">
                <label>
                  <input
                    type="checkbox"
                    checked={options.includeLowercase}
                    onChange={(e) =>
                      setOptions({ ...options, includeLowercase: e.target.checked })
                    }
                  />
                  Lowercase (a-z)
                </label>
              </div>

              <div className="option-row">
                <label>
                  <input
                    type="checkbox"
                    checked={options.includeNumbers}
                    onChange={(e) =>
                      setOptions({ ...options, includeNumbers: e.target.checked })
                    }
                  />
                  Numbers (0-9)
                </label>
              </div>

              <div className="option-row">
                <label>
                  <input
                    type="checkbox"
                    checked={options.includeSymbols}
                    onChange={(e) =>
                      setOptions({ ...options, includeSymbols: e.target.checked })
                    }
                  />
                  Symbols (!@#$...)
                </label>
              </div>

              <div className="option-row">
                <label>
                  <input
                    type="checkbox"
                    checked={options.excludeAmbiguous}
                    onChange={(e) =>
                      setOptions({ ...options, excludeAmbiguous: e.target.checked })
                    }
                  />
                  Exclude Ambiguous (0, O, 1, l, I)
                </label>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button onClick={handleSelect} className="btn-primary">
            Use This Password
          </button>
        </div>

        <style jsx>{`
          .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            padding: 1rem;
          }

          .modal-content {
            background: white;
            border-radius: 16px;
            width: 100%;
            max-width: 600px;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          }

          .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1.5rem;
            border-bottom: 1px solid #e1e8ed;
          }

          .modal-header h2 {
            margin: 0;
            color: #2c3e50;
            font-size: 1.5rem;
          }

          .modal-close {
            background: none;
            border: none;
            font-size: 2rem;
            color: #7f8c8d;
            cursor: pointer;
            line-height: 1;
            padding: 0;
            width: 32px;
            height: 32px;
          }

          .modal-body {
            padding: 1.5rem;
          }

          .mode-toggle {
            display: flex;
            gap: 0.5rem;
            margin-bottom: 1.5rem;
          }

          .mode-toggle button {
            flex: 1;
            padding: 0.75rem;
            border: 1px solid #e1e8ed;
            background: white;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s;
          }

          .mode-toggle button.active {
            background: #667eea;
            color: white;
            border-color: #667eea;
          }

          .password-display {
            background: #f8f9fa;
            border-radius: 12px;
            padding: 1.5rem;
            margin-bottom: 1.5rem;
          }

          .password-text {
            font-family: 'Courier New', monospace;
            font-size: 1.2rem;
            word-break: break-all;
            color: #2c3e50;
            margin-bottom: 1rem;
            font-weight: 600;
            letter-spacing: 1px;
          }

          .password-actions {
            display: flex;
            gap: 0.5rem;
          }

          .btn-regenerate,
          .btn-copy {
            flex: 1;
            padding: 0.75rem;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.2s;
          }

          .btn-regenerate {
            background: #667eea;
            color: white;
          }

          .btn-regenerate:hover {
            background: #5568d3;
          }

          .btn-copy {
            background: white;
            color: #667eea;
            border: 1px solid #667eea;
          }

          .btn-copy:hover {
            background: #f8f9fa;
          }

          .strength-indicator {
            background: white;
            border: 1px solid #e1e8ed;
            border-radius: 12px;
            padding: 1rem;
            margin-bottom: 1.5rem;
          }

          .strength-bar-container {
            height: 8px;
            background: #e1e8ed;
            border-radius: 4px;
            overflow: hidden;
            margin-bottom: 0.75rem;
          }

          .strength-bar {
            height: 100%;
            transition: all 0.3s;
            border-radius: 4px;
          }

          .strength-bar.strength-0,
          .strength-bar.strength-1 {
            background: #e74c3c;
          }

          .strength-bar.strength-2 {
            background: #f39c12;
          }

          .strength-bar.strength-3 {
            background: #f1c40f;
          }

          .strength-bar.strength-4 {
            background: #2ecc71;
          }

          .strength-bar.strength-5 {
            background: #27ae60;
          }

          .strength-info {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 0.5rem;
          }

          .strength-label {
            font-weight: 600;
            color: #2c3e50;
          }

          .strength-entropy {
            font-size: 0.9rem;
            color: #7f8c8d;
          }

          .strength-suggestions {
            list-style: none;
            padding: 0;
            margin: 0.5rem 0 0 0;
          }

          .strength-suggestions li {
            padding: 0.25rem 0;
            font-size: 0.9rem;
            color: #7f8c8d;
          }

          .generator-options {
            background: white;
            border: 1px solid #e1e8ed;
            border-radius: 12px;
            padding: 1rem;
          }

          .generator-options h3 {
            margin: 0 0 1rem 0;
            color: #2c3e50;
            font-size: 1.1rem;
          }

          .option-row {
            margin-bottom: 1rem;
          }

          .option-row:last-child {
            margin-bottom: 0;
          }

          .option-row label {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            color: #2c3e50;
            cursor: pointer;
          }

          .option-row input[type='checkbox'] {
            width: 18px;
            height: 18px;
            cursor: pointer;
          }

          .option-row input[type='range'] {
            flex: 1;
            margin-left: 0.5rem;
          }

          .modal-footer {
            display: flex;
            gap: 0.75rem;
            padding: 1.5rem;
            border-top: 1px solid #e1e8ed;
          }

          .btn-secondary,
          .btn-primary {
            flex: 1;
            padding: 0.875rem;
            border: none;
            border-radius: 8px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
          }

          .btn-secondary {
            background: #f8f9fa;
            color: #2c3e50;
          }

          .btn-secondary:hover {
            background: #e1e8ed;
          }

          .btn-primary {
            background: #667eea;
            color: white;
          }

          .btn-primary:hover {
            background: #5568d3;
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
          }

          @media (max-width: 768px) {
            .modal-content {
              max-width: 100%;
              margin: 0.5rem;
            }

            .password-text {
              font-size: 1rem;
            }
          }
        `}</style>
      </div>
    </div>
  );
}
