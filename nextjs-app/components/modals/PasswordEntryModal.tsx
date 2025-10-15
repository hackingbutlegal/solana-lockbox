'use client';

import React, { useState, useEffect } from 'react';
import { PasswordEntry, PasswordEntryType } from '../../sdk/src/types-v2';
import { PasswordGeneratorModal } from './PasswordGeneratorModal';
import { PasswordGenerator } from '../../lib/password-generator';
import { useToast } from '../ui/Toast';
import { normalizeUrl, isValidUrl } from '../../lib/url-validation';
import { useCategory } from '../../contexts/CategoryContext';
import { CategoryManager } from '../../lib/category-manager';

interface PasswordEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (entry: PasswordEntry) => void;
  entry?: PasswordEntry | null;
  mode: 'create' | 'edit' | 'view';
  onDelete?: () => void;
}

export function PasswordEntryModal({
  isOpen,
  onClose,
  onSave,
  entry,
  mode,
  onDelete,
}: PasswordEntryModalProps) {
  const toast = useToast();
  const { categories } = useCategory();
  const [formData, setFormData] = useState<Partial<PasswordEntry> & {
    // Temporary fields to handle all entry types
    cardNumber?: string;
    cardHolder?: string;
    cardExpiry?: string;
    cardCvv?: string;
    billingAddress?: string;
    content?: string;
    fullName?: string;
    email?: string;
    phone?: string;
    dateOfBirth?: string;
    ssn?: string;
    passportNumber?: string;
    apiKey?: string;
    apiSecret?: string;
    apiEndpoint?: string;
    hostname?: string;
    port?: number;
    sshPrivateKey?: string;
    sshPublicKey?: string;
    passphrase?: string;
    walletName?: string;
    walletAddress?: string;
    privateKey?: string;
    seedPhrase?: string;
    network?: string;
  }>({
    title: '',
    username: '',
    password: '',
    url: '',
    notes: '',
    type: PasswordEntryType.Login,
    category: 0,
    totpSecret: '',
    email: '',
    phone: '',
    cardNumber: '',
    cardHolder: '',
    cardExpiry: '',
    cardCvv: '',
    billingAddress: '',
    content: '',
    fullName: '',
    dateOfBirth: '',
    ssn: '',
    passportNumber: '',
    apiKey: '',
    apiSecret: '',
    apiEndpoint: '',
    hostname: '',
    port: 22,
    sshPrivateKey: '',
    sshPublicKey: '',
    passphrase: '',
    walletName: '',
    walletAddress: '',
    privateKey: '',
    seedPhrase: '',
    network: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showGeneratorModal, setShowGeneratorModal] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(mode === 'create' || mode === 'edit');
  const [urlError, setUrlError] = useState<string>('');

  // Initialize form data when entry changes
  useEffect(() => {
    if (entry) {
      // Type-safe spreading - handle password field for LoginEntry
      const baseData: any = { ...entry };
      if ('password' in entry) {
        baseData.password = entry.password || '';
      }
      setFormData(baseData);
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
    const password = (formData as any).password;
    if (password && password.length > 0) {
      const strength = PasswordGenerator.assessStrength(password);
      setPasswordStrength(strength);
    } else {
      setPasswordStrength(null);
    }
  }, [(formData as any).password]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate title is always required
    if (!formData.title || formData.title.trim() === '') {
      toast.showError('Title is required');
      return;
    }

    // Build correctly-typed entry based on type
    let entry: PasswordEntry;

    const formAny = formData as any;

    switch (formData.type) {
      case PasswordEntryType.Login:
        if (!formAny.username || !formAny.password) {
          toast.showError('Username and password are required');
          return;
        }
        entry = {
          type: PasswordEntryType.Login,
          title: formData.title!,
          username: formAny.username,
          password: formAny.password,
          url: formAny.url,
          totpSecret: formAny.totpSecret,
          notes: formData.notes,
          category: formData.category,
          tags: formData.tags,
          id: formData.id,
          createdAt: formData.createdAt,
          lastModified: formData.lastModified,
          accessCount: formData.accessCount,
        };
        break;

      case PasswordEntryType.CreditCard:
        if (!formAny.cardNumber || !formAny.cardHolder || !formAny.cardExpiry || !formAny.cardCvv) {
          toast.showError('Card number, holder, expiry, and CVV are required');
          return;
        }
        entry = {
          type: PasswordEntryType.CreditCard,
          title: formData.title!,
          cardNumber: formAny.cardNumber,
          cardHolder: formAny.cardHolder,
          cardExpiry: formAny.cardExpiry,
          cardCvv: formAny.cardCvv,
          billingAddress: formAny.billingAddress,
          zipCode: formAny.phone,
          notes: formData.notes,
          category: formData.category,
          tags: formData.tags,
          id: formData.id,
          createdAt: formData.createdAt,
          lastModified: formData.lastModified,
          accessCount: formData.accessCount,
        };
        break;

      case PasswordEntryType.SecureNote:
        if (!formAny.content) {
          toast.showError('Note content is required');
          return;
        }
        entry = {
          type: PasswordEntryType.SecureNote,
          title: formData.title!,
          content: formAny.content,
          notes: formData.notes,
          category: formData.category,
          tags: formData.tags,
          id: formData.id,
          createdAt: formData.createdAt,
          lastModified: formData.lastModified,
          accessCount: formData.accessCount,
        };
        break;

      case PasswordEntryType.Identity:
        if (!formAny.fullName) {
          toast.showError('Full name is required');
          return;
        }
        entry = {
          type: PasswordEntryType.Identity,
          title: formData.title!,
          fullName: formAny.fullName,
          email: formAny.email,
          phone: formAny.phone,
          address: formAny.url,
          dateOfBirth: formAny.dateOfBirth,
          ssn: formAny.ssn,
          passportNumber: formAny.passportNumber,
          notes: formData.notes,
          category: formData.category,
          tags: formData.tags,
          id: formData.id,
          createdAt: formData.createdAt,
          lastModified: formData.lastModified,
          accessCount: formData.accessCount,
        };
        break;

      case PasswordEntryType.ApiKey:
        if (!formAny.apiKey) {
          toast.showError('API key is required');
          return;
        }
        entry = {
          type: PasswordEntryType.ApiKey,
          title: formData.title!,
          apiKey: formAny.apiKey,
          apiSecret: formAny.apiSecret,
          apiEndpoint: formAny.apiEndpoint,
          documentation: formAny.email,
          notes: formData.notes,
          category: formData.category,
          tags: formData.tags,
          id: formData.id,
          createdAt: formData.createdAt,
          lastModified: formData.lastModified,
          accessCount: formData.accessCount,
        };
        break;

      case PasswordEntryType.SshKey:
        if (!formAny.username || !formAny.hostname || !formAny.sshPrivateKey) {
          toast.showError('Username, hostname, and private key are required');
          return;
        }
        entry = {
          type: PasswordEntryType.SshKey,
          title: formData.title!,
          username: formAny.username,
          hostname: formAny.hostname,
          port: formAny.port,
          sshPublicKey: formAny.sshPublicKey,
          sshPrivateKey: formAny.sshPrivateKey,
          passphrase: formAny.passphrase,
          notes: formData.notes,
          category: formData.category,
          tags: formData.tags,
          id: formData.id,
          createdAt: formData.createdAt,
          lastModified: formData.lastModified,
          accessCount: formData.accessCount,
        };
        break;

      case PasswordEntryType.CryptoWallet:
        if (!formAny.walletName || !formAny.walletAddress) {
          toast.showError('Wallet name and address are required');
          return;
        }
        entry = {
          type: PasswordEntryType.CryptoWallet,
          title: formData.title!,
          walletName: formAny.walletName,
          walletAddress: formAny.walletAddress,
          privateKey: formAny.privateKey,
          seedPhrase: formAny.seedPhrase,
          network: formAny.network,
          notes: formData.notes,
          category: formData.category,
          tags: formData.tags,
          id: formData.id,
          createdAt: formData.createdAt,
          lastModified: formData.lastModified,
          accessCount: formData.accessCount,
        };
        break;

      default:
        toast.showError('Invalid entry type');
        return;
    }

    onSave(entry);
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.showSuccess(`${label} copied to clipboard!`);
    } catch (error) {
      console.error('Failed to copy:', error);
      toast.showError('Failed to copy to clipboard');
    }
  };

  // Handle URL blur - normalize and validate URL when user leaves the field
  const handleUrlBlur = (currentUrl: string) => {
    if (!currentUrl || currentUrl.trim() === '') {
      setUrlError('');
      return;
    }

    // Normalize URL (auto-prepend https:// if missing)
    const normalized = normalizeUrl(currentUrl);

    // Validate normalized URL
    if (isValidUrl(normalized)) {
      setFormData({ ...formData, url: normalized } as any);
      setUrlError('');
    } else {
      setUrlError('Please enter a valid URL (e.g., microsoft.com or https://example.com)');
    }
  };

  if (!isOpen) return null;

  // Cast for easier JSX field access across different entry types
  const formAny = formData as any;

  return (
    <>
      <div className="modal-overlay" onClick={onClose} style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        zIndex: 10000,  // Higher than reset modal (1000)
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        overflowY: 'auto'
      }}>
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
                  value={formData.title || ''}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., GitHub Account"
                  disabled={!isEditing}
                  required
                />
              </div>

              {/* LOGIN TYPE */}
              {formData.type === PasswordEntryType.Login && (
                <>
                  <div className="form-group">
                    <label>Username</label>
                    <div className="input-with-action">
                      <input
                        type="text"
                        value={formAny.username || ''}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value } as any)}
                        placeholder="username or email"
                        disabled={!isEditing}
                      />
                      {mode === 'view' && formAny.username && (
                        <button
                          type="button"
                          onClick={() => copyToClipboard(formAny.username!, 'Username')}
                          className="btn-copy-inline"
                        >
                          📋
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Password *</label>
                    <div className="password-input-group">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={formAny.password || ''}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value } as any)}
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
                      {mode === 'view' && formAny.password && (
                        <button
                          type="button"
                          onClick={() => copyToClipboard(formAny.password!, 'Password')}
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

                  <div className="form-group">
                    <label>Website URL</label>
                    <div className="input-with-action">
                      <input
                        type="text"
                        value={formAny.url || ''}
                        onChange={(e) => {
                          setFormData({ ...formData, url: e.target.value } as any);
                          setUrlError(''); // Clear error on change
                        }}
                        onBlur={(e) => handleUrlBlur(e.target.value)}
                        placeholder="microsoft.com or https://example.com"
                        disabled={!isEditing}
                      />
                      {mode === 'view' && formAny.url && (
                        <a
                          href={formAny.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-copy-inline"
                        >
                          🔗
                        </a>
                      )}
                    </div>
                    {urlError && isEditing && (
                      <p className="form-error">{urlError}</p>
                    )}
                  </div>

                  <div className="form-group">
                    <label>Email</label>
                    <input
                      type="email"
                      value={formData.email || ''}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="email@example.com"
                      disabled={!isEditing}
                    />
                  </div>

                  <div className="form-group">
                    <label>2FA Secret (TOTP)</label>
                    <input
                      type="text"
                      value={formData.totpSecret || ''}
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
                </>
              )}

              {/* CREDIT CARD TYPE */}
              {formData.type === PasswordEntryType.CreditCard && (
                <>
                  <div className="form-group">
                    <label>Cardholder Name *</label>
                    <input
                      type="text"
                      value={formData.cardHolder || ''}
                      onChange={(e) => setFormData({ ...formData, cardHolder: e.target.value })}
                      placeholder="John Doe"
                      disabled={!isEditing}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Card Number *</label>
                    <div className="input-with-action">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={formData.cardNumber || ''}
                        onChange={(e) => setFormData({ ...formData, cardNumber: e.target.value })}
                        placeholder="4111 1111 1111 1111"
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
                      {mode === 'view' && formData.cardNumber && (
                        <button
                          type="button"
                          onClick={() => copyToClipboard(formData.cardNumber!, 'Card Number')}
                          className="btn-copy-inline"
                        >
                          📋
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="form-group">
                    <label>CVV *</label>
                    <input
                      type="text"
                      value={formData.cardCvv || ''}
                      onChange={(e) => setFormData({ ...formData, cardCvv: e.target.value })}
                      placeholder="123"
                      maxLength={4}
                      disabled={!isEditing}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Expiration Date *</label>
                    <input
                      type="text"
                      value={formData.cardExpiry || ''}
                      onChange={(e) => setFormData({ ...formData, cardExpiry: e.target.value })}
                      placeholder="MM/YY"
                      disabled={!isEditing}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Billing Address</label>
                    <input
                      type="text"
                      value={formData.billingAddress || ''}
                      onChange={(e) => setFormData({ ...formData, billingAddress: e.target.value })}
                      placeholder="123 Main St, City, State, ZIP"
                      disabled={!isEditing}
                    />
                  </div>

                  <div className="form-group">
                    <label>ZIP Code</label>
                    <input
                      type="text"
                      value={formData.phone || ''}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="12345"
                      disabled={!isEditing}
                    />
                  </div>
                </>
              )}

              {/* SECURE NOTE TYPE */}
              {formData.type === PasswordEntryType.SecureNote && (
                <>
                  <div className="form-group">
                    <label>Note Content *</label>
                    <textarea
                      value={formData.content || ''}
                      onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                      placeholder="Enter your secure note..."
                      rows={10}
                      disabled={!isEditing}
                      required
                      style={{ minHeight: '200px' }}
                    />
                  </div>
                </>
              )}

              {/* IDENTITY TYPE */}
              {formData.type === PasswordEntryType.Identity && (
                <>
                  <div className="form-group">
                    <label>Full Name *</label>
                    <input
                      type="text"
                      value={formData.fullName || ''}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      placeholder="John Doe"
                      disabled={!isEditing}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Email</label>
                    <input
                      type="email"
                      value={formData.email || ''}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="email@example.com"
                      disabled={!isEditing}
                    />
                  </div>

                  <div className="form-group">
                    <label>Phone</label>
                    <input
                      type="tel"
                      value={formData.phone || ''}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+1 234 567 8900"
                      disabled={!isEditing}
                    />
                  </div>

                  <div className="form-group">
                    <label>Address</label>
                    <input
                      type="text"
                      value={formAny.url || ''}
                      onChange={(e) => setFormData({ ...formData, url: e.target.value } as any)}
                      placeholder="123 Main St, City, State, ZIP"
                      disabled={!isEditing}
                    />
                  </div>

                  <div className="form-group">
                    <label>Date of Birth</label>
                    <input
                      type="text"
                      value={formData.dateOfBirth || ''}
                      onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                      placeholder="MM/DD/YYYY"
                      disabled={!isEditing}
                    />
                  </div>

                  <div className="form-group">
                    <label>SSN / ID Number</label>
                    <div className="input-with-action">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={formData.ssn || ''}
                        onChange={(e) => setFormData({ ...formData, ssn: e.target.value })}
                        placeholder="XXX-XX-XXXX"
                        disabled={!isEditing}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="btn-toggle-password"
                      >
                        {showPassword ? '🙈' : '👁️'}
                      </button>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Passport Number</label>
                    <input
                      type="text"
                      value={formData.passportNumber || ''}
                      onChange={(e) => setFormData({ ...formData, passportNumber: e.target.value })}
                      placeholder="123456789"
                      disabled={!isEditing}
                    />
                  </div>
                </>
              )}

              {/* API KEY TYPE */}
              {formData.type === PasswordEntryType.ApiKey && (
                <>
                  <div className="form-group">
                    <label>API Key *</label>
                    <div className="input-with-action">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={formData.apiKey || ''}
                        onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                        placeholder="sk_live_..."
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
                      {mode === 'view' && formData.apiKey && (
                        <button
                          type="button"
                          onClick={() => copyToClipboard(formData.apiKey!, 'API Key')}
                          className="btn-copy-inline"
                        >
                          📋
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="form-group">
                    <label>API Secret</label>
                    <div className="input-with-action">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={formData.apiSecret || ''}
                        onChange={(e) => setFormData({ ...formData, apiSecret: e.target.value })}
                        placeholder="Secret key..."
                        disabled={!isEditing}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="btn-toggle-password"
                      >
                        {showPassword ? '🙈' : '👁️'}
                      </button>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>API Endpoint</label>
                    <input
                      type="text"
                      value={formData.apiEndpoint || ''}
                      onChange={(e) => {
                        setFormData({ ...formData, apiEndpoint: e.target.value });
                        setUrlError('');
                      }}
                      onBlur={(e) => handleUrlBlur(e.target.value)}
                      placeholder="api.example.com or https://api.example.com"
                      disabled={!isEditing}
                    />
                    {urlError && isEditing && (
                      <p className="form-error">{urlError}</p>
                    )}
                  </div>

                  <div className="form-group">
                    <label>API Documentation</label>
                    <input
                      type="text"
                      value={formData.email || ''}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="docs.example.com or https://docs.example.com"
                      disabled={!isEditing}
                    />
                  </div>
                </>
              )}

              {/* SSH KEY TYPE */}
              {formData.type === PasswordEntryType.SshKey && (
                <>
                  <div className="form-group">
                    <label>Username *</label>
                    <input
                      type="text"
                      value={formAny.username || ''}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value } as any)}
                      placeholder="root or ubuntu"
                      disabled={!isEditing}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Hostname *</label>
                    <input
                      type="text"
                      value={formData.hostname || ''}
                      onChange={(e) => setFormData({ ...formData, hostname: e.target.value })}
                      placeholder="example.com or 192.168.1.1"
                      disabled={!isEditing}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Port</label>
                    <input
                      type="number"
                      value={formData.port || 22}
                      onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
                      placeholder="22"
                      disabled={!isEditing}
                    />
                  </div>

                  <div className="form-group">
                    <label>Private Key *</label>
                    <textarea
                      value={formData.sshPrivateKey || ''}
                      onChange={(e) => setFormData({ ...formData, sshPrivateKey: e.target.value })}
                      placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;...&#10;-----END OPENSSH PRIVATE KEY-----"
                      rows={8}
                      disabled={!isEditing}
                      required
                      style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                    />
                  </div>

                  <div className="form-group">
                    <label>Public Key</label>
                    <textarea
                      value={formData.sshPublicKey || ''}
                      onChange={(e) => setFormData({ ...formData, sshPublicKey: e.target.value })}
                      placeholder="ssh-rsa AAAA..."
                      rows={3}
                      disabled={!isEditing}
                      style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                    />
                  </div>

                  <div className="form-group">
                    <label>Passphrase</label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formData.passphrase || ''}
                      onChange={(e) => setFormData({ ...formData, passphrase: e.target.value })}
                      placeholder="Optional passphrase"
                      disabled={!isEditing}
                    />
                  </div>
                </>
              )}

              {/* CRYPTO WALLET TYPE */}
              {formData.type === PasswordEntryType.CryptoWallet && (
                <>
                  <div className="form-group">
                    <label>Wallet Name *</label>
                    <input
                      type="text"
                      value={formData.walletName || ''}
                      onChange={(e) => setFormData({ ...formData, walletName: e.target.value })}
                      placeholder="My Bitcoin Wallet"
                      disabled={!isEditing}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Wallet Address *</label>
                    <div className="input-with-action">
                      <input
                        type="text"
                        value={formData.walletAddress || ''}
                        onChange={(e) => setFormData({ ...formData, walletAddress: e.target.value })}
                        placeholder="0x... or 1A1zP1..."
                        disabled={!isEditing}
                        required
                      />
                      {mode === 'view' && formData.walletAddress && (
                        <button
                          type="button"
                          onClick={() => copyToClipboard(formData.walletAddress!, 'Address')}
                          className="btn-copy-inline"
                        >
                          📋
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Seed Phrase</label>
                    <div className="input-with-action">
                      <textarea
                        value={formData.seedPhrase || ''}
                        onChange={(e) => setFormData({ ...formData, seedPhrase: e.target.value })}
                        placeholder="word1 word2 word3 ... word12"
                        rows={4}
                        disabled={!isEditing}
                        style={{ flex: 1 }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="btn-toggle-password"
                      >
                        {showPassword ? '🙈' : '👁️'}
                      </button>
                      {mode === 'view' && formData.seedPhrase && (
                        <button
                          type="button"
                          onClick={() => copyToClipboard(formData.seedPhrase!, 'Seed Phrase')}
                          className="btn-copy-inline"
                        >
                          📋
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Private Key</label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formData.privateKey || ''}
                      onChange={(e) => setFormData({ ...formData, privateKey: e.target.value })}
                      placeholder="Optional private key"
                      disabled={!isEditing}
                    />
                  </div>

                  <div className="form-group">
                    <label>Blockchain / Network</label>
                    <input
                      type="text"
                      value={formData.network || ''}
                      onChange={(e) => setFormData({ ...formData, network: e.target.value })}
                      placeholder="Bitcoin, Ethereum, Solana, etc."
                      disabled={!isEditing}
                    />
                  </div>
                </>
              )}

              {/* Category - Show for all types */}
              <div className="form-group">
                <label>Category (Optional)</label>
                <select
                  value={formData.category || 0}
                  onChange={(e) => setFormData({ ...formData, category: parseInt(e.target.value) })}
                  disabled={!isEditing}
                >
                  <option value={0}>Uncategorized</option>
                  {categories.map((cat) => {
                    const icon = CategoryManager.getIcon(cat.icon);
                    return (
                      <option key={cat.id} value={cat.id}>
                        {icon} {cat.name}
                      </option>
                    );
                  })}
                </select>
                {categories.length === 0 && isEditing && (
                  <p className="form-hint">
                    💡 Create categories from the Categories menu to organize your passwords
                  </p>
                )}
              </div>

              {/* Notes - Show for all types except Secure Note (which has its own content field) */}
              {formData.type !== PasswordEntryType.SecureNote && (
                <div className="form-group">
                  <label>Notes</label>
                  <textarea
                    value={formData.notes || ''}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Additional notes..."
                    rows={4}
                    disabled={!isEditing}
                  />
                </div>
              )}
            </div>

            <div className="modal-footer">
              {mode === 'view' ? (
                <>
                  <button type="button" onClick={onClose} className="btn-secondary">
                    Close
                  </button>
                  {onDelete && (
                    <button
                      type="button"
                      onClick={onDelete}
                      className="btn-danger"
                    >
                      Delete
                    </button>
                  )}
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

            .form-error {
              margin: 0.5rem 0 0 0;
              font-size: 0.85rem;
              color: #e74c3c;
              font-weight: 500;
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

            .btn-danger {
              flex: 1;
              padding: 0.875rem;
              border: none;
              border-radius: 8px;
              font-size: 1rem;
              font-weight: 600;
              cursor: pointer;
              transition: all 0.2s;
              background: #fee;
              color: #e74c3c;
            }

            .btn-danger:hover {
              background: #fcc;
              transform: translateY(-1px);
              box-shadow: 0 4px 12px rgba(231, 76, 60, 0.3);
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
