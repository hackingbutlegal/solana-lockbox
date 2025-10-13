'use client';

import React, { useState, useEffect } from 'react';
import { PasswordEntry, PasswordEntryType } from '../sdk/src/types-v2';
import { PasswordGeneratorModal } from './PasswordGeneratorModal';
import { PasswordGenerator } from '../lib/password-generator';

interface PasswordEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (entry: PasswordEntry) => void;
  entry?: PasswordEntry | null;
  mode: 'create' | 'edit' | 'view';
}

export function PasswordEntryModal({
  isOpen,
  onClose,
  onSave,
  entry,
  mode,
}: PasswordEntryModalProps) {
  const [formData, setFormData] = useState<Partial<PasswordEntry>>({
    title: '',
    username: '',
    password: '',
    url: '',
    notes: '',
    type: PasswordEntryType.Login,
    category: 0,
    email: '',
    phone: '',
    totpSecret: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showGeneratorModal, setShowGeneratorModal] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(mode === 'create' || mode === 'edit');

  // Initialize form data when entry changes
  useEffect(() => {
    if (entry) {
      setFormData({
        ...entry,
        password: entry.password || '',
      });
    } else {
      setFormData({
        title: '',
        username: '',
        password: '',
        url: '',
        notes: '',
        type: PasswordEntryType.Login,
        category: 0,
        email: '',
        phone: '',
        totpSecret: '',
      });
    }
    setIsEditing(mode === 'create' || mode === 'edit');
  }, [entry, mode, isOpen]);

  // Assess password strength on change
  useEffect(() => {
    if (formData.password && formData.password.length > 0) {
      const strength = PasswordGenerator.assessStrength(formData.password);
      setPasswordStrength(strength);
    } else {
      setPasswordStrength(null);
    }
  }, [formData.password]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title || !formData.password) {
      alert('Title and password are required');
      return;
    }

    onSave(formData as PasswordEntry);
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert(`${label} copied to clipboard!`);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content password-entry-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>
              {mode === 'create' && '🔐 New Password'}
              {mode === 'edit' && '✏️ Edit Password'}
              {mode === 'view' && '👁️ View Password'}
            </h2>
            <button className="modal-close" onClick={onClose}>
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              {/* Entry Type */}
              <div className="form-group">
                <label>Type</label>
                <select
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({ ...formData, type: parseInt(e.target.value) as PasswordEntryType })
                  }
                  disabled={!isEditing}
                  required
                >
                  <option value={PasswordEntryType.Login}>Login</option>
                  <option value={PasswordEntryType.CreditCard}>Credit Card</option>
                  <option value={PasswordEntryType.SecureNote}>Secure Note</option>
                  <option value={PasswordEntryType.Identity}>Identity</option>
                  <option value={PasswordEntryType.ApiKey}>API Key</option>
                  <option value={PasswordEntryType.SshKey}>SSH Key</option>
                  <option value={PasswordEntryType.CryptoWallet}>Crypto Wallet</option>
                </select>
              </div>

              {/* Title */}
              <div className="form-group">
                <label>Title *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., GitHub Account"
                  disabled={!isEditing}
                  required
                />
              </div>

              {/* Username */}
              <div className="form-group">
                <label>Username</label>
                <div className="input-with-action">
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="username or email"
                    disabled={!isEditing}
                  />
                  {mode === 'view' && formData.username && (
                    <button
                      type="button"
                      onClick={() => copyToClipboard(formData.username!, 'Username')}
                      className="btn-copy-inline"
                    >
                      📋
                    </button>
                  )}
                </div>
              </div>

              {/* Password */}
              <div className="form-group">
                <label>Password *</label>
                <div className="password-input-group">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Enter password"
                    disabled={!isEditing}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="btn-toggle-password"
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                  {mode === 'view' && formData.password && (
                    <button
                      type="button"
                      onClick={() => copyToClipboard(formData.password!, 'Password')}
                      className="btn-copy-inline"
                    >
                      📋
                    </button>
                  )}
                  {isEditing && (
                    <button
                      type="button"
                      onClick={() => setShowGeneratorModal(true)}
                      className="btn-generate"
                    >
                      🎲 Generate
                    </button>
                  )}
                </div>

                {/* Password Strength */}
                {passwordStrength && (
                  <div className="password-strength">
                    <div className="strength-bar-container">
                      <div
                        className={`strength-bar strength-${passwordStrength.score}`}
                        style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                      />
                    </div>
                    <div className="strength-label">
                      {passwordStrength.label} ({passwordStrength.entropy.toFixed(0)} bits)
                    </div>
                  </div>
                )}
              </div>

              {/* URL */}
              <div className="form-group">
                <label>Website URL</label>
                <div className="input-with-action">
                  <input
                    type="url"
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    placeholder="https://example.com"
                    disabled={!isEditing}
                  />
                  {mode === 'view' && formData.url && (
                    <a
                      href={formData.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-copy-inline"
                    >
                      🔗
                    </a>
                  )}
                </div>
              </div>

              {/* Email */}
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@example.com"
                  disabled={!isEditing}
                />
              </div>

              {/* Phone */}
              <div className="form-group">
                <label>Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+1 234 567 8900"
                  disabled={!isEditing}
                />
              </div>

              {/* TOTP Secret */}
              <div className="form-group">
                <label>2FA Secret (TOTP)</label>
                <input
                  type="text"
                  value={formData.totpSecret}
                  onChange={(e) => setFormData({ ...formData, totpSecret: e.target.value })}
                  placeholder="Base32-encoded secret"
                  disabled={!isEditing}
                />
                {formData.totpSecret && (
                  <p className="form-hint">
                    💡 This will enable 2FA code generation for this entry
                  </p>
                )}
              </div>

              {/* Category */}
              <div className="form-group">
                <label>Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: parseInt(e.target.value) })}
                  disabled={!isEditing}
                >
                  <option value={0}>Personal</option>
                  <option value={1}>Work</option>
                  <option value={2}>Financial</option>
                  <option value={3}>Social</option>
                  <option value={4}>Shopping</option>
                  <option value={5}>Entertainment</option>
                  <option value={6}>Development</option>
                  <option value={7}>Education</option>
                </select>
              </div>

              {/* Notes */}
              <div className="form-group">
                <label>Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional notes..."
                  rows={4}
                  disabled={!isEditing}
                />
              </div>
            </div>

            <div className="modal-footer">
              {mode === 'view' ? (
                <>
                  <button type="button" onClick={onClose} className="btn-secondary">
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="btn-primary"
                  >
                    Edit
                  </button>
                </>
              ) : (
                <>
                  <button type="button" onClick={onClose} className="btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    {mode === 'create' ? 'Create' : 'Save Changes'}
                  </button>
                </>
              )}
            </div>
          </form>

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
              overflow-y: auto;
            }

            .modal-content {
              background: white;
              border-radius: 16px;
              width: 100%;
              max-width: 600px;
              max-height: 90vh;
              overflow-y: auto;
              box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
              margin: auto;
            }

            .password-entry-modal {
              max-width: 700px;
            }

            .modal-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 1.5rem;
              border-bottom: 1px solid #e1e8ed;
              position: sticky;
              top: 0;
              background: white;
              z-index: 10;
              border-radius: 16px 16px 0 0;
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

            .form-group {
              margin-bottom: 1.5rem;
            }

            .form-group label {
              display: block;
              margin-bottom: 0.5rem;
              color: #2c3e50;
              font-weight: 600;
              font-size: 0.95rem;
            }

            .form-group input,
            .form-group select,
            .form-group textarea {
              width: 100%;
              padding: 0.75rem;
              border: 1px solid #e1e8ed;
              border-radius: 8px;
              font-size: 1rem;
              font-family: inherit;
              transition: border-color 0.2s;
            }

            .form-group input:focus,
            .form-group select:focus,
            .form-group textarea:focus {
              outline: none;
              border-color: #667eea;
            }

            .form-group input:disabled,
            .form-group select:disabled,
            .form-group textarea:disabled {
              background: #f8f9fa;
              cursor: not-allowed;
            }

            .input-with-action {
              display: flex;
              gap: 0.5rem;
            }

            .input-with-action input {
              flex: 1;
            }

            .password-input-group {
              display: flex;
              gap: 0.5rem;
            }

            .password-input-group input {
              flex: 1;
            }

            .btn-toggle-password,
            .btn-copy-inline,
            .btn-generate {
              padding: 0.75rem;
              border: 1px solid #e1e8ed;
              border-radius: 8px;
              background: white;
              cursor: pointer;
              transition: all 0.2s;
              font-size: 1rem;
            }

            .btn-toggle-password:hover,
            .btn-copy-inline:hover {
              background: #f8f9fa;
              border-color: #667eea;
            }

            .btn-generate {
              white-space: nowrap;
              font-weight: 600;
              color: #667eea;
            }

            .btn-generate:hover {
              background: #667eea;
              color: white;
            }

            .password-strength {
              margin-top: 0.5rem;
            }

            .strength-bar-container {
              height: 6px;
              background: #e1e8ed;
              border-radius: 3px;
              overflow: hidden;
              margin-bottom: 0.5rem;
            }

            .strength-bar {
              height: 100%;
              transition: all 0.3s;
              border-radius: 3px;
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

            .strength-label {
              font-size: 0.85rem;
              color: #7f8c8d;
            }

            .form-hint {
              margin: 0.5rem 0 0 0;
              font-size: 0.85rem;
              color: #7f8c8d;
            }

            .modal-footer {
              display: flex;
              gap: 0.75rem;
              padding: 1.5rem;
              border-top: 1px solid #e1e8ed;
              position: sticky;
              bottom: 0;
              background: white;
              border-radius: 0 0 16px 16px;
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
                margin: 0;
                max-height: 100vh;
                border-radius: 0;
              }

              .modal-header,
              .modal-footer {
                border-radius: 0;
              }

              .password-input-group {
                flex-wrap: wrap;
              }

              .btn-generate {
                flex: 1 0 100%;
              }
            }
          `}</style>
        </div>
      </div>

      {/* Password Generator Modal */}
      <PasswordGeneratorModal
        isOpen={showGeneratorModal}
        onClose={() => setShowGeneratorModal(false)}
        onSelect={(password) => {
          setFormData({ ...formData, password });
          setShowGeneratorModal(false);
        }}
      />
    </>
  );
}
